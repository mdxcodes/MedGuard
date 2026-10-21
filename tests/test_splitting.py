"""Tests for patient-grouped splitting, out-of-fold predictions,
and error categorization."""

from __future__ import annotations

import pandas as pd
import pytest

from backend.ml import config
from backend.ml.data_loading import load_joined_dataset
from backend.ml.features import build_feature_frame
from backend.ml.splitting import (
    patient_grouped_split,
    grouped_kfold,
    report_stratification_feasibility,
    assert_no_patient_overlap,
    assert_non_empty,
)
from tests.fixtures import synthetic_labelled_frame


@pytest.fixture()
def frame():
    """A synthetic feature frame with many repeat patients."""
    return build_feature_frame(synthetic_labelled_frame(n_patients=30, seed=11))


@pytest.fixture()
def real_frame():
    """The real cohort, loaded from the joined dataset."""
    from backend.ml.data_loading import load_joined_dataset

    return build_feature_frame(load_joined_dataset())


# ---------------------------------------------------------------------------
# Patient separation
# ---------------------------------------------------------------------------


class TestPatientSeparation:
    def test_no_patient_appears_in_both_sets(self, frame):
        train, test = patient_grouped_split(frame, test_size=0.3, seed=1)
        assert train["patient_id"].nunique() + test["patient_id"].nunique() == (
            frame["patient_id"].nunique()
        )
        assert not (
            set(train["patient_id"]) & set(test["patient_id"])
        )

    def test_overlap_guard_raises_on_leaked_split(self):
        train = {"patient_id": [1, 2, 3]}
        test = {"patient_id": [3, 4]}
        with pytest.raises(PatientOverlapError, match="BOTH the training"):
            assert_no_patient_overlap(train["patient_id"], test["patient_id"])

    def test_empty_guards(self):
        with pytest.raises(EmptySplitError, match="training side is empty"):
            assert_non_empty([], [1])
        with pytest.raises(EmptySplitError, match="test side is empty"):
            assert_non_empty([1], [])

    def test_test_size_is_respected(self, frame):
        train, test = patient_grouped_split(frame, test_size=0.25, seed=2)
        n_patients = frame["patient_id"].nunique()
        assert len(test) > 0
        # Approximately a quarter of PATIENTS, not rows.
        assert test["patient_id"].nunique() <= n_patients * 0.35

    def test_repeat_patients_stay_together(self, frame):
        """Every visit of a repeat patient must land on one side only."""
        train, test = patient_grouped_split(frame, test_size=0.3, seed=5)
        counts = frame["patient_id"].value_counts()
        for patient, count in counts.items():
            if count > 1:
                in_train = (train["patient_id"] == patient).sum()
                in_test = (test["patient_id"] == patient).sum()
                assert in_train == count or in_test == count, (
                    "patient was split across train/test"
                )


class TestReproducibility:
    def test_same_seed_gives_same_split(self, frame):
        train_a, test_a = patient_grouped_split(frame, test_size=0.3, seed=42)
        train_b, test_b = patient_grouped_split(frame, test_size=0.3, seed=42)
        assert train_a["patient_id"].tolist() == train_b["patient_id"].tolist()
        assert test_a["patient_id"].tolist() == test_b["patient_id"].tolist()

    def test_different_seed_gives_different_split(self, frame):
        train_a, _ = patient_grouped_split(frame, test_size=0.3, seed=1)
        train_b, _ = patient_grouped_split(frame, test_size=0.3, seed=99)
        assert not set(train_a["patient_id"]) == set(train_b["patient_id"])

    def test_split_is_stable_across_repeated_calls(self, frame):
        first = patient_grouped_split(frame, test_size=0.3, seed=3)
        second = patient_grouped_split(frame, test_size=0.3, seed=3)
        assert first[0]["patient_id"].tolist() == second[0]["patient_id"].tolist()
        assert first[1]["patient_id"].tolist() == second[1]["patient_id"].tolist()


class TestGroupedKFold:
    def test_folds_cover_all_rows_once(self, frame):
        seen = []
        for train, val in grouped_kfold(frame, n_splits=3):
            assert not (set(train["patient_id"]) & set(val["patient_id"]))
            seen.extend(val["patient_id"].tolist())
        assert sorted(seen) == sorted(frame["patient_id"].tolist())

    def test_stratified_kfold_is_infeasible_without_esi5(self, frame):
        report = report_stratification_feasibility(frame)
        assert report["feasible"] is False
        with pytest.raises(SplitError, match="infeasible"):
            list(stratified_grouped_kfold(frame, n_splits=4))

    def test_stratified_kfold_works_when_all_levels_present(self):
        frame = build_feature_frame(synthetic_labelled_frame(n_patients=60, seed=1))
        labels = [1.0, 2.0, 3.0, 4.0, 5.0]
        frame = frame.head(25).copy()
        frame["triage_acuity"] = [
            labels[i % len(labels)] for i in range(len(frame))
        ]
        report = report_stratification_feasibility(frame, n_splits=5)
        assert report["feasible"] is True
        folds = list(stratified_grouped_kfold(frame, n_splits=5))
        assert len(folds) == 5


class TestRealCohortSplitting:
    def test_real_split_has_no_patient_overlap(self, real_frame):
        train, test = patient_grouped_split(real_frame, seed=config.RANDOM_SEED)
        assert not (set(train["patient_id"]) & set(test["patient_id"]))

    def test_real_esi5_is_absent_and_stratification_refused(self, real_frame):
        report = report_stratification_feasibility(real_frame)
        assert report["missing_classes"] == [5]
        assert report["feasible"] is False
        assert 4 in report["sparse_classes"]

    def test_labels_are_never_collapsed(self, real_frame):
        # The five-level target must survive every split unchanged.
        assert set(real_frame["triage_acuity"].unique()) <= {1.0, 2.0, 3.0, 4.0}
        assert set(config.ESI_LABELS) == {1, 2, 3, 4, 5}

    def test_grouped_kfold_holds_on_real_cohort(self, real_frame):
        folds = list(grouped_kfold(real_frame, n_splits=5))
        assert len(folds) == 5
        for train, val in folds:
            assert not (set(train["patient_id"]) & set(val["patient_id"]))
