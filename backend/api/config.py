"""MedGuard API configuration.

Environment variables
---------------------
MEDGUARD_MODEL_PATH
    Absolute path to the saved ``*.joblib`` inference pipeline. Defaults to
    ``models/triagegeist/triage_model.joblib`` relative to the project root.

MEDGUARD_MANIFEST_PATH
    Absolute path to the saved ``*.manifest.json`` metadata file. Defaults
    to ``models/triagegeist/triage_model.manifest.json`` relative to the
    project root.

MEDGUARD_DATA_ROOT
    Root directory containing the Triagegeist dataset (default:
    ``triagegeist/`` relative to project root).

MEDGUARD_ALLOW_FOREIGN_ORIGIN
    When set to ``1``, CORS allows requests from any origin. In production
    leave unset so that Starlette defaults to ``RequestHeaders`` origin
    validation. This key exists to keep tests deterministic without forcing
    cross-origin credentials.
"""

from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Any, Optional

from dotenv import load_dotenv
from pydantic import BaseModel, Field
from fastapi import FastAPI

from backend.ml import artifacts

# Resolve absolute paths so downstream scripts can run from any CWD.
_PROJECT_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(_PROJECT_ROOT / ".env")

ENV: dict[str, str] = {
    "MODEL_PATH": _PROJECT_ROOT
        / (os.getenv("MEDGUARD_MODEL_PATH", "models/triagegeist/triage_model.joblib")),
    "MANIFEST_PATH": _PROJECT_ROOT
        / (os.getenv("MEDGUARD_MANIFEST_PATH", "models/triagegeist/triage_model.manifest.json")),
    "DATA_ROOT": _PROJECT_ROOT
        / os.getenv("MEDGUARD_DATA_ROOT", "triagegeist"),
}

MODEL_PATH = Path(ENV["MODEL_PATH"])
MANIFEST_PATH = Path(ENV["MANIFEST_PATH"])
DATA_ROOT = Path(ENV["DATA_ROOT"])

#: When truthy the app enables permissive CORS (useful for tests).
ALLOW_FOREIGN_ORIGIN = os.getenv("MEDGUARD_ALLOW_FOREIGN_ORIGIN", "0") == "1"


def _allowed_origins() -> list[str]:
    """Origins allowed to call the API.

    ``MEDGUARD_CORS_ORIGINS`` is a comma-separated list of exact origins,
    for example the deployed Vercel frontend and its preview deployments::

        MEDGUARD_CORS_ORIGINS=https://medguard.vercel.app,https://medguard-*.vercel.app

    A wildcard entry (``*``) is accepted for local development, but it is
    never combined with credentialed requests, because browsers reject that
    combination and the specification forbids it.
    """
    raw = os.getenv("MEDGUARD_CORS_ORIGINS", "").strip()
    if not raw:
        return []
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


#: Exact origins permitted to call this API from a browser.
CORS_ORIGINS = _allowed_origins()

#: Optional regular expression matching additional origins, used for Vercel
#: preview deployments whose domain is not known in advance, e.g.
#: ``https://medguard-.*\.vercel\.app``. Leave unset to allow only the exact
#: origins above.
CORS_ORIGIN_REGEX = os.getenv("MEDGUARD_CORS_ORIGIN_REGEX", "").strip() or None


class ModelManifest(BaseModel):
    """Schema matching ``models/triagegeist/triage_model.manifest.json``."""

    model_name: str
    model_kind: str
    target: str
    esi_labels: list[int]
    dataset: str
    training_rows: int
    training_patients: int
    class_distribution: dict[str, int] = {}
    random_seed: int
    params: dict[str, Any]
    versions: dict[str, str]
    created_utc: str
    note: str


#: Singleton holding the loaded pipeline + manifest. Initialized on first
#: request; tested via ``load_model_if_needed`` below.
model_state: dict[str, Any] = {"pipeline": None, "manifest": None, "feature_names": None}

log = logging.getLogger("medguard.api")


def resolve_artifact_paths() -> tuple[Path, Path]:
    """Return the paths of the model and manifest artifacts.

    The artifacts are taken from the local filesystem when they are present.
    Otherwise they are fetched from the configured remote URL and verified
    against their expected digest. Raises ``RuntimeError`` with an actionable
    cause when they cannot be made available.

    No placeholder or dummy model is ever substituted.
    """
    model_path = artifacts.resolve_artifact(
        MODEL_PATH,
        MODEL_PATH.name,
        artifacts.MODEL_URL_ENV,
        artifacts.MODEL_SHA_ENV,
    )
    manifest_path = artifacts.resolve_artifact(
        MANIFEST_PATH,
        MANIFEST_PATH.name,
        artifacts.MANIFEST_URL_ENV,
        artifacts.MANIFEST_SHA_ENV,
    )

    missing = []
    if model_path is None:
        missing.append(
            f"model artifact ({MODEL_PATH}); set {artifacts.MODEL_URL_ENV} to fetch it "
            f"or place it on disk"
        )
    if manifest_path is None:
        missing.append(
            f"model manifest ({MANIFEST_PATH}); set {artifacts.MANIFEST_URL_ENV} to fetch it "
            f"or place it on disk"
        )
    if missing:
        raise RuntimeError(
            "Missing " + " and ".join(missing) + "."
            "See docs/RENDER_DEPLOYMENT_FIX.md for the deployment options."
        )
    return model_path, manifest_path


def _schema_probe_frame():
    """Build a single schema-valid row for the startup compatibility check.

    The row carries one placeholder value per feature column, chosen from the
    schema itself (the midpoint of the declared range for numerics, the first
    declared category for categoricals, ``False`` for booleans). It exists
    only to prove that the saved artifact and the current code still agree on
    the feature schema; it is never used to produce a prediction.
    """
    import pandas as pd

    from backend.ml import triagegeist_schema

    row = {}
    for field in triagegeist_schema.FEATURE_FIELDS:
        if field.dtype == "numeric":
            if field.min_value is not None and field.max_value is not None:
                row[field.name] = (field.min_value + field.max_value) / 2.0
            else:
                row[field.name] = 1.0
        elif field.dtype == "categorical":
            row[field.name] = field.categories[0] if field.categories else "unknown"
        elif field.dtype == "boolean":
            row[field.name] = False
    return pd.DataFrame([row])


def load_model_if_needed() -> tuple[Any, ModelManifest, list[str]]:
    """Load the joblib pipeline + JSON manifest lazily.

    Returns ``(pipeline, manifest, feature_names)``. Raises ``RuntimeError``
    with a human-readable cause when the artifact is missing or incompatible.
    """
    if model_state.get("pipeline") is not None:
        return model_state["pipeline"], model_state["manifest"], model_state["feature_names"]

    import joblib
    from backend.ml.triagegeist_preprocessing import leakage_free_feature_names
    from backend.ml.triagegeist_training import run_training

    model_path, manifest_path = resolve_artifact_paths()

    import json as _json
    with manifest_path.open(encoding="utf-8") as handle:
        manifest_dict = _json.load(handle)
    manifest = ModelManifest(**manifest_dict)

    pipeline = joblib.load(model_path)

    # Sanity-check: the artifact must still agree with the code that will feed
    # it. The check is built from the SCHEMA, not from the training dataset:
    # the dataset is a licensed/large artefact that is not deployed, and
    # inference only ever needs the model. Requiring train.csv here would make
    # the service start but refuse to predict.
    from backend.ml.triagegeist_preprocessing import (
        build_feature_frame,
        leakage_free_feature_names,
    )

    feature_names = leakage_free_feature_names(pipeline)

    try:
        feature_frame = build_feature_frame(_schema_probe_frame())
        if len(feature_frame) == 0:
            raise RuntimeError("feature frame is empty")
        transformed = pipeline.named_steps["preprocess"].transform(feature_frame.head(1))
        actual_features = (
            transformed.shape[1] if hasattr(transformed, "shape") else len(transformed)
        )
        if actual_features < 1:
            raise RuntimeError(f"transformed output has {actual_features} features")
        if actual_features != len(feature_names):
            raise RuntimeError(
                f"artifact expects {len(feature_names)} transformed features but the "
                f"current schema produces {actual_features}; the model and the code "
                f"are out of sync"
            )
    except Exception as exc:  # noqa: BLE001
        raise RuntimeError(f"Model sanity check failed: {exc}") from exc
    model_state["pipeline"] = pipeline
    model_state["manifest"] = manifest
    model_state["feature_names"] = feature_names
    log.info(
        "Loaded model %s (%s) with %d features from %s.",
        manifest.model_name,
        manifest.model_kind,
        len(feature_names),
        model_path,
    )
    return pipeline, manifest, feature_names


def build_app() -> FastAPI:
    """Build a fresh FastAPI application from the current configuration."""
    from backend.api.main import create_app
    return create_app()


def get_or_raise_model() -> tuple[Any, ModelManifest, list[str]]:
    """Return the loaded model; surface a clear 503 when unavailable."""
    try:
        return load_model_if_needed()
    except RuntimeError as exc:
        raise exc  # keep original message intact
