"""Uncertainty and calibration analysis utilities.

Provides metrics and indicators without fitting calibration on held-out/test sets.
"""

from __future__ import annotations

import math
from typing import Any, Dict, List

import numpy as np


def compute_uncertainty_metrics(probs: np.ndarray | List[float]) -> Dict[str, Any]:
    """Compute interpretable uncertainty indicators from probability vector.

    Args:
        probs: Class probabilities (sum to ~1, in ESI order 1,2,3,4,5)

    Returns:
        Dict with max_prob, prediction_margin, predictive_entropy, entropy_norm
    """
    if probs is None or len(probs) == 0:
        return {
            "max_prob": 0.0,
            "prediction_margin": 0.0,
            "predictive_entropy": 0.0,
            "entropy_norm": 0.0,
            "available": False,
        }

    p = np.array(probs, dtype=float)
    # Normalize if needed
    s = p.sum()
    if s > 0 and abs(s - 1.0) > 1e-10:
        p = p / s

    # Max prob
    max_prob = float(p.max()) if p.size > 0 else 0.0
    # Top two
    if p.size >= 2:
        sorted_p = np.sort(p)[::-1]
        margin = float(sorted_p[0] - sorted_p[1])
    else:
        margin = max_prob
    # Entropy
    ent = 0.0
    for val in p:
        if val > 1e-18:
            ent -= val * math.log(val, 2)
    n_classes = p.size
    ent_norm = ent / math.log(n_classes, 2) if n_classes > 1 else 0.0
    return {
        "max_prob": max_prob,
        "prediction_margin": margin,
        "predictive_entropy": float(ent),
        "entropy_norm": float(ent_norm),
        "available": True,
    }


def compute_multiclass_brier(y_true: np.ndarray, proba: np.ndarray, classes: List[int]) -> float:
    """Compute multiclass Brier score. Requires aligned proba (n_samples x n_classes)."""
    if len(y_true) == 0 or proba is None or proba.shape[0] == 0:
        return float('nan')
    n = len(y_true)
    k = proba.shape[1] if proba.ndim > 1 else len(proba[0]) if hasattr(proba[0], '__len__') else len(classes)
    bs = 0.0
    for i in range(n):
        yt = y_true[i]
        # one-hot
        for j, c in enumerate(classes):
            p = proba[i][j] if j < proba.shape[1] else 0.0
            if yt == c:
                bs += (p - 1.0) ** 2
            else:
                bs += p ** 2
    return float(bs / n)
