"""Tests for model artifact discovery, delivery and validation.

Covers the behaviours the deployment depends on: a successful download and
load, a missing artifact, a digest mismatch, an incompatible manifest, a
failed download, caching, and bounded retries.
"""

from __future__ import annotations

import hashlib
import io
import json
import lzma
import os
from pathlib import Path

import pytest

from backend.ml import artifacts


@pytest.fixture
def clean_env(monkeypatch, tmp_path):
    """Remove every artifact environment variable and point the cache at tmp."""
    for name in (
        artifacts.ARTIFACT_DIR_ENV,
        artifacts.ARTIFACT_BUCKET_ENV,
        artifacts.ARTIFACT_MODEL_OBJECT_ENV,
        artifacts.ARTIFACT_MANIFEST_OBJECT_ENV,
        artifacts.MODEL_URL_ENV,
        artifacts.MANIFEST_URL_ENV,
        artifacts.MODEL_SHA_ENV,
        artifacts.MANIFEST_SHA_ENV,
        artifacts.SUPABASE_URL_ENV,
        artifacts.SUPABASE_SECRET_KEY_ENV,
        artifacts.SUPABASE_SERVICE_ROLE_ENV,
    ):
        monkeypatch.delenv(name, raising=False)
    monkeypatch.setenv(artifacts.ARTIFACT_DIR_ENV, str(tmp_path / "cache"))
    return tmp_path


def make_spec(tmp_path, name="model.joblib"):
    return artifacts.ArtifactSpec(
        label="model artifact",
        local_path=tmp_path / name,
        bucket_env=artifacts.ARTIFACT_BUCKET_ENV,
        object_env=artifacts.ARTIFACT_MODEL_OBJECT_ENV,
        url_env=artifacts.MODEL_URL_ENV,
        sha_env=artifacts.MODEL_SHA_ENV,
    )


class _FakeStream:
    """Stand-in for the object httpx.stream() returns."""

    def __init__(self, payload=b"", status=200):
        self.payload = payload
        self.status_code = status

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def raise_for_status(self):
        if self.status_code >= 400:
            raise RuntimeError(f"HTTP {self.status_code}")

    def iter_bytes(self, chunk_size):
        yield self.payload


def install_stream(monkeypatch, stream, calls=None):
    """Patch httpx.stream so the artifact downloader can be driven offline."""
    import httpx

    def fake_stream(method, url, **kwargs):
        if calls is not None:
            calls.append((url, kwargs))
        return stream

    monkeypatch.setattr(httpx, "stream", fake_stream)


class TestLocalArtifact:
    def test_existing_local_file_is_used(self, clean_env, tmp_path):
        spec = make_spec(tmp_path)
        spec.local_path.write_bytes(b"artifact")
        assert artifacts.resolve_artifact(spec) == spec.local_path

    def test_missing_file_without_a_source_returns_none(self, clean_env, tmp_path):
        spec = make_spec(tmp_path)
        assert artifacts.resolve_artifact(spec) is None

    def test_digest_mismatch_on_a_cached_file_triggers_a_refetch(self, clean_env, tmp_path, monkeypatch):
        spec = make_spec(tmp_path)
        spec.local_path.write_bytes(b"stale")
        monkeypatch.setenv(artifacts.MODEL_SHA_ENV, "0" * 64)
        monkeypatch.setenv(artifacts.MODEL_URL_ENV, "https://example.invalid/model.joblib")

        calls = []
        install_stream(monkeypatch, _FakeStream(b"fresh"), calls)
        # The stale cache is replaced, and the replacement is then judged
        # against the pinned digest like any other download.
        with pytest.raises(artifacts.ArtifactIntegrityError):
            artifacts.resolve_artifact(spec)
        assert len(calls) == 1


class TestDigestVerification:
    def test_a_matching_digest_is_accepted(self, clean_env, tmp_path, monkeypatch):
        payload = b"the-real-artifact"
        digest = hashlib.sha256(payload).hexdigest()
        spec = make_spec(tmp_path)
        monkeypatch.setenv(artifacts.MODEL_URL_ENV, "https://example.invalid/model.joblib")
        monkeypatch.setenv(artifacts.MODEL_SHA_ENV, digest)

        install_stream(monkeypatch, _FakeStream(payload))
        resolved = artifacts.resolve_artifact(spec)
        assert resolved.read_bytes() == payload

    def test_a_mismatching_digest_is_rejected(self, clean_env, tmp_path, monkeypatch):
        spec = make_spec(tmp_path)
        monkeypatch.setenv(artifacts.MODEL_URL_ENV, "https://example.invalid/model.joblib")
        monkeypatch.setenv(artifacts.MODEL_SHA_ENV, "0" * 64)

        install_stream(monkeypatch, _FakeStream(b"not-what-we-expected"))
        with pytest.raises(artifacts.ArtifactIntegrityError, match="Digest mismatch"):
            artifacts.resolve_artifact(spec)

        # The rejected file must not be left behind to be picked up later.
        assert not spec.local_path.exists()


class TestFailedDownloads:
    def test_a_missing_object_is_reported_as_unavailable(self, clean_env, tmp_path, monkeypatch):
        spec = make_spec(tmp_path)
        monkeypatch.setenv(artifacts.MODEL_URL_ENV, "https://example.invalid/model.joblib")

        install_stream(monkeypatch, _FakeStream(b"", status=404))
        with pytest.raises(artifacts.ArtifactUnavailable):
            artifacts.resolve_artifact(spec)

    def test_a_denied_object_is_reported_as_unavailable(self, clean_env, tmp_path, monkeypatch):
        spec = make_spec(tmp_path)
        monkeypatch.setenv(artifacts.MODEL_URL_ENV, "https://example.invalid/model.joblib")

        install_stream(monkeypatch, _FakeStream(b"", status=403))
        with pytest.raises(artifacts.ArtifactUnavailable, match="denied"):
            artifacts.resolve_artifact(spec)

    def test_a_network_failure_is_retried_a_bounded_number_of_times(self, clean_env, tmp_path, monkeypatch):
        spec = make_spec(tmp_path)
        monkeypatch.setenv(artifacts.MODEL_URL_ENV, "https://example.invalid/model.joblib")
        monkeypatch.setenv(artifacts.ARTIFACT_RETRIES_ENV, "3")
        monkeypatch.setattr(artifacts.time, "sleep", lambda _s: None)

        calls = []
        install_stream(monkeypatch, _FakeStream(b""), calls)

        def failing_stream(method, url, **kwargs):
            calls.append((url, kwargs))
            raise OSError("connection reset")

        import httpx

        monkeypatch.setattr(httpx, "stream", failing_stream)

        with pytest.raises(artifacts.ArtifactError):
            artifacts.resolve_artifact(spec)

        # Bounded: exactly the configured number of attempts, not unbounded.
        assert len(calls) == 3


class TestCaching:
    def test_a_verified_artifact_is_reused_from_the_cache(self, clean_env, tmp_path, monkeypatch):
        payload = b"cached-artifact"
        digest = hashlib.sha256(payload).hexdigest()
        spec = make_spec(tmp_path)
        monkeypatch.setenv(artifacts.MODEL_URL_ENV, "https://example.invalid/model.joblib")
        monkeypatch.setenv(artifacts.MODEL_SHA_ENV, digest)

        calls = []
        install_stream(monkeypatch, _FakeStream(payload), calls)
        artifacts.resolve_artifact(spec)
        assert len(calls) == 1

        # A second resolution must not download again.
        install_stream(monkeypatch, _FakeStream(payload), calls)
        artifacts.resolve_artifact(spec)
        assert len(calls) == 1


class TestCompressedArtifacts:
    def test_an_xz_payload_is_restored(self, clean_env, tmp_path, monkeypatch):
        payload = b"model-bytes" * 5000
        digest = hashlib.sha256(payload).hexdigest()
        spec = make_spec(tmp_path)
        monkeypatch.setenv(artifacts.MODEL_URL_ENV, "https://example.invalid/model.joblib.xz")
        monkeypatch.setenv(artifacts.MODEL_SHA_ENV, digest)

        install_stream(monkeypatch, _FakeStream(lzma.compress(payload)))
        resolved = artifacts.resolve_artifact(spec)
        assert resolved.read_bytes() == payload

    def test_the_digest_is_of_the_restored_file(self, clean_env, tmp_path, monkeypatch):
        payload = b"original-model-bytes"
        spec = make_spec(tmp_path)
        monkeypatch.setenv(artifacts.MODEL_URL_ENV, "https://example.invalid/model.joblib.xz")
        # The digest of the COMPRESSED bytes must not satisfy the check.
        monkeypatch.setenv(
            artifacts.MODEL_SHA_ENV, hashlib.sha256(lzma.compress(payload)).hexdigest()
        )

        install_stream(monkeypatch, _FakeStream(lzma.compress(payload)))
        with pytest.raises(artifacts.ArtifactIntegrityError, match="Digest mismatch"):
            artifacts.resolve_artifact(spec)


class TestStorageSource:
    def test_a_bucket_and_object_build_a_url(self, clean_env, tmp_path, monkeypatch):
        monkeypatch.setenv(artifacts.SUPABASE_URL_ENV, "https://project.supabase.co")
        monkeypatch.setenv(artifacts.SUPABASE_SECRET_KEY_ENV, "secret")
        monkeypatch.setenv(artifacts.ARTIFACT_BUCKET_ENV, "model-artifacts")
        monkeypatch.setenv(
            artifacts.ARTIFACT_MODEL_OBJECT_ENV, "triagegeist/v1.0/triage_model.joblib"
        )
        spec = make_spec(tmp_path)
        urls = artifacts._source_urls(spec)
        assert urls == [
            "https://project.supabase.co/storage/v1/object/model-artifacts/"
            "triagegeist/v1.0/triage_model.joblib"
        ]

    def test_credentials_are_only_attached_to_the_configured_project(self, clean_env, monkeypatch):
        monkeypatch.setenv(artifacts.SUPABASE_URL_ENV, "https://project.supabase.co")
        monkeypatch.setenv(artifacts.SUPABASE_SECRET_KEY_ENV, "secret")
        assert artifacts._auth_headers(
            "https://project.supabase.co/storage/v1/object/b/o"
        )["Authorization"] == "Bearer secret"
        # A different host must not receive the credential.
        assert artifacts._auth_headers("https://cdn.example.com/o") == {}

    def test_no_credential_is_attached_when_none_is_configured(self, clean_env):
        assert artifacts._auth_headers("https://project.supabase.co/o") == {}


class TestManifestCompatibility:
    """The manifest gates the load. A digest proves the bytes; the manifest
    proves they belong to this pipeline and this code."""

    def _manifest(self, **overrides):
        import sklearn

        manifest = {
            "dataset": "Triagegeist",
            "target": "triage_acuity",
            "esi_labels": [1, 2, 3, 4, 5],
            "versions": {
                "scikit-learn": sklearn.__version__,
                "numpy": artifacts._module_version("numpy"),
                "pandas": artifacts._module_version("pandas"),
            },
        }
        manifest.update(overrides)
        return manifest

    def test_a_matching_manifest_has_no_problems(self):
        assert artifacts.validate_manifest_compatibility(self._manifest()) == []

    def test_a_different_dataset_is_rejected(self):
        problems = artifacts.validate_manifest_compatibility(
            self._manifest(dataset="Some Other Dataset")
        )
        assert any("dataset" in p for p in problems)

    def test_a_different_target_is_rejected(self):
        problems = artifacts.validate_manifest_compatibility(
            self._manifest(target="acuity")
        )
        assert any("target" in p for p in problems)

    def test_different_esi_labels_are_rejected(self):
        problems = artifacts.validate_manifest_compatibility(
            self._manifest(esi_labels=[1, 2, 3, 4])
        )
        assert any("ESI labels" in p for p in problems)

    def test_a_version_mismatch_is_rejected(self):
        problems = artifacts.validate_manifest_compatibility(
            self._manifest(versions={"scikit-learn": "0.24.0", "numpy": "1.0.0", "pandas": "1.0.0"})
        )
        assert any("scikit-learn" in p for p in problems)
        assert any("numpy" in p for p in problems)


class TestNoDummySubstitution:
    def test_a_missing_artifact_never_yields_a_placeholder(self, clean_env, tmp_path):
        spec = make_spec(tmp_path)
        assert artifacts.resolve_artifact(spec) is None

    def test_config_reports_the_missing_artifact_actionably(self, clean_env, monkeypatch):
        from backend.api import config

        monkeypatch.setattr(config, "MODEL_PATH", Path("/nonexistent/model.joblib"))
        monkeypatch.setattr(config, "MANIFEST_PATH", Path("/nonexistent/manifest.json"))

        with pytest.raises(RuntimeError) as excinfo:
            config.resolve_artifact_paths()

        message = str(excinfo.value)
        assert "model artifact" in message
        assert "RENDER_DEPLOYMENT_FIX" in message


class TestUnavailableModelIsReportedCleanly:
    """A missing artifact must be reported, never crash the endpoint."""

    def test_predict_reports_the_missing_model_without_a_server_error(
        self, monkeypatch, tmp_path
    ):
        from fastapi.testclient import TestClient

        from backend.api import config
        from backend.api.main import create_app

        # Isolate from any model loaded by earlier tests.
        config.model_state.clear()

        monkeypatch.setattr(config, "MODEL_PATH", tmp_path / "absent.joblib")
        monkeypatch.setattr(config, "MANIFEST_PATH", tmp_path / "absent.json")
        monkeypatch.delenv("MEDGUARD_MODEL_URL", raising=False)
        monkeypatch.delenv("MEDGUARD_MANIFEST_URL", raising=False)

        with TestClient(create_app(), raise_server_exceptions=False) as client:
            response = client.post(
                "/predict",
                json={"heart_rate": 88, "systolic_bp": 120, "diastolic_bp": 80,
                      "age": 45, "sex": "F"},
            )

        assert response.status_code == 200
        payload = response.json()
        assert payload["prediction"] is None
        assert payload["error"]["code"] == "MODEL_UNAVAILABLE"
        assert "Missing model artifact" in payload["error"]["detail"]

    def test_readyz_reports_503_with_the_reason(self, monkeypatch, tmp_path):
        from fastapi.testclient import TestClient

        from backend.api import config
        from backend.api.main import create_app

        # Isolate from any model loaded by earlier tests.
        config.model_state.clear()

        monkeypatch.setattr(config, "MODEL_PATH", tmp_path / "absent.joblib")
        monkeypatch.setattr(config, "MANIFEST_PATH", tmp_path / "absent.json")
        monkeypatch.delenv("MEDGUARD_MODEL_URL", raising=False)
        monkeypatch.delenv("MEDGUARD_MANIFEST_URL", raising=False)

        with TestClient(create_app(), raise_server_exceptions=False) as client:
            response = client.get("/readyz")

        assert response.status_code == 503
        detail = response.json()["detail"]
        assert detail["status"] in ("unavailable", "error")
        assert detail["reason"]
