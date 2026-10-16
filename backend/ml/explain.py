"""MedGuard Phase 2 — model explainability using SHAP.

Explains predictions from fitted candidate pipelines using exact feature names
from the preprocessing pipeline. Disclaimers: SHAP values describe internal
model attribution and do not constitute clinical causation or medical guidance.
"""

from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd
import shap
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline

from backend.ml.features import leakage_free_feature_names


def explain_prediction(
    pipeline: Pipeline,
    X: pd.DataFrame,
    row_index: int = 0,
    target_class: int | None = None,
    background_size: int = 50,
) -> dict[str, Any]:
    """Explain a single prediction using SHAP.

    Parameters
    ----------
    pipeline : Pipeline
        Fitted sklearn Pipeline containing 'preprocess' and 'estimator' steps.
    X : pd.DataFrame
        DataFrame containing the row to explain (and optional background data).
    row_index : int
        Index (0-based integer position) of the sample to explain in X.
    target_class : int | None
        Specific ESI class (e.g. 1, 2, 3) to explain. If None, the predicted
        class with highest probability is explained.
    background_size : int
        Number of background samples for explainer calibration.

    Returns
    -------
    dict containing:
        - predicted_class: int
        - explained_class: int
        - class_probabilities: dict[str, float]
        - shap_values: list[float]
        - feature_names: list[str]
        - top_features: list[dict[str, Any]]
        - note: str disclaimer
    """
    if "preprocess" not in pipeline.named_steps or "estimator" not in pipeline.named_steps:
        raise ValueError("Pipeline must contain 'preprocess' and 'estimator' steps.")

    preprocessor = pipeline.named_steps["preprocess"]
    estimator = pipeline.named_steps["estimator"]

    feature_names = leakage_free_feature_names(pipeline)

    x_sample = X.iloc[[row_index]]
    x_sample_trans = preprocessor.transform(x_sample)
    if hasattr(x_sample_trans, "toarray"):
        x_sample_trans = x_sample_trans.toarray()

    bg_n = min(len(X), background_size)
    bg_df = X.sample(bg_n, random_state=42)
    bg_trans = preprocessor.transform(bg_df)
    if hasattr(bg_trans, "toarray"):
        bg_trans = bg_trans.toarray()

    # Create appropriate explainer
    if isinstance(estimator, RandomForestClassifier):
        explainer = shap.TreeExplainer(estimator)
        raw_shap = explainer.shap_values(x_sample_trans)
    elif isinstance(estimator, LogisticRegression):
        explainer = shap.LinearExplainer(estimator, bg_trans)
        raw_shap = explainer.shap_values(x_sample_trans)
    else:
        # Generic KernelExplainer fallback
        explainer = shap.KernelExplainer(estimator.predict_proba, bg_trans)
        raw_shap = explainer.shap_values(x_sample_trans)

    # Probabilities and predicted class
    probs = estimator.predict_proba(x_sample_trans)[0]
    classes = [int(c) for c in estimator.classes_]
    prob_dict = {f"ESI {c}": float(p) for c, p in zip(classes, probs)}
    pred_class = classes[int(np.argmax(probs))]

    if target_class is None:
        target_class = pred_class

    if target_class in classes:
        class_idx = classes.index(target_class)
    else:
        # If model was never trained on target_class (e.g. ESI 4 or 5)
        class_idx = 0

    # Extract 1D SHAP values for the specified class
    # TreeExplainer/LinearExplainer in shap 0.53 can return ndarray of shape (1, n_features, n_classes)
    # or list of ndarrays of shape (1, n_features).
    if isinstance(raw_shap, list):
        shap_vals_1d = raw_shap[class_idx][0]
    elif isinstance(raw_shap, np.ndarray):
        if raw_shap.ndim == 3:
            shap_vals_1d = raw_shap[0, :, class_idx]
        elif raw_shap.ndim == 2:
            shap_vals_1d = raw_shap[0]
        else:
            shap_vals_1d = raw_shap
    else:
        shap_vals_1d = np.asarray(raw_shap).ravel()

    shap_vals_list = [float(v) for v in shap_vals_1d]

    # Combine with feature names and sort by absolute contribution
    feature_impacts = [
        {
            "feature": name,
            "shap_value": float(val),
            "sample_value": float(x_sample_trans[0, i]) if i < x_sample_trans.shape[1] else 0.0,
        }
        for i, (name, val) in enumerate(zip(feature_names, shap_vals_list))
    ]
    feature_impacts.sort(key=lambda item: abs(item["shap_value"]), reverse=True)

    return {
        "prediction": pred_class,
        "predicted_class": pred_class,
        "explained_class": target_class,
        "class_probabilities": prob_dict,
        "shap_values": shap_vals_list,
        "feature_names": feature_names,
        "top_features": feature_impacts[:10],
        "note": "Attribution indicates model feature sensitivity, not medical causation.",
    }
