"""Tests for MedGuard Phase 2: Model training, evaluation, and explainability."""

from __future__ import annotations

import json
import tempfile
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

from backend.ml import config, evaluate, explain, features, splitting, train
from backend.ml.run_experiment import run_phase2_experiment
from tests.fixtures import synthetic_labelled_frame


@pytest.fixture()
def clean_frame():
    """A synthetic feature frame ready for modelling."""
    raw = synthetic_labelled_frame(n_patients=35, seed=42)
    return features.build_feature_frame(raw)


class TestModelTraining:
    def test_build_model_constructs_registered_models(self):
        for name in train.MODEL_REGISTRY:
            model = train.build_model(name)
            assert model is not None
            assert hasattr(model, "fit")

    def test_pipeline_includes_preprocessing(self):
        pipeline = train.build_estimator_pipeline("logistic_regression")
        assert "preprocess" in pipeline.named_steps
        assert "estimator" in pipeline.named_steps

    def test_models_deterministic_with_same_seed(self, clean_frame):
        X = clean_frame
        y = clean_frame[config.TARGET_COLUMN]

        pipe1 = train.build_estimator_pipeline("random_forest")
        pipe2 = train.build_estimator_pipeline("random_forest")

        pipe1.fit(X, y)
        pipe2.fit(X, y)

        pred1 = pipe1.predict(X)
        pred2 = pipe2.predict(X)
        np.testing.assert_array_equal(pred1, pred2)

    def test_no_leakage_features_in_model_schema(self, clean_frame):
        X = clean_frame
        y = clean_frame[config.TARGET_COLUMN]

        pipeline = train.build_estimator_pipeline("logistic_regression")
        pipeline.fit(X, y)

        feature_names = features.leakage_free_feature_names(pipeline)
        for forbidden in config.FORBIDDEN_FEATURE_COLUMNS:
            assert forbidden not in feature_names
        assert "stay_id" not in feature_names
        assert "subject_id" not in feature_names
        assert "disposition" not in feature_names


class TestEvaluation:
    def test_explicit_class_labels_and_zero_division(self):
        # Even if some classes are missing from true/pred, all 5 must be in per_class
        y_true = np.array([1, 2, 2, 3])
        y_pred = np.array([2, 2, 2, 3])

        metrics = evaluate.compute_metrics(y_true, y_pred)
        assert len(metrics["per_class"]) == 5
        for level in config.ESI_LABELS:
            name = f"ESI {int(level)}"
            assert name in metrics["per_class"]
            assert "precision" in metrics["per_class"][name]
            assert "recall" in metrics["per_class"][name]
            assert "f1" in metrics["per_class"][name]

        # Check shape of confusion matrix: strictly 5x5
        assert len(metrics["confusion_matrix"]) == 5
        assert len(metrics["confusion_matrix"][0]) == 5
        assert metrics["per_class"]["ESI 5"]["support"] == 0
        assert metrics["per_class"]["ESI 5"]["f1"] == 0.0

    def test_patient_separation_across_cv_folds(self, clean_frame):
        folds = list(splitting.grouped_kfold(clean_frame, n_splits=5))
        for train_df, val_df in folds:
            train_pts = set(train_df[config.SUBJECT_ID_COLUMN])
            val_pts = set(val_df[config.SUBJECT_ID_COLUMN])
            assert len(train_pts.intersection(val_pts)) == 0

    def test_identical_evaluation_cohorts_for_model_comparisons(self, clean_frame):
        train_df, test_df = splitting.patient_grouped_split(clean_frame, test_size=0.2, seed=123)
        
        # Test baseline and candidate on exact same test_df
        dummy = train.build_estimator_pipeline("dummy_most_frequent")
        rf = train.build_estimator_pipeline("random_forest")

        m_dummy = evaluate.evaluate_pipeline_on_split(dummy, train_df, test_df)
        m_rf = evaluate.evaluate_pipeline_on_split(rf, train_df, test_df)

        assert m_dummy["test_rows"] == m_rf["test_rows"]
        assert m_dummy["test_patients"] == m_rf["test_patients"]
        assert m_dummy["y_true_counts"] == m_rf["y_true_counts"]

    def test_missing_class_handling(self):
        # Only class 2 and 3 present
        y_true = np.array([2, 2, 3, 3])
        y_pred = np.array([2, 3, 2, 3])
        metrics = evaluate.compute_metrics(y_true, y_pred)
        assert metrics["per_class"]["ESI 1"]["support"] == 0
        assert metrics["per_class"]["ESI 4"]["support"] == 0
        assert metrics["per_class"]["ESI 5"]["support"] == 0
        assert metrics["per_class"]["ESI 1"]["recall"] == 0.0
        assert metrics["per_class"]["ESI 4"]["recall"] == 0.0


class TestModelPersistence:
    def test_save_and_load_pipeline(self, clean_frame):
        X = clean_frame
        y = clean_frame[config.TARGET_COLUMN]

        pipeline = train.build_estimator_pipeline("logistic_regression")
        pipeline.fit(X, y)
        pred_before = pipeline.predict(X)

        with tempfile.TemporaryDirectory() as tmp_dir:
            path = Path(tmp_dir) / "model.joblib"
            train.persist_pipeline(
                pipeline,
                path,
                model_name="logistic_regression",
                training_rows=len(X),
                training_patients=X[config.SUBJECT_ID_COLUMN].nunique(),
            )
            assert path.exists()
            manifest_path = path.with_suffix(".manifest.json")
            assert manifest_path.exists()

            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            assert manifest["model_name"] == "logistic_regression"
            assert manifest["target"] == config.TARGET_COLUMN
            assert manifest["training_rows"] == len(X)
            assert "scikit-learn" in manifest["versions"]

            import joblib
            loaded = joblib.load(path)
            pred_after = loaded.predict(X)
            np.testing.assert_array_equal(pred_before, pred_after)


class TestExplainability:
    def test_shap_explanation_shape(self, clean_frame):
        X = clean_frame
        y = clean_frame[config.TARGET_COLUMN]

        pipeline = train.build_estimator_pipeline("random_forest")
        pipeline.fit(X, y)

        res = explain.explain_prediction(pipeline, X, row_index=0)
        assert "shap_values" in res
        assert "feature_names" in res
        assert len(res["shap_values"]) == len(res["feature_names"])
        assert res["prediction"] in config.ESI_LABELS
        assert "top_features" in res
        assert len(res["top_features"]) <= 10
        # Check alignment of feature names
        assert res["top_features"][0]["feature"] in res["feature_names"]


class TestFullExperimentRun:
    def test_experiment_runner_creates_all_artifacts(self, tmp_path):
        reports_dir = tmp_path / "reports"
        models_dir = tmp_path / "models"

        res = run_phase2_experiment(reports_dir=reports_dir, models_dir=models_dir)

        assert (reports_dir / "model_evaluation.json").exists()
        assert (reports_dir / "model_comparison.csv").exists()
        assert (reports_dir / "confusion_matrix.csv").exists()
        assert (reports_dir / "fold_metrics.csv").exists()
        assert (reports_dir / "model_card.md").exists()
        assert (models_dir / "triage_model.joblib").exists()
        assert (models_dir / "triage_model.manifest.json").exists()

        # Check model comparison content
        comp_df = pd.read_csv(reports_dir / "model_comparison.csv")
        assert len(comp_df) == 4
        assert "random_forest" in comp_df["model"].values
        assert "dummy_most_frequent" in comp_df["model"].values
