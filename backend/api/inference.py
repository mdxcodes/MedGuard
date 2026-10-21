"""MedGuard API inference helpers.

Keeps FastAPI routing separate from the ML training code so that a
production deployment can swap in a different inference backend if needed.
"""

from __future__ import annotations

import logging
from typing import Any, Optional

import numpy as np
import pandas as pd

from backend.api.config import get_or_raise_model
try:
    from backend.ml.explain import explain_prediction
except Exception:  # pragma: no cover
    explain_prediction = None
from backend.api.schemas import (
    AssessmentRequest,
    ClassProbability,
    ExplanationResponse,
    ExplanationItem,
    PredictResponse,
    Prediction,
)
from backend.ml import triagegeist_schema
from backend.ml.triagegeist_preprocessing import (
    build_preprocessor,
    build_feature_frame,
    leakage_free_feature_names,
)
from backend.ml.triagegeist_validation import assess_input_quality
try:
    from backend.ml.uncertainty import compute_uncertainty_metrics
except Exception:
    compute_uncertainty_metrics = None

log = logging.getLogger("medguard.api.inference")


def _normalize_assessment(req: AssessmentRequest) -> pd.DataFrame:
    """Build a single-row DataFrame from the validated Pydantic request.

    Maps Triagegeist API field names to preprocessing-compatible names.
    Missing fields become NaN (handled by imputation downstream).
    """
    row: dict[str, Any] = {
        triagegeist_schema.TARGET_COLUMN: np.nan,  # placeholder; dropped before prediction
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

    # Numeric vitals
    row["heart_rate"] = maybe_float(req.heart_rate)
    row["respiratory_rate"] = maybe_float(req.respiratory_rate)
    row["temperature_c"] = maybe_float(req.temperature_c)
    row["spo2"] = maybe_float(req.spo2)
    row["systolic_bp"] = maybe_float(req.systolic_bp)
    row["diastolic_bp"] = maybe_float(req.diastolic_bp)
    row["pain_score"] = maybe_float(req.pain_score)
    row["age"] = maybe_float(req.age)
    row["arrival_hour"] = maybe_float(req.arrival_hour)
    row["shock_index"] = maybe_float(req.shock_index)
    row["num_prior_ed_visits_12m"] = maybe_float(req.num_prior_ed_visits_12m)
    row["num_active_medications"] = maybe_float(req.num_active_medications)

    # Categoricals
    transport = req.arrival_mode
    row["arrival_mode"] = (
        str(transport).strip().upper() if transport is not None else "UNKNOWN"
    )

    sex = req.sex
    row["sex"] = str(sex).strip().upper() if sex is not None else "UNKNOWN"

    insurance = getattr(req, "insurance_type", None)
    row["insurance_type"] = (
        str(insurance).strip().title() if insurance is not None else "Unknown"
    )

    complaint_system = req.chief_complaint_system
    row["chief_complaint_system"] = (
        str(complaint_system).strip().title() if complaint_system is not None else "Unknown"
    )

    # Build frame with ALL expected feature columns (missing ones get NaN)
    all_feature_cols = list(triagegeist_schema.ALL_FEATURE_COLUMNS)
    for col in all_feature_cols:
        if col not in row:
            row[col] = None

    frame = pd.DataFrame([row])
    return frame


def _apply_validation(frame: pd.DataFrame) -> pd.DataFrame:
    """Apply validation rules to produce a clean feature frame.

    For Triagegeist, we apply range clamping (values outside observed
    training ranges become NaN and are imputed downstream) and ensure
    boolean columns are properly typed.
    """
    # Boolean columns: fill NaN with False, ensure boolean dtype
    for col in triagegeist_schema.BOOLEAN_FEATURE_COLUMNS:
        if col in frame.columns:
            frame[col] = frame[col].fillna(False).astype(bool)

    # Clamp numeric features to valid ranges defined in schema
    for f in triagegeist_schema.FEATURE_FIELDS:
        if f.dtype == "numeric" and f.name in frame.columns:
            col = frame[f.name]
            if f.min_value is not None:
                col = col.where(col >= f.min_value, np.nan)
            if f.max_value is not None:
                col = col.where(col <= f.max_value, np.nan)
            frame[f.name] = col

    # Drop the placeholder target column before the pipeline sees it
    frame.drop(columns=[triagegeist_schema.TARGET_COLUMN], errors="ignore", inplace=True)
    return frame


def _compute_prediction(
    pipeline: Any,
    feature_names: list[str],
    request: AssessmentRequest,
) -> tuple[Prediction, ExplanationResponse]:
    """Run inference and return (prediction, explanation)."""
    sample_frame = _normalize_assessment(request)
    cleaned = _apply_validation(sample_frame)

    # Apply feature engineering (derived features like shock_index)
    from backend.ml.triagegeist_preprocessing import derive_features
    X = derive_features(cleaned)

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
        for lvl in triagegeist_schema.ESI_LABELS
    ]

    # SHAP explanation: best-effort
    explanation_status = "unavailable"
    top_features: list[dict[str, Any]] = []
    try:
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
        quality = None
        try:
            if assess_input_quality is not None:
                sample_frame = _normalize_assessment(request)
                quality = assess_input_quality(sample_frame)
        except Exception as exc:
            log.warning("Quality assessment failed: %s", exc)
            quality = {"has_warnings": True, "warnings": [{"code": "QUALITY_ASSESS_FAILED", "message": str(exc)}], "errors": []}
        uncertainty = None
        try:
            if compute_uncertainty_metrics is not None and prediction and prediction.probabilities:
                pvec = [pp.probability for pp in prediction.probabilities]
                um = compute_uncertainty_metrics(pvec)
                um["calibration_status"] = "unsupported_by_sample_size"
                uncertainty = um
        except Exception as exc:
            log.warning("Uncertainty computation failed: %s", exc)
            uncertainty = None
        return PredictResponse(
            prediction=prediction, explanation=explanation, quality=quality, uncertainty=uncertainty
        )
    except Exception as exc:  # noqa: BLE001
        log.exception("Prediction failed for request %s", request)
        return PredictResponse(
            error=ErrorResponse(detail=f"Prediction failed: {exc}", code="PREDICTION_FAILED"),
        )
