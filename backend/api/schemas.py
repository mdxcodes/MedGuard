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

    All fields are optional because the existing Phase-1 validation pipeline
    treats missing vitals as informative (see ``temperature_missing`` etc.)
    rather than fatal. Fields are validated at inference time against the
    dataset-specific envelopes documented in ``docs/DATASET_AUDIT.md``.
    """

    subject_id: Optional[str] = Field(
        None,
        description=(
            "Optional opaque identifier used only for debugging. Must not "
            "be used for real patient PII."
        ),
        examples=["demo-001"],
    )
    temperature: Optional[float] = Field(
        None,
        description=(
            "Body temperature recorded at triage. Celsius values <= 45 are "
            "assumed Celsius; > 45 are assumed Fahrenheit and converted. "
            "Values outside [34, 42] C after conversion become missing."
        ),
        examples=[98.6, 37.0],
    )
    heartrate: Optional[float] = Field(
        None,
        ge=30.0,
        le=220.0,
        description="Heart rate in beats per minute.",
        examples=[80.0],
    )
    resprate: Optional[float] = Field(
        None,
        ge=4.0,
        le=60.0,
        description="Respiratory rate in breaths per minute.",
        examples=[16.0],
    )
    o2sat: Optional[float] = Field(
        None,
        ge=50.0,
        le=100.0,
        description="Peripheral oxygen saturation as a percent.",
        examples=[98.0],
    )
    sbp: Optional[float] = Field(
        None,
        ge=50.0,
        le=250.0,
        description="Systolic blood pressure in mmHg.",
        examples=[120.0],
    )
    dbp: Optional[float] = Field(
        None,
        ge=30.0,
        le=150.0,
        description="Diastolic blood pressure in mmHg.",
        examples=[80.0],
    )
    pain: Optional[float] = Field(
        None,
        ge=0.0,
        le=10.0,
        description=(
            "Numeric pain score on a 0-10 scale. Values > 10 or non-numeric "
            "tokens (e.g. 'UA', 'unable') become missing with a retained "
            "indicator."
        ),
        examples=[5.0],
    )
    arrival_transport: Optional[str] = Field(
        None,
        description=(
            "Mode of arrival (e.g. 'AMBULANCE', 'WALK IN', 'UNKNOWN'). "
            "Casing is normalized internally."
        ),
        examples=["AMBULANCE"],
    )
    chiefcomplaint: Optional[str] = Field(
        None,
        description=(
            "Chief complaint text as recorded at triage. Placeholders such "
            "as 'UNKNOWN-CC' are normalized to 'unknown'. The text is "
            "processed through a train-fitted TF-IDF vocabulary."
        ),
        examples=["CHEST PAIN"],
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
            "Demo subset only (207 labeled rows).",
            "ESI Level 5 has zero support in the training data; predictions for "
            "that class are meaningless.",
            "ESI Level 4 has only 2 examples; per-class metrics are unstable.",
            "This model is a research prototype and is NOT clinically validated.",
            "The raw MIMIC data is licensed under ODbL and may not be uploaded "
            "to external services.",
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
