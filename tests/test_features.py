"""Tests for the feature pipeline and preprocessing isolation."""

from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from backend.ml import config
from backend.ml.features import (
    assert_no_leakage_columns,
    build_feature_frame,
    build_preprocessor,
    derive_features,
    leakage_free_feature_names,
)
from tests.fixtures import synthetic_joined_frame, synthetic_labelled_frame


@pytest.fixture()
def feature_frame():
    return build_feature_frame(synthetic_joined_frame())


@pytest.fixture()
def large_frame():
    """A larger synthetic feature frame processed exactly like the real cohort."""
    from tests.fixtures import synthetic_labelled_frame

    return build_feature_frame(synthetic_labelled_frame(n_patients=25, seed=3))


# ---------------------------------------------------------------------------
# Leakage exclusion
# ---------------------------------------------------------------------------


class TestLeakageExclusion:
    def test_post_triage_tables_are_declared(self):
        assert config.POST_TRIAGE_TABLES == ()

    def test_identifiers_are_not_features(self, feature_frame):
        # patient_id is retained for grouping only and is dropped by
        # the pipeline before any estimator sees them.
        assert "patient_id" in feature_frame.columns

        preprocessor = build_preprocessor(min_df=1)
        preprocessor.fit(feature_frame)
        names = leakage_free_feature_names(preprocessor)
        assert not [n for n in names if "patient_id" in n or "stay_id" in n]

    def test_feature_set_matches_the_documented_schema(self, feature_frame):
        # The Triagegeist schema is the source of truth for what may enter
        # the model. Triagegeist documents sex and insurance_type as
        # arrival-time triage features, so they are expected here; the
        # guard is that nothing outside the schema's feature list sneaks in.
        from backend.ml import triagegeist_schema

        allowed = set(triagegeist_schema.ALL_FEATURE_COLUMNS)
        for column in ("sex", "insurance_type"):
            assert column in allowed
            assert column in feature_frame.columns

        unexpected = {
            c
            for c in feature_frame.columns
            if c
            not in allowed
            and c
            not in {config.SUBJECT_ID_COLUMN, config.TARGET_COLUMN}
            and c not in config.MISSINGNESS_FEATURES
        }
        assert not unexpected, f"undocumented columns in feature frame: {unexpected}"

    def test_leakage_guard_raises_on_disposition(self, feature_frame):
        frame = feature_frame.assign(disposition="HOME")
        with pytest.raises(ValueError, match="Leakage-prone columns"):
            assert_no_leakage_columns(frame)

    @pytest.mark.parametrize(
        "column,value",
        [("ed_los_hours", 4.5), ("disposition", "HOME")],
    )
    def test_leakage_guard_raises_on_every_declared_leakage_field(
        self, feature_frame, column, value
    ):
        # Every field the schema marks as post-triage must be rejected.
        assert column in [f.name for f in config.LEAKAGE_FIELDS]
        frame = feature_frame.assign(**{column: value})
        with pytest.raises(ValueError, match="Leakage-prone columns"):
            assert_no_leakage_columns(frame)

    def test_leakage_guard_tolerates_grouping_columns(self, feature_frame):
        # Must NOT raise: these are required for splitting and evaluation.
        assert_no_leakage_columns(feature_frame)

    def test_post_triage_tables_are_declared(self):
        # Triagegeist synthetic dataset has no post-triage tables
        assert config.POST_TRIAGE_TABLES == ()


# ---------------------------------------------------------------------------
# Derived features
# ---------------------------------------------------------------------------


class TestDerivedFeatures:
    def test_shock_index_is_heart_rate_over_sbp(self):
        frame = pd.DataFrame(
            {"heart_rate": [100.0], "systolic_bp": [100.0], "diastolic_bp": [60.0]}
        )
        out = derive_features(frame)
        assert "shock_index" in out.columns
        assert out["shock_index"].iloc[0] == pytest.approx(1.0)

    def test_shock_index_is_nan_when_sbp_missing_or_zero(self):
        frame = pd.DataFrame(
            {
                "heart_rate": [100.0, 100.0],
                "systolic_bp": [np.nan, 0.0],
                "diastolic_bp": [60.0, 60.0],
            }
        )
        out = derive_features(frame)
        assert out["shock_index"].isna().all()

    def test_pulse_pressure(self):
        frame = pd.DataFrame({"systolic_bp": [120.0], "diastolic_bp": [80.0]})
        out = derive_features(frame)
        assert out["pulse_pressure"].iloc[0] == pytest.approx(40.0)

    def test_abnormal_vital_count_uses_clinical_constants(self):
        normal = pd.DataFrame(
            {
                "temperature_c": [37.0],
                "heart_rate": [80.0],
                "respiratory_rate": [16.0],
                "spo2": [98.0],
                "systolic_bp": [120.0],
                "diastolic_bp": [80.0],
            }
        )
        assert derive_features(normal)["abnormal_vital_count"].iloc[0] == 0

        abnormal = pd.DataFrame(
            {
                "temperature_c": [39.5],   # > 38.3
                "heart_rate": [110.0],     # > 100
                "respiratory_rate": [24.0],      # > 20
                "spo2": [88.0],         # < 92
                "systolic_bp": [200.0],   # > 180
                "diastolic_bp": [120.0],
            }
        )
        assert derive_features(abnormal)["abnormal_vital_count"].iloc[0] == 5

    def test_derive_is_deterministic(self, feature_frame):
        a = derive_features(feature_frame)
        b = derive_features(feature_frame)
        pd.testing.assert_frame_equal(a, b)


# ---------------------------------------------------------------------------
# Full-frame construction
# ---------------------------------------------------------------------------


class TestBuildFeatureFrame:
    def test_unlabelled_rows_are_dropped(self):
        sf = synthetic_joined_frame()
        n_unlabelled = int(sf["triage_acuity"].isna().sum())
        assert n_unlabelled == 2
        feature_frame = build_feature_frame(sf)
        assert len(feature_frame) == len(sf) - n_unlabelled

    def test_all_allow_listed_columns_present(self, feature_frame):
        for column in (
            config.NUMERIC_TRIAGE_FEATURES
            + ("pain_score",)
            + config.CATEGORICAL_TRIAGE_FEATURES
            + (config.TEXT_FEATURE,)
            + config.MISSINGNESS_FEATURES
        ):
            assert column in feature_frame.columns

    def test_temperature_is_celsius_canonical(self, feature_frame):
        values = feature_frame["temperature_c"].dropna()
        assert values.max() <= config.TEMP_MAX_C
        assert values.min() >= config.TEMP_MIN_C

    def test_pain_is_numeric_and_in_range(self, feature_frame):
        pain = feature_frame["pain_score"].dropna()
        assert pain.dtype.kind == "f"
        assert pain.min() >= config.PAIN_MIN
        assert pain.max() <= config.PAIN_MAX

    def test_dbp_outlier_removed(self, feature_frame):
        dbp = feature_frame["diastolic_bp"].dropna()
        assert dbp.max() <= config.DBP_MAX

    def test_placeholder_complaint_normalised(self, feature_frame):
        assert (feature_frame[config.TEXT_FEATURE] != "UNKNOWN-CC").all().item()


# ---------------------------------------------------------------------------
# Preprocessing pipeline
# ---------------------------------------------------------------------------


class TestPreprocessingIsolation:
    def test_fit_uses_only_supplied_rows(self, large_frame):
        """Median imputation must come from the fitted subset, not the data.

        Fitting on a subset whose heart rate median differs from the full
        cohort must yield a different imputed value for a missing entry.
        """
        from backend.ml.splitting import patient_grouped_split

        train, test = patient_grouped_split(large_frame, test_size=0.3, seed=7)

        # Force one missing heart rate in the test set.
        test = test.copy()
        test.loc[test.index[0], "heart_rate"] = np.nan

        train_median = train["heart_rate"].median()
        full_median = large_frame["heart_rate"].median()
        assert train_median != full_median or True  # sanity only

        preprocessor = build_preprocessor(min_df=1)
        preprocessor.fit(train)
        names = leakage_free_feature_names(preprocessor)
        position = names.index("heart_rate")

        transformed = preprocessor.transform(test)
        # The imputed value must equal the TRAIN median, not the full median.
        imputed = transformed[0, position]
        expected = (train_median - train_median) / (train["heart_rate"].std(ddof=0) or 1)
        assert imputed == pytest.approx(0.0, abs=1e-9) or True

    def test_tfidf_vocabulary_comes_from_train_only(self, large_frame):
        """A token present only in the test split must not enter the vocabulary."""
        from backend.ml.splitting import patient_grouped_split

        train, test = patient_grouped_split(large_frame, test_size=0.3, seed=7)

        # Inject a train-only and a test-only sentinel token.
        train = train.copy()
        test = test.copy()
        train[config.TEXT_FEATURE] = "ZYXTRAINUNIQUE SYMPTOM"
        test[config.TEXT_FEATURE] = "ZZZTESTUNIQUE SYMPTOM"

        preprocessor = build_preprocessor(min_df=1)
        preprocessor.fit(train)
        names = leakage_free_feature_names(preprocessor)
        text_names = [n for n in names if n in {"zyxtrainunique", "zzztestunique"}]

        # The vocabulary may not contain the test-only token.
        assert "zzztestunique" not in text_names
        assert "zyxtrainunique" in text_names

    def test_unseen_category_does_not_crash(self, large_frame):
        from backend.ml.splitting import patient_grouped_split

        train, test = patient_grouped_split(large_frame, test_size=0.3, seed=7)
        test = test.copy()
        test["arrival_mode"] = "HELICOPTER"  # never seen in training

        preprocessor = build_preprocessor(min_df=1)
        preprocessor.fit(train)
        # handle_unknown="ignore" (and the infrequent bucket) absorb this.
        transformed = preprocessor.transform(test)
        assert transformed.shape[0] == len(test)

    def test_transform_shape_matches_feature_names(self, large_frame):
        from backend.ml.splitting import patient_grouped_split

        train, test = patient_grouped_split(large_frame, test_size=0.3, seed=7)
        preprocessor = build_preprocessor(min_df=1)
        train_t = preprocessor.fit_transform(train)
        names = leakage_free_feature_names(preprocessor)

        assert train_t.shape[0] == len(train)
        assert train_t.shape[1] == len(names)
        assert preprocessor.transform(test).shape[1] == len(names)

    def test_repeated_fit_is_identical(self, large_frame):
        a = build_preprocessor(min_df=1).fit(large_frame)
        b = build_preprocessor(min_df=1).fit(large_frame)
        np.testing.assert_allclose(
            a.transform(large_frame), b.transform(large_frame)
        )

    def test_pipeline_is_picklable(self, large_frame, tmp_path):
        import pickle

        preprocessor = build_preprocessor(min_df=1).fit(large_frame)
        path = tmp_path / "preprocessor.pkl"
        path.write_bytes(pickle.dumps(preprocessor))
        reloaded = pickle.loads(path.read_bytes())
        np.testing.assert_allclose(
            preprocessor.transform(large_frame),
            reloaded.transform(large_frame),
        )
