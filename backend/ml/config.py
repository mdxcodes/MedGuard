"""Central configuration for the MedGuard data-preparation pipeline.

Everything that encodes a *decision* about the data lives here so that the
rule is stated once, is auditable, and is shared by the pipeline, the tests
and the documentation.

Nothing in this module reads or writes patient data.
"""

from __future__ import annotations

from pathlib import Path

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

PROJECT_ROOT = Path(__file__).resolve().parents[2]

#: Licensed raw dataset. NEVER committed to git (see .gitignore).
DATASET_DIR = PROJECT_ROOT / "mimic-iv-ed-demo-2.2"
DATASET_ED_DIR = DATASET_DIR / "ed"
CHECKSUM_FILE = DATASET_DIR / "SHA256SUMS.txt"

#: Generated outputs. Never committed (derived from licensed research data).
REPORTS_DIR = PROJECT_ROOT / "reports"
DOCS_DIR = PROJECT_ROOT / "docs"

#: Reproducibility: fixed seed recorded in docs/ML_PIPELINE_DESIGN.md.
RANDOM_SEED = 20260915

# ---------------------------------------------------------------------------
# Target
# ---------------------------------------------------------------------------

TARGET_COLUMN = "acuity"

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
SUBJECT_ID_COLUMN = "subject_id"
#: ED-visit identifier. Used ONLY for the 1:1 join and for duplicate checks.
STAY_ID_COLUMN = "stay_id"

# ---------------------------------------------------------------------------
# Table schemas (verified against the demo package on 2026-10-15)
# ---------------------------------------------------------------------------

TRIAGE_REQUIRED_COLUMNS: tuple[str, ...] = (
    "subject_id",
    "stay_id",
    "temperature",
    "heartrate",
    "resprate",
    "o2sat",
    "sbp",
    "dbp",
    "pain",
    "acuity",
    "chiefcomplaint",
)

#: Full column set verified against MIMIC-IV-ED v2.2 demo on 2026-10-15.
#: ``hadm_id`` is present but null for 22.5% of stays (stays with no linked
#: hospital admission), so it is NOT required to be non-null.
EDSTAYS_REQUIRED_COLUMNS: tuple[str, ...] = (
    "subject_id",
    "hadm_id",
    "stay_id",
    "intime",
    "outtime",
    "gender",
    "race",
    "arrival_transport",
    "disposition",
)

#: Columns of `edstays` that describe what happened *after* the triage
#: assessment. They are excluded from the feature matrix.
EDSTAYS_LEAKAGE_COLUMNS: tuple[str, ...] = ("disposition", "outtime")

#: Entirely post-triage tables. Never used as model features.
POST_TRIAGE_TABLES: tuple[str, ...] = ("diagnosis", "pyxis", "medrecon")

#: `vitalsign` holds repeated measurements taken *throughout* the stay.
#: Later measurements encode the evolving clinical course, so the table is
#: excluded from the baseline feature set until a strict pre-triage
#: timestamp filter is validated (see docs/DATASET_AUDIT.md).
VITALSIGN_EXCLUDED_REASON = (
    "vitalsign contains repeated measurements taken during the ED stay, not "
    "only at initial triage; excluded from the baseline feature set."
)

# ---------------------------------------------------------------------------
# Clinical plausibility envelopes
#
# These are conservative physiological windows for adult ED patients. Values
# outside them are treated as data-entry errors, set to missing, and counted
# — never silently clipped or converted.
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

#: Canonical internal unit for temperature after normalisation: degrees
#: Celsius. The plausible envelope for a living adult ED patient.
TEMP_MIN_C, TEMP_MAX_C = 34.0, 42.0

#: Unit-splitting rule. A recorded temperature at or below this value cannot
#: be a valid Fahrenheit body temperature (34 C == 93.2 F), so it is assumed
#: to be Celsius. Above it, and up to the Fahrenheit envelope, the value is
#: assumed to be Fahrenheit.
TEMP_CELSIUS_CUTOFF = 45.0
#: Upper bound for the Fahrenheit interpretation, in degrees Fahrenheit.
TEMP_MAX_F = 108.0  # 42.2 C

# ---------------------------------------------------------------------------
# Pain score parsing
# ---------------------------------------------------------------------------

#: Sentinels recorded instead of a numeric pain score. These are matched
#: case-insensitively after whitespace stripping. They mean "not assessable"
#: and become missing values, with a dedicated missingness indicator.
PAIN_UNASSESSABLE_TOKENS: frozenset[str] = frozenset(
    {
        "ua",          # unable to assess
        "uta",         # unable to assess (abbreviation)
        "unable",      # unable
        "unable to assess",
        "unable to answer",
        "uta pain",
        "n/a",         # not applicable
        "na",
        "unknown",
        "none",
        "not assessed",
    }
)

#: Any other non-numeric token is treated as an unparseable entry -> missing,
#: and counted separately from clinically unassessable values.

# ---------------------------------------------------------------------------
# Chief-complaint normalisation
# ---------------------------------------------------------------------------

#: Placeholder / unknown chief-complaint strings. Case-insensitive match.
CHIEFCOMPLAINT_PLACEHOLDERS: frozenset[str] = frozenset(
    {
        "unknown-cc",
        "unknown",
        "unknown cc",
        "unknown complaint",
        "unk",
        "not documented",
        "no complaint",
        "none",
        "n/a",
        "na",
        "",
        "-",
    }
)

#: Entries at or below this token count are collapsed to a single "<short>"
#: bucket so the TF-IDF vocabulary is not dominated by 1-2 character noise.
MIN_COMPLAINT_TOKEN_LENGTH = 2

# ---------------------------------------------------------------------------
# Feature allow-list (initial triage only)
# ---------------------------------------------------------------------------

NUMERIC_TRIAGE_FEATURES: tuple[str, ...] = (
    "temperature",
    "heartrate",
    "resprate",
    "o2sat",
    "sbp",
    "dbp",
)

CATEGORICAL_TRIAGE_FEATURES: tuple[str, ...] = (
    "arrival_transport",
    # NOTE: `race` and `gender` are deliberately excluded from the baseline
    # feature set. They are available at arrival but are sensitive
    # demographic attributes with no documented research justification for
    # this phase, and using them risks encoding bias rather than acuity.
    # See docs/FEATURE_SPECIFICATION.md.
)

#: Text feature (normalised upstream, before the pipeline).
TEXT_FEATURE = "chiefcomplaint"

#: Missingness indicator features derived from triage vital signs.
MISSINGNESS_FEATURES: tuple[str, ...] = (
    "temperature_missing",
    "heartrate_missing",
    "resprate_missing",
    "o2sat_missing",
    "sbp_missing",
    "dbp_missing",
    "pain_missing",
)

#: Every identifier and leakage column that must never reach the estimator.
FORBIDDEN_FEATURE_COLUMNS: tuple[str, ...] = (
    "subject_id",
    "stay_id",
    "hadm_id",
    "intime",
    "outtime",
    "disposition",
    "gender",
    "race",
    "acuity",
    # post-triage tables
    "icd_code",
    "icd_version",
    "icd_title",
    "seq_num",
    "charttime",
    "med_rn",
    "name",
    "gsn_rn",
    "gsn",
    "ndc",
    "etc_rn",
    "etccode",
    "etcdescription",
    "rhythm",
)

# ---------------------------------------------------------------------------
# Derived-feature thresholds (fixed clinical constants, not fitted statistics)
#
# These define what counts as an "abnormal" vital. They are clinical
# constants taken from standard ED triage references, chosen *before* looking
# at any data, so no statistic from the dataset informs them and no leakage
# can occur through them.
# ---------------------------------------------------------------------------

ABNORMAL_VITAL_RULES: tuple[tuple[str, str, float], ...] = (
    ("o2sat", "below", 92.0),
    ("sbp", "below", 90.0),
    ("sbp", "above", 180.0),
    ("heartrate", "above", 100.0),
    ("resprate", "above", 20.0),
    ("temperature", "above", 38.3),
)

# ---------------------------------------------------------------------------
# Split configuration
# ---------------------------------------------------------------------------

TEST_SIZE = 0.2
N_SPLITS = 5
