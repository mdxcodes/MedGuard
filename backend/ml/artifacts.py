"""Model artifact discovery, delivery and validation.

The trained Triagegeist pipeline is roughly 250 MB, which is larger than
GitHub's 100 MB per-file limit and larger than the 50 MB per-file limit of
Supabase Storage on the free plan. The artifact is therefore stored
xz-compressed (about 32 MB) in a **private** Supabase Storage bucket and
restored on startup.

Delivery guarantees implemented here:

* **Explicit location.** A bucket and object path are configured
  independently, so the deployment names exactly which object is fetched.
  The raw training dataset is never part of the inference download path.
* **Least privilege.** The bucket is private. The backend authenticates with
  a server-side key; the key never reaches the frontend, Git, a log line or
  an API response. A pre-signed URL may be used instead, in which case no
  long-lived credential is needed at all.
* **Bounded work.** The download has a timeout and a bounded number of
  retries with backoff. A failure is retried a known number of times and
  then reported, never retried forever.
* **Atomic replacement.** The download lands on a temporary file and is moved
  into place with ``os.replace``. A known-good artifact is never
  overwritten in place, and an interrupted download can never be mistaken
  for a complete one.
* **Integrity.** The restored file is checked against a digest that is
  pinned out of band, in the environment.
* **Compatibility.** The manifest that accompanies the artifact is validated
  against the running code and the installed library versions *before* the
  artifact is deserialized. A checksum proves the bytes are the ones we
  expect; it does not prove the bytes are safe to unpickle, so the
  manifest cross-check and the version gate are separate and both required.
* **Caching.** A verified artifact is reused from the cache directory. It
  is never re-downloaded per request.

If the artifact cannot be obtained or fails validation the failure is
reported as such. A dummy or synthetic model is never substituted: a
prediction that does not come from the trained model would be a fabricated
result.
"""

from __future__ import annotations

import gzip
import hashlib
import json
import logging
import lzma
import os
import shutil
import tempfile
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Optional
from urllib.parse import urlparse

log = logging.getLogger("medguard.ml.artifacts")

#: Where a verified artifact is cached between restarts.
ARTIFACT_DIR_ENV = "MEDGUARD_ARTIFACT_DIR"

#: Explicit Storage location. The bucket is private and holds versioned
#: artifacts only - never the training dataset.
ARTIFACT_BUCKET_ENV = "MEDGUARD_ARTIFACT_BUCKET"
ARTIFACT_MODEL_OBJECT_ENV = "MEDGUARD_ARTIFACT_MODEL_OBJECT"
ARTIFACT_MANIFEST_OBJECT_ENV = "MEDGUARD_ARTIFACT_MANIFEST_OBJECT"

#: Direct URL alternative to the bucket + object pair. A pre-signed URL needs
#: no long-lived credential on the server.
MODEL_URL_ENV = "MEDGUARD_MODEL_URL"
MANIFEST_URL_ENV = "MEDGUARD_MANIFEST_URL"

#: Pinned digests of the restored (decompressed) artifacts.
MODEL_SHA_ENV = "MEDGUARD_MODEL_SHA256"
MANIFEST_SHA_ENV = "MEDGUARD_MANIFEST_SHA256"

#: Transfer controls.
ARTIFACT_TIMEOUT_ENV = "MEDGUARD_ARTIFACT_TIMEOUT"
ARTIFACT_RETRIES_ENV = "MEDGUARD_ARTIFACT_RETRIES"

#: Backend-only Supabase credentials. A secret key bypasses Row Level
#: Security, so it must never reach the browser, Git, a log or a response.
SUPABASE_URL_ENV = "SUPABASE_URL"
SUPABASE_SECRET_KEY_ENV = "SUPABASE_SECRET_KEY"
SUPABASE_SERVICE_ROLE_ENV = "SUPABASE_SERVICE_ROLE_KEY"

_CHUNK = 1024 * 1024
_DEFAULT_TIMEOUT = 300.0
_DEFAULT_RETRIES = 3


class ArtifactError(RuntimeError):
    """Raised when a required model artifact cannot be made available."""


class ArtifactUnavailable(ArtifactError):
    """The artifact is not configured or not present in the store."""


class ArtifactIntegrityError(ArtifactError):
    """The artifact was fetched but does not match its pinned digest."""


class ArtifactCompatibilityError(ArtifactError):
    """The artifact is intact but incompatible with the running code."""


@dataclass(frozen=True)
class ArtifactSpec:
    """Everything needed to fetch and validate one artifact."""

    label: str
    local_path: Path
    bucket_env: str
    object_env: str
    url_env: str
    sha_env: str


def sha256_file(path: Path) -> str:
    """Return the hex SHA-256 digest of a file."""
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(_CHUNK), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _artifact_dir() -> Path:
    """Directory used to cache verified artifacts."""
    configured = os.getenv(ARTIFACT_DIR_ENV)
    target = Path(configured) if configured else Path(tempfile.gettempdir()) / "medguard-artifacts"
    try:
        target.mkdir(parents=True, exist_ok=True)
    except OSError as exc:  # pragma: no cover - depends on the filesystem
        log.warning("Could not create artifact directory %s: %s", target, exc)
        return Path(tempfile.gettempdir())
    return target


def _timeout() -> float:
    try:
        return float(os.getenv(ARTIFACT_TIMEOUT_ENV, _DEFAULT_TIMEOUT))
    except ValueError:
        return _DEFAULT_TIMEOUT


def _retries() -> int:
    try:
        return max(0, int(os.getenv(ARTIFACT_RETRIES_ENV, _DEFAULT_RETRIES)))
    except ValueError:
        return _DEFAULT_RETRIES


def _storage_credentials() -> tuple[str, str]:
    """Return the project URL and the server-side key, if configured.

    The secret key is preferred; the service-role key is accepted as a
    fallback for existing deployments. Both are server-side only.
    """
    project_url = os.getenv(SUPABASE_URL_ENV, "").strip()
    secret = os.getenv(SUPABASE_SECRET_KEY_ENV, "").strip()
    service = os.getenv(SUPABASE_SERVICE_ROLE_ENV, "").strip()
    return project_url, (secret or service)


def _object_url(project_url: str, bucket: str, object_path: str) -> str:
    """Public URL of a private Storage object (still requires a credential)."""
    return f"{project_url.rstrip('/')}/storage/v1/object/{bucket}/{object_path.lstrip('/')}"


def _auth_headers(url: str) -> dict[str, str]:
    """Authorization headers for a private Supabase Storage object.

    Credentials are attached only when the target host is the configured
    Supabase project, so an ordinary public URL is fetched without them.
    """
    project_url, key = _storage_credentials()
    if not project_url or not key:
        return {}
    if urlparse(url).netloc != urlparse(project_url).netloc:
        return {}
    return {"apikey": key, "Authorization": f"Bearer {key}"}


def _source_urls(spec: ArtifactSpec) -> list[str]:
    """Candidate URLs for an artifact, most specific first."""
    urls: list[str] = []
    direct = os.getenv(spec.url_env, "").strip()
    if direct:
        urls.append(direct)

    project_url, key = _storage_credentials()
    bucket = os.getenv(spec.bucket_env, "").strip()
    object_path = os.getenv(spec.object_env, "").strip()
    if project_url and bucket and object_path:
        urls.append(_object_url(project_url, bucket, object_path))
    elif bucket and object_path and not project_url:
        log.warning(
            "%s and %s are set but %s is not; cannot build a Storage URL.",
            spec.bucket_env, spec.object_env, SUPABASE_URL_ENV,
        )
    return urls


def _download(url: str, destination: Path) -> Path:
    """Download ``url`` to a temporary file next to ``destination``.

    The bytes land on a temporary path, so an interrupted transfer can never
    be mistaken for a complete artifact.
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
            timeout=httpx.Timeout(_timeout(), connect=30.0),
            follow_redirects=True,
            headers=_auth_headers(url),
        ) as response:
            if response.status_code in (401, 403):
                raise ArtifactUnavailable(
                    f"Access to {url} was denied (HTTP {response.status_code}). "
                    "The credential may be missing, expired, or lack permission for this object."
                )
            if response.status_code == 404:
                raise ArtifactUnavailable(
                    f"{url} was not found (HTTP 404). Check the bucket and object path."
                )
            response.raise_for_status()
            with handle as sink:
                for chunk in response.iter_bytes(_CHUNK):
                    sink.write(chunk)
    except ArtifactError:
        temp_path.unlink(missing_ok=True)
        raise
    except Exception as exc:
        temp_path.unlink(missing_ok=True)
        raise ArtifactError(f"Failed to download {url}: {exc}") from exc

    return temp_path


def _finalize(archive: Path, target: Path, compression_suffix: str = "") -> Path:
    """Move a downloaded file into place, decompressing it when needed.

    The expansion is streamed to disk one chunk at a time. Decompressing into
    a single in-memory buffer and then writing it out needs roughly 512 MB
    of resident memory for this artifact, which is more than a small Render
    instance has.
    """
    decompress = _DECOMPRESSORS.get(compression_suffix.lower())
    target.parent.mkdir(parents=True, exist_ok=True)

    if decompress is None:
        shutil.move(str(archive), str(target))
        return target

    temp_path = None
    try:
        with tempfile.NamedTemporaryFile(
            dir=str(target.parent), prefix=target.name, suffix=".part", delete=False
        ) as sink:
            temp_path = Path(sink.name)
            with decompress(archive, "rb") as source:
                shutil.copyfileobj(source, sink, length=_CHUNK)
    except Exception as exc:  # noqa: BLE001
        if temp_path is not None:
            temp_path.unlink(missing_ok=True)
        archive.unlink(missing_ok=True)
        raise ArtifactError(f"Could not decompress {archive.name}: {exc}") from exc

    # Atomic: the verified file only becomes visible under its final name
    # once it is complete.
    os.replace(str(temp_path), str(target))
    archive.unlink(missing_ok=True)
    log.info("Decompressed %s into %s", archive.name, target)
    return target


#: Suffix -> streaming opener. Only formats available in the standard library
#: are supported, so no extra dependency is needed to restore the artifact.
_DECOMPRESSORS = {
    ".xz": lzma.open,
    ".gz": gzip.open,
}


def _fetch_with_retries(urls: list[str], destination: Path) -> Path:
    """Fetch an artifact, trying each source and retrying transient errors."""
    attempts = _retries()
    last_error: Optional[Exception] = None
    unavailable: Optional[ArtifactUnavailable] = None

    for url in urls:
        for attempt in range(1, attempts + 1):
            suffix = Path(urlparse(url).path).suffix.lower()
            if suffix not in _DECOMPRESSORS:
                suffix = ""
            archive_name = destination.name + suffix if suffix else destination.name
            try:
                archive = _download(url, _artifact_dir() / archive_name)
                return _finalize(archive, destination, suffix)
            except ArtifactUnavailable as exc:
                # A missing object or a denied credential will not improve on
                # a retry; move to the next source but keep the reason.
                unavailable = exc
                break
            except Exception as exc:  # noqa: BLE001
                last_error = exc
                if attempt < attempts:
                    backoff = min(2 ** (attempt - 1), 8)
                    log.warning(
                        "Download of %s failed (attempt %d/%d): %s; retrying in %ds",
                        url, attempt, attempts, exc, backoff,
                    )
                    time.sleep(backoff)

    if last_error is not None:
        raise last_error
    if unavailable is not None:
        raise unavailable
    raise ArtifactUnavailable(
        f"No source configured for {destination.name}. Set "
        f"{MODEL_URL_ENV} / {MANIFEST_URL_ENV}, or "
        f"{ARTIFACT_BUCKET_ENV} together with {ARTIFACT_MODEL_OBJECT_ENV} / "
        f"{ARTIFACT_MANIFEST_OBJECT_ENV}."
    )


def resolve_artifact(spec: ArtifactSpec) -> Optional[Path]:
    """Return a verified local path for one artifact, or ``None``.

    The artifact already on disk is used when it matches its pinned digest.
    Otherwise it is fetched, restored, verified and moved into place
    atomically. A digest mismatch is never ignored.
    """
    expected = os.getenv(spec.sha_env, "").strip()
    destination = spec.local_path

    if destination.exists():
        if not expected:
            log.warning(
                "%s is not set; using the artifact already on disk without "
                "digest verification.", spec.sha_env,
            )
            return destination
        if sha256_file(destination).lower() == expected.lower():
            log.info("Using cached artifact %s", destination)
            return destination
        log.warning(
            "Cached artifact %s does not match %s; it will be replaced.",
            destination, spec.sha_env,
        )

    urls = _source_urls(spec)
    if not urls:
        return None

    log.info("Fetching %s for %s", spec.label, spec.local_path.name)
    restored = _fetch_with_retries(urls, destination)

    if expected:
        actual = sha256_file(restored)
        if actual.lower() != expected.lower():
            restored.unlink(missing_ok=True)
            raise ArtifactIntegrityError(
                f"Digest mismatch for {spec.label}: expected {expected}, got {actual}. "
                "Refusing to load an unverified artifact."
            )
        log.info("Verified %s digest %s", spec.label, actual)

    return restored


#: Libraries whose version must match the manifest that describes the
#: artifact. A pickle produced by a different scikit-learn version may load
# silently and then predict wrongly, so the gate is on the version, not
# only on the bytes.
_COMPATIBILITY_VERSIONS = ("scikit-learn", "numpy", "pandas")


def validate_manifest_compatibility(manifest: dict[str, Any]) -> list[str]:
    """Check a manifest against the running code and installed libraries.

    Returns the list of problems found. An empty list means the artifact is
    compatible. This runs *before* the artifact is deserialized.
    """
    import sklearn

    from backend.ml import config as ml_config
    from backend.ml import triagegeist_schema

    problems: list[str] = []

    dataset = manifest.get("dataset")
    expected_dataset = triagegeist_schema.dataset_provenance()["name"]
    if dataset and dataset != expected_dataset:
        problems.append(
            f"manifest dataset {dataset!r} does not match the active dataset "
            f"{expected_dataset!r}"
        )

    target = manifest.get("target")
    if target and target != ml_config.TARGET_COLUMN:
        problems.append(
            f"manifest target {target!r} does not match the active target "
            f"{ml_config.TARGET_COLUMN!r}"
        )

    labels = manifest.get("esi_labels")
    if labels and list(labels) != list(ml_config.ESI_LABELS):
        problems.append(
            f"manifest ESI labels {labels} do not match the active labels "
            f"{list(ml_config.ESI_LABELS)}"
        )

    runtime_versions = {
        "scikit-learn": sklearn.__version__,
        "numpy": _module_version("numpy"),
        "pandas": _module_version("pandas"),
    }
    recorded = manifest.get("versions") or {}
    for library in _COMPATIBILITY_VERSIONS:
        expected = recorded.get(library)
        actual = runtime_versions.get(library)
        if expected and actual and expected != actual:
            problems.append(
                f"{library} {expected} in the manifest does not match the installed "
                f"{actual}; the artifact may not deserialize or may predict wrongly"
            )

    return problems


def _module_version(name: str) -> str:
    try:
        module = __import__(name)
        return getattr(module, "__version__", "")
    except Exception:  # pragma: no cover - the library is a hard dependency
        return ""


def load_manifest_dict(path: Path) -> dict[str, Any]:
    """Read and parse a manifest file."""
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)
