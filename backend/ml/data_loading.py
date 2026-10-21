"""Data loading utilities for MedGuard.

Loads the Triagegeist dataset and joins the supporting tables onto the
modelling frames. The join is strictly one-to-one on ``patient_id`` and is
validated, so no row is ever lost or duplicated.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

import pandas as pd

from backend.ml import config

logger = logging.getLogger(__name__)

DATA_DIR = config.PROJECT_ROOT / "triagegeist"


class DataLoadingError(RuntimeError):
    """Base class for all dataset loading failures."""


class SchemaError(DataLoadingError):
    """A required column is missing, unexpected, or has the wrong dtype."""


class EmptyDatasetError(DataLoadingError):
    """A required table read back as empty."""


class DuplicateKeyError(DataLoadingError):
    """A join would not be one-to-one (duplicate keys found)."""


class JoinError(DataLoadingError):
    """The 1:1 join lost or duplicated rows."""


class MissingChecksumError(DataLoadingError):
    """A required checksum file is missing."""


def _assert_no_duplicate_keys(df: pd.DataFrame, column: str, source_name: str) -> None:
    """Raise DuplicateKeyError when ``column`` is not unique."""
    dupes = df[column].duplicated()
    if bool(dupes.any()):
        values = df.loc[dupes, column].tolist()
        raise DuplicateKeyError(
            f"Duplicate {column} values in {source_name}: {values[:5]}"
        )


def _join_one_to_one(
    left: pd.DataFrame, right: pd.DataFrame, key: str, source: str
) -> pd.DataFrame:
    """Join ``right`` onto ``left`` one-to-one, asserting no row loss."""
    _assert_no_duplicate_keys(right, key, source)
    before = len(left)
    merged = left.merge(right, on=key, how="left", validate="one_to_one")
    if len(merged) != before:
        raise JoinError(
            f"Join with {source} changed row count from {before} to {len(merged)}."
        )
    return merged


def load_joined_dataset(verify_checksum: bool = True) -> dict[str, pd.DataFrame]:
    """Load the Triagegeist modelling frames.

    ``train.csv`` and ``test.csv`` are the primary modelling tables.
    ``patient_history.csv`` is joined onto both, one-to-one on ``patient_id``,
    to supply the comorbidity history features.

    Parameters
    ----------
    verify_checksum : bool
        Whether to verify checksums (not applicable for synthetic data).

    Returns
    -------
    dict
        Dictionary with "train" and "test" keys, each a DataFrame.
    """
    from backend.ml.triagegeist_loader import (
        load_patient_history,
        load_test,
        load_train,
    )

    train = load_train(DATA_DIR / "train.csv")
    test = load_test(DATA_DIR / "test.csv")
    history = load_patient_history(DATA_DIR / "patient_history.csv")

    train = _join_one_to_one(train, history, "patient_id", "patient_history.csv")
    test = _join_one_to_one(test, history, "patient_id", "patient_history.csv")

    logger.info(
        "Loaded Triagegeist: %d train rows, %d test rows, %d history columns",
        len(train),
        len(test),
        len(history.columns) - 1,
    )
    return {"train": train, "test": test}


def load_triage(verify_checksum: bool = True) -> pd.DataFrame:
    """Load the triage training split."""
    return load_joined_dataset(verify_checksum=verify_checksum)["train"]


def load_edstays(verify_checksum: bool = True) -> pd.DataFrame:
    """Triagegeist has no separate edstays table."""
    return pd.DataFrame(columns=["patient_id"])


def load_vitalsign_for_audit(verify_checksum: bool = True) -> pd.DataFrame:
    """Triagegeist has no separate vitalsign table."""
    return pd.DataFrame()


def read_checksum_file(path: Path | None = None) -> dict[str, str]:
    """Read checksum file - not applicable for synthetic data."""
    return {}


def verify_checksums(
    paths: list[Path] | None = None,
    checksum_file: Path | None = None,
) -> dict[str, bool]:
    """Verify checksums - not applicable for synthetic data."""
    return {}


def join_triage_edstays(
    triage: pd.DataFrame, edstays: pd.DataFrame, validate: bool = True
) -> pd.DataFrame:
    """Triagegeist has no separate edstays table, so this is the identity."""
    return triage
