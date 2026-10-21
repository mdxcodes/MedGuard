"""Triagegeist dataset schema and feature eligibility.

Defines the canonical schema for the Triagegeist synthetic dataset,
classifies each column by its role in the ML pipeline, and documents
leakage exclusions.

Every field is classified as one of:
- FEATURE: eligible model input (fitted in preprocessing)
- CONTEXT: prediction-time metadata (shown in UI, not used as feature)
- TARGET: the label (triage_acuity)
- IDENTIFIER: patient/stay identifier (never a feature)
- METADATA: administrative/operational field
- LEAKAGE: post-outcome or outcome-derived field (excluded)
- EXCLUDED: not usable for modeling with a documented reason
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

Role = Literal["feature", "context", "target", "identifier", "metadata", "leakage", "excluded"]


@dataclass(frozen=True)
class FieldSchema:
    name: str
    role: Role
    dtype: str  # "numeric", "categorical", "text", "boolean", "identifier"
    description: str
    units: str | None = None
    min_value: float | None = None
    max_value: float | None = None
    categories: tuple[str, ...] | None = None
    missing_sentinel: str | None = None


# ---------------------------------------------------------------------------
# FIELD REGISTRY
# ---------------------------------------------------------------------------

FIELDS: list[FieldSchema] = [
    # ---------------- Target ----------------
    FieldSchema("triage_acuity", "target", "numeric",
                "Emergency Severity Index acuity level (1=highest, 5=lowest)",
                min_value=1, max_value=5),

    # ---------------- Identifiers ----------------
    FieldSchema("patient_id", "identifier", "identifier",
                "Unique patient identifier (links all files)", missing_sentinel=None),
    FieldSchema("site_id", "identifier", "identifier",
                "Hospital site identifier", missing_sentinel=None),
    FieldSchema("triage_nurse_id", "identifier", "identifier",
                "Triage nurse identifier", missing_sentinel=None),

    # ---------------- Demographics (features) ----------------
    FieldSchema("age", "feature", "numeric", "Patient age in years",
                units="years", min_value=0, max_value=120),
    FieldSchema("age_group", "derived", "categorical",
                "Age group category", categories=("pediatric", "adult", "geriatric")),
    FieldSchema("sex", "feature", "categorical",
                "Patient biological sex", categories=("M", "F", "Other", "Unknown")),
    FieldSchema("language", "feature", "categorical",
                "Preferred language", categories=("English", "Spanish", "Other", "Unknown")),
    FieldSchema("insurance_type", "feature", "categorical",
                "Insurance type", categories=("Private", "Medicare", "Medicaid", "Self-pay", "Other", "Unknown")),

    # ---------------- Arrival context ----------------
    FieldSchema("arrival_mode", "feature", "categorical",
                "Mode of arrival", categories=("AMBULANCE", "WALK IN", "OTHER", "UNKNOWN")),
    FieldSchema("arrival_transport", "context", "categorical",
                "Arrival transport category (UI context only)",
                categories=("AMBULANCE", "WALK IN", "UNKNOWN", "OTHER")),
    FieldSchema("transport_origin", "feature", "categorical",
                "Origin of transport",
                categories=("Scene", "Transfer", "Walk-in", "Unknown")),
    FieldSchema("arrival_hour", "feature", "numeric", "Hour of arrival (0-23)",
                units="hour", min_value=0, max_value=23),
    FieldSchema("arrival_day", "feature", "numeric", "Day of week (1=Mon)",
                units="day", min_value=1, max_value=7),
    FieldSchema("arrival_month", "feature", "numeric", "Month of arrival (1-12)",
                units="month", min_value=1, max_value=12),
    FieldSchema("arrival_season", "feature", "categorical",
                "Season of arrival", categories=("Winter", "Spring", "Summer", "Fall")),
    FieldSchema("shift", "feature", "categorical",
                "Shift of arrival", categories=("Day", "Evening", "Night")),

    # ---------------- Vitals (features) ----------------
    FieldSchema("heart_rate", "feature", "numeric", "Heart rate",
                units="bpm", min_value=20, max_value=220),
    FieldSchema("respiratory_rate", "feature", "numeric", "Respiratory rate",
                units="/min", min_value=4, max_value=60),
    FieldSchema("temperature_c", "feature", "numeric", "Body temperature",
                units="°C", min_value=30.0, max_value=42.0),
    FieldSchema("spo2", "feature", "numeric", "Oxygen saturation",
                units="%", min_value=50, max_value=100),
    FieldSchema("systolic_bp", "feature", "numeric", "Systolic blood pressure",
                units="mmHg", min_value=50, max_value=250),
    FieldSchema("diastolic_bp", "feature", "numeric", "Diastolic blood pressure",
                units="mmHg", min_value=30, max_value=150),
    FieldSchema("pain_score", "feature", "numeric", "Pain score",
                units="0-10", min_value=0, max_value=10),

    # ---------------- Derived features ----------------
    FieldSchema("shock_index", "feature", "numeric",
                "Shock index (HR / SBP)", min_value=0.0, max_value=10.0),
    FieldSchema("pulse_pressure", "feature", "numeric",
                "Pulse pressure (SBP - DBP)", units="mmHg", min_value=0, max_value=200),
    FieldSchema("mean_arterial_pressure", "feature", "numeric",
                "Mean arterial pressure", units="mmHg", min_value=0, max_value=200),
    FieldSchema("gcs_total", "feature", "numeric", "Glasgow Coma Scale total",
                min_value=3, max_value=15),
    FieldSchema("weight_kg", "feature", "numeric", "Weight",
                units="kg", min_value=1, max_value=300),
    FieldSchema("height_cm", "feature", "numeric", "Height",
                units="cm", min_value=30, max_value=250),
    FieldSchema("bmi", "feature", "numeric", "Body mass index",
                min_value=10, max_value=60),
    FieldSchema("news2_score", "feature", "numeric", "NEWS2 score",
                min_value=0, max_value=20),

    # ---------------- Chief complaint ----------------
    FieldSchema("chief_complaint_system", "feature", "categorical",
                "Chief complaint system category",
                categories=("Cardiovascular", "Respiratory", "Neurological",
                            "Abdominal", "Trauma", "Other", "Unknown")),
    FieldSchema("chief_complaint_raw", "context", "text",
                "Raw chief complaint text (UI context only)", missing_sentinel=None),

    # ---------------- History counts ----------------
    FieldSchema("num_prior_ed_visits_12m", "feature", "numeric",
                "Prior ED visits in 12 months", min_value=0, max_value=50),
    FieldSchema("num_prior_admissions_12m", "feature", "numeric",
                "Prior admissions in 12 months", min_value=0, max_value=20),
    FieldSchema("num_active_medications", "feature", "numeric",
                "Active medications count", min_value=0, max_value=30),
    FieldSchema("num_comorbidities", "feature", "numeric",
                "Comorbidity count", min_value=0, max_value=20),

    # ---------------- Post-triage outcomes (LEAKAGE - excluded) ----------------
    FieldSchema("disposition", "leakage", "categorical",
                "Disposition (post-triage outcome)",
                categories=("Discharge", "Admit", "Transfer", "Death", "Left")),
    FieldSchema("ed_los_hours", "leakage", "numeric",
                "ED length of stay (post-triage outcome)",
                units="hours", min_value=0, max_value=72),

    # ---------------- Patient history (boolean features) ----------------
    FieldSchema("hx_hypertension", "feature", "boolean", "History of hypertension"),
    FieldSchema("hx_diabetes_type2", "feature", "boolean", "History of type 2 diabetes"),
    FieldSchema("hx_diabetes_type1", "feature", "boolean", "History of type 1 diabetes"),
    FieldSchema("hx_asthma", "feature", "boolean", "History of asthma"),
    FieldSchema("hx_copd", "feature", "boolean", "History of COPD"),
    FieldSchema("hx_heart_failure", "feature", "boolean", "History of heart failure"),
    FieldSchema("hx_atrial_fibrillation", "feature", "boolean", "History of atrial fibrillation"),
    FieldSchema("hx_ckd", "feature", "boolean", "History of chronic kidney disease"),
    FieldSchema("hx_liver_disease", "feature", "boolean", "History of liver disease"),
    FieldSchema("hx_malignancy", "feature", "boolean", "History of malignancy"),
    FieldSchema("hx_obesity", "feature", "boolean", "History of obesity"),
    FieldSchema("hx_depression", "feature", "boolean", "History of depression"),
    FieldSchema("hx_anxiety", "feature", "boolean", "History of anxiety"),
    FieldSchema("hx_dementia", "feature", "boolean", "History of dementia"),
    FieldSchema("hx_epilepsy", "feature", "boolean", "History of epilepsy"),
    FieldSchema("hx_hypothyroidism", "feature", "boolean", "History of hypothyroidism"),
    FieldSchema("hx_hyperthyroidism", "feature", "boolean", "History of hyperthyroidism"),
    FieldSchema("hx_hiv", "feature", "boolean", "History of HIV"),
    FieldSchema("hx_coagulopathy", "feature", "boolean", "History of coagulopathy"),
    FieldSchema("hx_immunosuppressed", "feature", "boolean", "History of immunosuppression"),
    FieldSchema("hx_pregnant", "feature", "boolean", "History of pregnancy"),
    FieldSchema("hx_substance_use_disorder", "feature", "boolean", "History of substance use disorder"),
    FieldSchema("hx_coronary_artery_disease", "feature", "boolean", "History of coronary artery disease"),
    FieldSchema("hx_stroke_prior", "feature", "boolean", "History of prior stroke"),
    FieldSchema("hx_peripheral_vascular_disease", "feature", "boolean", "History of PVD"),

    # ---------------- HPI / reason for visit ----------------
]

#: Chief complaint raw text lives in chief_complaints.csv (joined on patient_id).
#: Patient history lives in patient_history.csv (joined on patient_id).


# ---------------------------------------------------------------------------
# CLASSIFICATION VIEWS
# ---------------------------------------------------------------------------

def features_by_role(role: Role) -> list[FieldSchema]:
    """Return all fields with the given role."""
    return [f for f in FIELDS if f.role == role]


FEATURE_FIELDS = features_by_role("feature")
CONTEXT_FIELDS = features_by_role("context")
TARGET_FIELDS = features_by_role("target")
IDENTIFIER_FIELDS = features_by_role("identifier")
LEAKAGE_FIELDS = features_by_role("leakage")
EXCLUDED_FIELDS = features_by_role("excluded")

#: Numeric feature column names (used for imputation/scaling).
NUMERIC_FEATURE_COLUMNS: list[str] = [f.name for f in FEATURE_FIELDS if f.dtype == "numeric"]

#: Categorical feature column names (used for one-hot encoding).
CATEGORICAL_FEATURE_COLUMNS: list[str] = [f.name for f in FEATURE_FIELDS if f.dtype == "categorical"]

#: Boolean feature column names.
BOOLEAN_FEATURE_COLUMNS: list[str] = [f.name for f in FEATURE_FIELDS if f.dtype == "boolean"]

#: All feature column names (in deterministic order).
ALL_FEATURE_COLUMNS: list[str] = [f.name for f in FEATURE_FIELDS]

#: Target column name.
TARGET_COLUMN: str = "triage_acuity"

#: Identifier column (used for grouped splitting).
PATIENT_ID_COLUMN: str = "patient_id"

#: ESI class labels in canonical order (1 = highest urgency).
ESI_LABELS: list[int] = [1, 2, 3, 4, 5]
ESI_LABEL_NAMES: list[str] = [f"ESI {l}" for l in ESI_LABELS]


def feature_eligibility_matrix() -> dict[str, dict]:
    """Return a machine-readable feature eligibility matrix.

    Each entry describes the field's role, whether it can be used as a model
    input, and the reason if excluded.
    """
    matrix: dict[str, dict] = {}
    for f in FIELDS:
        entry: dict = {
            "role": f.role,
            "dtype": f.dtype,
            "eligible": f.role == "feature",
            "description": f.description,
        }
        if f.units:
            entry["units"] = f.units
        if f.role == "leakage":
            entry["exclusion_reason"] = "Post-triage outcome; would leak future information"
        if f.role == "identifier":
            entry["exclusion_reason"] = "Patient identifier; not a predictive feature"
        if f.role == "context":
            entry["exclusion_reason"] = "Context-only; not used as model input"
        matrix[f.name] = entry
    return matrix


def file_roles() -> dict[str, str]:
    """Map each Triagegeist file to its role in the pipeline."""
    return {
        "train.csv": "Labeled training data (80,000 rows with triage_acuity)",
        "test.csv": "Holdout evaluation set (20,000 rows, labels withheld)",
        "chief_complaints.csv": "Chief complaint text + system classification (joined on patient_id)",
        "patient_history.csv": "Patient history comorbidities (joined on patient_id)",
        "sample_submission.csv": "Competition submission template (patient_id + triage_acuity)",
    }


def dataset_provenance() -> dict:
    """Return dataset provenance and licensing information."""
    return {
        "name": "Triagegeist",
        "type": "synthetic",
        "description": "Synthetic emergency department triage acuity dataset",
        "source": "Kaggle competition (hackathon-provided)",
        "license": "Non-commercial research (verify locally)",
        "permitted_use": "Research and education only; verify before redistribution",
        "files": file_roles(),
        "esi_labels": ESI_LABELS,
        "esi_label_names": ESI_LABEL_NAMES,
        "target_column": TARGET_COLUMN,
        "patient_id_column": PATIENT_ID_COLUMN,
    }


if __name__ == "__main__":
    import json
    print(json.dumps({
        "n_features": len(ALL_FEATURE_COLUMNS),
        "feature_columns": ALL_FEATURE_COLUMNS,
        "target": TARGET_COLUMN,
        "patient_id": PATIENT_ID_COLUMN,
        "esi_labels": ESI_LABELS,
        "eligible_features": len(FEATURE_FIELDS),
        "leakage_excluded": len(LEAKAGE_FIELDS),
        "context_fields": len(CONTEXT_FIELDS),
        "identifier_fields": len(IDENTIFIER_FIELDS),
    }, indent=2))
