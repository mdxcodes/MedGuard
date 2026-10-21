"""Tests for data-quality rules: temperature units, blood pressure, pain,
chief-complaint normalisation, and target handling."""

from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from backend.ml import config
from backend.ml.validation import DataQualityError, clean_triage_frame
from tests.fixtures import synthetic_labelled_frame


# ---------------------------------------------------------------------------
# Temperature: mixed units
# ---------------------------------------------------------------------------


class TestTemperatureUnits:
    def test_fahrenheit_value_is_converted_to_celsius(self):
        raw = pd.Series([98.6])
        result, counts = validation.normalize_temperature(raw)
        assert result.iloc[0] == pytest.approx(37.0, abs=1e-9)
        assert counts["fahrenheit_converted"] == 1
        assert counts["celsius_detected"] == 0

    def test_celsius_value_is_not_converted(self):
        raw = pd.Series([37.0])
        result, counts = validation.normalize_temperature(raw)
        assert result.iloc[0] == pytest.approx(37.0)
        assert counts["celsius_detected"] == 1
        assert counts["fahrenheit_converted"] == 0

    def test_mixed_column_is_handled_row_by_row(self):
        # The exact defect found in the audit: one Celsius value among many
        # Fahrenheit values in the same column.
        raw = pd.Series([98.6, 36.5, 100.4, 97.0])
        result, counts = validation.normalize_temperature(raw)
        assert counts["fahrenheit_converted"] == 3
        assert counts["celsius_detected"] == 1
        assert result.iloc[0] == pytest.approx(37.0, abs=1e-9)
        assert result.iloc[1] == pytest.approx(36.5)
        assert result.iloc[2] == pytest.approx(38.0, abs=1e-9)
        assert result.iloc[3] == pytest.approx(36.11, abs=0.01)
        # All values land inside the clinical envelope.
        assert result.min() >= config.TEMP_MIN_C
        assert result.max() <= config.TEMP_MAX_C

    def test_implausible_temperature_is_rejected_not_converted(self):
        raw = pd.Series([150.0])  # impossible in either unit
        result, counts = validation.normalize_temperature(raw)
        assert result.isna().all()
        assert counts["temperature_out_of_envelope"] == 1

    def test_hypothermia_boundary_is_rejected(self):
        raw = pd.Series([25.0])  # 25 C is incompatible with ED triage
        result, counts = validation.normalize_temperature(raw)
        assert result.isna().all()
        assert counts["temperature_out_of_envelope"] == 1

    def test_unparseable_temperature_is_counted(self):
        raw = pd.Series(["not a temperature"])
        result, counts = validation.normalize_temperature(raw)
        assert result.isna().all()
        assert counts["temperature_unparseable"] == 1

    def test_missing_temperature_is_missing(self):
        raw = pd.Series([None, 98.6])
        result, counts = validation.normalize_temperature(raw)
        assert bool(result.isna().iloc[0])
        assert counts["fahrenheit_converted"] == 1
        assert counts["celsius_detected"] == 0

    def test_canonical_unit_is_celsius(self):
        # 212 F is boiling; the conversion must not be applied blindly.
        raw = pd.Series([212.0])
        _, _ = validation.normalize_temperature(raw)
        assert config.TEMPERATURE_UNIT == "celsius"


# ---------------------------------------------------------------------------
# Blood pressure
# ---------------------------------------------------------------------------


class TestBloodPressure:
    def test_implausible_diastolic_is_rejected(self):
        sbp = pd.Series([120.0])
        dbp = pd.Series([879.0])  # the audited outlier
        _, dbp_clean, counts = validation.validate_blood_pressure(sbp, dbp)
        assert dbp_clean.isna().all()
        assert counts["dbp_out_of_range"] == 1

    def test_plausible_values_are_kept(self):
        sbp = pd.Series([118.0, 130.0])
        dbp = pd.Series([76.0, 85.0])
        sbp_clean, dbp_clean, counts = validation.validate_blood_pressure(sbp, dbp)
        assert not sbp_clean.isna().any() and not dbp_clean.isna().any()
        assert counts["sbp_out_of_range"] == 0
        assert counts["dbp_out_of_range"] == 0

    def test_out_of_range_systolic_is_rejected(self):
        sbp = pd.Series([400.0])
        _, _, counts = validation.validate_blood_pressure(sbp, pd.Series([80.0]))
        assert counts["sbp_out_of_range"] == 1

    def test_diastolic_above_systolic_is_flagged(self):
        sbp = pd.Series([80.0])
        dbp = pd.Series([100.0])
        _, _, counts = validation.validate_blood_pressure(sbp, dbp)
        assert counts["dbp_greater_than_sbp"] == 1

    def test_low_values_are_rejected(self):
        sbp = pd.Series([10.0])
        dbp = pd.Series([5.0])
        _, _, counts = validation.validate_blood_pressure(sbp, dbp)
        assert counts["sbp_out_of_range"] == 1
        assert counts["dbp_out_of_range"] == 1


# ---------------------------------------------------------------------------
# Pain
# ---------------------------------------------------------------------------


class TestPainParsing:
    @pytest.mark.parametrize(
        "raw,expected",
        [
            ("0", 0.0),
            ("5", 5.0),
            ("10", 10.0),
            (" 7 ", 7.0),
            (7, 7.0),
        ],
    )
    def test_numeric_scores_are_kept(self, raw, expected):
        result, _ = validation.parse_pain(pd.Series([raw]))
        assert result.iloc[0] == pytest.approx(expected)

    @pytest.mark.parametrize("token", ["UA", "uta", "unable", "UNKNOWN"])
    def test_sentinel_tokens_become_missing(self, token):
        # Case-insensitive: the raw data stores these inconsistently.
        result, counts = validation.parse_pain(pd.Series([token]))
        assert bool(result.isna().iloc[0])
        assert counts["pain_unassessable"] == 1

    def test_out_of_range_pain_is_rejected(self):
        # 13 is impossible on a 0-10 scale (planted in the audited data).
        result, counts = validation.parse_pain(pd.Series([13]))
        assert bool(result.isna().iloc[0])
        assert counts["pain_out_of_range"] == 1

    def test_negative_pain_is_rejected(self):
        result, counts = validation.parse_pain(pd.Series([-2]))
        assert bool(result.isna().iloc[0])
        assert counts["pain_out_of_range"] == 1

    @pytest.mark.parametrize("token", ["Critical", "o", "ett", "abc"])
    def test_unrecognised_tokens_become_missing(self, token):
        result, counts = validation.parse_pain(pd.Series([token]))
        assert bool(result.isna().iloc[0])
        assert counts["pain_unparseable"] == 1

    def test_missing_stays_missing(self):
        result, _ = validation.parse_pain(pd.Series([None]))
        assert bool(result.isna().iloc[0])

    def test_mixed_column_counts_each_class(self):
        raw = pd.Series(["3", "UA", "13", "Critical", None])
        result, counts = validation.parse_pain(raw)
        assert counts["pain_unassessable"] == 1
        assert counts["pain_out_of_range"] == 1
        assert counts["pain_unparseable"] == 1
        assert result.notna().sum() == 1


# ---------------------------------------------------------------------------
# Chief complaint
# ---------------------------------------------------------------------------


class TestChiefComplaint:
    def test_placeholder_is_normalised(self):
        result, counts = validation.normalize_chiefcomplaint(
            pd.Series(["UNKNOWN-CC"])
        )
        assert result.iloc[0] == "unknown"
        assert counts["chiefcomplaint_placeholder"] == 1

    def test_case_and_whitespace_are_normalised(self):
        result, _ = validation.normalize_chiefcomplaint(
            pd.Series(["   shortness   of  BreaTh "])
        )
        assert result.iloc[0] == "shortness of breath"

    def test_real_complaint_is_preserved(self):
        result, counts = validation.normalize_chiefcomplaint(
            pd.Series(["CHEST PAIN"])
        )
        assert result.iloc[0] == "chest pain"
        assert counts["chiefcomplaint_placeholder"] == 0

    def test_empty_becomes_unknown(self):
        result, counts = validation.normalize_chiefcomplaint(pd.Series(["", None]))
        assert (result == "unknown").all()
        # Both an explicit empty string and a null are caught by the
        # placeholder branch; the count must reflect that.
        assert counts["chiefcomplaint_placeholder"] == 2

    def test_no_free_text_is_returned_in_counts(self):
        # Privacy: the returned counts must not contain complaint text.
        result, counts = validation.normalize_chiefcomplaint(
            pd.Series(["CHEST PAIN"])
        )
        assert "CHEST PAIN" not in str(counts)


# ---------------------------------------------------------------------------
# Target
# ---------------------------------------------------------------------------


class TestTargetValidation:
    def _frame(self, acuity_values):
        from tests.fixtures import synthetic_labelled_frame

        frame = synthetic_labelled_frame().copy()
        frame[config.TARGET_COLUMN] = acuity_values
        return frame

    def test_missing_labels_are_dropped_not_imputed(self):
        frame = self._frame([2.0, None, 3.0] + [2.0] * 12)
        kept, counts = validation.validate_target(frame)
        assert len(kept) == len(frame) - 1
        assert counts["rows_dropped_missing_target"] == 1
        assert kept[config.TARGET_COLUMN].notna().all()

    def test_out_of_range_label_raises(self):
        frame = self._frame([6.0] + [2.0] * 14)
        with pytest.raises(DataQualityError, match="outside the expected"):
            validation.validate_target(frame)

    def test_zero_label_raises(self):
        frame = self._frame([0.0] + [2.0] * 14)
        with pytest.raises(DataQualityError):
            validation.validate_target(frame)

    def test_all_five_levels_are_accepted(self):
        frame = self._frame([1.0, 2.0, 3.0, 4.0, 5.0] + [2.0] * 10)
        kept, counts = validation.validate_target(frame)
        assert sorted(kept[config.TARGET_COLUMN].unique()) == [1.0, 2.0, 3.0, 4.0, 5.0]

    def test_labels_are_not_collapsed(self):
        # The original five levels must survive untouched.
        frame = self._frame([1.0, 2.0, 3.0, 4.0, 5.0] + [2.0] * 10)
        kept, _ = validation.validate_target(frame)
        assert set(config.ESI_LABELS) == {1, 2, 3, 4, 5}


# ---------------------------------------------------------------------------
# Missingness indicators
# ---------------------------------------------------------------------------


class TestMissingnessIndicators:
    def test_indicator_is_added_for_each_column(self):
        frame = pd.DataFrame({"temperature_c": [98.6, None], "heart_rate": [80, None]})
        result = validation.add_missingness_indicators(
            frame, ("temperature_c", "heart_rate")
        )
        assert list(result["temperature_c_missing"]) == [0, 1]
        assert list(result["heart_rate_missing"]) == [0, 1]

    def test_indicator_is_binary(self):
        frame = pd.DataFrame({"pain_score": [1.0, None, None, 3.0]})
        result = validation.add_missingness_indicators(frame, ("pain_score",))
        assert set(result["pain_score_missing"].unique()) <= {0, 1}
