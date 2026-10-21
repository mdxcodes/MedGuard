"""Cautious dataset drift analysis for demo purposes.

Note: Only demo split available; drift analysis is limited by small size.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict

import numpy as np

from backend.ml import config, triagegeist_schema


def chi2_approx(o: np.ndarray, e: np.ndarray) -> float:
    e = np.array(e, dtype=float)
    o = np.array(o, dtype=float)
    mask = e > 0
    if not mask.any(): return float('inf')
    return float(np.sum((o[mask] - e[mask])**2 / e[mask]))


def compute_psi(ref: np.ndarray, comp: np.ndarray, bins: int = 5) -> float:
    if len(ref) == 0 or len(comp) == 0: return float('nan')
    try:
        ref_hist, edges = np.histogram(ref[~np.isnan(ref)], bins=bins, density=False)
        comp_hist, _ = np.histogram(comp[~np.isnan(comp)], bins=bins, density=False)
        ref_pct = ref_hist / max(1, ref_hist.sum())
        comp_pct = comp_hist / max(1, comp_hist.sum())
        psi = 0.0
        for r, c in zip(ref_pct, comp_pct):
            dr = (r + 1e-10)
            dc = (c + 1e-10)
            psi += (c-r) * np.log(dc/dr)
        return float(psi)
    except Exception:
        return float('nan')


def analyze_drift(ref_df, comp_df, numeric_cols=None) -> Dict[str, Any]:
    if numeric_cols is None:
        numeric_cols = triagegeist_schema.NUMERIC_FEATURE_COLUMNS
    results = {'numeric_psi': {}, 'sample_sizes': {'ref': len(ref_df), 'comp': len(comp_df)}, 'status': 'limited'}
    for c in numeric_cols:
        if c in ref_df and c in comp_df:
            results['numeric_psi'][c] = compute_psi(ref_df[c].values, comp_df[c].values)
    return results
