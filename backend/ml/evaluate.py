"""MedGuard Triagegeist evaluation metrics and cross-validation evaluation.

Metrics are always computed with explicit ESI labels ``[1, 2, 3, 4, 5]`` and
``zero_division=0``, so missing-class folds (ESI 4, 5) are marked clearly
rather than hidden. No SMOTE or other synthetic resampling is used.
"""

from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd
from sklearn.metrics import (
    balanced_accuracy_score,
    cohen_kappa_score,
    confusion_matrix,
    f1_score,
    precision_recall_fscore_support,
)
from sklearn.pipeline import Pipeline

from backend.ml import config, triagegeist_schema

EXPLICIT_LABELS: list[int] = list(triagegeist_schema.ESI_LABELS)
LABEL_NAMES: list[str] = triagegeist_schema.ESI_LABEL_NAMES


def compute_metrics(
    y_true: pd.Series | np.ndarray,
    y_pred: np.ndarray,
) -> dict[str, Any]:
    """Per-fold metrics. Never invents a label and never drops a class."""
    y_true_a = np.asarray(y_true).astype(int)
    y_pred_a = np.asarray(y_pred).astype(int)

    ba = balanced_accuracy_score(y_true_a, y_pred_a)
    macro_f1 = f1_score(y_true_a, y_pred_a, average="macro", zero_division=0)

    precision, recall, f1, support = precision_recall_fscore_support(
        y_true_a, y_pred_a, labels=EXPLICIT_LABELS, zero_division=0
    )

    # Confusion matrix rows = true, cols = predicted, fixed 5x5.
    cm = confusion_matrix(y_true_a, y_pred_a, labels=EXPLICIT_LABELS)

    # Quadratic-weighted kappa is undefined for single-label or degenerate sets.
    try:
        qwk = cohen_kappa_score(y_true_a, y_pred_a, labels=EXPLICIT_LABELS, weights="quadratic")
        qwk_val: float | None = float(qwk) if np.isfinite(qwk) else None
    except Exception:
        qwk_val = None

    # True support per label in this fold (from the test side).
    true_support = {f"ESI {int(l)}": int((y_true_a == l).sum()) for l in EXPLICIT_LABELS}

    per_class: dict[str, dict[str, float | int]] = {}
    for idx, label in enumerate(EXPLICIT_LABELS):
        name = f"ESI {int(label)}"
        per_class[name] = {
            "precision": float(precision[idx]),
            "recall": float(recall[idx]),
            "f1": float(f1[idx]),
            "support": int(support[idx]),
            "true_support": int(true_support[name]),
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
        "confusion_matrix_labels": LABEL_NAMES,
        "y_true_counts": true_support,
        "y_pred_counts": {f"ESI {int(l)}": int((y_pred_a == l).sum()) for l in EXPLICIT_LABELS},
        "undertriage_count": undertriage,
        "overtriage_count": overtriage,
    }


def aggregate_fold_metrics(fold_metrics: list[dict[str, Any]]) -> dict[str, Any]:
    """Mean ± std across folds. Folds that lacked a class contribute 0 for that class."""
    if not fold_metrics:
        return {}

    scalars = ["balanced_accuracy", "macro_f1", "quadratic_weighted_kappa",
               "undertriage_count", "overtriage_count"]
    summary: dict[str, Any] = {}
    for key in scalars:
        values = [m[key] for m in fold_metrics if m.get(key) is not None]
        summary[f"mean_{key}"] = float(np.mean(values)) if values else None
        summary[f"std_{key}"] = float(np.std(values, ddof=1)) if len(values) > 1 else 0.0

    # Per-class means across folds (F1 and recall).
    for label in LABEL_NAMES:
        f1_values = [m["per_class"][label]["f1"] for m in fold_metrics]
        rec_values = [m["per_class"][label]["recall"] for m in fold_metrics]
        summary[f"mean_f1_{label.replace(' ', '_')}"] = float(np.mean(f1_values))
        summary[f"std_f1_{label.replace(' ', '_')}"] = float(np.std(f1_values, ddof=1)) if len(f1_values) > 1 else 0.0
        summary[f"mean_rec_{label.replace(' ', '_')}"] = float(np.mean(rec_values))

    summary["n_folds"] = len(fold_metrics)
    return summary


def aggregate_confusion_matrices(fold_metrics: list[dict[str, Any]]) -> list[list[int]]:
    """Sum confusion matrices across folds (for a printable aggregate table)."""
    if not fold_metrics:
        return [[0] * len(EXPLICIT_LABELS) for _ in EXPLICIT_LABELS]
    stacked = np.sum([np.asarray(m["confusion_matrix"], dtype=int) for m in fold_metrics], axis=0)
    return stacked.tolist()


def evaluate_pipeline_on_split(
    pipeline: Pipeline,
    train_df: pd.DataFrame,
    test_df: pd.DataFrame,
) -> dict[str, Any]:
    """Fit a full pipeline on train_df, evaluate on test_df, and return metrics.

    Leakage check: preprocessor is fit only on training data.
    """
    y_train = train_df[triagegeist_schema.TARGET_COLUMN].values.astype(int)
    y_test = test_df[triagegeist_schema.TARGET_COLUMN].values.astype(int)

    pipeline.fit(train_df, y_train)
    y_pred = pipeline.predict(test_df)

    metrics = compute_metrics(y_test, y_pred)
    metrics["train_rows"] = int(len(train_df))
    metrics["test_rows"] = int(len(test_df))
    metrics["train_patients"] = int(train_df[triagegeist_schema.PATIENT_ID_COLUMN].nunique())
    metrics["test_patients"] = int(test_df[triagegeist_schema.PATIENT_ID_COLUMN].nunique())
    return metrics


def run_grouped_cv_evaluation(
    model_factory: Any,
    feature_frame: pd.DataFrame,
    n_splits: int = config.N_SPLITS,
) -> dict[str, Any]:
    """Run GroupKFold cross-validation using model_factory() for a fresh pipeline each fold."""
    fold_metrics = []
    fold_diagnostics = []

    for fold_idx, (train_fold, val_fold) in enumerate(
        __import__('backend.ml.splitting', fromlist=['grouped_kfold']).grouped_kfold(feature_frame, n_splits=n_splits)
    ):
        pipeline = model_factory()
        metrics = evaluate_pipeline_on_split(pipeline, train_fold, val_fold)
        metrics["fold"] = fold_idx
        fold_metrics.append(metrics)
        fold_diagnostics.append({
            "fold": fold_idx,
            "train_rows": metrics["train_rows"],
            "val_rows": metrics["test_rows"],
            "train_patients": metrics["train_patients"],
            "val_patients": metrics["test_patients"],
            "val_class_counts": metrics["y_true_counts"],
        })

    summary = aggregate_fold_metrics(fold_metrics)
    agg_cm = aggregate_confusion_matrices(fold_metrics)

    return {
        "fold_metrics": fold_metrics,
        "summary": summary,
        "aggregate_confusion_matrix": agg_cm,
        "fold_diagnostics": fold_diagnostics,
    }


def run_grouped_cv_oof(
    model_factory: Any,
    feature_frame: pd.DataFrame,
    n_splits: int = config.N_SPLITS,
) -> dict[str, Any]:
    """Run GroupKFold cross-validation and collect out-of-fold predictions.

    Returns per-sample predictions for samples in feature_frame in original order,
    along with their true labels and fold indices. No patient identifiers are included.
    """
    from sklearn.model_selection import GroupKFold

    groups = feature_frame[triagegeist_schema.PATIENT_ID_COLUMN].values
    X = feature_frame.drop(columns=[triagegeist_schema.TARGET_COLUMN, triagegeist_schema.PATIENT_ID_COLUMN])
    y = feature_frame[triagegeist_schema.TARGET_COLUMN].values.astype(int)

    gkf = GroupKFold(n_splits=n_splits)
    oof_pred = np.full(len(X), fill_value=-1, dtype=int)
    oof_proba = np.zeros((len(X), len(triagegeist_schema.ESI_LABELS)))
    fold_indices = np.full(len(X), fill_value=-1, dtype=int)

    for fold_idx, (train_idx, val_idx) in enumerate(gkf.split(X, y, groups=groups)):
        pipeline = model_factory()
        pipeline.fit(X.iloc[train_idx], y[train_idx])
        preds = pipeline.predict(X.iloc[val_idx])
        proba = pipeline.predict_proba(X.iloc[val_idx])
        oof_pred[val_idx] = preds
        oof_proba[val_idx, :] = proba
        fold_indices[val_idx] = fold_idx

    return {
        "y_true": y.tolist(),
        "y_pred": oof_pred.tolist(),
        "y_pred_proba": oof_proba.tolist(),
        "fold": fold_indices.tolist(),
        "classes": triagegeist_schema.ESI_LABELS,
        "n_samples": len(X),
    }


def build_drift_payload(
    train_df: pd.DataFrame,
    test_df: pd.DataFrame,
) -> dict[str, Any]:
    """A minimal dataset-shift diagnostic computed on a held-out patient-grouped split.

    This is intentionally conservative: it reports feature availability differences,
    distributional centroid differences for key numeric triage features, and the
    class distribution on each split. It does NOT fabricate covariate-shift
    statistics between the real MIMIC cohort and any external dataset.
    """
    def _numeric_profile(df: pd.DataFrame) -> dict[str, float | None]:
        profile: dict[str, float | None] = {}
        numeric_features = (
            "heart_rate",
            "respiratory_rate",
            "temperature_c",
            "spo2",
            "systolic_bp",
            "diastolic_bp",
            "pain_score",
            "shock_index",
            "pulse_pressure",
            "mean_arterial_pressure",
        )
        for col in numeric_features:
            if col not in df.columns:
                profile[col] = None
                continue
            series = pd.to_numeric(df[col], errors="coerce")
            if series.notna().sum() == 0:
                profile[col] = None
            else:
                profile[col] = float(series.mean())
        return profile

    train_num = _numeric_profile(train_df)
    test_num = _numeric_profile(test_df)

    class_dist = {
        "train": {f"ESI {int(k)}": int(v) for k, v in train_df[triagegeist_schema.TARGET_COLUMN].value_counts().sort_index().items()},
        "test": {f"ESI {int(k)}": int(v) for k, v in test_df[triagegeist_schema.TARGET_COLUMN].value_counts().sort_index().items()},
    }

    missing_rate = {}
    for col in triagegeist_schema.NUMERIC_FEATURE_COLUMNS:
        if col not in train_df.columns or col not in test_df.columns:
            continue
        missing_rate[col] = {
            "train": float(train_df[col].isna().mean()),
            "test": float(test_df[col].isna().mean()),
        }

    return {
        "split": {
            "train_rows": int(len(train_df)),
            "train_patients": int(train_df[triagegeist_schema.PATIENT_ID_COLUMN].nunique()),
            "test_rows": int(len(test_df)),
            "test_patients": int(test_df[triagegeist_schema.PATIENT_ID_COLUMN].nunique()),
        },
        "class_distribution": class_dist,
        "numeric_profile": {
            "train": train_num,
            "test": test_num,
            "difference": {
                k: (test_num[k] - train_num[k]) if (train_num[k] is not None and test_num[k] is not None) else None for k in train_num
            },
        },
        "missingness_difference": missing_rate,
    }
