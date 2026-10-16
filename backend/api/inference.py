"""MedGuard API inference helpers.

Keeps FastAPI routing separate from the ML training code so that a
production deployment can swap in a different inference backend if needed.
"""

from __future__ import annotations

import logging
from typing import Any, Optional, Sequence

import numpy as np
import pandas as pd

from backend.api.config import get_or_raise_model
from backend.api.schemas import (
    AssessmentRequest,
    ClassProbability,
    ExplanationResponse,
    PredictResponse,
    Prediction,
)
from backend.ml import config as ml_config
from backend.ml.validation import (
    normalize_temperature,
    parse_pain,
    validate_blood_pressure,
    validate_vitals,
    normalize_chiefcomplaint,
    add_missingness_indicators,
)

log = logging.getLogger("medguard.api.inference")


def _normalize_assessment(req: AssessmentRequest) -> pd.DataFrame:
    """Build a single-row DataFrame from the validated Pydantic request."""
    row: dict[str, Any] = {
        ml_config.TARGET_COLUMN: np.nan,  # placeholder; dropped before prediction
    }

    def maybe_float(val: Any) -> Optional[float]:
        if val is None:
            return None
        try:
            f = float(val)
            if np.isnan(f):
                return None
            return f
        except (TypeError, ValueError):
            return None

    # Temperature: accept either °C or °F raw; the validation function converts.
    temp_raw = maybe_float(req.temperature)
    row["temperature"] = temp_raw

    for col in ("heartrate", "resprate", "o2sat", "sbp", "dbp", "pain"):
        row[col] = maybe_float(getattr(req, col))

    # Categoricals — accept nulls (become 'unknown' / 'missing' downstream).
    transport = req.arrival_transport
    row["arrival_transport"] = (
        str(transport).strip().upper() if transport is not None else "unknown"
    )

    complaint = req.chiefcomplaint
    row["chiefcomplaint"] = (
        str(complaint).strip() if complaint is not None else ""
    )

    frame = pd.DataFrame([row])
    return frame


def _apply_validation(frame: pd.DataFrame) -> pd.DataFrame:
    """Apply Phase-1 validation rules to produce a clean feature frame."""
    # Temperature
    frame["temperature"], _ = normalize_temperature(frame["temperature"])
    # Pain
    frame["pain"], _ = parse_pain(frame["pain"])
    # Blood pressure
    frame["sbp"], frame["dbp"], _ = validate_blood_pressure(
        frame.get("sbp", pd.Series(dtype=float)),
        frame.get("dbp", pd.Series(dtype=float)),
    )
    # Remaining vitals
    frame, _ = validate_vitals(frame)
    # Chief complaint
    frame["chiefcomplaint"], _ = normalize_chiefcomplaint(frame["chiefcomplaint"])
    # Missingness indicators
    frame = add_missingness_indicators(
        frame,
        ("temperature", "heartrate", "resprate", "o2sat", "sbp", "dbp", "pain"),
    )
    # Drop the placeholder target column before the pipeline sees it.
    frame.drop(columns=[ml_config.TARGET_COLUMN], errors="ignore", inplace=True)
    return frame


def _compute_prediction(
    pipeline: Any,
    feature_names: list[str],
    request: AssessmentRequest,
) -> tuple[Prediction, ExplanationResponse]:
    """Run inference and return (prediction, explanation)."""
    sample_frame = _normalize_assessment(request)
    cleaned = _apply_validation(sample_frame)

    # Run the derive step BEFORE selecting columns, so that shock_index etc.
    # are present on the DataFrame and the ColumnTransformer downstream does
    # not raise "columns are missing".
    from backend.ml.features import derive_features
    derived = derive_features(cleaned)

    # The pipeline expects columns matching the training feature set. We pass
    # only the allow-listed columns present on the derived frame; remainder is
    # dropped by the ColumnTransformer.
    available = list(derived.columns.intersection(feature_names))
    X = derived[available]
    if len(available) != len(feature_names):
        log.warning(
            "Predicting with %d of %d expected features; missing: %s",
            len(available), len(feature_names),
            sorted(set(feature_names) - set(available)),
        )

    pred_idx = int(pipeline.predict(X)[0])
    classes = pipeline.named_steps["estimator"].classes_.tolist()
    proba = pipeline.predict_proba(X)[0]
    probabilities = [
        ClassProbability(esi_level=int(c), probability=float(p))
        for c, p in zip(classes, proba)
    ]

    # Build full supported-classes list (including absent ESI 5)
    probabilities_full = [
        ClassProbability(
            esi_level=int(lvl),
            probability=float(proba[list(classes).index(int(lvl))])
            if int(lvl) in classes
            else 0.0,
        )
        for lvl in ml_config.ESI_LABELS
    ]

    # SHAP explanation: best-effort. If it fails, return status='unavailable'.
    explanation_status = "unavailable"
    top_features: list[dict[str, Any]] = []
    try:
        from backend.ml.explain import explain_prediction
        expl = explain_prediction(
            pipeline,
            X,
            row_index=0,
            target_class=None,
        )
        top_features = [
            ExplanationItem(
                feature=item["feature"],
                shap_value=float(item["shap_value"]),
                sample_value=float(item.get("sample_value", 0.0)),
            )
            for item in expl.get("top_features", [])[:10]
        ]
        explanation_status = "available"
    except Exception as exc:  # noqa: BLE001
        log.warning("SHAP explanation failed: %s", exc)
        explanation_status = "unavailable"

    prediction = Prediction(
        predicted_esi_level=pred_idx,
        probabilities=probabilities_full,
    )
    explanation = ExplanationResponse(
        explanation_status=explanation_status,
        predicted_class=pred_idx,
        explained_class=pred_idx,
        top_features=top_features,
    )
    return prediction, explanation


def predict(request: AssessmentRequest) -> PredictResponse:
    """Public inference entry-point used by the FastAPI router."""
    try:
        pipeline, manifest, feature_names = get_or_raise_model()
    except RuntimeError as exc:
        return PredictResponse(
            error=ErrorResponse(detail=str(exc), code="MODEL_UNAVAILABLE"),
        )

    try:
        prediction, explanation = _compute_prediction(
            pipeline, feature_names, request
        )
        return PredictResponse(prediction=prediction, explanation=explanation)
    except Exception as exc:  # noqa: BLE001
        log.exception("Prediction failed for request %s", request)
        return PredictResponse(
            error=ErrorResponse(detail=f"Prediction failed: {exc}", code="PREDICTION_FAILED"),
        )
