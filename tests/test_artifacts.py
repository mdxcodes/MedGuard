"""Tests for model artifact discovery and delivery.

The artifact is delivered from disk or fetched from remote storage. A
fetched artifact must be verified against its expected digest before it is
used, and no placeholder model may ever be substituted.
"""

from __future__ import annotations

import hashlib
import os
from pathlib import Path

import pytest

from backend.ml import artifacts


@pytest.fixture
def clean_env(monkeypatch, tmp_path):
    """Remove every artifact environment variable and point the cache at tmp."""
    for name in (
        artifacts.MODEL_URL_ENV,
        artifacts.MODEL_SHA_ENV,
        artifacts.MANIFEST_URL_ENV,
        artifacts.MANIFEST_SHA_ENV,
    ):
        monkeypatch.delenv(name, raising=False)
    monkeypatch.setenv(artifacts.ARTIFACT_DIR_ENV, str(tmp_path / "cache"))
    return tmp_path


class TestLocalArtifact:
    def test_existing_local_file_is_used(self, clean_env, tmp_path):
        local = tmp_path / "model.joblib"
        local.write_bytes(b"artifact")
        assert artifacts.resolve_artifact(
            local, "model.joblib", artifacts.MODEL_URL_ENV, artifacts.MODEL_SHA_ENV
        ) == local

    def test_missing_file_without_a_url_returns_none(self, clean_env, tmp_path):
        missing = tmp_path / "model.joblib"
        assert artifacts.resolve_artifact(
            missing, "model.joblib", artifacts.MODEL_URL_ENV, artifacts.MODEL_SHA_ENV
        ) is None


class TestDigestVerification:
    def test_sha256_file_matches_hashlib(self, tmp_path):
        path = tmp_path / "blob.bin"
        payload = b"medguard-artifact-bytes" * 1000
        path.write_bytes(payload)
        expected = hashlib.sha256(payload).hexdigest()
        assert artifacts.sha256_file(path) == expected

    def test_download_rejects_a_digest_mismatch(self, clean_env, monkeypatch, tmp_path):
        monkeypatch.setenv(artifacts.MODEL_URL_ENV, "https://example.invalid/model.joblib")
        monkeypatch.setenv(artifacts.MODEL_SHA_ENV, "0" * 64)

        class _Response:
            def raise_for_status(self):
                return None

            def iter_bytes(self, chunk_size):
                yield b"corrupted-payload"

        class _Stream:
            def __enter__(self):
                return _Response()

            def __exit__(self, *exc):
                return False

        import httpx

        monkeypatch.setattr(httpx, "stream", lambda *a, **k: _Stream())

        with pytest.raises(artifacts.ArtifactError, match="digest mismatch"):
            artifacts.resolve_artifact(
                tmp_path / "absent.joblib",
                "model.joblib",
                artifacts.MODEL_URL_ENV,
                artifacts.MODEL_SHA_ENV,
            )

        # A rejected download must not leave a file behind that could be
        # mistaken for a verified artifact.
        cached = Path(os.environ[artifacts.ARTIFACT_DIR_ENV]) / "model.joblib"
        assert not cached.exists()

    def test_download_accepts_a_matching_digest(self, clean_env, monkeypatch, tmp_path):
        payload = b"verified-artifact-payload"
        digest = hashlib.sha256(payload).hexdigest()
        monkeypatch.setenv(artifacts.MODEL_URL_ENV, "https://example.invalid/model.joblib")
        monkeypatch.setenv(artifacts.MODEL_SHA_ENV, digest)

        class _Response:
            def raise_for_status(self):
                return None

            def iter_bytes(self, chunk_size):
                yield payload

        class _Stream:
            def __enter__(self):
                return _Response()

            def __exit__(self, *exc):
                return False

        import httpx

        monkeypatch.setattr(httpx, "stream", lambda *a, **k: _Stream())

        resolved = artifacts.resolve_artifact(
            tmp_path / "absent.joblib",
            "model.joblib",
            artifacts.MODEL_URL_ENV,
            artifacts.MODEL_SHA_ENV,
        )
        assert resolved is not None
        assert resolved.read_bytes() == payload
        assert artifacts.sha256_file(resolved) == digest


class TestSupabaseStorageAuth:
    """A private bucket needs the backend-only service-role key."""

    def test_supabase_url_gets_the_service_role_header(self, clean_env, monkeypatch):
        monkeypatch.setenv(artifacts.SUPABASE_URL_ENV, "https://project.supabase.co")
        monkeypatch.setenv(artifacts.SUPABASE_SERVICE_ROLE_ENV, "secret-key")
        headers = artifacts._auth_headers(
            "https://project.supabase.co/storage/v1/object/bucket/model.joblib"
        )
        assert headers["Authorization"] == "Bearer secret-key"
        assert headers["apikey"] == "secret-key"

    def test_a_foreign_host_gets_no_credentials(self, clean_env, monkeypatch):
        monkeypatch.setenv(artifacts.SUPABASE_URL_ENV, "https://project.supabase.co")
        monkeypatch.setenv(artifacts.SUPABASE_SERVICE_ROLE_ENV, "secret-key")
        assert artifacts._auth_headers("https://cdn.example.com/model.joblib") == {}

    def test_no_key_means_no_credentials(self, clean_env, monkeypatch):
        monkeypatch.setenv(artifacts.SUPABASE_URL_ENV, "https://project.supabase.co")
        monkeypatch.delenv(artifacts.SUPABASE_SERVICE_ROLE_ENV, raising=False)
        assert artifacts._auth_headers(
            "https://project.supabase.co/storage/v1/object/bucket/model.joblib"
        ) == {}


class TestCompressedArtifacts:
    """The artifact is stored xz-compressed to fit the Storage file limit."""

    def test_an_xz_payload_is_restored(self, clean_env, monkeypatch, tmp_path):
        import lzma

        payload = b"model-bytes" * 5000
        digest = hashlib.sha256(payload).hexdigest()
        archive = lzma.compress(payload)

        monkeypatch.setenv(artifacts.MODEL_URL_ENV, "https://example.invalid/model.joblib.xz")
        monkeypatch.setenv(artifacts.MODEL_SHA_ENV, digest)

        class _Response:
            def raise_for_status(self):
                return None

            def iter_bytes(self, chunk_size):
                yield archive

        class _Stream:
            def __enter__(self):
                return _Response()

            def __exit__(self, *exc):
                return False

        import httpx

        monkeypatch.setattr(httpx, "stream", lambda *a, **k: _Stream())

        resolved = artifacts.resolve_artifact(
            tmp_path / "absent.joblib",
            "model.joblib",
            artifacts.MODEL_URL_ENV,
            artifacts.MODEL_SHA_ENV,
        )
        assert resolved is not None
        assert resolved.read_bytes() == payload

    def test_the_digest_is_of_the_restored_file(self, clean_env, monkeypatch, tmp_path):
        import lzma

        payload = b"original-model-bytes"
        digest = hashlib.sha256(payload).hexdigest()
        archive = lzma.compress(payload)
        # The digest of the COMPRESSED bytes must NOT satisfy the check.
        compressed_digest = hashlib.sha256(archive).hexdigest()

        monkeypatch.setenv(artifacts.MODEL_URL_ENV, "https://example.invalid/model.joblib.xz")
        monkeypatch.setenv(artifacts.MODEL_SHA_ENV, compressed_digest)

        class _Response:
            def raise_for_status(self):
                return None

            def iter_bytes(self, chunk_size):
                yield archive

        class _Stream:
            def __enter__(self):
                return _Response()

            def __exit__(self, *exc):
                return False

        import httpx

        monkeypatch.setattr(httpx, "stream", lambda *a, **k: _Stream())

        with pytest.raises(artifacts.ArtifactError, match="digest mismatch"):
            artifacts.resolve_artifact(
                tmp_path / "absent.joblib",
                "model.joblib",
                artifacts.MODEL_URL_ENV,
                artifacts.MODEL_SHA_ENV,
            )


class TestNoDummySubstitution:
    def test_missing_artifact_never_yields_a_placeholder(self, clean_env, tmp_path):
        """A missing artifact must be reported as missing, not replaced."""
        resolved = artifacts.resolve_artifact(
            tmp_path / "absent.joblib",
            "model.joblib",
            artifacts.MODEL_URL_ENV,
            artifacts.MODEL_SHA_ENV,
        )
        assert resolved is None

    def test_config_reports_the_missing_artifact_actionably(self, clean_env, monkeypatch):
        from backend.api import config

        monkeypatch.setattr(config, "MODEL_PATH", Path("/nonexistent/model.joblib"))
        monkeypatch.setattr(config, "MANIFEST_PATH", Path("/nonexistent/manifest.json"))

        with pytest.raises(RuntimeError) as excinfo:
            config.resolve_artifact_paths()

        message = str(excinfo.value)
        assert "model artifact" in message
        assert "RENDER_DEPLOYMENT_FIX" in message
