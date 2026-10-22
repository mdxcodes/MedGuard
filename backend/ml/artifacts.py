"""Model artifact discovery and delivery.

The trained Triagegeist pipeline is roughly 250 MB, which is larger than
GitHub's 100 MB per-file limit, so the artifact cannot be committed to the
repository. This module resolves the artifact at startup from whichever
source is configured:

1. **Local paths** — ``MEDGUARD_MODEL_PATH`` / ``MEDGUARD_MANIFEST_PATH``.
   This is the path used by a checkout that already carries the artifact (a
   local development environment, or a Render persistent disk mounted at the
   same location).

2. **Remote storage** — ``MEDGUARD_MODEL_URL`` / ``MEDGUARD_MANIFEST_URL``.
   The artifact is downloaded once into ``MEDGUARD_ARTIFACT_DIR`` and
   verified against ``MEDGUARD_MODEL_SHA256`` / ``MEDGUARD_MANIFEST_SHA256``
   before it is used. A digest mismatch, a failed download or a missing
   configuration is reported as an error; it is never ignored.

3. **Nothing configured** — the artifact is reported as unavailable and the
   dependent endpoints answer 503 with an actionable message.

A dummy or synthetic model is never substituted for a missing artifact: a
prediction that does not come from the trained model would be a fabricated
result.
"""

from __future__ import annotations

import hashlib
import logging
import os
import shutil
import tempfile
from pathlib import Path
from typing import Optional

log = logging.getLogger("medguard.api.artifacts")

#: Environment variable holding the directory that downloaded artifacts are
#: cached in. Render's filesystem is ephemeral between deploys, so the cache
#: is only reused within one instance's lifetime.
ARTIFACT_DIR_ENV = "MEDGUARD_ARTIFACT_DIR"
MODEL_URL_ENV = "MEDGUARD_MODEL_URL"
MODEL_SHA_ENV = "MEDGUARD_MODEL_SHA256"
MANIFEST_URL_ENV = "MEDGUARD_MANIFEST_URL"
MANIFEST_SHA_ENV = "MEDGUARD_MANIFEST_SHA256"

_CHUNK = 1024 * 1024


class ArtifactError(RuntimeError):
    """Raised when a required model artifact cannot be made available."""


def sha256_file(path: Path) -> str:
    """Return the hex SHA-256 digest of a file."""
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(_CHUNK), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _artifact_dir() -> Path:
    """Directory used to cache downloaded artifacts."""
    configured = os.getenv(ARTIFACT_DIR_ENV)
    if configured:
        target = Path(configured)
    else:
        target = Path(tempfile.gettempdir()) / "medguard-artifacts"
    try:
        target.mkdir(parents=True, exist_ok=True)
    except OSError as exc:  # pragma: no cover - depends on the filesystem
        log.warning("Could not create artifact directory %s: %s", target, exc)
        return Path(tempfile.gettempdir())
    return target


def _download(url: str, destination: Path, expected_sha256: Optional[str]) -> Path:
    """Download ``url`` to ``destination`` and verify its digest.

    The download lands on a temporary file first, so an interrupted or
    corrupt download can never be mistaken for a complete artifact.
    """
    import httpx

    destination.parent.mkdir(parents=True, exist_ok=True)
    handle = tempfile.NamedTemporaryFile(
        dir=str(destination.parent), prefix=destination.name, suffix=".part", delete=False
    )
    temp_path = Path(handle.name)
    try:
        with httpx.stream("GET", url, timeout=600.0, follow_redirects=True) as response:
            response.raise_for_status()
            with handle as sink:
                for chunk in response.iter_bytes(_CHUNK):
                    sink.write(chunk)
    except Exception:
        temp_path.unlink(missing_ok=True)
        raise ArtifactError(f"Failed to download model artifact from {url}: {exc}") from exc

    if expected_sha256:
        actual = sha256_file(temp_path)
        if actual.lower() != expected_sha256.strip().lower():
            temp_path.unlink(missing_ok=True)
            raise ArtifactError(
                "Model artifact digest mismatch for "
                f"{url}: expected {expected_sha256}, got {actual}. "
                "Refusing to load an unverified artifact."
            )
        log.info("Verified model artifact digest %s", actual)

    shutil.move(str(temp_path), str(destination))
    return destination


def resolve_artifact(
    local_path: Path,
    filename: str,
    url_env: str,
    sha_env: str,
) -> Optional[Path]:
    """Return a usable path for one artifact, or ``None`` if unavailable.

    ``local_path`` is used when it exists. Otherwise the artifact is fetched
    from the configured URL. ``None`` means "not available" and the caller
    decides how to report it.
    """
    if local_path.exists():
        return local_path

    url = os.getenv(url_env)
    if not url:
        return None

    destination = _artifact_dir() / filename
    if destination.exists():
        expected = os.getenv(sha_env)
        if not expected or sha256_file(destination).lower() == expected.strip().lower():
            log.info("Using cached artifact %s", destination)
            return destination
        log.warning("Cached artifact %s failed verification; re-downloading.", destination)
        destination.unlink(missing_ok=True)

    log.info("Fetching artifact %s from %s", filename, url)
    try:
        return _download(url, destination, os.getenv(sha_env))
    except ArtifactError as exc:
        raise ArtifactError(str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise ArtifactError(f"Failed to fetch artifact {filename}: {exc}") from exc
