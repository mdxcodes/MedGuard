"""Triagegeist synthetic benchmark status endpoint.

Serves aggregate benchmark metadata only — no raw patient records or raw
clinical text. Read-only; does not touch training or inference.
"""

from __future__ import annotations

import json
from pathlib import Path

from fastapi import HTTPException

from backend.ml import config


TG_REPORTS = config.PROJECT_ROOT / "reports" / "triagegeist"


def triagegeist_status():
    """Return the Triagegeist benchmark profile and results if available."""
    profile_path = TG_REPORTS / "dataset_profile.json"
    results_path = TG_REPORTS / "benchmark_results.json"
    manifest_path = TG_REPORTS / "experiment_manifest.json"

    if not profile_path.exists():
        raise HTTPException(status_code=404, detail="Triagegeist benchmark artifacts not available")

    try:
        profile = json.loads(profile_path.read_text(encoding="utf-8"))
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Invalid benchmark profile: {exc}") from exc

    results = None
    if results_path.exists():
        try:
            results = json.loads(results_path.read_text(encoding="utf-8"))
        except Exception:  # noqa: BLE001
            results = None

    manifest = None
    if manifest_path.exists():
        try:
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        except Exception:  # noqa: BLE001
            manifest = None

    return {
        "available": True,
        "dataset": "triagegeist",
        "profile": profile,
        "benchmark_results": results,
        "manifest": manifest,
    }
