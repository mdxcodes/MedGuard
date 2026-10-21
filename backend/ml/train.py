"""MedGuard Phase 2 — model training.

Implements two baselines and two candidate models.  Fitting re-uses the
leakage-safe preprocessing from ``backend.ml.features``: every
``SimpleImputer`` median, ``OneHotEncoder`` category set and TF-IDF
vocabulary is fitted *inside the fold*, never on the full cohort.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
import joblib
from sklearn.dummy import DummyClassifier
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
import sklearn

from backend.ml import config, triagegeist_schema
from backend.ml.features import build_preprocessor

RANDOM_SEED = config.RANDOM_SEED

DEFAULT_DUMMY_STRATEGIES: tuple[str, ...] = ("most_frequent", "stratified")

LOGISTIC_PARAMS: dict[str, Any] = {
    "solver": "saga",
    "C": 0.5,
    "max_iter": 5000,
    "random_state": RANDOM_SEED,
}

RANDOM_FOREST_PARAMS: dict[str, Any] = {
    "n_estimators": 80,
    "max_depth": 6,
    "min_samples_leaf": 4,
    "min_samples_split": 6,
    "random_state": RANDOM_SEED,
    "n_jobs": -1,
    "class_weight": "balanced_subsample",
}

MODEL_REGISTRY: dict[str, dict[str, Any]] = {
    "logistic_regression": {"kind": "LogisticRegression", "params": dict(LOGISTIC_PARAMS)},
    "random_forest": {"kind": "RandomForestClassifier", "params": dict(RANDOM_FOREST_PARAMS)},
    "dummy_most_frequent": {"kind": "DummyClassifier", "params": {"strategy": "most_frequent", "random_state": RANDOM_SEED}},
    "dummy_stratified": {"kind": "DummyClassifier", "params": {"strategy": "stratified", "random_state": RANDOM_SEED}},
}


def build_model(model_name: str):
    """Return an *unfitted* estimator for ``model_name``."""
    if model_name == "logistic_regression":
        return LogisticRegression(**LOGISTIC_PARAMS)
    if model_name == "random_forest":
        return RandomForestClassifier(**RANDOM_FOREST_PARAMS)
    if model_name == "dummy_most_frequent":
        return DummyClassifier(strategy="most_frequent", random_state=RANDOM_SEED)
    if model_name == "dummy_stratified":
        return DummyClassifier(strategy="stratified", random_state=RANDOM_SEED)
    raise ValueError(f"unknown model {model_name!r}; known: {sorted(MODEL_REGISTRY)}")


def build_estimator_pipeline(model_name: str) -> Pipeline:
    """Unfitted sklearn ``Pipeline`` (preprocess + estimator).

    Preprocessing is the Phase-1 ``build_preprocessor()`` pipeline, so TF-IDF
    vocabulary, imputer medians and encoder categories are all fitted per fold.
    """
    return Pipeline(steps=[
        ("preprocess", build_preprocessor()),
        ("estimator", build_model(model_name)),
    ])


def persist_pipeline(
    pipeline: Pipeline,
    path: Path,
    *,
    model_name: str,
    training_rows: int,
    training_patients: int,
) -> Path:
    """Persist a fitted pipeline with ``joblib`` and return the written path."""
    from datetime import datetime, timezone
    import platform

    path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(pipeline, path)
    manifest = {
        "model_name": model_name,
        "model_kind": type(pipeline.named_steps["estimator"]).__name__ if "estimator" in pipeline.named_steps else type(pipeline).__name__,
        "target": config.TARGET_COLUMN,
        "esi_labels": list(config.ESI_LABELS),
        "dataset": triagegeist_schema.dataset_provenance()["name"],
        "training_rows": training_rows,
        "training_patients": training_patients,
        "random_seed": RANDOM_SEED,
        "params": dict(MODEL_REGISTRY.get(model_name, {}).get("params", {})),
        "versions": {
            "python": platform.python_version(),
            "scikit-learn": sklearn.__version__,
            "pandas": pd.__version__,
            "numpy": np.__version__,
            "joblib": joblib.__version__,
        },
        "created_utc": datetime.now(timezone.utc).isoformat(),
        "note": "Demonstration model on Triagegeist synthetic dataset. Not for clinical use.",
    }
    manifest_path = path.with_suffix(".manifest.json")
    import json as _json
    manifest_path.write_text(_json.dumps(manifest, indent=2, default=str))
    return path
