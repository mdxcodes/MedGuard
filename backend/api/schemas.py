"""Pydantic request / response schemas for the MedGuard API.

These schemas intentionally do NOT carry ML implementation details so that
the HTTP contract remains stable even when preprocessing or model internals
change.
"""

from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, Field


class AssessmentRequest(BaseModel):
    """Minimal triage assessment submitted by a consumer.

    All fields are optional because missing vitals are treated as informative
    (missingness indicators added during preprocessing) rather than fatal.
    Fields are validated at inference time against the dataset-specific
    envelopes documented in the Triagegeist schema.
    """

    patient_id: Optional[str] = Field(
        None,
        description=(
            "Optional opaque patient identifier used only for debugging. "
            "Must not be used for real patient PII."
        ),
        examples=["demo-001"],
    )
    heart_rate: Optional[float] = Field(
        None,
        ge=20.0,
        le=220.0,
        description="Heart rate in beats per minute.",
        examples=[80.0],
    )
    respiratory_rate: Optional[float] = Field(
        None,
        ge=4.0,
        le=60.0,
        description="Respiratory rate in breaths per minute.",
        examples=[16.0],
    )
    temperature_c: Optional[float] = Field(
        None,
        description="Body temperature in Celsius.",
        examples=[37.0, 98.6],
    )
    spo2: Optional[float] = Field(
        None,
        ge=50.0,
        le=100.0,
        description="Peripheral oxygen saturation as a percent.",
        examples=[98.0],
    )
    systolic_bp: Optional[float] = Field(
        None,
        ge=50.0,
        le=250.0,
        description="Systolic blood pressure in mmHg.",
        examples=[120.0],
    )
    diastolic_bp: Optional[float] = Field(
        None,
        ge=30.0,
        le=150.0,
        description="Diastolic blood pressure in mmHg.",
        examples=[80.0],
    )
    pain_score: Optional[float] = Field(
        None,
        ge=0.0,
        le=10.0,
        description=(
            "Numeric pain score on a 0-10 scale."
        ),
        examples=[5.0],
    )
    arrival_mode: Optional[str] = Field(
        None,
        description=(
            "Mode of arrival (e.g. 'AMBULANCE', 'WALK IN', 'UNKNOWN'). "
            "Casing is normalized internally."
        ),
        examples=["AMBULANCE"],
    )
    chief_complaint_system: Optional[str] = Field(
        None,
        description=(
            "Chief complaint system category (e.g. 'Cardiovascular', "
            "'Respiratory', 'Neurological', 'Abdominal', 'Trauma')."
        ),
        examples=["CHEST PAIN"],
    )
    age: Optional[float] = Field(
        None,
        ge=0.0,
        le=120.0,
        description="Patient age in years.",
        examples=[45.0],
    )
    sex: Optional[str] = Field(
        None,
        description="Patient biological sex (M, F, Other, Unknown).",
        examples=["M", "F"],
    )
    arrival_hour: Optional[float] = Field(
        None,
        ge=0.0,
        le=23.0,
        description="Hour of arrival (0-23).",
        examples=[14.0],
    )
    shock_index: Optional[float] = Field(
        None,
        ge=0.0,
        le=10.0,
        description="Shock index (heart_rate / systolic_bp).",
        examples=[0.8],
    )
    num_prior_ed_visits_12m: Optional[float] = Field(
        None,
        ge=0.0,
        le=50.0,
        description="Prior ED visits in 12 months.",
        examples=[2.0],
    )
    num_active_medications: Optional[float] = Field(
        None,
        ge=0.0,
        le=30.0,
        description="Active medications count.",
        examples=[3.0],
    )


class ClassProbability(BaseModel):
    """Probability assigned to one ESI class."""

    esi_level: int
    probability: float


class ModelInfoResponse(BaseModel):
    """Metadata exposed by ``GET /model-info``."""

    model_name: str
    model_kind: str
    target: str
    supported_esi_levels: list[int]
    training_rows: int
    training_patients: int
    random_seed: int
    dataset: str
    created_utc: str
    limitations: list[str] = Field(
        default_factory=lambda: [
            "Synthetic dataset only.",
            "All five ESI levels are present in the training cohort, but the "
            "rarest level (ESI 1) has far fewer examples than the dominant "
            "ones, so its predictions are the least certain.",
            "This model is a research prototype and is NOT clinically validated.",
            "Not suitable for real clinical triage decisions.",
        ]
    )
    note: str


class Prediction(BaseModel):
    """Single-sample prediction returned by ``POST /predict``."""

    predicted_esi_level: int
    probabilities: list[ClassProbability]
    note: str = "Probabilities reflect model confidence, not clinical calibration."


class ExplanationItem(BaseModel):
    """One feature's SHAP attribution."""

    feature: str
    shap_value: float
    sample_value: Optional[float] = None


class ExplanationResponse(BaseModel):
    """SHAP explanation returned alongside a prediction when available."""

    explanation_status: str  # 'available' | 'unavailable'
    predicted_class: Optional[int] = None
    explained_class: Optional[int] = None
    top_features: list[ExplanationItem] = Field(
        default_factory=list,
        description="Top features by absolute SHAP value, capped at 10.",
    )
    note: str = (
        "Attribution indicates model feature sensitivity, not medical causation."
    )


class QualityWarning(BaseModel):
    """Input quality or distribution warning."""
    code: str
    message: str
    feature: Optional[str] = None
    details: dict[str, Any] = Field(default_factory=dict)


class InputQualityResponse(BaseModel):
    """Conservative input quality assessment."""
    has_errors: bool = False
    has_warnings: bool = False
    warnings: list[QualityWarning] = Field(default_factory=list)
    errors: list[QualityWarning] = Field(default_factory=list)


class ErrorResponse(BaseModel):
    """Generic error envelope."""

    detail: str
    code: Optional[str] = Field(None, description="Machine-readable error code.")


class UncertaintyResponse(BaseModel):
    """Interpretable uncertainty indicators (research-only)."""
    max_prob: float
    prediction_margin: float
    predictive_entropy: float
    entropy_norm: float
    available: bool = True
    calibration_status: str = "unsupported_by_sample_size"
    note: str = "Indicators describe model confidence patterns, not clinical certainty."


class PredictResponse(BaseModel):
    """Full response returned by ``POST /predict``."""

    prediction: Optional[Prediction] = None
    explanation: Optional[ExplanationResponse] = None
    error: Optional[ErrorResponse] = None
    quality: Optional[InputQualityResponse] = None
    uncertainty: Optional[UncertaintyResponse] = None
    disclaimer: str = (
        "MEDGUARD IS A RESEARCH PROTOTYPE. This output must NOT be used for "
        "clinical decision-making, triage routing, or treatment guidance."
    )
