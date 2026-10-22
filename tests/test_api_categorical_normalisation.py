"""Tests for the inference-time normalisation of categorical inputs.

The one-hot encoder inside the saved pipeline is fitted on the *raw*
Triagegeist column values (``walk-in``, ``public``, ``cardiovascular``, ...).
A submitted value that does not match one of those categories is dropped by
the encoder, so the feature silently disappears from the prediction. These
tests pin the mapping that keeps the categorical features alive.
"""

from __future__ import annotations

import joblib
import pytest

from backend.api.inference import (
    _normalise_category,
    _normalise_sex,
    _TRAINED_CATEGORIES,
)


class TestCategoryNormalisation:
    @pytest.mark.parametrize(
        "submitted,expected",
        [
            ("walk-in", "walk-in"),
            ("Walk In", "walk-in"),
            ("WALK-IN", "walk-in"),
            ("walk in", "walk-in"),
            ("ambulance", "ambulance"),
            ("Ambulance", "ambulance"),
            ("Brought by Family", "brought_by_family"),
            ("brought_by_family", "brought_by_family"),
            ("transfer", "transfer"),
            ("police", "police"),
            ("helicopter", "helicopter"),
        ],
    )
    def test_arrival_mode_maps_onto_a_trained_category(self, submitted, expected):
        assert _normalise_category("arrival_mode", submitted) == expected

    @pytest.mark.parametrize(
        "submitted,expected",
        [
            ("public", "public"),
            ("Public", "public"),
            ("private", "private"),
            ("military", "military"),
            ("none", "none"),
            ("unknown", "unknown"),
        ],
    )
    def test_insurance_type_maps_onto_a_trained_category(self, submitted, expected):
        assert _normalise_category("insurance_type", submitted) == expected

    @pytest.mark.parametrize(
        "submitted,expected",
        [
            ("cardiovascular", "cardiovascular"),
            ("Cardiovascular", "cardiovascular"),
            ("respiratory", "respiratory"),
            ("ENT", "ENT"),
            ("ent", "ENT"),
            ("Ear, Nose and Throat", "ENT"),
        ],
    )
    def test_chief_complaint_maps_onto_a_trained_category(self, submitted, expected):
        assert _normalise_category("chief_complaint_system", submitted) == expected

    def test_an_unrecognised_value_falls_back_rather_than_creating_a_category(self):
        # A value the model has never seen must not become a new category:
        # it resolves to the column default and is ignored by the encoder.
        assert _normalise_category("insurance_type", "Medicare") == "unknown"
        assert _normalise_category("arrival_mode", "spaceship") == "unknown"
        assert _normalise_category("chief_complaint_system", "nonsense") == "other"

    def test_a_missing_value_falls_back_to_the_column_default(self):
        assert _normalise_category("arrival_mode", None) == "unknown"
        assert _normalise_category("insurance_type", None) == "unknown"
        assert _normalise_category("chief_complaint_system", None) == "other"

    def test_every_normalised_value_is_a_trained_category(self):
        for column, categories in _TRAINED_CATEGORIES.items():
            for candidate in categories:
                normalised = _normalise_category(column, candidate)
                assert normalised in categories


class TestSexNormalisation:
    @pytest.mark.parametrize(
        "submitted,expected",
        [
            ("F", "F"),
            ("f", "F"),
            ("Female", "F"),
            ("M", "M"),
            ("m", "M"),
            ("Male", "M"),
            ("Other", "Other"),
        ],
    )
    def test_sex_maps_onto_a_trained_category(self, submitted, expected):
        assert _normalise_sex(submitted) == expected

    def test_an_unrecognised_sex_becomes_other(self):
        assert _normalise_sex("unspecified") == "Other"
        assert _normalise_sex(None) == "Other"


@pytest.fixture(scope="module")
def encoder_categories():
    """The categories the fitted model's one-hot encoder actually knows."""
    model_path = __import__("backend.api.config", fromlist=["MODEL_PATH"]).MODEL_PATH
    if not model_path.exists():
        pytest.skip("model artifact not present")
    pipeline = joblib.load(model_path)
    encoder = pipeline.named_steps["preprocess"]
    fitted = {}
    for _name, transformer, columns in encoder.transformers_:
        steps = getattr(transformer, "named_steps", {})
        if "onehot" in steps:
            for column, categories in zip(columns, steps["onehot"].categories_):
                fitted[column] = list(categories)
    return fitted


class TestAgainstTheSavedEncoder:
    """The mapping must agree with the categories the fitted model knows."""

    def test_arrival_mode_categories_are_reachable(self, encoder_categories):
        categories = encoder_categories.get("arrival_mode")
        if categories is None:
            pytest.skip("encoder has no arrival_mode column")
        for candidate in categories:
            assert _normalise_category("arrival_mode", candidate) == candidate
            assert _normalise_category("arrival_mode", candidate.upper()) == candidate

    def test_insurance_type_categories_are_reachable(self, encoder_categories):
        categories = encoder_categories.get("insurance_type")
        if categories is None:
            pytest.skip("encoder has no insurance_type column")
        for candidate in categories:
            assert _normalise_category("insurance_type", candidate) == candidate
            assert _normalise_category("insurance_type", candidate.title()) == candidate

    def test_chief_complaint_categories_are_reachable(self, encoder_categories):
        categories = encoder_categories.get("chief_complaint_system")
        if categories is None:
            pytest.skip("encoder has no chief_complaint_system column")
        for candidate in categories:
            assert _normalise_category("chief_complaint_system", candidate) == candidate
            assert (
                _normalise_category("chief_complaint_system", candidate.title())
                == candidate
            )

    def test_sex_categories_are_reachable(self, encoder_categories):
        categories = encoder_categories.get("sex")
        if categories is None:
            pytest.skip("encoder has no sex column")
        for candidate in categories:
            assert _normalise_sex(candidate) == candidate
