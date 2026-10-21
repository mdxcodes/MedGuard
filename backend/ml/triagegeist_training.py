"""Triagegeist ML training pipeline.

Trains and evaluates models on Triagegeist synthetic data using:
- Patient-grouped splits (no patient leakage across train/validation)
- DummyClassifier baseline
- Logistic Regression baseline
- Random Forest candidate model
- Fixed random seeds for reproducibility

Preserves ESI class ordering: ESI 1 (highest urgency) through ESI 5 (lowest).

All metrics are computed on real validation data - no hardcoded values.
"""

from __future__ import annotations

import json
import logging
import uuid
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
from sklearn.dummy import DummyClassifier
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    balanced_accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_recall_fscore_support,
    cohen_kappa_score,
)

from backend.ml import config, train, triagegeist_schema
from backend.ml.triagegeist_loader import load_all, DEFAULT_DIR
from backend.ml.triagegeist_preprocessing import (
    build_preprocessor,
    build_preprocessor_for_frame,
    build_feature_frame,
    assert_no_leakage_columns,
    leakage_free_feature_names,
)
from backend.ml.splitting import patient_grouped_split, grouped_kfold

logger = logging.getLogger("medguard.triagegeist_training")


# ---------------------------------------------------------------------------
# Model factories
# ---------------------------------------------------------------------------

def build_dummy_pipeline(strategy: str = "most_frequent", preprocess: Any = None) -> Any:
    """Build a DummyClassifier baseline pipeline."""
    from sklearn.pipeline import Pipeline
    from sklearn.impute import SimpleImputer
    from sklearn.preprocessing import OneHotEncoder, StandardScaler
    from sklearn.compose import ColumnTransformer

    preprocess = preprocess or build_preprocessor()
    estimator = DummyClassifier(strategy=strategy, random_state=config.RANDOM_SEED)
    return Pipeline(steps=[("preprocess", preprocess), ("estimator", estimator)])


def build_logistic_regression_pipeline(preprocess: Any = None) -> Any:
    """Build a Logistic Regression pipeline."""
    from sklearn.pipeline import Pipeline
    preprocess = preprocess or build_preprocessor()
    estimator = LogisticRegression(
        max_iter=1000,
        random_state=config.RANDOM_SEED,
        class_weight="balanced",
        n_jobs=-1,
    )
    return Pipeline(steps=[("preprocess", preprocess), ("estimator", estimator)])


def build_random_forest_pipeline(preprocess: Any = None) -> Any:
    """Build a Random Forest pipeline."""
    from sklearn.pipeline import Pipeline
    preprocess = preprocess or build_preprocessor()
    estimator = RandomForestClassifier(
        n_estimators=100,
        max_depth=None,
        random_state=config.RANDOM_SEED,
        n_jobs=-1,
        class_weight="balanced_subsample",
    )
    return Pipeline(steps=[("preprocess", preprocess), ("estimator", estimator)])


MODEL_FACTORIES = {
    "dummy": build_dummy_pipeline,
    "logistic_regression": build_logistic_regression_pipeline,
    "random_forest": build_random_forest_pipeline,
}


# ---------------------------------------------------------------------------
# Evaluation
# ---------------------------------------------------------------------------

def compute_metrics(
    y_true: np.ndarray,
    y_pred: np.ndarray,
    y_proba: np.ndarray | None = None,
) -> dict[str, Any]:
    """Compute evaluation metrics for ESI classification."""
    y_true_a = np.asarray(y_true).astype(int)
    y_pred_a = np.asarray(y_pred).astype(int)

    ba = balanced_accuracy_score(y_true_a, y_pred_a)
    macro_f1 = f1_score(y_true_a, y_pred_a, average="macro", zero_division=0)

    precision, recall, f1, support = precision_recall_fscore_support(
        y_true_a, y_pred_a, labels=triagegeist_schema.ESI_LABELS, zero_division=0
    )

    cm = confusion_matrix(y_true_a, y_pred_a, labels=triagegeist_schema.ESI_LABELS)

    # Quadratic-weighted kappa
    try:
        qwk = cohen_kappa_score(y_true_a, y_pred_a, labels=triagegeist_schema.ESI_LABELS, weights="quadratic")
        qwk_val = float(qwk) if np.isfinite(qwk) else None
    except Exception:
        qwk_val = None

    per_class: dict[str, dict[str, float | int]] = {}
    for idx, label in enumerate(triagegeist_schema.ESI_LABELS):
        name = f"ESI {int(label)}"
        per_class[name] = {
            "precision": float(precision[idx]),
            "recall": float(recall[idx]),
            "f1": float(f1[idx]),
            "support": int(support[idx]),
            "true_support": int((y_true_a == label).sum()),
        }

    # Undertriage: predicting higher ESI number (lower urgency) than true
    # Overtriage: predicting lower ESI number (higher urgency) than true
    undertriage = int((y_pred_a > y_true_a).sum())
    overtriage = int((y_pred_a < y_true_a).sum())

    return {
        "balanced_accuracy": float(ba),
        "macro_f1": float(macro_f1),
        "quadratic_weighted_kappa": qwk_val,
        "per_class": per_class,
        "confusion_matrix": cm.tolist(),
        "confusion_matrix_labels": triagegeist_schema.ESI_LABEL_NAMES,
        "y_true_counts": {f"ESI {int(l)}": int((y_true_a == l).sum()) for l in triagegeist_schema.ESI_LABELS},
        "y_pred_counts": {f"ESI {int(l)}": int((y_pred_a == l).sum()) for l in triagegeist_schema.ESI_LABELS},
        "undertriage_count": undertriage,
        "overtriage_count": overtriage,
    }


def evaluate_model_on_split(
    pipeline: Any,
    train_df: pd.DataFrame,
    test_df: pd.DataFrame,
) -> dict[str, Any]:
    """Fit pipeline on train_df, evaluate on test_df.

    Returns metrics dict with train/test row counts and patient counts.
    """
    y_train = train_df[triagegeist_schema.TARGET_COLUMN].values.astype(int)
    y_test = test_df[triagegeist_schema.TARGET_COLUMN].values.astype(int)

    pipeline.fit(train_df, y_train)
    y_pred = pipeline.predict(test_df)
    y_proba = pipeline.predict_proba(test_df) if hasattr(pipeline, "predict_proba") else None

    metrics = compute_metrics(y_test, y_pred, y_proba)
    metrics["train_rows"] = int(len(train_df))
    metrics["test_rows"] = int(len(test_df))
    metrics["train_patients"] = int(train_df[triagegeist_schema.PATIENT_ID_COLUMN].nunique())
    metrics["test_patients"] = int(test_df[triagegeist_schema.PATIENT_ID_COLUMN].nunique())
    return metrics


def run_cross_validation(
    model_factory: Any,
    df: pd.DataFrame,
    n_splits: int = config.N_SPLITS,
    group_col: str = triagegeist_schema.PATIENT_ID_COLUMN,
) -> dict[str, Any]:
    """Run patient-grouped cross-validation."""
    fold_metrics = []

    for fold_idx, (train_fold, val_fold) in enumerate(
        grouped_kfold(df, n_splits=n_splits, group_col=group_col)
    ):
        pipeline = model_factory()
        m = evaluate_model_on_split(pipeline, train_fold, val_fold)
        m["fold"] = fold_idx
        fold_metrics.append(m)

    # Aggregate
    scalars = ["balanced_accuracy", "macro_f1", "quadratic_weighted_kappa"]
    summary: dict[str, Any] = {}
    for key in scalars:
        values = [m[key] for m in fold_metrics if m.get(key) is not None]
        summary[f"mean_{key}"] = float(np.mean(values)) if values else None
        summary[f"std_{key}"] = float(np.std(values, ddof=1)) if len(values) > 1 else 0.0

    for label in triagegeist_schema.ESI_LABEL_NAMES:
        f1_values = [m["per_class"][label]["f1"] for m in fold_metrics]
        rec_values = [m["per_class"][label]["recall"] for m in fold_metrics]
        summary[f"mean_f1_{label.replace(' ', '_')}"] = float(np.mean(f1_values))
        summary[f"std_f1_{label.replace(' ', '_')}"] = float(np.std(f1_values, ddof=1)) if len(f1_values) > 1 else 0.0
        summary[f"mean_rec_{label.replace(' ', '_')}"] = float(np.mean(rec_values))

    # Aggregate confusion matrix
    stacked = np.sum([np.asarray(m["confusion_matrix"], dtype=int) for m in fold_metrics], axis=0)

    summary["n_folds"] = len(fold_metrics)

    return {
        "fold_metrics": fold_metrics,
        "summary": summary,
        "aggregate_confusion_matrix": stacked.tolist(),
    }


# ---------------------------------------------------------------------------
# Training entry point
# ---------------------------------------------------------------------------

@dataclass
class TrainingConfig:
    model_name: str = "random_forest"
    random_seed: int = config.RANDOM_SEED
    test_size: float = config.TEST_SIZE
    n_splits: int = config.N_SPLITS
    use_text: bool = False


def run_training(
    config_obj: TrainingConfig | None = None,
    reports_dir: Path | None = None,
    models_dir: Path | None = None,
) -> dict[str, Any]:
    """Run complete Triagegeist training pipeline.

    1. Loads Triagegeist data
    2. Splits into patient-grouped train/test
    3. Trains baseline + candidate models
    4. Evaluates on holdout and cross-validation
    5. Saves best model artifact + manifest
    6. Generates evaluation reports

    Returns the full evaluation payload.
    """
    cfg = config_obj or TrainingConfig()
    reports_dir = reports_dir or config.REPORTS_DIR
    models_dir = models_dir or (config.PROJECT_ROOT / "models" / "triagegeist")
    reports_dir.mkdir(parents=True, exist_ok=True)
    models_dir.mkdir(parents=True, exist_ok=True)

    started = datetime.now(timezone.utc).isoformat()

    # 1. Load data
    logger.info("Loading Triagegeist dataset...")
    data = load_all(DEFAULT_DIR)
    train_df_raw = data["train"]
    test_df_raw = data["test"]

    # 2. Build feature frames
    logger.info("Building feature frames...")
    train_df = build_feature_frame(train_df_raw)

    # test.csv holds the unlabeled holdout (ground truth withheld); it cannot be
    # used for metric computation. Split the labeled training data instead so
    # that train and validation both carry triage_acuity labels.
    train_split, val_split = patient_grouped_split(
        train_df,
        test_size=cfg.test_size,
        seed=cfg.random_seed,
        group_col=triagegeist_schema.PATIENT_ID_COLUMN,
    )

    # Assert no leakage columns
    assert_no_leakage_columns(train_split)
    assert_no_leakage_columns(val_split)

    logger.info(
        "Training on %d rows (%d patients), validating on %d rows (%d patients)",
        len(train_split), train_split[triagegeist_schema.PATIENT_ID_COLUMN].nunique(),
        len(val_split), val_split[triagegeist_schema.PATIENT_ID_COLUMN].nunique(),
    )

    class_counts = train_split[triagegeist_schema.TARGET_COLUMN].value_counts().sort_index().to_dict()
    logger.info("Training class distribution: %s", {f"ESI {int(k)}": v for k, v in class_counts.items()})

    # Build a preprocessor restricted to columns actually present in the data
    # (e.g. history booleans live in patient_history.csv and are not joined here).
    preprocess = build_preprocessor_for_frame(train_split)

    # 3. Baseline evaluation on validation holdout
    baselines = ["dummy"]
    baseline_eval = {}
    for b_name in baselines:
        pipe = MODEL_FACTORIES[b_name](preprocess=preprocess)
        m = evaluate_model_on_split(pipe, train_split, val_split)
        baseline_eval[b_name] = m
        logger.info("Baseline %s on holdout: Macro-F1=%.4f, Balanced Acc=%.4f",
                    b_name, m["macro_f1"], m["balanced_accuracy"])

    # 4. Candidate CV
    candidates = ["logistic_regression", "random_forest"]
    candidate_cv = {}
    fold_metrics_rows = []

    for c_name in candidates:
        logger.info("Running %d-fold patient-grouped CV for %s...", cfg.n_splits, c_name)
        cv_res = run_cross_validation(
            lambda name=c_name: MODEL_FACTORIES[name](preprocess=preprocess),
            train_split,
            n_splits=cfg.n_splits,
            group_col=triagegeist_schema.PATIENT_ID_COLUMN,
        )
        candidate_cv[c_name] = cv_res
        summ = cv_res["summary"]
        logger.info(
            "Candidate %s CV: Mean Macro-F1=%.4f +/- %.4f, Balanced Acc=%.4f +/- %.4f",
            c_name,
            summ.get("mean_macro_f1", 0.0), summ.get("std_macro_f1", 0.0),
            summ.get("mean_balanced_accuracy", 0.0), summ.get("std_balanced_accuracy", 0.0),
        )

        for fm in cv_res["fold_metrics"]:
            fold_metrics_rows.append({
                "model": c_name,
                "fold": fm["fold"],
                "macro_f1": fm["macro_f1"],
                "balanced_accuracy": fm["balanced_accuracy"],
                "quadratic_weighted_kappa": fm["quadratic_weighted_kappa"],
            })

    # 5. Candidate evaluation on holdout
    candidate_holdout = {}
    for c_name in candidates:
        pipe = MODEL_FACTORIES[c_name](preprocess=preprocess)
        m = evaluate_model_on_split(pipe, train_split, val_split)
        candidate_holdout[c_name] = m
        logger.info(
            "Candidate %s on holdout: Macro-F1=%.4f, Balanced Acc=%.4f, QWK=%.4f",
            c_name, m["macro_f1"], m["balanced_accuracy"], m["quadratic_weighted_kappa"] or 0.0,
        )

    # 6. Select best model (highest CV macro-F1, fallback to holdout)
    best_model_name = max(
        candidates,
        key=lambda c: candidate_cv[c]["summary"].get("mean_macro_f1", 0.0) or 0.0,
    )
    logger.info("Selected best model: %s", best_model_name)

    # 7. Fit selected model on full train_df
    selected_pipeline = MODEL_FACTORIES[best_model_name](preprocess=preprocess)
    y_train = train_df[triagegeist_schema.TARGET_COLUMN].values.astype(int)
    selected_pipeline.fit(train_df, y_train)

    # 8. Persist model artifact
    model_artifact_path = models_dir / "triage_model.joblib"
    train.persist_pipeline(
        selected_pipeline,
        model_artifact_path,
        model_name=best_model_name,
        training_rows=len(train_df),
        training_patients=int(train_df[triagegeist_schema.PATIENT_ID_COLUMN].nunique()),
        class_distribution={
            f"ESI {int(level)}": int(count)
            for level, count in train_df[triagegeist_schema.TARGET_COLUMN]
            .value_counts()
            .sort_index()
            .items()
        },
    )
    logger.info("Persisted model to %s", model_artifact_path)

    # 9. Build evaluation payload
    finished = datetime.now(timezone.utc).isoformat()

    # Get feature names
    feature_names = leakage_free_feature_names(selected_pipeline)

    full_eval_payload = {
        "dataset": "Triagegeist",
        "dataset_version": "synthetic",
        "source": "triagegeist/",
        "generated_at_utc": finished,
        "random_seed": cfg.random_seed,
        "n_rows": int(len(train_df_raw) + len(test_df_raw)),
        "n_patients": int(
            train_df_raw[triagegeist_schema.PATIENT_ID_COLUMN].nunique()
            + test_df_raw[triagegeist_schema.PATIENT_ID_COLUMN].nunique()
        ),
        "class_distribution": {f"ESI {int(k)}": v for k, v in class_counts.items()},
        "baselines_holdout": baseline_eval,
        "candidates_holdout": candidate_holdout,
        "candidates_5fold_cv": {
            c: {
                "summary": candidate_cv[c]["summary"],
                "aggregate_confusion_matrix": candidate_cv[c]["aggregate_confusion_matrix"],
            }
            for c in candidates
        },
        "selected_model": {
            "name": best_model_name,
            "artifact": str(model_artifact_path),
            "holdout_metrics": candidate_holdout[best_model_name],
            "cv_summary": candidate_cv[best_model_name]["summary"],
        },
        "feature_schema": {
            "n_features": len(feature_names),
            "feature_columns": feature_names,
            "target_column": triagegeist_schema.TARGET_COLUMN,
            "patient_id_column": triagegeist_schema.PATIENT_ID_COLUMN,
            "esi_labels": triagegeist_schema.ESI_LABELS,
        },
        "provenance": triagegeist_schema.dataset_provenance(),
    }

    # 10. Write evaluation report
    eval_report_path = reports_dir / "triagegeist_evaluation.json"
    eval_report_path.write_text(json.dumps(full_eval_payload, indent=2, default=str))
    logger.info("Wrote evaluation report to %s", eval_report_path)

    # 11. Write model comparison CSV
    comp_rows = []
    for b_name in baselines:
        m = baseline_eval[b_name]
        comp_rows.append({
            "model": b_name,
            "type": "baseline",
            "eval_strategy": "holdout",
            "macro_f1": m["macro_f1"],
            "balanced_accuracy": m["balanced_accuracy"],
            "quadratic_weighted_kappa": m["quadratic_weighted_kappa"],
        })
    for c_name in candidates:
        m_h = candidate_holdout[c_name]
        cv_s = candidate_cv[c_name]["summary"]
        comp_rows.append({
            "model": c_name,
            "type": "candidate",
            "eval_strategy": "holdout_and_cv",
            "macro_f1": m_h["macro_f1"],
            "balanced_accuracy": m_h["balanced_accuracy"],
            "quadratic_weighted_kappa": m_h["quadratic_weighted_kappa"],
            "mean_cv_macro_f1": cv_s.get("mean_macro_f1"),
            "std_cv_macro_f1": cv_s.get("std_macro_f1"),
            "mean_cv_balanced_acc": cv_s.get("mean_balanced_accuracy"),
            "std_cv_balanced_acc": cv_s.get("std_balanced_accuracy"),
        })
    comp_df = pd.DataFrame(comp_rows)
    comp_df.to_csv(reports_dir / "triagegeist_model_comparison.csv", index=False)

    # 12. Write fold metrics CSV
    fold_df = pd.DataFrame(fold_metrics_rows)
    fold_df.to_csv(reports_dir / "triagegeist_fold_metrics.csv", index=False)

    logger.info("Triagegeist training complete. Best model: %s (Macro-F1=%.4f)",
                best_model_name, candidate_holdout[best_model_name]["macro_f1"])

    return full_eval_payload


if __name__ == "__main__":
    run_training()
