"""Generate the aggregate research artifacts consumed by the frontend.

Produces, for the active Triagegeist model:

* ``reports/model_evaluation.json``    - holdout + grouped-CV metrics
* ``reports/data_quality_report.json`` - dataset profile and missingness
* ``reports/global_shap.json``         - global mean |SHAP| importance
* ``reports/evaluation_errors.json``   - out-of-fold error records

Every artifact is aggregate-only: no patient identifiers, no chief-complaint
free text and no raw clinical rows are written. Run from the project root:

    venv/bin/python -m backend.ml.build_reports
"""

from __future__ import annotations

import argparse
import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from backend.ml import config, evaluate, explain, splitting, triagegeist_schema
from backend.ml.triagegeist_loader import load_all
from backend.ml.triagegeist_preprocessing import (
    build_feature_frame,
    build_preprocessor_for_frame,
)
from backend.ml.triagegeist_training import build_random_forest_pipeline

log = logging.getLogger("medguard.build_reports")


def _write_json(payload: dict[str, Any], path: Path, *, compact: bool = False) -> None:
    """Write a JSON artifact.

    ``compact`` drops the indentation. It is used for the per-record error
    file, which holds one entry per out-of-fold prediction: the indentation
    alone would add ~6 MB to a file the frontend imports statically.
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    if compact:
        text = json.dumps(payload, separators=(",", ":"))
    else:
        text = json.dumps(payload, indent=2)
    path.write_text(text, encoding="utf-8")
    log.info("Wrote %s", path)


def _missing_percent(frame: pd.DataFrame, columns: list[str]) -> dict[str, float]:
    total = max(len(frame), 1)
    return {
        column: round(float(frame[column].isna().sum()) / total * 100.0, 2)
        for column in columns
        if column in frame.columns
    }


def _feature_stats(frame: pd.DataFrame, columns: list[str]) -> dict[str, dict[str, float]]:
    stats: dict[str, dict[str, float]] = {}
    for column in columns:
        if column not in frame.columns:
            continue
        values = pd.to_numeric(frame[column], errors="coerce").dropna()
        if values.empty:
            stats[column] = {"n_valid": 0.0}
            continue
        stats[column] = {
            "n_valid": float(len(values)),
            "min": float(values.min()),
            "p25": float(values.quantile(0.25)),
            "median": float(values.median()),
            "p75": float(values.quantile(0.75)),
            "max": float(values.max()),
            "mean": float(values.mean()),
        }
    return stats


def build_data_quality_report(frame: pd.DataFrame) -> dict[str, Any]:
    """Dataset profile, missingness and feature statistics (aggregate only)."""
    labels = frame[config.TARGET_COLUMN].value_counts().sort_index()
    row_counts = {
        "modelling_rows": int(len(frame)),
        "modelling_patients": int(frame[config.SUBJECT_ID_COLUMN].nunique()),
        "train_rows": 0,
        "test_rows": 0,
        "train_patients": 0,
        "test_patients": 0,
    }
    return {
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "dataset": {
            "name": "Triagegeist",
            "version": "synthetic",
            "variant": "train split",
            "license": "Non-commercial research (Kaggle competition terms)",
        },
        "target": {
            "column": config.TARGET_COLUMN,
            "labels": list(config.ESI_LABELS),
            "label_meaning": "original five-level ESI acuity, preserved as-is",
        },
        "random_seed": config.RANDOM_SEED,
        "row_counts": row_counts,
        "label_distribution": {f"ESI {int(k)}": int(v) for k, v in labels.items()},
        "missing_percent": _missing_percent(
            frame, list(triagegeist_schema.NUMERIC_FEATURE_COLUMNS)
        ),
        "feature_stats": _feature_stats(
            frame,
            [
                "temperature_c",
                "heart_rate",
                "respiratory_rate",
                "spo2",
                "systolic_bp",
                "diastolic_bp",
                "pain_score",
                "shock_index",
                "pulse_pressure",
                "age",
                "gcs_total",
            ],
        ),
    }



def build_training_stats(frame: pd.DataFrame) -> dict[str, Any]:
    """Per-feature training distribution used for input-quality checks.

    Aggregate statistics only: counts, mean, standard deviation and range for
    numeric features, and observed value frequencies for categorical features.
    """
    numeric: dict[str, Any] = {}
    for column in triagegeist_schema.NUMERIC_FEATURE_COLUMNS:
        if column not in frame.columns:
            continue
        values = pd.to_numeric(frame[column], errors="coerce").dropna()
        if values.empty:
            continue
        numeric[column] = {
            "count": int(len(values)),
            "mean": float(values.mean()),
            "std": float(values.std(ddof=0)),
            "min": float(values.min()),
            "max": float(values.max()),
        }

    categorical: dict[str, Any] = {}
    for column in triagegeist_schema.CATEGORICAL_FEATURE_COLUMNS:
        if column not in frame.columns:
            continue
        counts = frame[column].astype(str).str.strip().str.upper().value_counts()
        categorical[column] = {str(k): int(v) for k, v in counts.items()}

    return {
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "dataset": "Triagegeist",
        "n_samples": int(len(frame)),
        "numeric": numeric,
        "categorical": categorical,
    }


def build_out_of_fold_errors(
    frame: pd.DataFrame, pipeline_factory, n_splits: int = config.N_SPLITS
) -> dict[str, Any]:
    """Collect patient-grouped out-of-fold predictions for error analysis."""
    from sklearn.model_selection import GroupKFold

    groups = frame[config.SUBJECT_ID_COLUMN].values
    X = frame.drop(columns=[config.TARGET_COLUMN, config.SUBJECT_ID_COLUMN])
    y = frame[config.TARGET_COLUMN].values.astype(int)
    classes = list(config.ESI_LABELS)

    oof_pred = np.full(len(X), -1, dtype=int)
    oof_proba = np.zeros((len(X), len(classes)))
    folds = np.full(len(X), -1, dtype=int)

    gkf = GroupKFold(n_splits=n_splits)
    for fold_idx, (train_idx, val_idx) in enumerate(gkf.split(X, y, groups=groups)):
        pipeline = pipeline_factory()
        pipeline.fit(X.iloc[train_idx], y[train_idx])
        oof_pred[val_idx] = pipeline.predict(X.iloc[val_idx])
        proba = pipeline.predict_proba(X.iloc[val_idx])
        for j, cls in enumerate(classes):
            if cls in pipeline.named_steps["estimator"].classes_:
                oof_proba[val_idx, j] = proba[
                    :, list(pipeline.named_steps["estimator"].classes_).index(cls)
                ]
        folds[val_idx] = fold_idx

    records: list[dict[str, Any]] = []
    for i in range(len(X)):
        if folds[i] < 0:
            continue
        true_label = int(y[i])
        pred_label = int(oof_pred[i])
        proba = oof_proba[i]
        is_misclassified = true_label != pred_label
        error_category = None
        if is_misclassified:
            delta = abs(true_label - pred_label)
            error_category = "adjacent" if delta == 1 else "multi_level"
        records.append(
            {
                "index": int(i),
                "true_label": true_label,
                "pred_label": pred_label,
                "is_misclassified": is_misclassified,
                "error_category": error_category,
                "max_prob": float(proba.max()),
                "prob_true": float(proba[true_label - 1]),
                "prob_pred": float(proba[pred_label - 1]),
                "fold": int(folds[i]),
                "evaluation_protocol": "patient_grouped_5fold_cv_out_of_fold",
            }
        )

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "n_samples": len(records),
        "classes": classes,
        "records": records,
    }



def build_drift_analysis(train: pd.DataFrame, test: pd.DataFrame) -> dict[str, Any]:
    """Feature-distribution comparison between the grouped train and holdout splits.

    The two partitions come from the *same* cohort, so any signal here reflects
    sampling variation rather than genuine temporal or site-level shift. It is
    reported as a diagnostic only, never as evidence of real-world drift.
    """
    from backend.ml import drift as drift_mod

    result = drift_mod.analyze_drift(
        train, test, numeric_cols=list(triagegeist_schema.NUMERIC_FEATURE_COLUMNS)
    )
    result["reference"] = "training_split_patient_grouped"
    result["comparison"] = "holdout_split_patient_grouped"
    result["note"] = (
        "Same cohort, different patient-grouped partition. Differences reflect "
        "sampling variation only; this is not a real-world drift measurement."
    )
    return result


def _file_inventory() -> dict[str, dict[str, Any]]:
    """Row counts and label availability for each released Triagegeist file."""
    inventory: dict[str, dict[str, Any]] = {}
    for name in ("train", "test", "chief_complaints", "patient_history", "sample_submission"):
        path = config.DATASET_DIR / f"{name}.csv"
        if not path.exists():
            continue
        frame = pd.read_csv(path, usecols=None, nrows=None)
        entry: dict[str, Any] = {"rows": int(len(frame))}
        if config.TARGET_COLUMN in frame.columns:
            entry["has_labels"] = True
        elif name == "test":
            entry["has_labels"] = False
        inventory[f"{name}.csv"] = entry
    return inventory


def _unique_patients(name: str) -> int | None:
    """Number of distinct patients in a released Triagegeist file."""
    path = config.DATASET_DIR / f"{name}.csv"
    if not path.exists():
        return None
    frame = pd.read_csv(path, usecols=[config.SUBJECT_ID_COLUMN])
    return int(frame[config.SUBJECT_ID_COLUMN].nunique())


def _patient_overlap(left: str, right: str) -> int:
    """Patients appearing in both files. 0 means no patient-level leakage."""
    left_path = config.DATASET_DIR / f"{left}.csv"
    right_path = config.DATASET_DIR / f"{right}.csv"
    if not (left_path.exists() and right_path.exists()):
        return 0
    column = config.SUBJECT_ID_COLUMN
    left_ids = set(pd.read_csv(left_path, usecols=[column])[column])
    right_ids = set(pd.read_csv(right_path, usecols=[column])[column])
    return int(len(left_ids & right_ids))


def build_benchmark_results(
    train: pd.DataFrame,
    test: pd.DataFrame,
    holdout: dict[str, Any],
    cv: dict[str, Any],
    frame: pd.DataFrame,
) -> dict[str, Any]:
    """Benchmark the candidate models against a dummy baseline on the holdout split."""
    from backend.ml.triagegeist_training import (
        build_dummy_pipeline,
        build_logistic_regression_pipeline,
    )

    results: dict[str, Any] = {}

    def _summarise(metrics: dict[str, Any]) -> dict[str, Any]:
        return {
            "balanced_accuracy": metrics["balanced_accuracy"],
            "macro_f1": metrics["macro_f1"],
            "quadratic_weighted_kappa": metrics["quadratic_weighted_kappa"],
            "per_class": metrics["per_class"],
        }

    dummy = build_dummy_pipeline(preprocess=build_preprocessor_for_frame(frame))
    dummy.fit(
        train.drop(columns=[config.TARGET_COLUMN, config.SUBJECT_ID_COLUMN]),
        train[config.TARGET_COLUMN].values.astype(int),
    )
    results["dummy"] = _summarise(evaluate.evaluate_pipeline_on_split(dummy, train, test))

    logistic = build_logistic_regression_pipeline(
        preprocess=build_preprocessor_for_frame(frame)
    )
    logistic.fit(
        train.drop(columns=[config.TARGET_COLUMN, config.SUBJECT_ID_COLUMN]),
        train[config.TARGET_COLUMN].values.astype(int),
    )
    results["logistic_regression"] = _summarise(
        evaluate.evaluate_pipeline_on_split(logistic, train, test)
    )

    results["random_forest"] = _summarise(holdout)
    return {
        "dataset": "Triagegeist",
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "n_patients_train": int(train[config.SUBJECT_ID_COLUMN].nunique()),
        "n_patients_test": int(test[config.SUBJECT_ID_COLUMN].nunique()),
        "train_rows": int(len(train)),
        "test_rows": int(len(test)),
        "model_results": results,
        "cv_summary": cv["summary"],
        "note": (
            "Validation-holdout benchmark on the Triagegeist synthetic "
            "dataset. Not a clinical performance claim."
        ),
    }


def build(reports_dir: Path | None = None, seed: int = config.RANDOM_SEED) -> dict[str, Any]:
    """Regenerate every aggregate artifact from the active Triagegeist model."""
    reports_dir = reports_dir or config.REPORTS_DIR
    reports_dir.mkdir(parents=True, exist_ok=True)

    log.info("Loading Triagegeist dataset...")
    # Use exactly the frame the training path uses, so the published metrics
    # describe the artifact that is actually deployed. The comorbidity
    # history in patient_history.csv is deliberately not joined here: the
    # assessment API cannot supply it, so a model that depended on it could
    # not be served.
    data = load_all(config.DATASET_DIR)
    frame = build_feature_frame(data["train"])

    train, test = splitting.patient_grouped_split(
        frame, test_size=config.TEST_SIZE, seed=seed
    )
    log.info(
        "Split: %d train rows / %d patients, %d test rows / %d patients",
        len(train),
        train[config.SUBJECT_ID_COLUMN].nunique(),
        len(test),
        test[config.SUBJECT_ID_COLUMN].nunique(),
    )

    # ---- data quality report -------------------------------------------
    quality = build_data_quality_report(frame)
    quality["row_counts"].update(
        {
            "train_rows": int(len(train)),
            "test_rows": int(len(test)),
            "train_patients": int(train[config.SUBJECT_ID_COLUMN].nunique()),
            "test_patients": int(test[config.SUBJECT_ID_COLUMN].nunique()),
        }
    )
    _write_json(quality, reports_dir / "data_quality_report.json")

    # ---- training distribution used for input-quality / OOD checks ------
    _write_json(
        build_training_stats(frame),
        reports_dir / "triagegeist_training_stats.json",
    )

    # ---- fit the production model --------------------------------------
    # The preprocessor is restricted to the columns the modelling frame
    # carries, exactly as the training path does, so the published metrics
    # describe the artifact that is actually deployed.
    preprocess = build_preprocessor_for_frame(frame)
    pipeline = build_random_forest_pipeline(preprocess=preprocess)
    pipeline.fit(
        train.drop(columns=[config.TARGET_COLUMN, config.SUBJECT_ID_COLUMN]),
        train[config.TARGET_COLUMN].values.astype(int),
    )

    # ---- evaluation report ---------------------------------------------
    from backend.ml import evaluate as evaluate_mod

    holdout = evaluate_mod.evaluate_pipeline_on_split(
        build_random_forest_pipeline(preprocess=build_preprocessor_for_frame(frame)),
        train,
        test,
    )
    cv = evaluate_mod.run_grouped_cv_evaluation(
        lambda: build_random_forest_pipeline(
            preprocess=build_preprocessor_for_frame(frame)
        ),
        train,
        n_splits=config.N_SPLITS,
    )
    evaluation = {
        "dataset": "Triagegeist",
        "dataset_version": "synthetic",
        "source": "triagegeist/",
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "random_seed": seed,
        "n_rows": int(len(frame)),
        "n_patients": int(frame[config.SUBJECT_ID_COLUMN].nunique()),
        "class_distribution": quality["label_distribution"],
        "baselines_holdout": {},
        "candidates_holdout": {"random_forest": holdout},
        "candidates_5fold_cv": {
            "random_forest": {
                "summary": cv["summary"],
                "aggregate_confusion_matrix": cv["aggregate_confusion_matrix"],
            }
        },
        "selected_model": {
            "name": "random_forest",
            "artifact": "models/triagegeist/triage_model.joblib",
            "holdout_metrics": holdout,
            "cv_summary": cv["summary"],
        },
        "provenance": triagegeist_schema.dataset_provenance(),
    }
    _write_json(evaluation, reports_dir / "model_evaluation.json")

    # ---- global SHAP ----------------------------------------------------
    reference = test.drop(columns=[config.TARGET_COLUMN, config.SUBJECT_ID_COLUMN])
    shap_report = explain.explain_global(
        pipeline, reference, background_size=min(len(reference), 200), max_features=20
    )
    _write_json(
        {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "model": "random_forest",
            "reference_dataset": "heldout_test_split_patient_grouped",
            "n_reference_samples": int(len(reference)),
            "feature_importances": shap_report["feature_importances"],
            "note": (
                "Global SHAP importance (mean |SHAP|). Describes model behavior, "
                "not medical causation."
            ),
        },
        reports_dir / "global_shap.json",
    )

    # ---- drift diagnostic ------------------------------------------------
    _write_json(
        build_drift_analysis(train, test),
        reports_dir / "drift_analysis.json",
    )

    # ---- out-of-fold error records ---------------------------------------
    errors = build_out_of_fold_errors(
        train, lambda: build_random_forest_pipeline(preprocess=build_preprocessor_for_frame(frame))
    )
    _write_json(errors, reports_dir / "evaluation_errors.json", compact=True)

    # ---- dataset profile / experiment manifest ---------------------------
    # The frontend dataset explorer imports these two files directly, so they
    # are generated here rather than by a separate script.
    triagegeist_dir = reports_dir / "triagegeist"
    triagegeist_dir.mkdir(parents=True, exist_ok=True)
    # The profile is a published contract: the API serves it verbatim and
    # both the "Model & dataset status" page and the dataset explorer read
    # these fields. The flat train/test counts describe the *released files*
    # (train.csv / test.csv); `row_counts` describes the modelling split
    # carved out of train.csv for the holdout evaluation.
    inventory = _file_inventory()
    train_file = inventory.get("train.csv", {})
    test_file = inventory.get("test.csv", {})
    train_patients = _unique_patients("train")
    test_patients = _unique_patients("test")
    overlap = _patient_overlap("train", "test")

    profile = {
        "dataset": "Triagegeist",
        "version": "synthetic",
        "source": "triagegeist/",
        "reference_dataset": "Triagegeist (synthetic)",
        "split_protocol": "patient-grouped 80/20 holdout, 5-fold grouped CV",
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "file_inventory": inventory,
        "train_rows": train_file.get("rows"),
        "train_patients": train_patients,
        "test_rows": test_file.get("rows"),
        "test_patients": test_patients,
        "patient_overlap_train_test": overlap,
        "row_counts": quality["row_counts"],
        "target_distribution": quality["label_distribution"],
        "target_distribution_train": quality["label_distribution"],
        "missing_percent": quality["missing_percent"],
        "feature_stats": quality["feature_stats"],
    }
    _write_json(profile, triagegeist_dir / "dataset_profile.json")
    _write_json(
        {
            "dataset": "Triagegeist",
            "dataset_version": "synthetic",
            "source": str(config.DATASET_DIR),
            "generated_at_utc": datetime.now(timezone.utc).isoformat(),
            "files": _file_inventory(),
            "target": f"{config.TARGET_COLUMN} (ESI levels 1-5)",
            "esi_labels": list(config.ESI_LABELS),
            "random_seed": seed,
            "note": (
                "Synthetic dataset. Aggregate facts only; no patient records "
                "are published in this manifest."
            ),
        },
        triagegeist_dir / "experiment_manifest.json",
    )

    # ---- benchmark results -----------------------------------------------
    _write_json(
        build_benchmark_results(train, test, holdout, cv, frame),
        triagegeist_dir / "benchmark_results.json",
    )

    log.info(
        "Built artifacts: holdout macro-F1 %.3f, CV macro-F1 %.3f",
        holdout["macro_f1"],
        cv["summary"]["mean_macro_f1"],
    )
    return evaluation


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--reports-dir", type=Path, default=None)
    parser.add_argument("--seed", type=int, default=config.RANDOM_SEED)
    parser.add_argument("-v", "--verbose", action="store_true")
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)-7s %(name)s: %(message)s",
    )
    build(reports_dir=args.reports_dir, seed=args.seed)


if __name__ == "__main__":
    main()
