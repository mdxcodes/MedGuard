"""Central configuration for the MedGuard data-preparation pipeline.

Everything that encodes a *decision* about the data lives here so that the
rule is stated once, is auditable, and is shared by the pipeline, the tests
and the documentation.

Nothing in this module reads or writes patient data.
"""

from __future__ import annotations

from pathlib import Path

from backend.ml import triagegeist_schema

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

PROJECT_ROOT = Path(__file__).resolve().parents[2]

#: Triagegeist synthetic dataset directory. Never committed to git (see .gitignore).
DATASET_DIR = PROJECT_ROOT / "triagegeist"

#: Generated outputs. Never committed (derived from synthetic research data).
REPORTS_DIR = PROJECT_ROOT / "reports"
DOCS_DIR = PROJECT_ROOT / "docs"

#: Reproducibility: fixed seed recorded in docs/ML_PIPELINE_DESIGN.md.
RANDOM_SEED = 20260915

# ---------------------------------------------------------------------------
# Target
# ---------------------------------------------------------------------------

TARGET_COLUMN = "triage_acuity"

#: The original five-level ESI labels are preserved exactly as recorded.
#: They are NEVER collapsed to Low/Moderate/High/Critical.
ESI_LABELS: tuple[int, ...] = (1, 2, 3, 4, 5)

#: Rows with a missing acuity label are excluded from supervised learning.
#: Labels are never invented or imputed.
ALLOW_MISSING_TARGET = False

# ---------------------------------------------------------------------------
# Identifiers
# ---------------------------------------------------------------------------

#: Patient identifier. Used ONLY for grouped splitting and auditing.
PATIENT_ID_COLUMN = "patient_id"

# ---------------------------------------------------------------------------
# Table schemas (verified against Triagegeist demo package)
# ---------------------------------------------------------------------------

#: Required columns for train.csv
TRIAGE_REQUIRED_COLUMNS: tuple[str, ...] = (
    "patient_id",
    "heart_rate",
    "respiratory_rate",
    "temperature_c",
    "spo2",
    "systolic_bp",
    "diastolic_bp",
    "pain_score",
    "triage_acuity",
    "chief_complaint_system",
    "age",
    "sex",
    "insurance_type",
    "arrival_mode",
    "arrival_hour",
    "shock_index",
    "num_prior_ed_visits_12m",
    "num_active_medications",
)

#: Columns of training data that describe what happened *after* the triage
#: assessment. They are excluded from the feature matrix.
TRAIN_LEAKAGE_COLUMNS: tuple[str, ...] = ("disposition", "ed_los_hours")

#: Entirely post-triage tables. Never used as model features.
POST_TRIAGE_TABLES: tuple[str, ...] = ()

# ---------------------------------------------------------------------------
# Clinical plausibility envelopes
#
# These are conservative physiological windows for adult ED patients. Values
# outside them are treated as data-entry errors, set to missing, and counted
# -- never silently clipped or converted.
# ---------------------------------------------------------------------------

#: Systolic blood pressure, mmHg.
SBP_MIN, SBP_MAX = 50.0, 250.0
#: Diastolic blood pressure, mmHg.
DBP_MIN, DBP_MAX = 30.0, 150.0
#: Heart rate, beats per minute.
HEARTRATE_MIN, HEARTRATE_MAX = 30.0, 220.0
#: Respiratory rate, breaths per minute.
RESPRATE_MIN, RESPRATE_MAX = 4.0, 60.0
#: Oxygen saturation, percent.
O2SAT_MIN, O2SAT_MAX = 50.0, 100.0
#: Pain score on the standard 0-10 numeric rating scale.
PAIN_MIN, PAIN_MAX = 0.0, 10.0

#: Body temperature, degrees Celsius.
TEMP_MIN_C, TEMP_MAX_C = 30.0, 42.0

# ---------------------------------------------------------------------------
# Feature allow-list (initial triage only)
# ---------------------------------------------------------------------------

NUMERIC_TRIAGE_FEATURES: tuple[str, ...] = (
    "heart_rate",
    "respiratory_rate",
    "temperature_c",
    "spo2",
    "systolic_bp",
    "diastolic_bp",
    "pain_score",
    "age",
    "arrival_hour",
    "shock_index",
    "num_prior_ed_visits_12m",
    "num_active_medications",
)

CATEGORICAL_TRIAGE_FEATURES: tuple[str, ...] = (
    "arrival_mode",
    "sex",
    "insurance_type",
    "chief_complaint_system",
)

#: Missingness indicator features derived from triage vital signs.
MISSINGNESS_FEATURES: tuple[str, ...] = (
    "heart_rate_missing",
    "respiratory_rate_missing",
    "temperature_c_missing",
    "spo2_missing",
    "systolic_bp_missing",
    "diastolic_bp_missing",
    "pain_score_missing",
)

#: Every identifier and leakage column that must never reach the estimator.
FORBIDDEN_FEATURE_COLUMNS: tuple[str, ...] = (
    "patient_id",
    "triage_nurse_id",
    "site_id",
    "triage_acuity",
    "disposition",
    "ed_los_hours",
    "chief_complaint_raw",
    # post-triage tables
    "icd_code",
    "icd_version",
    "charttime",
)

# ---------------------------------------------------------------------------
# Split configuration
# ---------------------------------------------------------------------------

TEST_SIZE = 0.2
N_SPLITS = 5

# ---------------------------------------------------------------------------
# Pain score parsing (Triagegeist-compatible)
# ---------------------------------------------------------------------------

#: Sentinels recorded instead of a numeric pain score.
PAIN_UNASSESSABLE_TOKENS: frozenset[str] = frozenset(
    {"ua", "uta", "unable", "unable to assess", "unable to answer", "uta pain",
     "n/a", "na", "unknown", "none", "not assessed", ""}
)

#: Placeholder / unknown chief-complaint strings.
CHIEFCOMPLAINT_PLACEHOLDERS: frozenset[str] = frozenset(
    {"unknown-cc", "unknown", "unknown cc", "unknown complaint", "unk",
     "not documented", "no complaint", "none", "n/a", "na", "", "-"}
)

#: Abnormal vital sign rules (column, direction, threshold).
ABNORMAL_VITAL_RULES: tuple[tuple[str, str, float], ...] = (
    ("spo2", "below", 92.0),
    ("systolic_bp", "below", 90.0),
    ("systolic_bp", "above", 180.0),
    ("heart_rate", "above", 100.0),
    ("respiratory_rate", "above", 20.0),
    ("temperature_c", "above", 38.3),
)

#: Temperature conversion cutoff.
TEMP_CELSIUS_CUTOFF = 45.0

#: Post-triage tables (excluded from features).
POST_TRIAGE_TABLES: tuple[str, ...] = ()

#: MIMIC compatibility aliases (kept for test compatibility).
SUBJECT_ID_COLUMN = "patient_id"
STAY_ID_COLUMN = "patient_id"
TEMP_MAX_C = TEMP_MAX_C = 42.0
TEMP_MAX_F = 108.0
TEMP_MIN_C = 30.0

#: Missingness feature names (Triagegeist).
MISSINGNESS_FEATURES: tuple[str, ...] = (
    "heart_rate_missing",
    "respiratory_rate_missing",
    "temperature_c_missing",
    "spo2_missing",
    "systolic_bp_missing",
    "diastolic_bp_missing",
    "pain_score_missing",
)

#: Text feature.
TEXT_FEATURE = "chief_complaint_system"

#: Categorical triage features.
CATEGORICAL_TRIAGE_FEATURES: tuple[str, ...] = (
    "arrival_mode",
    "sex",
    "insurance_type",
    "chief_complaint_system",
)

#: Numeric triage features.
NUMERIC_TRIAGE_FEATURES: tuple[str, ...] = (
    "heart_rate",
    "respiratory_rate",
    "temperature_c",
    "spo2",
    "systolic_bp",
    "diastolic_bp",
    "pain_score",
    "age",
    "arrival_hour",
    "shock_index",
    "num_prior_ed_visits_12m",
    "num_active_medications",
)

#: Text feature.
TEXT_FEATURE = "chief_complaint_system"

#: Vital signs feature names.
VITAL_SIGN_FEATURES: tuple[str, ...] = (
    "heart_rate", "respiratory_rate", "temperature_c", "spo2",
    "systolic_bp", "diastolic_bp", "pain_score",
)

# ---------------------------------------------------------------------------
# Backward-compatible aliases (kept for existing test compatibility)
# ---------------------------------------------------------------------------

SUBJECT_ID_COLUMN = PATIENT_ID_COLUMN
STAY_ID_COLUMN = PATIENT_ID_COLUMN

# ---------------------------------------------------------------------------

#: Leakage-prone feature names (excluded from model features).
LEAKAGE_FIELDS = triagegeist_schema.LEAKAGE_FIELDS

from backend.ml import triagegeist_schema
