"""Data loading utilities for MedGuard.

Reads the MedGuard dataset from CSV files.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Dict

import numpy as np
import pandas as pd

from backend.ml import config


DATA_DIR = config.PROJECT_ROOT / "triagegeist"


def load_joined_dataset(verify_checksum: bool = True) -> pd.DataFrame:
    """Load the joined MedGuard dataset.

    Reads train.csv and test.csv from the dataset directory and returns them
    as a dict with "train" and "test" keys.

    Parameters
    ----------
    verify_checksum : bool
        Whether to verify checksums (not applicable for synthetic data).

    Returns
    -------
    dict
        Dictionary with "train" and "test" keys, each a DataFrame.
    """
    train_df = pd.read_csv(DATA_DIR / "train.csv")
    test_df = pd.read_csv(DATA_DIR / "test.csv")
    return {"train": train_df, "test": test_df}


def load_triage(verify_checksum: bool = True) -> pd.DataFrame:
    """Load triage data (alias for load_joined_dataset train split)."""
    return load_joined_dataset(verify_checksum=verify_checksum)["train"]


def load_edstays(verify_checksum: bool = True) -> pd.DataFrame:
    """Load edstays - for Triagegeist this returns an empty DataFrame
    since there is no separate edstays table."""
    return pd.DataFrame(columns=["patient_id"])


def load_vitalsign_for_audit(verify_checksum: bool = True) -> pd.DataFrame:
    """Load vitalsign - for Triagegeist this returns an empty DataFrame
    since there is no separate vitalsign table."""
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
    """Join triage and edstays - for Triagegeist this just returns triage
    since there is no separate edstays table."""
    return triage


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
