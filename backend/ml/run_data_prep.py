"""MedGuard Phase 1 data-preparation entry point.

Run from the project root:

    venv/bin/python -m backend.ml.run_data_prep

What this does
--------------
1. Verifies SHA-256 checksums for every licensed dataset file.
2. Loads `triage` and `edstays`, validates schemas, joins them 1:1 on stay_id.
3. Applies every documented data-quality rule (temperature units, blood
   pressure, pain parsing, chief-complaint normalisation).
4. Drops rows with no clinician-assigned ESI label.
5. Splits into patient-grouped train/test sets with overlap assertions.
6. Fits the leakage-safe preprocessing pipeline on TRAINING rows only.
7. Writes a machine-readable JSON report and a human-readable Markdown report.

Out of scope for this phase: model training, evaluation metrics, any clinical
claim, and any upload of research data.

Privacy: no patient identifier or chief-complaint text is logged or written.
"""

from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path

from . import config, splitting
from .data_loading import load_joined_dataset, verify_checksums
from .features import (
    assert_no_leakage_columns,
    build_feature_frame,
    build_preprocessor,
    leakage_free_feature_names,
)
from .reporting import build_quality_report, write_json_report, write_markdown_report

log = logging.getLogger("medguard.data_prep")


def configure_logging(verbose: bool = False) -> None:
    logging.basicConfig(
        level=logging.DEBUG if verbose else logging.INFO,
        format="%(asctime)s %(levelname)-7s %(name)s: %(message)s",
        datefmt="%H:%M:%S",
    )


def run(
    output_json: Path | None = None,
    output_markdown: Path | None = None,
    seed: int = config.RANDOM_SEED,
    verbose: bool = False,
) -> dict:
    """Execute the full data-preparation pipeline. Returns the report payload."""
    output_json = output_json or config.REPORTS_DIR / "data_quality_report.json"
    output_markdown = output_markdown or config.DOCS_DIR / "DATA_QUALITY_REPORT.md"

    # --- 1. checksums ------------------------------------------------------
    checksum_results = verify_checksums()
    log.info("Verified %d file checksum(s) against SHA256SUMS.txt.",
             len(checksum_results))

    # --- 2. load and join --------------------------------------------------
    joined = load_joined_dataset(verify_checksum=False)
    log.info("Joined dataset: %d rows, %d patients.",
             len(joined), joined[config.SUBJECT_ID_COLUMN].nunique())

    # --- 3/4. quality rules + target filter -------------------------------
    feature_frame = build_feature_frame(joined)
    log.info("Modelling rows after dropping unlabelled rows: %d",
             len(feature_frame))
    assert_no_leakage_columns(feature_frame)

    # --- 5. patient-grouped split -----------------------------------------
    train, test = splitting.patient_grouped_split(
        feature_frame, test_size=config.TEST_SIZE, seed=seed
    )
    overlap = len(
        set(train[config.SUBJECT_ID_COLUMN]) & set(test[config.SUBJECT_ID_COLUMN])
    )
    splitting.assert_no_patient_overlap(
        train[config.SUBJECT_ID_COLUMN], test[config.SUBJECT_ID_COLUMN],
        "run_data_prep",
    )
    split_report = {
        "patient_overlap": overlap,
        "detail": (
            f"{len(train)} train rows / {train[config.SUBJECT_ID_COLUMN].nunique()} "
            f"patients and {len(test)} test rows / "
            f"{test[config.SUBJECT_ID_COLUMN].nunique()} patients; "
            f"{overlap} patient(s) appear in both sets (must be 0)."
        ),
    }

    stratification = splitting.report_stratification_feasibility(feature_frame)

    # --- 6. fit preprocessing on TRAIN ONLY --------------------------------
    y_train = train[config.TARGET_COLUMN]
    preprocessor = build_preprocessor()
    preprocessor.fit(train, y_train)
    feature_names = leakage_free_feature_names(preprocessor)
    log.info("Preprocessor fitted on train rows only; %d model features.",
             len(feature_names))

    # --- 7. reports --------------------------------------------------------
    report = build_quality_report(
        joined=joined,
        feature_frame=feature_frame,
        train=train,
        test=test,
        split_report=split_report,
        checksum_results=checksum_results,
        stratification=stratification,
        pipeline=preprocessor,
        feature_names=feature_names,
    )
    json_path = write_json_report(report, output_json)
    payload_extra = {"summary": report.to_dict()["summary"]}
    markdown_path = write_markdown_report(report, output_markdown, payload_extra)

    summary = {
        "rows_joined": len(joined),
        "modelling_rows": len(feature_frame),
        "train_rows": len(train),
        "test_rows": len(test),
        "train_patients": int(train[config.SUBJECT_ID_COLUMN].nunique()),
        "test_patients": int(test[config.SUBJECT_ID_COLUMN].nunique()),
        "patient_overlap": overlap,
        "n_features": len(feature_names),
        "checks_failed": len(report.failed),
        "checks_warned": len(report.warnings),
        "json": str(json_path),
        "markdown": str(markdown_path),
    }
    log.info("Data preparation complete: %s", summary)
    return summary


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="backend.ml.run_data_prep",
        description="MedGuard Phase 1 data preparation pipeline.",
    )
    parser.add_argument(
        "--output-json", type=Path, default=None, help="Machine report path."
    )
    parser.add_argument(
        "--output-markdown", type=Path, default=None, help="Human report path."
    )
    parser.add_argument(
        "--seed", type=int, default=config.RANDOM_SEED, help="Random seed."
    )
    parser.add_argument(
        "--verbose", "-v", action="store_true", help="Enable debug logging."
    )
    args = parser.parse_args(argv)

    configure_logging(args.verbose)
    try:
        run(
            output_json=args.output_json,
            output_markdown=args.output_markdown,
            seed=args.seed,
            verbose=args.verbose,
        )
    except Exception as exc:  # noqa: BLE001 - CLI boundary
        log.error("Data preparation failed: %s: %s", type(exc).__name__, exc)
        return 1
    return 0


if __name__ == "__main__":  # pragma: no cover
    sys.exit(main())
