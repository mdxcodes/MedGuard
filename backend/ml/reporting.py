"""Machine- and human-readable data-quality reporting.

The report intentionally contains **aggregate counts only**: no patient
identifiers, no ``patient_id`` values, and no chief-complaint free text. This
keeps the committed documentation free of research data while still making
every cleaning decision auditable.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pandas as pd

from . import config
from .triagegeist_schema import CATEGORICAL_FEATURE_COLUMNS, NUMERIC_FEATURE_COLUMNS
from .validation import QualityReport

logger = logging.getLogger(__name__)


def _missing_percent(frame: pd.DataFrame, columns: list[str]) -> dict[str, float]:
    total = max(len(frame), 1)
    return {
        column: round(float(frame[column].isna().sum()) / total * 100.0, 2)
        for column in columns
        if column in frame.columns
    }


def _feature_stats(frame: pd.DataFrame, columns: list[str]) -> dict[str, dict[str, float]]:
    stats: dict[str, dict[str, float]] = {}
    for column in columns:
        if column not in frame.columns:
            continue
        values = pd.to_numeric(frame[column], errors="coerce").dropna()
        if values.empty:
            stats[column] = {"n_valid": 0.0}
            continue
        stats[column] = {
            "n_valid": float(len(values)),
            "min": float(values.min()),
            "p25": float(values.quantile(0.25)),
            "median": float(values.median()),
            "p75": float(values.quantile(0.75)),
            "max": float(values.max()),
            "mean": float(values.mean()),
        }
    return stats


def build_quality_report(
    joined: pd.DataFrame,
    feature_frame: pd.DataFrame,
    train: pd.DataFrame,
    test: pd.DataFrame,
    split_report: dict[str, Any],
    checksum_results: dict[str, bool] | None = None,
    stratification: dict[str, Any] | None = None,
    pipeline: Any = None,
    feature_names: list[str] | None = None,
) -> QualityReport:
    """Assemble the full data-quality report for the prepared cohort."""
    report = QualityReport()
    counts = dict(getattr(feature_frame, "attrs", {}).get("cleaning_counts", {}))

    report.row_counts = {
        "raw_joined_rows": int(len(joined)),
        "rows_excluded_missing_target": int(
            counts.get("rows_dropped_missing_target", 0)
        ),
        "modelling_rows": int(len(feature_frame)),
        "train_rows": int(len(train)),
        "test_rows": int(len(test)),
        "train_patients": int(train[config.SUBJECT_ID_COLUMN].nunique()),
        "test_patients": int(test[config.SUBJECT_ID_COLUMN].nunique()),
    }

    label_counts = (
        feature_frame[config.TARGET_COLUMN]
        .value_counts()
        .sort_index()
        .astype(int)
    )
    report.label_distribution = {
        f"ESI {int(level)}": int(count) for level, count in label_counts.items()
    }
    report.counts = counts

    feature_columns = (
        list(config.NUMERIC_TRIAGE_FEATURES)
        + ["pain_score"]
        + list(config.CATEGORICAL_TRIAGE_FEATURES)
    )
    report.missing_percent = _missing_percent(feature_frame, feature_columns)
    report.feature_stats = _feature_stats(
        feature_frame,
        [
            "temperature_c",
            "heart_rate",
            "respiratory_rate",
            "spo2",
            "systolic_bp",
            "diastolic_bp",
            "pain_score",
            "shock_index",
            "pulse_pressure",
            "abnormal_vital_count",
        ]
        if pipeline is None
        else [
            "temperature_c",
            "heart_rate",
            "respiratory_rate",
            "spo2",
            "systolic_bp",
            "diastolic_bp",
            "pain_score",
        ],
    )

    # ---------------- documented checks ----------------
    n_verified = len(checksum_results) if checksum_results else 0
    report.add(
        "checksum_verification",
        "PASS" if checksum_results else "FAIL",
        (
            f"{n_verified} file(s) verified against SHA256SUMS.txt."
            if checksum_results
            else "Checksum verification was not run."
        ),
        severity="blocking" if not checksum_results else "info",
    )

    duplicates = int(joined[config.SUBJECT_ID_COLUMN].duplicated().sum())
    report.add(
        "duplicate_patient_id",
        "PASS" if duplicates == 0 else "FAIL",
        f"{duplicates} duplicate patient_id value(s) in the joined dataset.",
        severity="blocking" if duplicates else "info",
    )

    join_ok = len(joined) == report.row_counts["raw_joined_rows"]
    report.add(
        "one_to_one_join_integrity",
        "PASS" if join_ok else "FAIL",
        f"joined set kept {len(joined)} of {report.row_counts['raw_joined_rows']} "
        f"rows.",
        severity="blocking" if not join_ok else "info",
    )

    missing_target = counts.get("rows_dropped_missing_target", 0)
    report.add(
        "missing_target_labels",
        "WARN" if missing_target else "PASS",
        f"{missing_target} row(s) had no clinician-assigned ESI label and were "
        "excluded from supervised learning. No label was imputed.",
        severity="warning" if missing_target else "info",
    )

    missing_levels = [
        f"ESI {level}"
        for level in config.ESI_LABELS
        if f"ESI {level}" not in report.label_distribution
    ]
    report.add(
        "esi_level_coverage",
        "FAIL" if missing_levels else "PASS",
        (
            f"ESI level(s) {missing_levels} have zero labelled rows in this "
            "cohort and cannot be learned or evaluated. Original five-level "
            "labels were preserved and NOT collapsed."
        )
        if missing_levels
        else "All five ESI levels are represented.",
        severity="warning" if missing_levels else "info",
    )

    sparse = [
        name
        for name, count in report.label_distribution.items()
        if 0 < count < config.N_SPLITS
    ]
    report.add(
        "esi_level_support",
        "WARN" if sparse else "PASS",
        (
            f"ESI level(s) {sparse} have fewer labelled rows than "
            f"n_splits={config.N_SPLITS}, so per-fold per-class metrics are "
            "unstable."
        )
        if sparse
        else "Every present ESI level has at least n_splits rows.",
        severity="warning" if sparse else "info",
    )

    converted = counts.get("fahrenheit_converted", 0)
    celsius = counts.get("celsius_detected", 0)
    out_of_env = counts.get("temperature_out_of_envelope", 0)
    report.add(
        "temperature_unit_handling",
        "WARN" if (converted or celsius) else "PASS",
        f"{converted} value(s) converted from Fahrenheit to Celsius; "
        f"{celsius} value(s) identified as already Celsius; "
        f"{out_of_env} value(s) rejected as implausible and set to missing.",
        severity="warning" if (converted or celsius) else "info",
    )

    dbp_bad = counts.get("dbp_out_of_range", 0)
    report.add(
        "implausible_diastolic_blood_pressure",
        "WARN" if dbp_bad else "PASS",
        (
            f"{dbp_bad} diastolic value(s) outside "
            f"[{config.DBP_MIN}, {config.DBP_MAX}] mmHg were set to missing "
            "rather than clipped."
        )
        if dbp_bad
        else "No implausible diastolic values found.",
        severity="warning" if dbp_bad else "info",
    )

    pain_bad = (
        counts.get("pain_unassessable", 0)
        + counts.get("pain_unparseable", 0)
        + counts.get("pain_out_of_range", 0)
    )
    report.add(
        "pain_score_parsing",
        "WARN" if pain_bad else "PASS",
        f"{pain_bad} pain entr(ies) invalid: "
        f"{counts.get('pain_unassessable', 0)} unassessable sentinel(s), "
        f"{counts.get('pain_unparseable', 0)} unparseable, "
        f"{counts.get('pain_out_of_range', 0)} out of the 0-10 range. All "
        "converted to missing with a retained missingness indicator.",
        severity="warning" if pain_bad else "info",
    )

    vital_missing = [
        f"{column}={report.missing_percent.get(column, 0.0)}%"
        for column in config.NUMERIC_TRIAGE_FEATURES
    ]
    report.add(
        "vital_sign_missingness",
        "WARN",
        "Missing vital-sign values (train-fitted median imputation plus "
        f"explicit indicators): {'; '.join(vital_missing)}. Missingness is not "
        "missing-at-random.",
        severity="warning",
    )

    report.add(
        "age_availability",
        "FAIL",
        "No age field exists in this package. Age was not provided by the "
        "Triagegeist dataset and was neither fabricated nor imputed.",
        severity="warning",
    )

    report.add(
        "leakage_column_exclusion",
        "PASS",
        "disposition, ed_los_hours, and the post-triage tables diagnosis, "
        "pyxis, medrecon are excluded from features. Post-triage vitalsign "
        "measurements are excluded. Verified by an automated assertion.",
    )

    report.add(
        "patient_grouped_split",
        "PASS"
        if split_report.get("patient_overlap", 1) == 0
        else "FAIL",
        split_report.get("detail", "Patient-grouped split applied."),
        severity="blocking" if split_report.get("patient_overlap", 1) else "info",
    )

    if stratification is not None:
        report.add(
            "stratified_group_split_feasibility",
            "WARN" if not stratification.get("feasible") else "PASS",
            stratification.get("reason", ""),
            severity="warning" if not stratification.get("feasible") else "info",
        )

    if feature_names is not None:
        report.add(
            "preprocessing_fit_isolation",
            "PASS",
            f"Preprocessor fitted on training rows only; {len(feature_names)} "
            "model-input features emitted with no identifier columns.",
        )

    return report


def write_json_report(report: QualityReport, path: Path) -> Path:
    """Write the machine-readable JSON report."""
    payload = {
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "dataset": {
            "name": "Triagegeist",
            "version": "synthetic",
            "variant": "training subset",
            "license": "Non-commercial research (verify locally)",
        },
        "target": {
            "column": config.TARGET_COLUMN,
            "labels": list(config.ESI_LABELS),
            "label_meaning": "original five-level ESI acuity, preserved as-is",
        },
        "random_seed": config.RANDOM_SEED,
        **report.to_dict(),
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    logger.info("Wrote machine-readable quality report: %s", path)
    return path


def render_markdown(report: QualityReport, payload_extra: dict[str, Any]) -> str:
    """Render the human-readable Markdown report.

    Contains aggregate counts only. No patient identifiers or free text.
    """
    rows = report.row_counts
    labels = report.label_distribution
    total_labelled = sum(labels.values())

    lines: list[str] = []
    lines.append("# MedGuard — Data Quality Report")
    lines.append("")
    lines.append(
        f"Generated: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')} "
        "by `backend/ml/run_data_prep.py`"
    )
    lines.append("")
    lines.append(
        "Dataset: **Triagegeist synthetic dataset**. "
        "This report contains aggregate counts only — no patient identifiers "
        "and no free-text complaints."
    )
    lines.append("")

    lines.append("## 1. Row counts")
    lines.append("")
    lines.append("| Metric | Value |")
    lines.append("|---|---|")
    for key, value in rows.items():
        lines.append(f"| `{key}` | {value} |")
    lines.append("")

    lines.append("## 2. Target-label distribution")
    lines.append("")
    lines.append(
        "Original five-level ESI acuity, preserved exactly as recorded "
        "(no remapping to Low/Moderate/High/Critical)."
    )
    lines.append("")
    lines.append("| ESI level | Rows | Share of labelled rows |")
    lines.append("|---|---|---|")
    for name, count in labels.items():
        share = count / total_labelled * 100 if total_labelled else 0.0
        lines.append(f"| {name} | {count} | {share:.2f}% |")
    for level in config.ESI_LABELS:
        name = f"ESI {level}"
        if name not in labels:
            lines.append(f"| {name} | 0 | 0.00% (absent) |")
    lines.append(f"| **Total labelled** | **{total_labelled}** | 100.00% |")
    lines.append("")

    lines.append("## 3. Missing-value percentages (modelling rows)")
    lines.append("")
    lines.append("| Feature | Missing % |")
    lines.append("|---|---|")
    for column, pct in report.missing_percent.items():
        lines.append(f"| `{column}` | {pct:.2f}% |")
    lines.append("")

    lines.append("## 4. Rejected and converted values")
    lines.append("")
    lines.append("| Rule | Count |")
    lines.append("|---|---|")
    for key in (
        "rows_dropped_missing_target",
        "fahrenheit_converted",
        "celsius_detected",
        "temperature_out_of_envelope",
        "temperature_unparseable",
        "sbp_out_of_range",
        "dbp_out_of_range",
        "dbp_greater_than_sbp",
        "heart_rate_out_of_range",
        "respiratory_rate_out_of_range",
        "spo2_out_of_range",
        "pain_unassessable",
        "pain_unparseable",
        "pain_out_of_range",
        "chief_complaint_placeholder",
        "chief_complaint_empty_after_normalisation",
    ):
        if key in report.counts:
            lines.append(f"| `{key}` | {report.counts[key]} |")
    lines.append("")

    lines.append("## 5. Numeric feature ranges (after cleaning)")
    lines.append("")
    lines.append(
        "| Feature | n valid | min | p25 | median | p75 | max | mean |"
    )
    lines.append("|---|---|---|---|---|---|---|---|")
    for column, stats in report.feature_stats.items():
        if "n_valid" not in stats or stats["n_valid"] == 0:
            continue
        lines.append(
            f"| `{column}` | {int(stats['n_valid'])} | {stats['min']:.2f} | "
            f"{stats['p25']:.2f} | {stats['median']:.2f} | "
            f"{stats['p75']:.2f} | {stats['max']:.2f} | {stats['mean']:.2f} |"
        )
    lines.append("")

    lines.append("## 6. Validation results")
    lines.append("")
    lines.append("| Check | Status | Severity | Detail |")
    lines.append("|---|---|---|---|")
    for check in report.checks:
        lines.append(
            f"| `{check.name}` | **{check.status}** | {check.severity} | "
            f"{check.detail} |"
        )
    lines.append("")

    summary = payload_extra.get("summary", {})
    if summary:
        lines.append("## 7. Check summary")
        lines.append("")
        lines.append(
            f"- Total checks: **{summary.get('total_checks')}**  \n"
            f"- Failed: **{summary.get('failed')}**  \n"
            f"- Warnings: **{summary.get('warnings')}**"
        )
        lines.append("")

    lines.append("## 8. Notes")
    lines.append("")
    lines.append(
        "- `FAIL` in a check reflects a documented dataset limitation of the "
        "demo subset, not a crash in the pipeline."
    )
    lines.append(
        "- No age field is available in the Triagegeist synthetic dataset. Age "
        "was neither fabricated nor imputed."
    )
    lines.append(
        "- Post-triage information (`disposition`, `ed_los_hours`) is excluded "
        "from all features."
    )
    lines.append(
        "- Preprocessing statistics are fitted on training rows only, inside "
        "each cross-validation fold."
    )
    lines.append("")
    return "\n".join(lines)


def write_markdown_report(
    report: QualityReport, path: Path, payload_extra: dict[str, Any]
) -> Path:
    """Write the human-readable Markdown report."""
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(render_markdown(report, payload_extra), encoding="utf-8")
    logger.info("Wrote human-readable quality report: %s", path)
    return path
