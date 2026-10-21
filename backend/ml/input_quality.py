"""Input quality and OOD assessment for MedGuard.

Provides conservative, documented checks against training distribution statistics
for the Triagegeist synthetic dataset.
No patient identifiers or raw training rows are stored. All checks are transparent.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List

import numpy as np
import pandas as pd

from backend.ml import config
from backend.ml.triagegeist_schema import NUMERIC_FEATURE_COLUMNS, CATEGORICAL_FEATURE_COLUMNS


DEFAULT_STATS_PATH = config.REPORTS_DIR / "triagegeist_training_stats.json"
Z_WARNING = 3.0  # Unusually far from mean (conservative)


class QualityCheckResult:
    def __init__(self):
        self.warnings: List[Dict[str, Any]] = []
        self.errors: List[Dict[str, Any]] = []

    def add_warning(self, code: str, message: str, feature: str | None = None, details: Dict[str, Any] | None = None):
        self.warnings.append({
            "code": code,
            "message": message,
            "feature": feature,
            "details": details or {},
        })

    def add_error(self, code: str, message: str, feature: str | None = None, details: Dict[str, Any] | None = None):
        self.errors.append({
            "code": code,
            "message": message,
            "feature": feature,
            "details": details or {},
        })

    def to_dict(self) -> Dict[str, Any]:
        return {
            "has_errors": len(self.errors) > 0,
            "has_warnings": len(self.warnings) > 0,
            "warnings": self.warnings,
            "errors": self.errors,
        }


def load_training_stats(stats_path: Path | None = None) -> Dict[str, Any]:
    path = stats_path or DEFAULT_STATS_PATH
    if path.exists():
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    return {"numeric": {}, "categorical": {}, "n_samples": 0}


def assess_input_quality(
    sample_frame: pd.DataFrame,
    stats_path: Path | None = None,
) -> Dict[str, Any]:
    """Assess input quality for a single-sample (or batch) frame.

    Conservative checks against training distribution. Does not reject inputs;
    returns warnings only for distributional anomalies.
    """
    result = QualityCheckResult()
    stats = load_training_stats(stats_path)
    numeric_stats = stats.get("numeric", {})
    cat_stats = stats.get("categorical", {})

    # Check numeric features using Triagegeist schema
    numeric_cols = NUMERIC_FEATURE_COLUMNS
    for col in numeric_cols:
        if col not in sample_frame.columns:
            continue
        val = sample_frame[col].iloc[0] if len(sample_frame) > 0 else None
        if pd.isna(val):
            continue
        col_stats = numeric_stats.get(col)
        if not col_stats or col_stats.get("count", 0) < 5:
            result.add_warning(
                "QUALITY_LOW_N",
                f"Insufficient training data to assess distribution for {col}",
                feature=col,
                details={"training_count": col_stats.get("count", 0) if col_stats else 0},
            )
            continue
        # Range check
        if val < col_stats["min"] - 1e-9 or val > col_stats["max"] + 1e-9:
            result.add_warning(
                "OOD_RANGE",
                f"{col} ({val:.2f}) is outside observed training range [{col_stats['min']:.2f}, {col_stats['max']:.2f}]",
                feature=col,
                details={"value": float(val), "train_min": col_stats["min"], "train_max": col_stats["max"]},
            )
            continue
        # Z-score check if std > 0
        if col_stats["std"] > 1e-9:
            z = abs(val - col_stats["mean"]) / col_stats["std"]
            if z > Z_WARNING:
                result.add_warning(
                    "OOD_ZSCORE",
                    f"{col} ({val:.2f}) is unusually far from training distribution (|z|={z:.2f} > {Z_WARNING})",
                    feature=col,
                    details={"value": float(val), "z": float(z), "threshold": Z_WARNING},
                )

    # Check categorical features using Triagegeist schema
    for col in CATEGORICAL_FEATURE_COLUMNS:
        if col not in sample_frame.columns:
            continue
        val = sample_frame[col].iloc[0] if len(sample_frame) > 0 else None
        if pd.isna(val):
            continue
        val_str = str(val).strip().upper()
        cat_stats_col = cat_stats.get(col, {})
        if cat_stats_col and val_str not in cat_stats_col:
            result.add_warning(
                "OOD_CATEGORICAL",
                f"{col} '{val_str}' not observed in training data",
                feature=col,
                details={"value": val_str, "observed_in_training": False},
            )

    return result.to_dict()
