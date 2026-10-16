"""Tests for patient-grouped splitting, overlap guards and reproducibility."""

from __future__ import annotations

import pytest

from backend.ml import config, splitting
from backend.ml.features import build_feature_frame
from backend.ml.splitting import (
    EmptySplitError,
    PatientOverlapError,
    SplitError,
)
from tests.fixtures import synthetic_labelled_frame


@pytest.fixture()
def frame():
    """A synthetic feature frame with many repeat patients."""
    return build_feature_frame(synthetic_labelled_frame(n_patients=30, seed=11))


@pytest.fixture()
def real_frame():
    """The real cohort, loaded from the licensed dataset."""
    from backend.ml.data_loading import load_joined_dataset

    return build_feature_frame(load_joined_dataset())


# ---------------------------------------------------------------------------
# Patient separation
# ---------------------------------------------------------------------------


class TestPatientSeparation:
    def test_no_patient_appears_in_both_sets(self, frame):
        train, test = splitting.patient_grouped_split(frame, test_size=0.3, seed=1)
        assert train["subject_id"].nunique() + test["subject_id"].nunique() == (
            frame["subject_id"].nunique()
        )
        assert not (
            set(train["subject_id"]) & set(test["subject_id"])
        )

    def test_overlap_guard_raises_on_leaked_split(self):
        train = {"subject_id": [1, 2, 3]}
        test = {"subject_id": [3, 4]}
        with pytest.raises(PatientOverlapError, match="BOTH the training"):
            splitting.assert_no_patient_overlap(train["subject_id"], test["subject_id"])

    def test_empty_guards(self):
        with pytest.raises(EmptySplitError, match="training side is empty"):
            splitting.assert_non_empty([], [1])
        with pytest.raises(EmptySplitError, match="test side is empty"):
            splitting.assert_non_empty([1], [])

    def test_test_size_is_respected(self, frame):
        train, test = splitting.patient_grouped_split(frame, test_size=0.25, seed=2)
        n_patients = frame["subject_id"].nunique()
        assert len(test) > 0
        # Approximately a quarter of PATIENTS, not rows.
        assert test["subject_id"].nunique() <= n_patients * 0.35

    def test_repeat_patients_stay_together(self, frame):
        """Every visit of a repeat patient must land on one side only."""
        train, test = splitting.patient_grouped_split(frame, test_size=0.3, seed=5)
        counts = frame["subject_id"].value_counts()
        for patient, count in counts.items():
            if count > 1:
                in_train = (train["subject_id"] == patient).sum()
                in_test = (test["subject_id"] == patient).sum()
                assert in_train == count or in_test == count, (
                    "patient was split across train/test"
                )


# ---------------------------------------------------------------------------
# Reproducibility
# ---------------------------------------------------------------------------


class TestReproducibility:
    def test_same_seed_gives_same_split(self, frame):
        assert splitting.splits_are_reproducible(frame, seed=42)

    def test_different_seed_gives_different_split(self, frame):
        train_a, _ = splitting.patient_grouped_split(frame, test_size=0.3, seed=1)
        train_b, _ = splitting.patient_grouped_split(frame, test_size=0.3, seed=99)
        assert not set(train_a["stay_id"]) == set(train_b["stay_id"])

    def test_split_is_stable_across_repeated_calls(self, frame):
        first = splitting.patient_grouped_split(frame, test_size=0.3, seed=3)
        second = splitting.patient_grouped_split(frame, test_size=0.3, seed=3)
        assert first[0]["stay_id"].tolist() == second[0]["stay_id"].tolist()
        assert first[1]["stay_id"].tolist() == second[1]["stay_id"].tolist()


# ---------------------------------------------------------------------------
# Cross-validation folds
# ---------------------------------------------------------------------------


class TestGroupedKFold:
    def test_folds_cover_all_rows_once(self, frame):
        seen = []
        for train, val in splitting.grouped_kfold(frame, n_splits=3):
            assert not (set(train["subject_id"]) & set(val["subject_id"]))
            seen.extend(val["stay_id"].tolist())
        assert sorted(seen) == sorted(frame["stay_id"].tolist())

    def test_stratified_kfold_is_infeasible_without_esi5(self, frame):
        # The synthetic frame only contains ESI 1-3; the real cohort also
        # lacks ESI 5. StratifiedGroupKFold must be refused, not silently
        # applied with collapsed labels.
        report = splitting.report_stratification_feasibility(frame)
        assert report["feasible"] is False
        with pytest.raises(SplitError, match="infeasible"):
            list(splitting.stratified_grouped_kfold(frame, n_splits=4))

    def test_stratified_kfold_works_when_all_levels_present(self):
        frame = build_feature_frame(synthetic_labelled_frame(n_patients=60, seed=1))
        # Force a balanced five-label frame so stratification is feasible.
        labels = [1.0, 2.0, 3.0, 4.0, 5.0]
        frame = frame.head(25).copy()
        frame["acuity"] = [
            labels[i % len(labels)] for i in range(len(frame))
        ]
        report = splitting.report_stratification_feasibility(frame, n_splits=5)
        assert report["feasible"] is True
        folds = list(splitting.stratified_grouped_kfold(frame, n_splits=5))
        assert len(folds) == 5


# ---------------------------------------------------------------------------
# Stratification feasibility investigation (real cohort)
# ---------------------------------------------------------------------------


class TestRealCohortSplitting:
    def test_real_split_has_no_patient_overlap(self, real_frame):
        train, test = splitting.patient_grouped_split(real_frame, seed=config.RANDOM_SEED)
        assert not (set(train["subject_id"]) & set(test["subject_id"]))

    def test_real_esi5_is_absent_and_stratification_refused(self, real_frame):
        report = splitting.report_stratification_feasibility(real_frame)
        assert report["missing_classes"] == [5]
        assert report["feasible"] is False
        # Level 4 is sparse: fewer rows than n_splits.
        assert 4 in report["sparse_classes"]

    def test_labels_are_never_collapsed(self, real_frame):
        # The five-level target must survive every split unchanged.
        assert set(real_frame["acuity"].unique()) <= {1.0, 2.0, 3.0, 4.0}
        assert set(config.ESI_LABELS) == {1, 2, 3, 4, 5}

    def test_grouped_kfold_holds_on_real_cohort(self, real_frame):
        folds = list(splitting.grouped_kfold(real_frame, n_splits=5))
        assert len(folds) == 5
        for train, val in folds:
            assert not (set(train["subject_id"]) & set(val["subject_id"]))
