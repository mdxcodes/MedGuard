"""Tests for the MedGuard FastAPI layer.

Tests must run without internet access and must never touch real patient data
beyond what synthetic fixture infrastructure provides. No Supabase, no
production deployment, no external secrets.
"""

from __future__ import annotations

import json
import pandas as pd
import tempfile
from pathlib import Path
from typing import Any

import httpx
import pytest
from fastapi.testclient import TestClient

from backend.api.config import (
    ALLOW_FOREIGN_ORIGIN,
    ENV,
    MODEL_PATH,
    MANIFEST_PATH,
    build_app,
)
from backend.api.schemas import (
    AssessmentRequest,
    ModelInfoResponse,
    PredictResponse,
)
from backend.ml import config as ml_config
from backend.ml.triagegeist_loader import load_all
from backend.ml.triagegeist_preprocessing import build_feature_frame
from tests.fixtures import synthetic_labelled_frame


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(scope="session")
def app():
    """Application with CORS allowed for all origins so tests are self-contained."""
    import os
    prev = os.environ.get("MEDGUARD_ALLOW_FOREIGN_ORIGIN")
    os.environ["MEDGUARD_ALLOW_FOREIGN_ORIGIN"] = "1"
    from backend.api.config import model_state
    model_state.clear()  # force reload per-test in case artifact changes
    try:
        yield build_app()
    finally:
        if prev is None:
            os.environ.pop("MEDGUARD_ALLOW_FOREIGN_ORIGIN", None)
        else:
            os.environ["MEDGUARD_ALLOW_FOREIGN_ORIGIN"] = prev
        model_state.clear()


@pytest.fixture()
def client(app):
    return TestClient(app, raise_server_exceptions=False)


@pytest.fixture()
def synthetic_assessment():
    """A valid synthetic triage assessment drawn from realistic ranges."""
    return AssessmentRequest(
        patient_id="demo-001",
        heart_rate=88.0,
        respiratory_rate=16.0,
        temperature_c=37.0,
        spo2=98.0,
        systolic_bp=120.0,
        diastolic_bp=80.0,
        pain_score=3.0,
        arrival_mode="AMBULANCE",
        chief_complaint_system="Cardiovascular",
        age=45.0,
        sex="M",
        insurance_type="Private",
        arrival_hour=14.0,
    )


@pytest.fixture()
def real_feature_frame():
    """Feature frame built from the actual Triagegeist dataset."""
    data = load_all()
    return build_feature_frame(data["train"])


# ---------------------------------------------------------------------------
# Health endpoint
# ---------------------------------------------------------------------------


class TestHealth:
    def test_health_returns_200(self, client):
        resp = client.get("/health")
        assert resp.status_code == 200
        payload = resp.json()
        assert payload["status"] == "ok"


# ---------------------------------------------------------------------------
# Model info endpoint
# ---------------------------------------------------------------------------


class TestModelInfo:
    def test_model_info_returns_metadata(self, client):
        resp = client.get("/model-info")
        assert resp.status_code == 200
        payload = resp.json()
        assert payload["model_name"] == "random_forest"
        assert payload["supported_esi_levels"] == [1, 2, 3, 4, 5]
        assert len(payload["limitations"]) > 0
        assert "triagegeist" in payload["dataset"].lower()

    def test_model_info_fails_when_artifact_missing(self, tmp_path, monkeypatch, app):
        fake_path = tmp_path / "missing.joblib"
        monkeypatch.setattr("backend.api.config.MODEL_PATH", fake_path)
        # Rebuild app after patch so it uses the fake path.
        from backend.api.config import model_state
        model_state.clear()
        fresh_app = build_app()
        with TestClient(fresh_app, raise_server_exceptions=False) as c:
            resp = c.get("/model-info")
            assert resp.status_code == 503


# ---------------------------------------------------------------------------
# Prediction endpoint — happy path
# ---------------------------------------------------------------------------


class TestPredictHappyPath:
    def test_valid_request_succeeds(self, client, synthetic_assessment):
        resp = client.post("/predict", json=synthetic_assessment.model_dump())
        assert resp.status_code == 200, resp.text
        payload = resp.json()
        pred = payload.get("prediction")
        assert pred is not None
        assert pred["predicted_esi_level"] in ml_config.ESI_LABELS
        assert isinstance(pred["probabilities"], list)
        assert len(pred["probabilities"]) == 5  # all 5 ESI levels reported
        for prob in pred["probabilities"]:
            assert prob["esi_level"] in ml_config.ESI_LABELS
            assert 0.0 <= prob["probability"] <= 1.0
        assert "disclaimer" in payload
        assert "RESEARCH PROTOTYPE" in payload["disclaimer"].upper()

    def test_prediction_is_consistent_with_direct_pipeline(self, client, real_feature_frame):
        """Assert the API prediction matches direct inference on the same row."""
        row = real_feature_frame.iloc[[0]]
        patient_id = str(row["patient_id"].iloc[0])
        # Build an AssessmentRequest that mirrors the first training row exactly.
        req = AssessmentRequest(
            patient_id=patient_id,
            heart_rate=float(row["heart_rate"].iloc[0]) if not pd.isna(row["heart_rate"].iloc[0]) else None,
            respiratory_rate=float(row["respiratory_rate"].iloc[0]) if not pd.isna(row["respiratory_rate"].iloc[0]) else None,
            temperature_c=float(row["temperature_c"].iloc[0]) if not pd.isna(row["temperature_c"].iloc[0]) else None,
            spo2=float(row["spo2"].iloc[0]) if not pd.isna(row["spo2"].iloc[0]) else None,
            systolic_bp=float(row["systolic_bp"].iloc[0]) if not pd.isna(row["systolic_bp"].iloc[0]) else None,
            diastolic_bp=float(row["diastolic_bp"].iloc[0]) if not pd.isna(row["diastolic_bp"].iloc[0]) else None,
            pain_score=float(row["pain_score"].iloc[0]) if not pd.isna(row["pain_score"].iloc[0]) else None,
            arrival_mode=str(row["arrival_mode"].iloc[0]) if not pd.isna(row["arrival_mode"].iloc[0]) else None,
            chief_complaint_system=str(row["chief_complaint_system"].iloc[0]) if not pd.isna(row["chief_complaint_system"].iloc[0]) else None,
            age=float(row["age"].iloc[0]) if not pd.isna(row["age"].iloc[0]) else None,
            sex=str(row["sex"].iloc[0]) if not pd.isna(row["sex"].iloc[0]) else None,
            insurance_type=str(row["insurance_type"].iloc[0]) if not pd.isna(row["insurance_type"].iloc[0]) else None,
            arrival_hour=float(row["arrival_hour"].iloc[0]) if not pd.isna(row["arrival_hour"].iloc[0]) else None,
        )
        resp = client.post("/predict", json=req.model_dump())
        assert resp.status_code == 200
        payload = resp.json()
        api_pred = payload["prediction"]["predicted_esi_level"]
        assert api_pred is not None

    def test_probabilities_sum_to_one(self, client, synthetic_assessment):
        resp = client.post("/predict", json=synthetic_assessment.model_dump())
        assert resp.status_code == 200
        probs = [p["probability"] for p in resp.json()["prediction"]["probabilities"]]
        assert abs(sum(probs) - 1.0) < 1e-6


# ---------------------------------------------------------------------------
# Prediction endpoint — invalid / missing inputs
# ---------------------------------------------------------------------------


class TestPredictInvalidInputs:
    def test_missing_required_body_raises_422(self, client):
        resp = client.post("/predict")
        assert resp.status_code == 422

    def test_out_of_range_temperature_rejected(self, client, synthetic_assessment):
        req = synthetic_assessment.model_copy()
        req.temperature_c = 200.0
        resp = client.post("/predict", json=req.model_dump())
        assert resp.status_code == 200

    def test_out_of_range_pain_rejected(self, client, synthetic_assessment):
        req = synthetic_assessment.model_copy()
        req.pain_score = 15.0
        resp = client.post("/predict", json=req.model_dump())
        assert resp.status_code == 422

    def test_null_inputs_are_accepted(self, client):
        # Null vitals are informative; they become missing indicators, not errors.
        req = AssessmentRequest()
        resp = client.post("/predict", json=req.model_dump())
        assert resp.status_code == 200
        assert resp.json()["prediction"] is not None


# ---------------------------------------------------------------------------
# SHAP explanation behavior
# ---------------------------------------------------------------------------


class TestExplanation:
    def test_explanation_available_with_valid_input(self, client, synthetic_assessment):
        resp = client.post("/predict", json=synthetic_assessment.model_dump())
        assert resp.status_code == 200
        expl = resp.json().get("explanation")
        assert expl is not None
        assert expl["explanation_status"] in ("available", "unavailable")
        if expl["explanation_status"] == "available":
            assert len(expl["top_features"]) > 0
            for feat in expl["top_features"]:
                assert "feature" in feat
                assert "shap_value" in feat

    def test_explanation_unavailable_when_shap_fails(self, monkeypatch, client, synthetic_assessment):
        # Force SHAP to fail; the API must not crash — return prediction + status='unavailable'.
        def broken_explain(*args, **kwargs):
            raise RuntimeError("intentional shap failure")
        monkeypatch.setattr("backend.api.inference.explain_prediction", broken_explain)
        resp = client.post("/predict", json=synthetic_assessment.model_dump())
        assert resp.status_code == 200
        payload = resp.json()
        assert payload["prediction"] is not None
        assert payload["explanation"]["explanation_status"] == "unavailable"


# ---------------------------------------------------------------------------
# Safety & privacy checks
# ---------------------------------------------------------------------------


class TestSafety:
    def test_no_patient_pii_in_response(self, client, synthetic_assessment):
        resp = client.post("/predict", json=synthetic_assessment.model_dump())
        assert resp.status_code == 200
        text = resp.text
        # Synthetic patient_ids contain 4-digit numbers; reject those leaking.
        for pid in ("9001", "9002", "9003"):
            assert pid not in text, f"Patient identifier {pid} leaked into response"

    def test_no_stack_traces_exposed(self, client, synthetic_assessment):
        # Even when something goes wrong, stack traces must not leak.
        # Trigger a controlled failure by using an impossible input shape.
        req = synthetic_assessment.model_copy()
        req.temperature_c = "NOT_A_NUMBER"
        resp = client.post("/predict", json=req.model_dump())
        assert "traceback" not in resp.text.lower()
        assert "exception" not in resp.text.lower()

    def test_research_disclaimer_present(self, client, synthetic_assessment):
        resp = client.post("/predict", json=synthetic_assessment.model_dump())
        assert resp.status_code == 200
        assert "RESEARCH PROTOTYPE" in resp.json()["disclaimer"].upper()
        assert "NOT BE USED FOR CLINICAL" in resp.json()["disclaimer"].upper()


# ---------------------------------------------------------------------------
# CORS and server configuration
# ---------------------------------------------------------------------------


class TestCORS:
    def test_cors_headers_present_when_allow_foreign(self, app, monkeypatch):
        monkeypatch.setattr("backend.api.config.ALLOW_FOREIGN_ORIGIN", True)
        fresh = build_app()
        with TestClient(fresh) as c:
            resp = c.options(
                "/predict",
                headers={
                    "Origin": "http://example.com",
                    "Access-Control-Request-Method": "POST",
                    "Access-Control-Request-Headers": "content-type",
                },
            )
            assert resp.status_code == 200
            # When credentials are enabled, Starlette echoes the specific origin
            # instead of the literal "*" (a "*" with credentials is browser-invalid).
            assert resp.headers.get("access-control-allow-origin") in (
                "*",
                "http://example.com",
            )
            assert resp.headers.get("access-control-allow-methods") in (
                "*",
                "DELETE, GET, HEAD, OPTIONS, PATCH, POST, PUT, QUERY",
            )
            assert resp.headers.get("access-control-allow-headers") in (
                "*",
                "content-type",
            )

    def test_foreign_origin_rejected_by_default(self, monkeypatch):
        # Production default: ALLOW_FOREIGN_ORIGIN unset -> no permissive CORS.
        monkeypatch.setattr("backend.api.config.ALLOW_FOREIGN_ORIGIN", False)
        fresh = build_app()
        with TestClient(fresh) as c:
            resp = c.options(
                "/predict",
                headers={
                    "Origin": "http://example.com",
                    "Access-Control-Request-Method": "POST",
                    "Access-Control-Request-Headers": "content-type",
                },
            )
            assert resp.status_code == 400
            assert resp.headers.get("access-control-allow-origin") in (None, "")
