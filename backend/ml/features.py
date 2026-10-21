"""Leakage-safe feature engineering and the scikit-learn preprocessing pipeline
for the Triagegeist synthetic dataset.

Design contract
---------------
1. **Allow-list only.** The pipeline selects from an explicit allow-list of
   initial-triage features. Identifiers, outcomes and post-triage fields are
   dropped by ``remainder='drop'`` and additionally asserted against
   :data:`backend.ml.config.FORBIDDEN_FEATURE_COLUMNS`.
2. **Nothing is fitted before the split.** Imputation medians, one-hot
   categories, category frequency groupings and the TF-IDF vocabulary are all
   fitted *inside* the pipeline, so each fold fits them on its own training
   rows only.
3. **Derived features are pure row-wise arithmetic** over clinical constants
   from :data:`backend.ml.config.ABNORMAL_VITAL_RULES`. They are computed
   inside the pipeline via a :class:`FunctionTransformer` so the fitted
   object is self-contained and nothing is pre-computed on the full dataset.
"""

from __future__ import annotations

import logging

import numpy as np
import pandas as pd
from sklearn.base import BaseEstimator, TransformerMixin
from sklearn.compose import ColumnTransformer
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import FunctionTransformer, OneHotEncoder, StandardScaler

from backend.ml import config

logger = logging.getLogger(__name__)

#: Canonical internal temperature unit after normalisation.
TEMPERATURE_UNIT = "celsius"

#: Columns passed through unchanged for the indicator features.
INDICATOR_FEATURES: tuple[str, ...] = config.MISSINGNESS_FEATURES

#: Columns created by :func:`derive_features`.
DERIVED_FEATURES: tuple[str, ...] = (
    "shock_index",
    "pulse_pressure",
    "abnormal_vital_count",
)


# ---------------------------------------------------------------------------
# Derived features
# ---------------------------------------------------------------------------


def derive_features(frame: pd.DataFrame) -> pd.DataFrame:
    """Add row-wise derived features. No fitted statistics, no leakage.

    * ``shock_index``           = heart_rate / systolic_bp
    * ``pulse_pressure``        = systolic_bp - diastolic_bp
    * ``abnormal_vital_count``  = number of vitals outside the clinical
      envelope in :data:`backend.ml.config.ABNORMAL_VITAL_RULES`

    Only the identifiers, target and allow-listed feature columns are carried
    through, so the ColumnTransformer downstream never sees anything else.
    """
    out = pd.DataFrame(index=frame.index)

    def num(name: str) -> pd.Series:
        if name not in frame.columns:
            return pd.Series(np.nan, index=frame.index)
        return pd.to_numeric(frame[name], errors="coerce")

    hr, sbp, dbp = num("heart_rate"), num("systolic_bp"), num("diastolic_bp")
    rr, o2, temp = num("respiratory_rate"), num("spo2"), num("temperature_c")

    # Guard division: NaN or sbp <= 0 -> NaN, never a fabricated 0.
    out["shock_index"] = hr / sbp.where(sbp > 0)

    out["pulse_pressure"] = sbp - dbp

    columns = {
        "heart_rate": hr,
        "respiratory_rate": rr,
        "spo2": o2,
        "systolic_bp": sbp,
        "diastolic_bp": dbp,
        "temperature_c": temp,
    }
    abnormal = pd.Series(0, index=frame.index, dtype="float64")
    for column, direction, threshold in config.ABNORMAL_VITAL_RULES:
        values = columns.get(column)
        if values is None:
            continue
        flagged = values < threshold if direction == "below" else values > threshold
        abnormal = abnormal + flagged.fillna(False).astype("float64")
    out["abnormal_vital_count"] = abnormal

    # Carry through the columns the ColumnTransformer consumes.
    passthrough = [
        c
        for c in (
            config.NUMERIC_TRIAGE_FEATURES
            + config.CATEGORICAL_TRIAGE_FEATURES
            + (config.TEXT_FEATURE,)
            + INDICATOR_FEATURES
            + (
                config.SUBJECT_ID_COLUMN,
                config.TARGET_COLUMN,
            )
        )
        if c in frame.columns
    ]
    for column in passthrough:
        out[column] = frame[column]
    return out


def make_derive_step() -> FunctionTransformer:
    """Wrap :func:`derive_features` as a picklable, stateless transformer."""
    return FunctionTransformer(derive_features, validate=False)


class TextBlockFlattener(BaseEstimator, TransformerMixin):
    """Stateless helper: flatten a 1- or 2-column text block to a document list.

    ``SimpleImputer`` yields a 2-D array, but ``TfidfVectorizer`` expects a
    1-D iterable of documents. This transformer performs that flattening and
    replaces missing entries with the literal ``unknown`` token.

    It is stateless (nothing is fitted), and it implements
    ``get_feature_names_out`` so it can be chained in a ``Pipeline`` without
    breaking ``ColumnTransformer.get_feature_names_out``.
    """

    def fit(self, X, y=None):
        return self

    def transform(self, X):
        flat = np.asarray(X, dtype=object).ravel()
        series = pd.Series(flat, dtype=object).fillna("unknown")
        return [str(item) for item in series.tolist()]

    def get_feature_names_out(self, input_features=None):
        if input_features is None:
            return np.asarray([], dtype=object)
        return np.asarray(input_features, dtype=object)


def make_text_fill_step() -> TextBlockFlattener:
    return TextBlockFlattener()


# ---------------------------------------------------------------------------
# Preprocessing pipeline
# ---------------------------------------------------------------------------


def build_preprocessor(
    max_tfidf_features: int = 300, min_df: int = 5
) -> Pipeline:
    """Build the unfitted preprocessing pipeline.

    Structure::

        Pipeline([('derive',  FunctionTransformer(derive_features)),
                  ('encode', ColumnTransformer([
                      ('num',      numeric_branch,  numeric_cols),
                      ('derived',  numeric_branch,  derived_cols),
                      ('cat',      categorical_branch, cat_cols),
                      ('text',     text_branch,     [text_col]),
                      ('flags',    'passthrough',   indicator_cols),
                    ]))])

    Every transformer in the branches is *fitted* (imputer medians, encoder
    categories, TF-IDF vocabulary), so calling ``fit`` on training folds only
    guarantees train-only statistics.

    Parameters
    ----------
    max_tfidf_features:
        Upper bound on the TF-IDF vocabulary. The demo subset has 80,000
        labelled rows, so a small capped vocabulary is essential to avoid
        over-fitting.
    min_df:
        Minimum document frequency for a TF-IDF term.
    """
    numeric_branch = Pipeline(
        steps=[
            ("impute", SimpleImputer(strategy="median")),
            ("scale", StandardScaler()),
        ]
    )

    categorical_branch = Pipeline(
        steps=[
            (
                "impute",
                SimpleImputer(strategy="constant", fill_value="missing"),
            ),
            (
                "onehot",
                OneHotEncoder(
                    handle_unknown="ignore",
                    min_frequency=5,  # group rare categories -> reduces sparsity
                    sparse_output=False,
                ),
            ),
        ]
    )

    text_branch = Pipeline(
        steps=[
            ("fill", make_text_fill_step()),
            (
                "tfidf",
                TfidfVectorizer(
                    lowercase=True,   # text is already normalised upstream
                    # Require >=2 characters so single-letter noise such as
                    # "L" / "R" abbreviations does not consume vocabulary.
                    token_pattern=r"[A-Za-z][A-Za-z0-9/]+",
                    min_df=min_df,
                    max_features=max_tfidf_features,
                    sublinear_tf=True,
                ),
            ),
        ]
    )

    encoder = ColumnTransformer(
        transformers=[
            (
                "num",
                numeric_branch,
                list(config.NUMERIC_TRIAGE_FEATURES),
            ),
            ("derived", numeric_branch, list(DERIVED_FEATURES)),
            ("cat", categorical_branch, list(config.CATEGORICAL_TRIAGE_FEATURES)),
            ("text", text_branch, [config.TEXT_FEATURE]),
            ("flags", "passthrough", list(INDICATOR_FEATURES)),
        ],
        remainder="drop",
        verbose_feature_names_out=False,
    )

    return Pipeline(
        steps=[("derive", make_derive_step()), ("encode", encoder)]
    )


# ---------------------------------------------------------------------------
# Feature-frame construction (deterministic cleaning, no fitted statistics)
# ---------------------------------------------------------------------------


def build_feature_frame(joined: pd.DataFrame) -> pd.DataFrame:
    """Turn the joined raw frame into a cleaned, allow-listed feature frame.

    Applies every documented data-quality rule from
    :mod:`backend.ml.validation` and returns a frame with only the allow-listed
    feature columns, the missingness indicators, and the identifier/target
    columns needed for splitting and evaluation.

    This function performs **no fitted statistics** (no medians, no
    vocabularies, no category groupings), so it is safe to call on the full
    cohort before splitting. The cleaning counts are attached to
    ``frame.attrs['cleaning_counts']`` for the quality report.
    """
    from . import validation

    frame = joined.copy()

    # --- target: drop rows with no clinician-assigned acuity label ---------
    frame, target_counts = validation.validate_target(frame)

    # --- temperature: normalise mixed C/F, reject implausible values --------
    frame["temperature_c"], temp_counts = validation.normalize_temperature(
        frame["temperature_c"]
    )

    # --- pain: parse to 0-10, sentinels and out-of-range -> missing ---------
    frame["pain_score"], pain_counts = validation.parse_pain(frame["pain_score"])

    # --- remaining vitals: envelope validation -----------------------------
    frame, vitals_counts = validation.validate_vitals(frame)

    # --- chief complaint: deterministic normalisation (no fit) --------------
    frame["chief_complaint_system"], cc_counts = validation.normalize_chiefcomplaint(
        frame["chief_complaint_system"]
    )

    # --- arrival transport: explicit missing category -----------------------
    frame["arrival_mode"] = frame["arrival_mode"].astype("string").fillna("unknown")

    # --- missingness indicators --------------------------------------------
    frame = validation.add_missingness_indicators(
        frame,
        config.NUMERIC_TRIAGE_FEATURES,
    )

    counts: dict[str, int] = {}
    for source in (target_counts, temp_counts, pain_counts, vitals_counts, cc_counts):
        for key, value in source.items():
            counts[key] = counts.get(key, 0) + value
    frame.attrs["cleaning_counts"] = counts

    kept = (
        list(config.NUMERIC_TRIAGE_FEATURES)
        + ["pain_score"]
        + list(config.CATEGORICAL_TRIAGE_FEATURES)
        + [config.TEXT_FEATURE]
        + list(INDICATOR_FEATURES)
        + [config.SUBJECT_ID_COLUMN, config.TARGET_COLUMN]
    )
    frame = frame[[c for c in kept if c in frame.columns]].copy()
    return frame


def assert_no_leakage_columns(frame: pd.DataFrame) -> None:
    """Assert that no leakage-prone column is present as a feature.

    Leakage-prone columns (disposition, ed_los_hours) must never be used
    as model inputs because they are determined after triage.
    """
    leakage_cols = [f.name for f in config.LEAKAGE_FIELDS]
    present = [c for c in leakage_cols if c in frame.columns]
    if present:
        raise ValueError(
            f"Leakage-prone columns found in feature frame: {present}. "
            "These columns contain post-triage outcome information and "
            "must not be used as model inputs."
        )


def leakage_free_feature_names(fitted_preprocessor: Pipeline) -> list[str]:
    """Feature names from a fitted ColumnTransformer pipeline.

    Returns feature names in the order they appear after transformation,
    suitable for SHAP explanations and model interpretation.

    Parameters
    ----------
    fitted_preprocessor : sklearn Pipeline or ColumnTransformer
        A fitted pipeline with a 'preprocess' step (ColumnTransformer)
        or a ColumnTransformer directly.

    Returns
    -------
    list[str]
        Feature names in transformed order.
    """
    pre = fitted_preprocessor
    if hasattr(pre, "named_steps") and "preprocess" in pre.named_steps:
        pre = pre.named_steps["preprocess"]

    if "encode" in getattr(pre, "named_steps", {}):
        encoder = pre.named_steps["encode"]
        names = list(encoder.get_feature_names_out())
    else:  # pragma: no cover - direct ColumnTransformer input
        names = list(pre.get_feature_names_out())

    forbidden = [n for n in names if n.startswith(("subject_id", "stay_id"))]
    if forbidden:
        raise ValueError(
            f"Identifier column(s) reached the model input: {forbidden}."
        )
    return names
