"""Tests for assessment and prediction persistence.

The store is exercised against a mocked Supabase REST API: no test touches a
real project, and no test writes a record.
"""

from __future__ import annotations

import json

import pytest

from backend.ml import persistence


@pytest.fixture
def clean_env(monkeypatch):
    for name in (
        persistence.SUPABASE_URL_ENV,
        persistence.SUPABASE_SECRET_KEY_ENV,
        persistence.SUPABASE_SERVICE_ROLE_ENV,
    ):
        monkeypatch.delenv(name, raising=False)
    return monkeypatch


class _Recorder:
    """Records the requests a store makes and replies with canned data."""

    def __init__(self, responses=None):
        self.requests = []
        self.responses = responses or {}

    def __call__(self, method, url, **kwargs):
        self.requests.append({"method": method, "url": url, **kwargs})
        for fragment, payload in self.responses.items():
            if fragment in url:
                if isinstance(payload, Exception):
                    raise payload
                return _Response(payload)
        return _Response([])

    def bodies(self):
        out = []
        for r in self.requests:
            body = r.get("json")
            if body is None:
                continue
            if isinstance(body, str):
                out.append(json.loads(body))
            else:
                out.append(body)
        return out


class _Response:
    def __init__(self, payload, status=200):
        self.payload = payload
        self.status_code = status
        self.content = json.dumps(payload).encode() if payload is not None else b""
        self.text = self.content.decode()

    def json(self):
        return self.payload

    def raise_for_status(self):
        return None


@pytest.fixture
def store(monkeypatch):
    """A store with a mocked transport."""
    recorder = _Recorder()
    import httpx

    monkeypatch.setattr(httpx, "request", recorder)
    monkeypatch.setenv(persistence.SUPABASE_URL_ENV, "https://project.supabase.co")
    monkeypatch.setenv(persistence.SUPABASE_SECRET_KEY_ENV, "server-only-key")
    instance = persistence.AssessmentStore()
    instance.recorder = recorder
    return instance


class TestConfiguration:
    def test_persistence_is_off_when_nothing_is_configured(self, clean_env):
        assert persistence.persistence_configured() is False
        assert persistence.AssessmentStore().enabled is False

    def test_persistence_is_on_with_a_url_and_a_key(self, clean_env):
        clean_env.setenv(persistence.SUPABASE_URL_ENV, "https://project.supabase.co")
        clean_env.setenv(persistence.SUPABASE_SECRET_KEY_ENV, "key")
        assert persistence.persistence_configured() is True

    def test_the_service_role_key_is_accepted_as_a_fallback(self, clean_env):
        clean_env.setenv(persistence.SUPABASE_URL_ENV, "https://project.supabase.co")
        clean_env.setenv(persistence.SUPABASE_SERVICE_ROLE_ENV, "key")
        assert persistence.persistence_configured() is True


class TestRecording:
    def _record(self):
        return {
            "owner_token": "owner-abc",
            "surface": "patient",
            "inputs": {"heart_rate": 88, "age": 45},
            "missing_inputs": ["spo2"],
            "model_name": "random_forest",
            "model_version": "2026-10-21",
            "predicted_esi_level": 4,
            "probabilities": {"1": 0.0, "4": 0.56},
            "explanation": {"top_features": []},
            "quality": {"has_errors": False},
            "uncertainty": {"max_prob": 0.56},
            "input_warnings": 1,
            "duration_ms": 42,
        }

    def test_an_assessment_and_its_prediction_are_written(self, store, monkeypatch):
        store.recorder.responses = {
            "/rest/v1/assessments": [{"id": "row-1"}],
            "/rest/v1/predictions": [{"id": "pred-1"}],
        }
        assessment_id = store.record_assessment(self._record())
        assert assessment_id == "row-1"

        urls = [r["url"] for r in store.recorder.requests]
        assert any(u.endswith("/rest/v1/assessments") for u in urls)
        assert any(u.endswith("/rest/v1/predictions") for u in urls)

        bodies = store.recorder.bodies()
        assert bodies[0]["owner_token"] == "owner-abc"
        assert bodies[0]["predicted_esi_level"] == 4
        assert bodies[0]["missing_inputs"] == ["spo2"]
        # The prediction references the assessment.
        assert bodies[1]["assessment_id"] == "row-1"
        assert bodies[1]["predicted_esi_level"] == 4

    def test_the_server_key_is_used_for_server_side_auth(self, store):
        store.recorder.responses = {"/rest/v1/assessments": [{"id": "row-1"}]}
        store.record_assessment(self._record())
        # The store authenticates to Supabase with the server-side key. The
        # key must appear in the outbound request headers (it never reaches
        # the browser — the browser talks to the FastAPI endpoint, not to
        # Supabase directly).
        found = False
        for request in store.recorder.requests:
            headers = json.dumps(request.get("headers", {}))
            if "server-only-key" in headers:
                found = True
        assert found, "server key must be present in outbound Supabase request"


class TestOwnership:
    def test_history_is_scoped_to_the_owner(self, store):
        store.recorder.responses = {
            "/rest/v1/assessments": [{"id": "row-1", "created_at": "2026-10-22T10:00:00Z"}],
        }
        rows = store.list_assessments("owner-abc", limit=10)
        assert len(rows) == 1
        params = store.recorder.requests[0]["params"]
        assert params["owner_token"] == "eq.owner-abc"

    def test_a_record_belonging_to_another_owner_is_not_returned(self, store):
        store.recorder.responses = {"/rest/v1/assessments": []}
        assert store.get_assessment("owner-abc", "someone-elses-row") is None
        params = store.recorder.requests[0]["params"]
        # Both the id and the owner are constrained.
        assert params["id"] == "eq.someone-elses-row"
        assert params["owner_token"] == "eq.owner-abc"

    def test_no_owner_token_means_no_rows(self, store):
        assert store.list_assessments("") == []
        assert store.get_assessment("", "row-1") is None
        assert store.count_assessments("") == 0


class TestFailures:
    def test_a_database_error_is_reported_not_swallowed(self, store, monkeypatch):
        import httpx

        def failing(method, url, **kwargs):
            raise RuntimeError("connection refused")

        monkeypatch.setattr(httpx, "request", failing)
        with pytest.raises(persistence.PersistenceError):
            store.list_assessments("owner-abc")

    def test_an_http_error_is_reported(self, store, monkeypatch):
        import httpx

        def failing(method, url, **kwargs):
            return _Response({"message": "permission denied"}, status=403)

        monkeypatch.setattr(httpx, "request", failing)
        with pytest.raises(persistence.PersistenceError, match="403"):
            store.list_assessments("owner-abc")

    def test_writing_without_a_configuration_is_refused(self, clean_env):
        instance = persistence.AssessmentStore()
        with pytest.raises(persistence.PersistenceError):
            instance.record_assessment({"owner_token": "x"})


class TestHistoryEndpoints:
    """The HTTP surface: ownership is enforced, and the browser never talks
    to the database itself."""

    @pytest.fixture
    def client(self, monkeypatch):
        from fastapi.testclient import TestClient

        from backend.api.main import create_app

        recorder = _Recorder({
            "/rest/v1/assessments": [
                {
                    "id": "row-1",
                    "created_at": "2026-10-22T10:00:00Z",
                    "owner_token": "owner-abc",
                    "predicted_esi_level": 4,
                    "inputs": {"heart_rate": 88},
                    "missing_inputs": [],
                    "model_name": "random_forest",
                }
            ],
        })
        import httpx

        monkeypatch.setattr(httpx, "request", recorder)
        monkeypatch.setenv(persistence.SUPABASE_URL_ENV, "https://project.supabase.co")
        monkeypatch.setenv(persistence.SUPABASE_SECRET_KEY_ENV, "server-only-key")
        return TestClient(create_app()), recorder

    def test_history_returns_the_callers_records(self, client):
        test_client, _ = client
        response = test_client.get(
            "/history", headers={persistence.OWNER_HEADER: "owner-abc"}
        )
        assert response.status_code == 200
        body = response.json()
        assert body["status"] == "ok"
        assert body["count"] == 1
        assert body["assessments"][0]["id"] == "row-1"

    def test_history_without_an_owner_token_is_empty(self, client):
        test_client, _ = client
        response = test_client.get("/history")
        assert response.status_code == 200
        assert response.json()["status"] == "no_owner"
        assert response.json()["assessments"] == []

    def test_history_status_reports_whether_storage_is_configured(self, client):
        test_client, _ = client
        response = test_client.get("/history-status")
        assert response.status_code == 200
        assert response.json()["enabled"] is True
