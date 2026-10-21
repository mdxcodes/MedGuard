"""Patient-grouped splitting utilities for Triagegeist.

All splitting functions ensure patient-grouped integrity: the same patient
never appears in both train and validation/test partitions.
"""

from __future__ import annotations

from typing import Iterator, Tuple

import numpy as np
import pandas as pd
from sklearn.model_selection import GroupKFold, GroupShuffleSplit, ShuffleSplit

from backend.ml import config, triagegeist_schema
from backend.ml.data_loading import DataLoadingError


def patient_grouped_split(
    df: pd.DataFrame,
    test_size: float = config.TEST_SIZE,
    seed: int = config.RANDOM_SEED,
    group_col: str = triagegeist_schema.PATIENT_ID_COLUMN,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Split into train/test with no patient overlap.

    Uses GroupShuffleSplit on the patient identifier column so that no patient
    appears in both partitions.
    """
    gss = GroupShuffleSplit(
        n_splits=1, test_size=test_size, random_state=seed
    )
    groups = df[group_col].values
    train_idx, val_idx = next(gss.split(df, groups=groups))
    return df.iloc[train_idx].reset_index(drop=True), df.iloc[val_idx].reset_index(drop=True)


def grouped_kfold(
    df: pd.DataFrame,
    n_splits: int = config.N_SPLITS,
    seed: int = config.RANDOM_SEED,
    group_col: str = triagegeist_schema.PATIENT_ID_COLUMN,
) -> Iterator[tuple[pd.DataFrame, pd.DataFrame]]:
    """Yield (train, validation) fold pairs with no patient overlap.

    Uses GroupKFold on the patient identifier column.
    """
    gkf = GroupKFold(n_splits=n_splits)
    groups = df[group_col].values
    for train_idx, val_idx in gkf.split(df, groups=groups):
        yield df.iloc[train_idx].reset_index(drop=True), df.iloc[val_idx].reset_index(drop=True)


def assert_no_patient_overlap(
    train_pids: pd.Series | np.ndarray,
    val_pids: pd.Series | np.ndarray,
    context: str = "",
) -> None:
    """Assert no patient appears in both train and validation sets."""
    train_set = set(train_pids)
    val_set = set(val_pids)
    overlap = train_set & val_set
    if overlap:
        raise ValueError(
            f"Patient overlap detected in {context}: "
            f"{len(overlap)} patient(s) in both sets: {sorted(overlap)[:10]}"
        )


def report_stratification_feasibility(df: pd.DataFrame) -> dict[str, Any]:
    """Report stratification feasibility for a dataframe."""
    from collections import Counter

    counts = Counter(df[triagegeist_schema.TARGET_COLUMN])
    min_count = min(counts.values()) if counts else 0
    n_splits = config.N_SPLITS
    feasible = min_count >= n_splits

    return {
        "class_counts": {f"ESI {int(k)}": v for k, v in sorted(counts.items())},
        "min_class_count": min_count,
        "n_splits": n_splits,
        "stratification_feasible": feasible,
        "recommendation": (
            "Sufficient samples per class for stratified grouping"
            if feasible
            else f"Minimum class count ({min_count}) < n_splits ({n_splits}); "
            "stratified grouping may produce empty folds."
        ),
    }


# ---------------------------------------------------------------------------
# Compatibility exception aliases for test compatibility
# ---------------------------------------------------------------------------

class EmptySplitError(DataLoadingError):
    """A split produced an empty train or test partition."""


class PatientOverlapError(DataLoadingError):
    """A patient appears in both train and validation/test partitions."""


class SplitError(DataLoadingError):
    """A split operation failed for any other reason."""


def assert_non_empty(train: pd.DataFrame | list, val: pd.DataFrame | list) -> None:
    """Assert that both train and validation/test partitions are non-empty."""
    train_n = len(train) if hasattr(train, "__len__") else len(list(train))
    val_n = len(val) if hasattr(val, "__len__") else len(list(val))
    if train_n == 0:
        raise EmptySplitError("Training split is empty.")
    if val_n == 0:
        raise EmptySplitError("Validation/test split is empty.")


if __name__ == "__main__":
    import json

    print(json.dumps({
        "patient_id_column": triagegeist_schema.PATIENT_ID_COLUMN,
        "target_column": triagegeist_schema.TARGET_COLUMN,
        "n_splits": config.N_SPLITS,
        "test_size": config.TEST_SIZE,
    }, indent=2))
