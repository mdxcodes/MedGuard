"""Data-quality validation and cleaning rules for the MedGuard triage cohort.

Every rule in this module is explicit, counted and reversible-in-audit: each
cleaning step records *how many* values it changed and *why*, so the effect
of the rule is visible in the machine-readable quality report rather than
silently mutating rows.

Privacy note: no function in this module logs or returns patient identifiers
or chief-complaint free text. Only aggregate counts are reported.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from typing import Any

import numpy as np
import pandas as pd

from . import config

logger = logging.getLogger(__name__)

#: Counts of everything a cleaning rule changed, for the quality report.
ChangeCounts = dict[str, int]


class DataQualityError(RuntimeError):
    """A hard data-quality failure that must block the pipeline."""


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _new_counts() -> ChangeCounts:
    return {
        "celsius_detected": 0,
        "fahrenheit_converted": 0,
        "temperature_out_of_envelope": 0,
        "temperature_unparseable": 0,
        "sbp_out_of_range": 0,
        "dbp_out_of_range": 0,
        "dbp_greater_than_sbp": 0,
        "pain_unassessable": 0,
        "pain_unparseable": 0,
        "pain_out_of_range": 0,
        "chiefcomplaint_placeholder": 0,
        "chiefcomplaint_empty_after_normalisation": 0,
    }


def _as_numeric(series: pd.Series) -> pd.Series:
    """Coerce to float, mapping unparseable entries to NaN."""
    return pd.to_numeric(series, errors="coerce")


# ---------------------------------------------------------------------------
# Target validation
# ---------------------------------------------------------------------------


def validate_target(frame: pd.DataFrame) -> tuple[pd.DataFrame, ChangeCounts]:
    """Validate the ESI acuity label and drop unlabelled rows.

    Rules
    -----
    * ``acuity`` must lie in the original five-level ESI set ``{1,2,3,4,5}``.
      Out-of-range values are rejected as a hard error (an unexpected label
      means the dataset version changed).
    * Rows with a missing acuity label are **excluded** from supervised
      learning. Labels are never invented, imputed or guessed.
    """
    counts = _new_counts()
    missing_mask = frame[config.TARGET_COLUMN].isna()
    nonnull = frame.loc[~missing_mask, config.TARGET_COLUMN]

    invalid = nonnull[~nonnull.isin(config.ESI_LABELS)]
    if not invalid.empty:
        raise DataQualityError(
            f"{len(invalid)} row(s) carry an acuity value outside the "
            f"expected five-level ESI set {config.ESI_LABELS}. The dataset "
            "version differs from the audited one; review before proceeding."
        )

    kept = frame.loc[~missing_mask].copy()
    counts["rows_dropped_missing_target"] = int(missing_mask.sum())
    logger.info(
        "Target validation: %d row(s) dropped for missing acuity label.",
        counts["rows_dropped_missing_target"],
    )
    return kept, counts


# ---------------------------------------------------------------------------
# Temperature normalisation (mixed C / F)
# ---------------------------------------------------------------------------


def normalize_temperature(raw: pd.Series) -> tuple[pd.Series, ChangeCounts]:
    """Normalise a mixed Celsius/Fahrenheit column to degrees Celsius.

    The demo package records temperature in *both* units within a single
    column. A blanket conversion would corrupt the already-Celsius values, so
    the unit is inferred from physiological plausibility instead:

    * value <= ``TEMP_CELSIUS_CUTOFF`` (45 deg) -> assumed **Celsius**.
      93.2 F == 34 C is the lowest plausible living adult temperature, so any
      value at or below 45 cannot be valid Fahrenheit.
    * value > cutoff -> assumed **Fahrenheit**, converted via ``(F-32)*5/9``.

    Every value that falls outside the canonical envelope
    ``[TEMP_MIN_C, TEMP_MAX_C]`` after conversion is set to missing and
    counted, never clipped.
    """
    counts = _new_counts()
    numeric = _as_numeric(raw)
    result = pd.Series(np.nan, index=raw.index, dtype="float64")

    unparseable = numeric.isna() & raw.notna()
    counts["temperature_unparseable"] = int(unparseable.sum())

    # Values at or below the cutoff are treated as Celsius (already canonical).
    celsius_mask = numeric <= config.TEMP_CELSIUS_CUTOFF
    fahrenheit_mask = numeric > config.TEMP_CELSIUS_CUTOFF

    counts["celsius_detected"] = int((celsius_mask & numeric.notna()).sum())
    counts["fahrenheit_converted"] = int((fahrenheit_mask & numeric.notna()).sum())

    result.loc[celsius_mask] = numeric.loc[celsius_mask]
    fvals = numeric.loc[fahrenheit_mask]
    result.loc[fahrenheit_mask] = (fvals - 32.0) * 5.0 / 9.0

    out_of_envelope = result.notna() & (
        (result < config.TEMP_MIN_C) | (result > config.TEMP_MAX_C)
    )
    counts["temperature_out_of_envelope"] = int(out_of_envelope.sum())
    if counts["temperature_out_of_envelope"]:
        logger.warning(
            "%d temperature value(s) fell outside the clinical envelope "
            "[%s, %s] C and were set to missing.",
            counts["temperature_out_of_envelope"],
            config.TEMP_MIN_C,
            config.TEMP_MAX_C,
        )
    result.loc[out_of_envelope] = np.nan
    return result, counts


# ---------------------------------------------------------------------------
# Blood-pressure validation
# ---------------------------------------------------------------------------


def validate_blood_pressure(
    sbp: pd.Series, dbp: pd.Series
) -> tuple[pd.Series, pd.Series, ChangeCounts]:
    """Validate systolic and diastolic blood pressure.

    Out-of-envelope values (e.g. the audited 879 mmHg diastolic entry) are set
    to missing and counted. ``dbp > sbp`` is physiologically implausible and
    is reported as a separate suspicion count, but both values are retained
    so the row stays usable for the other features.
    """
    counts = _new_counts()
    sbp_n = _as_numeric(sbp)
    dbp_n = _as_numeric(dbp)

    sbp_bad = sbp_n.notna() & (
        (sbp_n < config.SBP_MIN) | (sbp_n > config.SBP_MAX)
    )
    counts["sbp_out_of_range"] = int(sbp_bad.sum())
    sbp_n.loc[sbp_bad] = np.nan

    dbp_bad = dbp_n.notna() & (
        (dbp_n < config.DBP_MIN) | (dbp_n > config.DBP_MAX)
    )
    counts["dbp_out_of_range"] = int(dbp_bad.sum())
    dbp_n.loc[dbp_bad] = np.nan

    contradictory = (
        dbp_n.notna() & sbp_n.notna() & (dbp_n > sbp_n)
    )
    counts["dbp_greater_than_sbp"] = int(contradictory.sum())

    if counts["dbp_out_of_range"]:
        logger.warning(
            "%d diastolic value(s) outside [%s, %s] mmHg were set to missing.",
            counts["dbp_out_of_range"], config.DBP_MIN, config.DBP_MAX,
        )
    return sbp_n, dbp_n, counts


# ---------------------------------------------------------------------------
# Pain score parsing
# ---------------------------------------------------------------------------


_WHITESPACE = re.compile(r"\s+")


def parse_pain(raw: pd.Series) -> tuple[pd.Series, ChangeCounts]:
    """Parse the pain column into a numeric 0-10 score.

    The column is stored as text and mixes three kinds of entry:

    1. Numeric scores on a 0-10 scale (kept).
    2. Recognised *unassessable* sentinels such as ``UA``, ``UTA``,
       ``unable``. These become missing values with an
       ``unassessable`` count — a distinct meaning from a plain gap, because
       a nurse could not assess the patient at all.
    3. Anything else (``13``, ``Critical``, ``o``) is invalid: out-of-range
       numerics and unrecognised tokens both become missing and are counted
       separately for auditing.
    """
    counts = _new_counts()
    text = raw.astype("string").str.strip().str.lower()

    unassessable = text.isin(list(config.PAIN_UNASSESSABLE_TOKENS)) & text.notna()
    counts["pain_unassessable"] = int(unassessable.sum())

    numeric = pd.to_numeric(text, errors="coerce")

    unparseable = numeric.isna() & text.notna() & ~unassessable
    counts["pain_unparseable"] = int(unparseable.sum())

    out_of_range = numeric.notna() & (
        (numeric < config.PAIN_MIN) | (numeric > config.PAIN_MAX)
    )
    counts["pain_out_of_range"] = int(out_of_range.sum())

    result = numeric.where(~out_of_range, np.nan)
    result = result.astype("float64")

    logger.info(
        "Pain parsing: %d unassessable, %d unparseable, %d out-of-range -> "
        "missing; %d usable scores.",
        counts["pain_unassessable"],
        counts["pain_unparseable"],
        counts["pain_out_of_range"],
        int(result.notna().sum()),
    )
    return result, counts


# ---------------------------------------------------------------------------
# Chief-complaint normalisation
# ---------------------------------------------------------------------------


def normalize_chiefcomplaint(raw: pd.Series) -> tuple[pd.Series, ChangeCounts]:
    """Light-touch normalisation of the chief-complaint free-text field.

    Normalisation is uppercase + whitespace collapse. Tokenisation and
    vocabulary building are handled by the scikit-learn text step so that
    the vocabulary is fitted on training data only.

    Placeholder entries (``UNKNOWN-CC`` and similar) are replaced with the
    literal ``unknown`` and counted, so the text step sees a single
    consistent token instead of many placeholder spellings.

    No complaint value is logged.
    """
    counts = _new_counts()
    text = (
        raw.astype("string")
        .fillna("")
        .str.strip()
        .str.upper()
        .str.replace(_WHITESPACE, " ", regex=True)
    )

    # The config placeholders are stored lowercase; compare case-insensitively.
    placeholders = {token.upper() for token in config.CHIEFCOMPLAINT_PLACEHOLDERS}
    is_placeholder = text.isin(list(placeholders))
    counts["chiefcomplaint_placeholder"] = int(is_placeholder.sum())

    normalised = text.where(~is_placeholder, "unknown")
    empty = normalised == ""
    counts["chiefcomplaint_empty_after_normalisation"] = int(empty.sum())
    normalised = normalised.where(~empty, "unknown")
    return normalised.astype("object"), counts


# ---------------------------------------------------------------------------
# Vitals range validation (no unit conversion)
# ---------------------------------------------------------------------------


def validate_vitals(
    frame: pd.DataFrame,
) -> tuple[pd.DataFrame, ChangeCounts]:
    """Validate all numeric triage vitals against clinical envelopes.

    ``temperature`` is handled by :func:`normalize_temperature` and ``pain``
    by :func:`parse_pain`; this function covers the remaining vitals.
    """
    counts = _new_counts()
    cleaned = frame.copy()

    for column, lo, hi in (
        ("heartrate", config.HEARTRATE_MIN, config.HEARTRATE_MAX),
        ("resprate", config.RESPRATE_MIN, config.RESPRATE_MAX),
        ("o2sat", config.O2SAT_MIN, config.O2SAT_MAX),
    ):
        if column not in cleaned.columns:
            continue
        values = _as_numeric(cleaned[column])
        bad = values.notna() & ((values < lo) | (values > hi))
        counts[f"{column}_out_of_range"] = int(bad.sum())
        if counts[f"{column}_out_of_range"]:
            logger.warning(
                "%d %s value(s) outside [%s, %s] were set to missing.",
                counts[f"{column}_out_of_range"], column, lo, hi,
            )
        cleaned[column] = values.where(~bad, np.nan)

    if "sbp" in cleaned.columns and "dbp" in cleaned.columns:
        sbp, dbp, bp_counts = validate_blood_pressure(
            cleaned["sbp"], cleaned["dbp"]
        )
        cleaned["sbp"], cleaned["dbp"] = sbp, dbp
        for key, value in bp_counts.items():
            counts[key] = value

    return cleaned, counts


# ---------------------------------------------------------------------------
# Missingness indicators
# ---------------------------------------------------------------------------


def add_missingness_indicators(
    frame: pd.DataFrame, columns: tuple[str, ...] | list[str]
) -> pd.DataFrame:
    """Add a ``<column>_missing`` 0/1 indicator for each named column.

    Missingness is informative: an unobtainable pain score or absent vitals
    is itself correlated with higher acuity. Preserving it as an explicit
    feature lets the model use that signal without imputing a fabricated
    measurement.
    """
    out = frame.copy()
    for column in columns:
        if column not in out.columns:
            continue
        out[f"{column}_missing"] = out[column].isna().astype(int)
    return out


# ---------------------------------------------------------------------------
# Quality report
# ---------------------------------------------------------------------------


@dataclass
class QualityCheck:
    """One auditable data-quality check with a machine-readable verdict."""

    name: str
    status: str  # "PASS" | "WARN" | "FAIL"
    detail: str
    severity: str = "info"  # "info" | "warning" | "blocking"

    def to_dict(self) -> dict[str, str]:
        return {
            "name": self.name,
            "status": self.status,
            "severity": self.severity,
            "detail": self.detail,
        }


@dataclass
class QualityReport:
    """Aggregated, machine- and human-readable data-quality findings.

    Contains aggregate counts only: no patient identifiers and no free text.
    """

    checks: list[QualityCheck] = field(default_factory=list)
    counts: dict[str, Any] = field(default_factory=dict)
    row_counts: dict[str, int] = field(default_factory=dict)
    label_distribution: dict[str, int] = field(default_factory=dict)
    missing_percent: dict[str, float] = field(default_factory=dict)
    feature_stats: dict[str, dict[str, float]] = field(default_factory=dict)

    def add(
        self, name: str, status: str, detail: str, severity: str = "info"
    ) -> None:
        self.checks.append(
            QualityCheck(name=name, status=status, detail=detail, severity=severity)
        )

    @property
    def failed(self) -> list[QualityCheck]:
        return [c for c in self.checks if c.status == "FAIL"]

    @property
    def warnings(self) -> list[QualityCheck]:
        return [c for c in self.checks if c.status == "WARN"]

    def to_dict(self) -> dict[str, Any]:
        return {
            "row_counts": self.row_counts,
            "label_distribution": self.label_distribution,
            "missing_percent": {k: round(v, 2) for k, v in self.missing_percent.items()},
            "feature_stats": {
                k: {kk: round(vv, 3) for kk, vv in v.items()}
                for k, v in self.feature_stats.items()
            },
            "counts": self.counts,
            "checks": [c.to_dict() for c in self.checks],
            "summary": {
                "total_checks": len(self.checks),
                "failed": len(self.failed),
                "warnings": len(self.warnings),
            },
        }
