"""Data-quality validation and cleaning rules for MedGuard triage data.

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

from backend.ml import config
from backend.ml.triagegeist_schema import (
    CATEGORICAL_FEATURE_COLUMNS,
    NUMERIC_FEATURE_COLUMNS,
)

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
    * ``triage_acuity`` must lie in the original five-level ESI set ``{1,2,3,4,5}``.
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

    The dataset records temperature in *both* units within a single
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
    """Validate and clean systolic / diastolic blood pressure.

    Rules
    -----
    * Both must lie within the audited physiological envelope.
    * SBP must be >= DBP.
    * Out-of-envelope or inconsistent values are set to missing, never clipped.
    """
    counts = _new_counts()
    sbp_num = _as_numeric(sbp)
    dbp_num = _as_numeric(dbp)

    sbp_clean = sbp_num.copy()
    dbp_clean = dbp_num.copy()

    # Range checks
    sbp_out = sbp_num.notna() & (
        (sbp_num < config.SBP_MIN) | (sbp_num > config.SBP_MAX)
    )
    dbp_out = dbp_num.notna() & (
        (dbp_num < config.DBP_MIN) | (dbp_num > config.DBP_MAX)
    )

    sbp_clean.loc[sbp_out] = np.nan
    dbp_clean.loc[dbp_out] = np.nan
    counts["sbp_out_of_range"] = int(sbp_out.sum())
    counts["dbp_out_of_range"] = int(dbp_out.sum())

    # SBP >= DBP consistency
    inconsistent = (
        sbp_clean.notna()
        & dbp_clean.notna()
        & (sbp_clean < dbp_clean)
    )
    sbp_clean.loc[inconsistent] = np.nan
    dbp_clean.loc[inconsistent] = np.nan
    counts["dbp_greater_than_sbp"] = int(inconsistent.sum())

    return sbp_clean, dbp_clean, counts


# ---------------------------------------------------------------------------
# Pain parsing
# ---------------------------------------------------------------------------


def parse_pain(raw: pd.Series) -> tuple[pd.Series, ChangeCounts]:
    """Parse pain scores, mapping sentinel tokens to missing.

    Accepts numeric values on the 0-10 scale. Sentinel strings such as
    ``UA``, ``unable`` etc. become missing with a missingness indicator.

    Returns
    -------
    (clean_series, counts)
    """
    counts = _new_counts()
    numeric = _as_numeric(raw)
    result = numeric.copy()

    # Check sentinel tokens explicitly mentioned in the audit.
    # Only consider non-null values -- None/NaN must stay NaN.
    sentinel_tokens = {t.lower() for t in config.PAIN_UNASSESSABLE_TOKENS}
    raw_str = raw.astype(str).str.strip().str.lower()
    sentinel_mask = raw.notna() & raw_str.isin(sentinel_tokens)
    counts["pain_unassessable"] = int(sentinel_mask.sum())

    # A value that is a documented sentinel is *not* also counted as
    # unparseable -- the two categories are mutually exclusive.
    unparseable = raw.notna() & numeric.isna() & ~sentinel_mask
    counts["pain_unparseable"] = int(unparseable.sum())

    # Triagegeist encodes "pain not assessed" as the numeric sentinel -1.
    # A negative pain score is not a measurement, so it is reported as
    # unassessable rather than as a value outside the 0-10 scale.
    negative_sentinel = numeric.notna() & (numeric < 0)
    counts["pain_unassessable"] += int(negative_sentinel.sum())

    out_of_range = numeric.notna() & (numeric > config.PAIN_MAX)
    counts["pain_out_of_range"] = int(out_of_range.sum())

    result.loc[unparseable | sentinel_mask | negative_sentinel | out_of_range] = np.nan
    return result, counts


# ---------------------------------------------------------------------------
# Chief complaint normalization
# ---------------------------------------------------------------------------


def normalize_chiefcomplaint(
    raw: pd.Series,
) -> tuple[pd.Series, ChangeCounts]:
    """Normalize chief complaint text.

    Lowercases, strips whitespace, collapses internal whitespace, and maps
    placeholder sentinels to ``"unknown"``.
    """
    counts = _new_counts()

    # A null is an explicit absence of a complaint, not a complaint.
    is_null = raw.isna()
    cleaned = (
        raw.astype(str)
        .str.strip()
        .str.replace(r"\s+", " ", regex=True)
        .str.lower()
    )

    placeholders = {t.lower().strip() for t in config.CHIEFCOMPLAINT_PLACEHOLDERS}
    placeholder_mask = cleaned.isin(placeholders) | is_null

    counts["chiefcomplaint_placeholder"] = int(placeholder_mask.sum())

    empty_after = placeholder_mask | cleaned.eq("")
    counts["chiefcomplaint_empty_after_normalisation"] = int(empty_after.sum())

    result = cleaned.copy()
    result.loc[placeholder_mask] = "unknown"
    return result, counts


# ---------------------------------------------------------------------------
# Batch cleaning
# ---------------------------------------------------------------------------


def clean_triage_frame(frame: pd.DataFrame) -> tuple[pd.DataFrame, ChangeCounts]:
    """Run all cleaning steps on a triage frame.

    Returns the cleaned frame and aggregated counts.
    """
    counts = _new_counts()

    # Target first -- drop unlabelled rows before anything else
    frame, tc = validate_target(frame)
    counts["rows_dropped_missing_target"] = tc["rows_dropped_missing_target"]

    # Temperature
    temp, tc = normalize_temperature(frame["temperature_c"])
    frame["temperature_c"] = temp
    counts.update(
        {
            "celsius_detected": tc["celsius_detected"],
            "fahrenheit_converted": tc["fahrenheit_converted"],
            "temperature_out_of_envelope": tc["temperature_out_of_envelope"],
            "temperature_unparseable": tc["temperature_unparseable"],
        }
    )

    # Blood pressure
    sbp_clean, dbp_clean, bp_counts = validate_blood_pressure(
        frame["systolic_bp"], frame["diastolic_bp"]
    )
    frame["systolic_bp"] = sbp_clean
    frame["diastolic_bp"] = dbp_clean
    counts.update(
        {
            "sbp_out_of_range": bp_counts["sbp_out_of_range"],
            "dbp_out_of_range": bp_counts["dbp_out_of_range"],
            "dbp_greater_than_sbp": bp_counts["dbp_greater_than_sbp"],
        }
    )

    # Pain
    pain_clean, pain_counts = parse_pain(frame["pain_score"])
    frame["pain_score"] = pain_clean
    counts.update(
        {
            "pain_unassessable": pain_counts["pain_unassessable"],
            "pain_unparseable": pain_counts["pain_unparseable"],
            "pain_out_of_range": pain_counts["pain_out_of_range"],
        }
    )

    # Chief complaint
    cc_clean, cc_counts = normalize_chiefcomplaint(frame["chief_complaint_system"])
    frame["chief_complaint_system"] = cc_clean
    counts.update(
        {
            "chiefcomplaint_placeholder": cc_counts["chiefcomplaint_placeholder"],
            "chiefcomplaint_empty_after_normalisation": cc_counts[
                "chiefcomplaint_empty_after_normalisation"
            ],
        }
    )

    return frame, counts


def add_missingness_indicators(
    frame: pd.DataFrame, columns: list[str] | None = None
) -> pd.DataFrame:
    """Add boolean missingness indicators for the given numeric columns.

    Parameters
    ----------
    frame : pd.DataFrame
        Input frame (modified in place).
    columns : list[str] | None
        Columns to add indicators for. Defaults to all numeric feature
        columns from the Triagegeist schema.
    """
    if columns is None:
        columns = list(config.NUMERIC_TRIAGE_FEATURES)
    for col in columns:
        if col in frame.columns:
            frame[col + "_missing"] = frame[col].isna().astype(int)
    return frame


# ---------------------------------------------------------------------------
# Quality report container
# ---------------------------------------------------------------------------


class QualityReport:
    """Container for data-quality audit results."""

    def __init__(self):
        self.row_counts: dict[str, int] = {}
        self.label_distribution: dict[str, int] = {}
        self.missing_percent: dict[str, float] = {}
        self.feature_stats: dict[str, dict[str, float]] = {}
        self.counts: dict[str, int] = {}
        self.checks: list[dict[str, Any]] = []

    def add(
        self,
        name: str,
        status: str,
        detail: str,
        severity: str = "info",
    ) -> None:
        self.checks.append(
            {
                "name": name,
                "status": status,
                "detail": detail,
                "severity": severity,
            }
        )

    @property
    def failed(self) -> list[dict[str, Any]]:
        """Checks that failed."""
        return [c for c in self.checks if c["status"] == "FAIL"]

    @property
    def warnings(self) -> list[dict[str, Any]]:
        """Checks that produced a warning."""
        return [c for c in self.checks if c["status"] == "WARN"]

    @property
    def passed(self) -> list[dict[str, Any]]:
        """Checks that passed."""
        return [c for c in self.checks if c["status"] == "PASS"]

    def summary(self) -> dict[str, Any]:
        """Aggregate summary of the audit: counts only, no row-level data."""
        return {
            "checks_total": len(self.checks),
            "checks_passed": len(self.passed),
            "checks_failed": len(self.failed),
            "checks_warned": len(self.warnings),
            "row_counts": dict(self.row_counts),
            "label_distribution": dict(self.label_distribution),
        }

    def to_dict(self) -> dict[str, Any]:
        return {
            "summary": self.summary(),
            "row_counts": self.row_counts,
            "label_distribution": self.label_distribution,
            "missing_percent": self.missing_percent,
            "feature_stats": self.feature_stats,
            "counts": self.counts,
            "checks": self.checks,
        }


# ---------------------------------------------------------------------------
# Vitals validation
# ---------------------------------------------------------------------------


def validate_vitals(frame: pd.DataFrame) -> tuple[pd.DataFrame, ChangeCounts]:
    """Validate vital signs against clinical envelopes.

    Applies range checks to heart_rate, respiratory_rate, temperature_c,
    spo2, systolic_bp, diastolic_bp, pain_score. Out-of-envelope values
    are set to missing and counted.
    """
    counts = _new_counts()
    for f_name in config.NUMERIC_TRIAGE_FEATURES:
        if f_name not in frame.columns:
            continue
        col = frame[f_name]
        if f_name == "heart_rate":
            out = col.notna() & ((col < 20) | (col > 220))
        elif f_name == "respiratory_rate":
            out = col.notna() & ((col < 4) | (col > 60))
        elif f_name == "temperature_c":
            out = col.notna() & ((col < 30.0) | (col > 42.0))
        elif f_name == "spo2":
            out = col.notna() & ((col < 50) | (col > 100))
        elif f_name == "systolic_bp":
            out = col.notna() & ((col < 50) | (col > 250))
        elif f_name == "diastolic_bp":
            out = col.notna() & ((col < 30) | (col > 150))
        elif f_name == "pain_score":
            out = col.notna() & ((col < 0) | (col > 10))
        elif f_name == "age":
            out = col.notna() & ((col < 0) | (col > 120))
        else:
            out = pd.Series(False, index=frame.index)
        frame.loc[out, f_name] = np.nan
        counts[f"{f_name}_out_of_range"] = int(out.sum())
    return frame, counts
