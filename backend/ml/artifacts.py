"""Model artifact discovery and delivery.

The trained Triagegeist pipeline is roughly 250 MB, which is larger than
GitHub's 100 MB per-file limit and larger than the 50 MB per-file limit of
Supabase Storage on the free plan, so the artifact cannot be committed to the
repository nor uploaded to Storage uncompressed. It is therefore compressed
before upload (xz reduces it to roughly 32 MB) and this module restores it
transparently.

The artifact is resolved at startup from whichever source is configured:

1. **Local paths** — ``MEDGUARD_MODEL_PATH`` / ``MEDGUARD_MANIFEST_PATH``.
   A checkout that already carries the artifact, or a Render persistent disk
   mounted at the same location.

2. **Remote storage** — ``MEDGUARD_MODEL_URL`` / ``MEDGUARD_MANIFEST_URL``.
   The object is downloaded once into ``MEDGUARD_ARTIFACT_DIR``, optionally
   decompressed, and verified against its expected SHA-256 before it is used.
   A digest mismatch, a failed download or a missing configuration is
   reported as an error; it is never ignored.

   When the URL points at Supabase Storage, the service authenticates with
   ``SUPABASE_SERVICE_ROLE_KEY`` so that a **private** bucket can be used. The
   key is a backend-only secret and is never sent to a browser.

3. **Nothing configured** — the artifact is reported as unavailable and the
   dependent endpoints answer 503 with an actionable message.

A dummy or synthetic model is never substituted for a missing artifact: a
prediction that does not come from the trained model would be a fabricated
result.
"""

from __future__ import annotations

import gzip
import hashlib
import lzma
import logging
import os
import shutil
import tempfile
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse

log = logging.getLogger("medguard.api.artifacts")

#: Environment variable holding the directory that downloaded artifacts are
#: cached in. Render's filesystem is ephemeral between deploys, so the cache
#: is only reused within one instance's lifetime.
ARTIFACT_DIR_ENV = "MEDGUARD_ARTIFACT_DIR"
MODEL_URL_ENV = "MEDGUARD_MODEL_URL"
MODEL_SHA_ENV = "MEDGUARD_MODEL_SHA256"
MANIFEST_URL_ENV = "MEDGUARD_MANIFEST_URL"
MANIFEST_SHA_ENV = "MEDGUARD_MANIFEST_SHA256"

#: Backend-only Supabase credentials. The service role key bypasses Row Level
#: Security, so it must never reach the browser or a public log.
SUPABASE_URL_ENV = "SUPABASE_URL"
SUPABASE_SERVICE_ROLE_ENV = "SUPABASE_SERVICE_ROLE_KEY"

_CHUNK = 1024 * 1024

#: Suffix -> decompressor. Only formats available in the standard library are
#: supported, so no extra dependency is needed to restore the artifact.
_DECOMPRESSORS = {
    ".xz": lzma.decompress,
    ".gz": gzip.decompress,
}


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
    target = Path(configured) if configured else Path(tempfile.gettempdir()) / "medguard-artifacts"
    try:
        target.mkdir(parents=True, exist_ok=True)
    except OSError as exc:  # pragma: no cover - depends on the filesystem
        log.warning("Could not create artifact directory %s: %s", target, exc)
        return Path(tempfile.gettempdir())
    return target


def _auth_headers(url: str) -> dict[str, str]:
    """Authorization headers for a private Supabase Storage object.

    Returns an empty mapping for any host that is not the configured Supabase
    project, so an ordinary public URL is fetched without credentials.
    """
    project_url = os.getenv(SUPABASE_URL_ENV, "").strip()
    service_key = os.getenv(SUPABASE_SERVICE_ROLE_ENV, "").strip()
    if not project_url or not service_key:
        return {}

    project_host = urlparse(project_url).netloc
    target_host = urlparse(url).netloc
    if not project_host or target_host != project_host:
        return {}

    return {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
    }


def _download(url: str, destination: Path) -> Path:
    """Download ``url`` into ``destination``.

    The download lands on a temporary file first, so an interrupted download
    can never be mistaken for a complete artifact.
    """
    import httpx

    destination.parent.mkdir(parents=True, exist_ok=True)
    handle = tempfile.NamedTemporaryFile(
        dir=str(destination.parent), prefix=destination.name, suffix=".part", delete=False
    )
    temp_path = Path(handle.name)
    try:
        with httpx.stream(
            "GET",
            url,
            timeout=600.0,
            follow_redirects=True,
            headers=_auth_headers(url),
        ) as response:
            response.raise_for_status()
            with handle as sink:
                for chunk in response.iter_bytes(_CHUNK):
                    sink.write(chunk)
    except Exception as exc:
        temp_path.unlink(missing_ok=True)
        raise ArtifactError(f"Failed to download artifact from {url}: {exc}") from exc

    return temp_path


def _finalize(archive: Path, target: Path, compression_suffix: str = "") -> Path:
    """Move the downloaded file into place, decompressing it when needed.

    ``compression_suffix`` is passed explicitly rather than read from the
    temporary file name, which always ends in ``.part``.
    """
    decompress = _DECOMPRESSORS.get(compression_suffix.lower())
    target.parent.mkdir(parents=True, exist_ok=True)

    if decompress is None:
        shutil.move(str(archive), str(target))
        return target

    try:
        with archive.open("rb") as source:
            payload = decompress(source.read())
    except Exception as exc:  # noqa: BLE001
        archive.unlink(missing_ok=True)
        raise ArtifactError(f"Could not decompress {archive.name}: {exc}") from exc

    with tempfile.NamedTemporaryFile(
        dir=str(target.parent), prefix=target.name, suffix=".part", delete=False
    ) as sink:
        sink.write(payload)
        temp_path = Path(sink.name)
    shutil.move(str(temp_path), str(target))
    archive.unlink(missing_ok=True)
    log.info("Decompressed %s into %s", archive.name, target)
    return target


def resolve_artifact(
    local_path: Path,
    filename: str,
    url_env: str,
    sha_env: str,
) -> Optional[Path]:
    """Return a usable path for one artifact, or ``None`` if unavailable.

    ``local_path`` is used when it exists. Otherwise the artifact is fetched
    from the configured URL, decompressed if it is an archive, and verified
    against the expected digest of the **restored** file. ``None`` means "not
    available" and the caller decides how to report it.
    """
    if local_path.exists():
        return local_path

    url = os.getenv(url_env)
    if not url:
        return None

    expected = os.getenv(sha_env)
    destination = _artifact_dir() / filename

    if destination.exists():
        if not expected or sha256_file(destination).lower() == expected.strip().lower():
            log.info("Using cached artifact %s", destination)
            return destination
        log.warning("Cached artifact %s failed verification; re-downloading.", destination)
        destination.unlink(missing_ok=True)

    log.info("Fetching artifact %s from %s", filename, url)
    suffix = Path(urlparse(url).path).suffix.lower()
    if suffix not in _DECOMPRESSORS:
        suffix = ""
    archive_name = filename + suffix if suffix else filename
    archive = _download(url, _artifact_dir() / archive_name)
    restored = _finalize(archive, destination, suffix)

    if expected:
        actual = sha256_file(restored)
        if actual.lower() != expected.strip().lower():
            restored.unlink(missing_ok=True)
            raise ArtifactError(
                f"Artifact digest mismatch for {url}: expected {expected}, got {actual}. "
                "Refusing to load an unverified artifact."
            )
        log.info("Verified artifact digest %s", actual)

    return restored
