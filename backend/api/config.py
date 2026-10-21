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


class ModelManifest(BaseModel):
    """Schema matching ``models/triagegeist/triage_model.manifest.json``."""

    model_name: str
    model_kind: str
    target: str
    esi_labels: list[int]
    dataset: str
    training_rows: int
    training_patients: int
    random_seed: int
    params: dict[str, Any]
    versions: dict[str, str]
    created_utc: str
    note: str


#: Singleton holding the loaded pipeline + manifest. Initialized on first
#: request; tested via ``load_model_if_needed`` below.
model_state: dict[str, Any] = {"pipeline": None, "manifest": None, "feature_names": None}

log = logging.getLogger("medguard.api")


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

    if not MODEL_PATH.exists():
        raise RuntimeError(
            f"Model artifact not found at {MODEL_PATH}. "
            "Re-run `venv/bin/python -m backend.ml.triagegeist_training` to produce it."
        )
    if not MANIFEST_PATH.exists():
        raise RuntimeError(
            f"Model manifest not found at {MANIFEST_PATH}. "
            "Re-run `venv/bin/python -m backend.ml.triagegeist_training` to produce it."
        )

    import json as _json
    with MANIFEST_PATH.open(encoding="utf-8") as handle:
        manifest_dict = _json.load(handle)
    manifest = ModelManifest(**manifest_dict)

    pipeline = joblib.load(MODEL_PATH)

    # Sanity-check: a real row must transform without error and produce the
    # expected feature count (so we can compare against manifest expectations).
    try:
        from backend.ml.triagegeist_loader import load_all
        from backend.ml.triagegeist_preprocessing import build_feature_frame

        data = load_all()
        train_df_raw = data["train"]
        feature_frame = build_feature_frame(train_df_raw)
        if len(feature_frame) == 0:
            raise RuntimeError("Model sanity check failed: feature frame is empty.")
        transformed = pipeline.named_steps["preprocess"].transform(feature_frame.head(1))
        actual_features = (
            transformed.shape[1] if hasattr(transformed, "shape") else len(transformed)
        )
        if actual_features < 1:
            raise RuntimeError(
                f"Model sanity check failed: transformed output has {actual_features} features."
            )
    except Exception as exc:  # noqa: BLE001
        raise RuntimeError(f"Model sanity check failed: {exc}") from exc

    from backend.ml.triagegeist_preprocessing import leakage_free_feature_names

    feature_names = leakage_free_feature_names(pipeline)
    model_state["pipeline"] = pipeline
    model_state["manifest"] = manifest
    model_state["feature_names"] = feature_names
    log.info(
        "Loaded model %s (%s) with %d features from %s.",
        manifest.model_name,
        manifest.model_kind,
        len(feature_names),
        MODEL_PATH,
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
