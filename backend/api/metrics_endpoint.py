"""Evaluation metrics endpoint.

Serves aggregate model evaluation metrics from ``reports/triagegeist/``
(``benchmark_results.json`` + ``dataset_profile.json`` + ``experiment_manifest.json``)
— the authoritative source of record for all displayed performance numbers.
Read-only; no patient identifiers or raw records are ever exposed.
"""

from __future__ import annotations

import json
from pathlib import Path

from fastapi import HTTPException

from backend.ml import config


TG_REPORTS = config.PROJECT_ROOT / "reports" / "triagegeist"
BENCHMARK_PATH = TG_REPORTS / "benchmark_results.json"
PROFILE_PATH = TG_REPORTS / "dataset_profile.json"
MANIFEST_PATH = TG_REPORTS / "experiment_manifest.json"

ESI_LABELS = ["ESI 1", "ESI 2", "ESI 3", "ESI 4", "ESI 5"]

TRAINING_ROWS = 80000
TRAINING_PATIENTS = 80000


def _load_json(path: Path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Invalid report {path.name}: {exc}") from exc


def metrics_status():
    """Return aggregate evaluation metrics and dataset profile.

    Returns a dict with two top-level keys:

    * ``dataset`` — row counts, label distribution, missingness summary
      (from ``dataset_profile.json``).
    * ``metrics`` — holdout and 5-fold CV aggregate metrics from
      ``benchmark_results.json`` (Triagegeist big training, 80 000 rows).
    """
    if not BENCHMARK_PATH.exists() or not PROFILE_PATH.exists():
        raise HTTPException(status_code=404, detail="Triagegeist benchmark artifacts not available")

    benchmark = _load_json(BENCHMARK_PATH)
    profile = _load_json(PROFILE_PATH)
    manifest = _load_json(MANIFEST_PATH) if MANIFEST_PATH.exists() else {}
    model_results = benchmark.get("model_results", {})
    lr_holdout = model_results.get("logistic_regression", {})
    cv_summary = benchmark.get("cv_summary", {})

    per_class = lr_holdout.get("per_class", {})
    per_class_holdout = {}
    for label in ESI_LABELS:
        if label in per_class:
            per_class_holdout[label] = per_class[label]

    metrics = {
        "model_name": "logistic_regression",
        "training_rows": TRAINING_ROWS,
        "training_patients": TRAINING_PATIENTS,
        "dataset_size": "big",
        "holdout": {
            "macro_f1": lr_holdout.get("macro_f1"),
            "balanced_accuracy": lr_holdout.get("balanced_accuracy"),
            "quadratic_weighted_kappa": lr_holdout.get("quadratic_weighted_kappa"),
            "confusion_matrix": lr_holdout.get("confusion_matrix"),
            "confusion_matrix_labels": ESI_LABELS,
            "y_true_counts": lr_holdout.get("y_true_counts"),
            "train_rows": benchmark.get("train_rows"),
            "test_rows": benchmark.get("test_rows"),
            "train_patients": benchmark.get("n_patients_train"),
            "test_patients": benchmark.get("n_patients_test"),
        },
        "cv": {
            "mean_macro_f1": cv_summary.get("mean_macro_f1"),
            "std_macro_f1": cv_summary.get("std_macro_f1"),
            "mean_balanced_accuracy": cv_summary.get("mean_balanced_accuracy"),
            "std_balanced_accuracy": cv_summary.get("std_balanced_accuracy"),
            "mean_quadratic_weighted_kappa": cv_summary.get("mean_quadratic_weighted_kappa"),
            "std_quadratic_weighted_kappa": cv_summary.get("std_quadratic_weighted_kappa"),
            "n_folds": cv_summary.get("n_folds"),
            "aggregate_confusion_matrix": None,
        },
        "per_class_holdout": per_class_holdout,
    }

    target_dist = profile.get("target_distribution", {})
    dataset = {
        "n_rows": profile.get("train_rows", TRAINING_ROWS),
        "n_patients": profile.get("train_patients", TRAINING_PATIENTS),
        "label_distribution": target_dist,
        "row_counts": profile.get("row_counts", {}),
        "missing_percent": profile.get("missing_percent", {}),
        "feature_stats": profile.get("feature_stats", {}),
        "target_distribution_train": profile.get("target_distribution_train", target_dist),
        "random_seed": manifest.get("random_seed"),
    }

    return {
        "dataset": dataset,
        "metrics": metrics,
        "provenance": "reports/triagegeist/benchmark_results.json + dataset_profile.json",
    }
