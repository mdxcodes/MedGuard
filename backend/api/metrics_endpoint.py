"""Evaluation metrics endpoint.

Serves aggregate model evaluation metrics from
``reports/model_evaluation.json`` — the authoritative source of record for
all displayed performance numbers. Read-only; no patient identifiers or raw
records are ever exposed.
"""

from __future__ import annotations

import json
from pathlib import Path

from fastapi import HTTPException

from backend.ml import config


REPORTS_DIR = config.PROJECT_ROOT / "reports"
MODEL_EVAL_PATH = REPORTS_DIR / "model_evaluation.json"
DATA_QUALITY_PATH = REPORTS_DIR / "data_quality_report.json"


def metrics_status():
    """Return aggregate evaluation metrics and dataset profile.

    Returns a dict with two top-level keys:

    * ``dataset`` — row counts, label distribution, missingness summary
      (from ``data_quality_report.json``).
    * ``metrics`` — holdout and 5-fold CV aggregate metrics for the selected
      Random Forest model (from ``model_evaluation.json``).
    """
    if not MODEL_EVAL_PATH.exists():
        raise HTTPException(status_code=404, detail="Model evaluation report not available")

    try:
        model_eval = json.loads(MODEL_EVAL_PATH.read_text(encoding="utf-8"))
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Invalid model evaluation report: {exc}") from exc

    data_quality = None
    if DATA_QUALITY_PATH.exists():
        try:
            data_quality = json.loads(DATA_QUALITY_PATH.read_text(encoding="utf-8"))
        except Exception:  # noqa: BLE001
            data_quality = None

    # Selected model = Random Forest per reports/model_evaluation.json
    rf_holdout = model_eval.get("candidates_holdout", {}).get("random_forest", {})
    rf_cv = model_eval.get("candidates_5fold_cv", {}).get("random_forest", {})
    cv_summary = rf_cv.get("summary", {})

    metrics = {
        "model_name": "random_forest",
        "holdout": {
            "macro_f1": rf_holdout.get("macro_f1"),
            "balanced_accuracy": rf_holdout.get("balanced_accuracy"),
            "quadratic_weighted_kappa": rf_holdout.get("quadratic_weighted_kappa"),
            "confusion_matrix": rf_holdout.get("confusion_matrix"),
            "confusion_matrix_labels": rf_holdout.get("confusion_matrix_labels", ["ESI 1", "ESI 2", "ESI 3", "ESI 4", "ESI 5"]),
            "y_true_counts": rf_holdout.get("y_true_counts"),
            "train_rows": rf_holdout.get("train_rows"),
            "test_rows": rf_holdout.get("test_rows"),
        },
        "cv": {
            "mean_macro_f1": cv_summary.get("mean_macro_f1"),
            "std_macro_f1": cv_summary.get("std_macro_f1"),
            "mean_balanced_accuracy": cv_summary.get("mean_balanced_accuracy"),
            "std_balanced_accuracy": cv_summary.get("std_balanced_accuracy"),
            "mean_quadratic_weighted_kappa": cv_summary.get("mean_quadratic_weighted_kappa"),
            "std_quadratic_weighted_kappa": cv_summary.get("std_quadratic_weighted_kappa"),
            "n_folds": cv_summary.get("n_folds"),
            "aggregate_confusion_matrix": rf_cv.get("aggregate_confusion_matrix"),
        },
        "per_class_holdout": rf_holdout.get("per_class"),
    }

    dataset = {}
    if data_quality:
        dataset = {
            "n_rows": model_eval.get("n_rows"),
            "n_patients": model_eval.get("n_patients"),
            "label_distribution": model_eval.get("class_distribution"),
            "row_counts": data_quality.get("row_counts"),
            "missing_percent": data_quality.get("missing_percent"),
            "feature_stats": data_quality.get("feature_stats"),
        }

    return {
        "dataset": dataset,
        "metrics": metrics,
        "provenance": "reports/model_evaluation.json + reports/data_quality_report.json",
    }
