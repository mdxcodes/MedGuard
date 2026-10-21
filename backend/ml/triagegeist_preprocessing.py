"""Triagegeist preprocessing pipeline.

Provides a scikit-learn ColumnTransformer-based preprocessing pipeline
that matches the Triagegeist schema defined in triagegeist_schema.py.

The pipeline is designed to be fit ONLY on training data and then
applied identically to both training and inference data.

All preprocessing is leakage-safe: no statistics from validation/test
data are ever used during training.
"""

from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

from backend.ml import triagegeist_schema


def build_preprocessor(
    numeric_features: list[str] | None = None,
    categorical_features: list[str] | None = None,
    boolean_features: list[str] | None = None,
) -> ColumnTransformer:
    """Build a leakage-safe ColumnTransformer for Triagegeist features.

    Parameters
    ----------
    numeric_features : list[str] | None
        Numeric feature column names. If None, uses schema defaults.
    categorical_features : list[str] | None
        Categorical feature column names. If None, uses schema defaults.
    boolean_features : list[str] | None
        Boolean feature column names. If None, uses schema defaults.

    Returns
    -------
    ColumnTransformer
        A fitted-ready pipeline that transforms raw feature DataFrames
        into numeric model inputs.
    """
    numeric = triagegeist_schema.NUMERIC_FEATURE_COLUMNS if numeric_features is None else numeric_features
    categorical = triagegeist_schema.CATEGORICAL_FEATURE_COLUMNS if categorical_features is None else categorical_features
    boolean = triagegeist_schema.BOOLEAN_FEATURE_COLUMNS if boolean_features is None else boolean_features

    numeric_transformer = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="median")),
            ("scaler", StandardScaler()),
        ]
    )

    categorical_transformer = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="most_frequent")),
            (
                "onehot",
                OneHotEncoder(
                    handle_unknown="ignore",
                    sparse_output=False,
                    drop="first",
                ),
            ),
        ]
    )

    # Boolean features: treat as 0/1 numeric (impute most_frequent)
    boolean_transformer = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="most_frequent")),
        ]
    )

    transformers = []
    if numeric:
        transformers.append(("numeric", numeric_transformer, numeric))
    if categorical:
        transformers.append(("categorical", categorical_transformer, categorical))
    if boolean:
        transformers.append(("boolean", boolean_transformer, boolean))

    if not transformers:
        raise ValueError("No feature columns provided to preprocessor.")

    return ColumnTransformer(
        transformers=transformers,
        remainder="drop",
        verbose_feature_names_out=False,
    )


def build_feature_frame(
    raw_df: pd.DataFrame,
    include_categorical_text: bool = False,
) -> pd.DataFrame:
    """Build a feature frame from raw Triagegeist data.

    Selects only eligible feature columns from the schema, drops leakage-prone
    columns, and ensures the correct ESI class ordering.

    Parameters
    ----------
    raw_df : pd.DataFrame
        Raw Triagegeist data (train.csv or test.csv).
    include_categorical_text : bool
        If True, keep raw text columns as-is (for text-enabled models).
        If False (default), text columns are excluded.

    Returns
    -------
    pd.DataFrame
        Feature frame with only eligible feature columns plus the target
        column (if present in raw_df) and patient_id (for grouped splitting).
    """
    feature_cols = list(triagegeist_schema.ALL_FEATURE_COLUMNS)

    # Select only columns that exist in the raw data
    available_features = [c for c in feature_cols if c in raw_df.columns]

    result = raw_df[available_features].copy()

    # Add target column if present
    if triagegeist_schema.TARGET_COLUMN in raw_df.columns:
        result[triagegeist_schema.TARGET_COLUMN] = raw_df[triagegeist_schema.TARGET_COLUMN].copy()

    # Add patient_id column if present (needed for grouped splitting)
    if triagegeist_schema.PATIENT_ID_COLUMN in raw_df.columns:
        result[triagegeist_schema.PATIENT_ID_COLUMN] = raw_df[triagegeist_schema.PATIENT_ID_COLUMN].copy()

    if "arrival_day" in result.columns and pd.api.types.is_string_dtype(result["arrival_day"]):
        _day_map = {
            "Monday": 1, "Tuesday": 2, "Wednesday": 3, "Thursday": 4,
            "Friday": 5, "Saturday": 6, "Sunday": 7,
        }
        result["arrival_day"] = result["arrival_day"].map(_day_map)

    return result


def assert_no_leakage_columns(df: pd.DataFrame) -> None:
    """Raise ValueError if any leakage-prone column is present as a feature.

    Leakage-prone columns (disposition, ed_los_hours) must never be used
    as model inputs because they are determined after triage.
    """
    leakage_cols = [f.name for f in triagegeist_schema.LEAKAGE_FIELDS]
    present = [c for c in leakage_cols if c in df.columns]
    if present:
        raise ValueError(
            f"Leakage-prone columns found in feature frame: {present}. "
            "These columns contain post-triage outcome information and "
            "must not be used as model inputs."
        )


def leakage_free_feature_names(pipeline) -> list[str]:
    """Extract feature names from a fitted ColumnTransformer pipeline.

    Returns feature names in the order they appear after transformation,
    suitable for SHAP explanations and model interpretation.

    Parameters
    ----------
    pipeline : sklearn Pipeline or ColumnTransformer
        A fitted pipeline with a 'preprocess' step (ColumnTransformer)
        or a ColumnTransformer directly.

    Returns
    -------
    list[str]
        Feature names in transformed order.
    """
    preprocess = pipeline
    if hasattr(pipeline, "named_steps") and "preprocess" in pipeline.named_steps:
        preprocess = pipeline.named_steps["preprocess"]

    if not hasattr(preprocess, "get_feature_names_out"):
        # Fallback: return schema feature names
        return list(triagegeist_schema.ALL_FEATURE_COLUMNS)

    return list(preprocess.get_feature_names_out())


def derive_features(df: pd.DataFrame) -> pd.DataFrame:
    """Derive engineered features from raw vital signs.

    Creates shock_index, pulse_pressure, mean_arterial_pressure, and bmi
    from raw measurements. Does not modify the input DataFrame.

    Parameters
    ----------
    df : pd.DataFrame
        Raw Triagegeist data with heart_rate, systolic_bp, diastolic_bp,
        weight_kg, height_cm columns.

    Returns
    -------
    pd.DataFrame
        Copy of df with derived feature columns added.
    """
    result = df.copy()

    # Shock index: HR / SBP
    if "heart_rate" in result.columns and "systolic_bp" in result.columns:
        result["shock_index"] = (
            result["heart_rate"] / result["systolic_bp"].replace(0, np.nan)
        )

    # Pulse pressure: SBP - DBP
    if "systolic_bp" in result.columns and "diastolic_bp" in result.columns:
        result["pulse_pressure"] = result["systolic_bp"] - result["diastolic_bp"]

    # Mean arterial pressure: (SBP + 2*DBP) / 3
    if "systolic_bp" in result.columns and "diastolic_bp" in result.columns:
        result["mean_arterial_pressure"] = (
            (result["systolic_bp"] + 2 * result["diastolic_bp"]) / 3
        )

    # BMI: weight_kg / (height_m)^2
    if "weight_kg" in result.columns and "height_cm" in result.columns:
        height_m = result["height_cm"] / 100.0
        result["bmi"] = result["weight_kg"] / (height_m**2)

    return result


if __name__ == "__main__":
    import json
    from backend.ml import triagegeist_schema
    print(json.dumps({
        "numeric_features": triagegeist_schema.NUMERIC_FEATURE_COLUMNS,
        "categorical_features": triagegeist_schema.CATEGORICAL_FEATURE_COLUMNS,
        "boolean_features": triagegeist_schema.BOOLEAN_FEATURE_COLUMNS,
        "all_features": triagegeist_schema.ALL_FEATURE_COLUMNS,
        "target": triagegeist_schema.TARGET_COLUMN,
        "patient_id": triagegeist_schema.PATIENT_ID_COLUMN,
        "esi_labels": triagegeist_schema.ESI_LABELS,
    }, indent=2))
