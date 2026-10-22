"""Model registry - versioned metadata and integrity checks."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any, Dict, List

import logging

from backend.ml import config

log = logging.getLogger("medguard.ml.registry")


#: The registry describes the model the application actually serves. These
#: come from the ML config so the registry and the API can never point at
#: different artifacts.
MODELS_DIR = config.MODELS_DIR
REPORTS_DIR = config.REPORTS_DIR
MANIFEST_PATH = config.MANIFEST_PATH
MODEL_PATH = config.MODEL_PATH

from backend.ml import artifacts

MANIFEST_URL_ENV = artifacts.MANIFEST_URL_ENV
MANIFEST_SHA_ENV = artifacts.MANIFEST_SHA_ENV


def sha256_file(p: Path) -> str:
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


def load_manifest(manifest_path: Path | None = None) -> Dict[str, Any]:
    """Load the active model manifest.

    The manifest may be delivered from disk or fetched from remote storage,
    exactly like the model artifact itself, so the registry always describes
    the model the service is actually serving.
    """
    p = manifest_path or MANIFEST_PATH
    if not p.exists():
        resolved = _resolve_manifest()
        if resolved is None:
            raise FileNotFoundError(
                f"Manifest not found: {p}. Provide {MANIFEST_URL_ENV} to fetch it, "
                "or place it on disk. See docs/RENDER_DEPLOYMENT_FIX.md."
            )
        p = resolved
    with open(p, "r", encoding="utf-8") as f:
        return json.load(f)


def _resolve_manifest() -> Path | None:
    """Fetch the manifest through the API artifact resolver."""
    from backend.ml import artifacts

    try:
        return artifacts.resolve_artifact(
            MANIFEST_PATH,
            MANIFEST_PATH.name,
            artifacts.MANIFEST_URL_ENV,
            artifacts.MANIFEST_SHA_ENV,
        )
    except Exception as exc:  # noqa: BLE001
        log.warning("Could not fetch the model manifest: %s", exc)
        raise


def check_integrity(manifest: Dict[str, Any], manifest_path: Path | None = None) -> Dict[str, Any]:
    mp = manifest_path or MANIFEST_PATH
    result = {"ok": True, "checks": [], "errors": []}
    checksums = manifest.get("artifact_checksums", {})
    if checksums.get("model_sha256"):
        model_file = MODELS_DIR / manifest.get("artifact_filenames", {}).get("model", MODEL_PATH.name)
        if model_file.exists():
            actual = sha256_file(model_file)
            expected = checksums["model_sha256"]
            if actual == expected:
                result["checks"].append("model_sha256_match")
            else:
                result["ok"] = False
                result["errors"].append(f"sha256_mismatch:{actual[:8]}!={expected[:8]}")
        else:
            result["ok"] = False
            result["errors"].append("model_file_missing")
    return result


def list_versions() -> List[Dict[str, Any]]:
    m = load_manifest()
    return [{
        "version": m.get("manifest_version") or m.get("version") or "v1",
        "model_name": m.get("model_name"),
        "active": True,
        "manifest_path": str(MANIFEST_PATH),
        "model_path": str(MODEL_PATH),
        "dataset": m.get("dataset"),
        "training_rows": m.get("training_rows"),
    }]


def get_active_version() -> Dict[str, Any]:
    m = load_manifest()
    integ = check_integrity(m)
    return {
        "version": m.get("manifest_version") or m.get("version") or "v1",
        "model_name": m.get("model_name"),
        "active": True,
        "integrity": integ,
        "metadata": {
            k: m.get(k)
            for k in [
                "dataset",
                "training_rows",
                "training_patients",
                "esi_labels",
                "target",
                "class_distribution",
                "random_seed",
                "created_utc",
            ]
        },
        "artifact": {
            "model_path": str(MODEL_PATH),
            "manifest_path": str(MANIFEST_PATH),
            "model_exists": MODEL_PATH.exists(),
            "manifest_exists": MANIFEST_PATH.exists(),
        },
    }
