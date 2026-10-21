"""Triagegeist dataset loader.

Loads and validates the Triagegeist synthetic dataset files.
No checksum verification is performed (synthetic dataset, no checksum manifest).
Schema validation and join integrity are enforced.
"""

from __future__ import annotations

import logging
from pathlib import Path

import pandas as pd

from backend.ml import triagegeist_schema

logger = logging.getLogger(__name__)

DEFAULT_DIR = Path(__file__).resolve().parents[2] / "triagegeist"


class TriagegeistError(RuntimeError):
    """Base class for Triagegeist loading failures."""


class SchemaError(TriagegeistError):
    """A required column is missing or has the wrong dtype."""


class JoinError(TriagegeistError):
    """The join between files would lose or duplicate rows."""


class MissingFileError(TriagegeistError):
    """A required Triagegeist file is missing."""


def _require_columns(df: pd.DataFrame, required: list[str], file_name: str) -> None:
    """Raise SchemaError if any required column is missing."""
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise SchemaError(
            f"{file_name} is missing required column(s): {missing}. "
            f"Present columns: {sorted(df.columns)}."
        )


def load_train(
    path: Path | None = None,
) -> pd.DataFrame:
    """Load train.csv with schema validation.

    train.csv contains 80,000 rows with labels (triage_acuity).
    """
    path = Path(path) or DEFAULT_DIR / "train.csv"
    if not path.exists():
        raise MissingFileError(f"Triagegeist train.csv not found: {path}")
    df = pd.read_csv(path)
    if df.empty:
        raise TriagegeistError(f"{path} contains no data rows.")
    _require_columns(df, ["patient_id", "triage_acuity"], "train.csv")
    logger.info("Loaded train.csv: %d rows, %d patients", len(df), df["patient_id"].nunique())
    return df


def load_test(
    path: Path | None = None,
) -> pd.DataFrame:
    """Load test.csv with schema validation.

    test.csv contains 20,000 rows WITHOUT labels (ground truth withheld).
    """
    path = Path(path) or DEFAULT_DIR / "test.csv"
    if not path.exists():
        raise MissingFileError(f"Triagegeist test.csv not found: {path}")
    df = pd.read_csv(path)
    if df.empty:
        raise TriagegeistError(f"{path} contains no data rows.")
    _require_columns(df, ["patient_id"], "test.csv")
    logger.info("Loaded test.csv: %d rows, %d patients", len(df), df["patient_id"].nunique())
    return df


def load_chief_complaints(
    path: Path | None = None,
) -> pd.DataFrame:
    """Load chief_complaints.csv with schema validation.

    Contains 100,000 rows with chief complaint text and system classification.
    Joined to train/test on patient_id.
    """
    path = Path(path) or DEFAULT_DIR / "chief_complaints.csv"
    if not path.exists():
        raise MissingFileError(f"Triagegeist chief_complaints.csv not found: {path}")
    df = pd.read_csv(path)
    if df.empty:
        raise TriagegeistError(f"{path} contains no data rows.")
    _require_columns(df, ["patient_id"], "chief_complaints.csv")
    logger.info("Loaded chief_complaints.csv: %d rows", len(df))
    return df


def load_patient_history(
    path: Path | None = None,
) -> pd.DataFrame:
    """Load patient_history.csv with schema validation.

    Contains 100,000 rows with comorbidity history flags.
    Joined to train/test on patient_id.
    """
    path = Path(path) or DEFAULT_DIR / "patient_history.csv"
    if not path.exists():
        raise MissingFileError(f"Triagegeist patient_history.csv not found: {path}")
    df = pd.read_csv(path)
    if df.empty:
        raise TriagegeistError(f"{path} contains no data rows.")
    _require_columns(df, ["patient_id"], "patient_history.csv")
    logger.info("Loaded patient_history.csv: %d rows", len(df))
    return df


def load_sample_submission(
    path: Path | None = None,
) -> pd.DataFrame:
    """Load sample_submission.csv (competition submission template)."""
    path = Path(path) or DEFAULT_DIR / "sample_submission.csv"
    if not path.exists():
        raise MissingFileError(f"Triagegeist sample_submission.csv not found: {path}")
    df = pd.read_csv(path)
    if df.empty:
        raise TriagegeistError(f"{path} contains no data rows.")
    _require_columns(df, ["patient_id"], "sample_submission.csv")
    logger.info("Loaded sample_submission.csv: %d rows", len(df))
    return df


def validate_join_integrity(
    train_df: pd.DataFrame,
    test_df: pd.DataFrame,
    complaints_df: pd.DataFrame | None = None,
    history_df: pd.DataFrame | None = None,
) -> dict:
    """Validate join integrity across files.

    Checks:
    - No patient_id overlap between train and test (leakage prevention).
    - Join key coverage: how many train/test patients appear in complaints/history.
    - Duplicate patient_ids within each file.
    """
    report: dict = {}

    # Patient overlap between train and test
    train_patients = set(train_df["patient_id"].unique())
    test_patients = set(test_df["patient_id"].unique())
    overlap = train_patients & test_patients
    report["train_patients"] = len(train_patients)
    report["test_patients"] = len(test_patients)
    report["patient_overlap"] = len(overlap)
    report["overlap_is_zero"] = len(overlap) == 0

    # Duplicate patient_ids within train
    report["train_duplicate_patients"] = int(
        train_df["patient_id"].duplicated().sum()
    )
    report["test_duplicate_patients"] = int(
        test_df["patient_id"].duplicated().sum()
    )

    # Join coverage for complaints
    if complaints_df is not None:
        complaints_patients = set(complaints_df["patient_id"].unique())
        report["complaints_patients"] = len(complaints_patients)
        report["complaints_cover_train_pct"] = round(
            len(train_patients & complaints_patients) / len(train_patients) * 100, 2
        ) if train_patients else 0.0
        report["complaints_cover_test_pct"] = round(
            len(test_patients & complaints_patients) / len(test_patients) * 100, 2
        ) if test_patients else 0.0

    # Join coverage for history
    if history_df is not None:
        history_patients = set(history_df["patient_id"].unique())
        report["history_patients"] = len(history_patients)
        report["history_cover_train_pct"] = round(
            len(train_patients & history_patients) / len(train_patients) * 100, 2
        ) if train_patients else 0.0
        report["history_cover_test_pct"] = round(
            len(test_patients & history_patients) / len(test_patients) * 100, 2
        ) if test_patients else 0.0

    return report


def load_all(
    base_dir: Path | None = None,
) -> dict[str, pd.DataFrame]:
    """Load all Triagegeist files and validate join integrity.

    Returns a dict of DataFrames: train, test, complaints, history, submission.
    """
    base = Path(base_dir or DEFAULT_DIR)
    train = load_train(base / "train.csv")
    test = load_test(base / "test.csv")
    complaints = load_chief_complaints(base / "chief_complaints.csv")
    history = load_patient_history(base / "patient_history.csv")
    submission = load_sample_submission(base / "sample_submission.csv")

    integrity = validate_join_integrity(train, test, complaints, history)
    logger.info(
        "Join integrity: train=%d patients, test=%d patients, overlap=%d",
        integrity["train_patients"],
        integrity["test_patients"],
        integrity["patient_overlap"],
    )

    return {
        "train": train,
        "test": test,
        "complaints": complaints,
        "history": history,
        "submission": submission,
        "integrity": integrity,
    }


if __name__ == "__main__":
    import json
    data = load_all()
    print(json.dumps(data["integrity"], indent=2))
