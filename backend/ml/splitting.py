"""Patient-grouped train/test splitting with automated overlap guards.

Why grouping is mandatory
-------------------------
The audited cohort contains 222 ED stays from only 64 patients, and the most
frequent patient contributes 23 stays. A row-level split would put the *same*
patient's repeated visits in both training and test sets, letting the model
memorise that patient's recurring complaint and stable physiology and
reporting an inflated score. Every split in this module therefore declares
``subject_id`` as the grouping key and asserts that no patient appears on both
sides.

Stratification limitation (verified, not assumed)
-------------------------------------------------
ESI Level 5 is entirely absent from the demo subset and ESI Level 4 has only
two labelled rows. ``StratifiedGroupKFold`` cannot reliably place 2 members
across 5 folds, so the labels are *never* collapsed or merged to make
stratification work. This module measures feasibility and reports it instead.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Iterator

import numpy as np
import pandas as pd
from sklearn.model_selection import GroupShuffleSplit, GroupKFold, StratifiedGroupKFold

from . import config

logger = logging.getLogger(__name__)


class SplitError(RuntimeError):
    """A split violated a required invariant."""


class PatientOverlapError(SplitError):
    """The same patient appeared in both training and test sets."""


class EmptySplitError(SplitError):
    """A split produced an empty training or test side."""


# ---------------------------------------------------------------------------
# Invariant guards
# ---------------------------------------------------------------------------


def assert_no_patient_overlap(
    train_groups: pd.Series | np.ndarray,
    test_groups: pd.Series | np.ndarray,
    context: str = "split",
) -> None:
    """Raise :class:`PatientOverlapError` if any patient is in both sides."""
    train_set = set(np.asarray(train_groups))
    test_set = set(np.asarray(test_groups))
    overlap = sorted(train_set & test_set)
    if overlap:
        raise PatientOverlapError(
            f"{context}: {len(overlap)} patient(s) appear in BOTH the training "
            "and test sets. Patient-grouped splitting is mandatory for this "
            "dataset. Overlapping patient identifiers are withheld from this "
            "message for privacy."
        )


def assert_non_empty(train, test, context: str = "split") -> None:
    """Raise if either side of a split has no rows."""
    if len(train) == 0:
        raise EmptySplitError(f"{context}: the training side is empty.")
    if len(test) == 0:
        raise EmptySplitError(f"{context}: the test side is empty.")


# ---------------------------------------------------------------------------
# Hold-out split
# ---------------------------------------------------------------------------


def patient_grouped_split(
    frame: pd.DataFrame,
    test_size: float = config.TEST_SIZE,
    seed: int = config.RANDOM_SEED,
    group_col: str = config.SUBJECT_ID_COLUMN,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Split rows into train/test so no patient appears in both.

    Parameters
    ----------
    frame:
        Feature frame containing ``subject_id``.
    test_size:
        Fraction of **patients** (not rows) placed in the test set.
    seed:
        Fixed random seed; the same seed always produces the same split.
    group_col:
        Patient identifier column.

    Returns
    -------
    ``(train_df, test_df)`` — row-index-aligned copies of the input.
    """
    groups = frame[group_col].to_numpy()
    splitter = GroupShuffleSplit(
        n_splits=1, test_size=test_size, random_state=seed
    )
    train_idx, test_idx = next(splitter.split(frame, groups=groups))

    train = frame.iloc[train_idx].copy()
    test = frame.iloc[test_idx].copy()

    assert_non_empty(train, test, "patient_grouped_split")
    assert_no_patient_overlap(
        train[group_col], test[group_col], "patient_grouped_split"
    )
    logger.info(
        "Patient-grouped split: %d train / %d test rows from %d train / "
        "%d test patients (seed=%d).",
        len(train), len(test),
        train[group_col].nunique(), test[group_col].nunique(), seed,
    )
    return train, test


# ---------------------------------------------------------------------------
# Cross-validation folds
# ---------------------------------------------------------------------------


def grouped_kfold(
    frame: pd.DataFrame,
    n_splits: int = config.N_SPLITS,
    group_col: str = config.SUBJECT_ID_COLUMN,
) -> Iterator[tuple[pd.DataFrame, pd.DataFrame]]:
    """Yield ``(train_df, val_df)`` folds grouped by patient.

    Uses ``GroupKFold``, which never stratifies and therefore cannot fail on
    sparse classes. Recommended for model selection on this demo subset.
    """
    groups = frame[group_col].to_numpy()
    splitter = GroupKFold(n_splits=n_splits)
    for fold, (train_idx, val_idx) in enumerate(
        splitter.split(frame, groups=groups)
    ):
        train = frame.iloc[train_idx]
        val = frame.iloc[val_idx]
        assert_non_empty(train, val, f"grouped_kfold fold {fold}")
        assert_no_patient_overlap(
            train[group_col], val[group_col], f"grouped_kfold fold {fold}"
        )
        yield train, val


def stratified_grouped_kfold(
    frame: pd.DataFrame,
    y_col: str = config.TARGET_COLUMN,
    n_splits: int = config.N_SPLITS,
    group_col: str = config.SUBJECT_ID_COLUMN,
) -> Iterator[tuple[pd.DataFrame, pd.DataFrame]]:
    """Yield ``(train_df, val_df)`` folds grouped by patient and stratified.

    Raises
    ------
    SplitError
        If stratification is infeasible for this class distribution (see
        :func:`report_stratification_feasibility`).
    """
    report = report_stratification_feasibility(frame, y_col, n_splits)
    if not report["feasible"]:
        raise SplitError(
            "StratifiedGroupKFold is infeasible for this cohort: "
            f"{report['reason']} Use grouped_kfold() instead, which does not "
            "collapse or merge the original ESI labels."
        )

    groups = frame[group_col].to_numpy()
    y = frame[y_col].to_numpy()
    splitter = StratifiedGroupKFold(
        n_splits=n_splits, shuffle=True, random_state=config.RANDOM_SEED
    )
    for fold, (train_idx, val_idx) in enumerate(
        splitter.split(frame, y, groups=groups)
    ):
        train = frame.iloc[train_idx]
        val = frame.iloc[val_idx]
        assert_non_empty(train, val, f"stratified_grouped_kfold fold {fold}")
        assert_no_patient_overlap(
            train[group_col], val[group_col], f"fold {fold}"
        )
        yield train, val


# ---------------------------------------------------------------------------
# Stratification feasibility investigation
# ---------------------------------------------------------------------------


@dataclass
class StratificationAssessment:
    """Result of testing whether stratified group splitting is feasible."""

    feasible: bool
    reason: str
    class_counts: dict[int, int]
    n_splits: int
    missing_classes: list[int]
    sparse_classes: list[int]
    attempted: bool = False
    error: str = ""

    def to_dict(self) -> dict:
        return {
            "feasible": self.feasible,
            "reason": self.reason,
            "class_counts": {str(k): v for k, v in self.class_counts.items()},
            "n_splits": self.n_splits,
            "missing_classes": self.missing_classes,
            "sparse_classes": self.sparse_classes,
            "attempted": self.attempted,
            "error": self.error,
        }


def report_stratification_feasibility(
    frame: pd.DataFrame,
    y_col: str = config.TARGET_COLUMN,
    n_splits: int = config.N_SPLITS,
) -> dict:
    """Measure whether ``StratifiedGroupKFold`` can work on this cohort.

    Returns a machine-readable dict. Never modifies the labels.
    """
    y = frame[y_col].dropna()
    counts = {int(k): int(v) for k, v in y.value_counts().sort_index().items()}
    missing = [label for label in config.ESI_LABELS if counts.get(label, 0) == 0]
    sparse = [
        label
        for label in config.ESI_LABELS
        if 0 < counts.get(label, 0) < n_splits
    ]

    if missing:
        return StratificationAssessment(
            feasible=False,
            reason=(
                f"ESI level(s) {missing} are absent from this cohort, so a "
                "stratified five-class split cannot place every class in "
                "every fold."
            ),
            class_counts=counts,
            n_splits=n_splits,
            missing_classes=missing,
            sparse_classes=sparse,
        ).to_dict()

    if sparse:
        assessment = StratificationAssessment(
            feasible=False,
            reason=(
                f"ESI level(s) {sparse} have fewer labelled rows than "
                f"n_splits={n_splits}, so stratified group splitting cannot "
                "place them in each fold."
            ),
            class_counts=counts,
            n_splits=n_splits,
            missing_classes=missing,
            sparse_classes=sparse,
        )
        # Try it anyway to record the concrete error for the audit trail.
        try:
            for _ in stratified_grouped_kfold(frame, y_col, n_splits):
                break
            assessment.attempted = True
        except Exception as exc:  # noqa: BLE001 - recorded for the report
            assessment.attempted = True
            assessment.error = f"{type(exc).__name__}: {exc}"
        return assessment.to_dict()

    return StratificationAssessment(
        feasible=True,
        reason="All five ESI levels have at least n_splits labelled rows.",
        class_counts=counts,
        n_splits=n_splits,
        missing_classes=missing,
        sparse_classes=sparse,
    ).to_dict()


# ---------------------------------------------------------------------------
# Reproducibility helper
# ---------------------------------------------------------------------------


def _stay_ids(frame: pd.DataFrame) -> pd.Series:
    """Sorted ``stay_id`` values, used for reproducibility comparisons."""
    return frame[config.STAY_ID_COLUMN].sort_values().reset_index(drop=True)


def splits_are_reproducible(
    frame: pd.DataFrame,
    seed: int = config.RANDOM_SEED,
    test_size: float = config.TEST_SIZE,
) -> bool:
    """True when two identical seeded calls produce identical splits."""
    train_a, test_a = patient_grouped_split(frame, test_size, seed)
    train_b, test_b = patient_grouped_split(frame, test_size, seed)
    return bool(
        _stay_ids(train_a).equals(_stay_ids(train_b))
        and _stay_ids(test_a).equals(_stay_ids(test_b))
    )
