"""MedGuard FastAPI application.

Routes
------
GET  /health
    Service liveness. Returns 200 when the process is running; the model
    artifact is *not* required for this endpoint so that orchestrators can
    distinguish process failures from configuration failures.

GET  /model-info
    Returns manifest metadata (model name, version, supported ESI levels,
    training dataset, and known limitations). Returns 503 if the artifact
    is missing or the sanity check failed.

POST /predict
    Accepts an ``AssessmentRequest``, runs the saved preprocessing + model
    pipeline, and returns a ``PredictResponse`` with prediction + optional
    SHAP explanation.

App construction
----------------
``create_app()`` builds a *fresh* application on every call rather than
returning a module-level singleton. This lets tests and deployments select
CORS policy and artifact paths through environment or monkeypatched
configuration *at construction time*: the CORS middleware is added from the
current ``backend.api.config.ALLOW_FOREIGN_ORIGIN`` value, so monkeypatching
that attribute before calling ``build_app()`` is honoured. The production
default (``ALLOW_FOREIGN_ORIGIN`` unset) still adds an empty allow-list, so
arbitrary origins are never trusted by default.
"""

from __future__ import annotations

import logging
import time
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware

from backend.api import config as api_config
from backend.api.inference import predict
from backend.ml import persistence
try:
    from backend.api.report_endpoint import export_research_report
except Exception:
    export_research_report = None
try:
    from backend.api.registry_endpoint import list_model_versions, get_model_version
except Exception:
    list_model_versions = None
    get_model_version = None
try:
    from backend.api.experiment_endpoint import run_new_experiment, list_exps, get_exp
except Exception:
    run_new_experiment = None; list_exps = None; get_exp = None
try:
    from backend.api.triagegeist_endpoint import triagegeist_status
except Exception:
    triagegeist_status = None
try:
    from backend.api.metrics_endpoint import metrics_status
except Exception:
    metrics_status = None
from backend.api.schemas import AssessmentRequest, ModelInfoResponse, PredictResponse

log = logging.getLogger("medguard.api.main")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    # Warm the model on startup so that /model-info reflects readiness.
    try:
        from backend.api.config import load_model_if_needed
        load_model_if_needed()
        log.info("Model loaded at startup.")
    except RuntimeError as exc:
        log.warning("Model not available at startup: %s", exc)
    yield
    log.info("Shutting down MedGuard API.")


def _limitations_for(manifest) -> list[str]:
    """Build the published limitation list from the model manifest.

    The class-support statement is derived from the recorded training
    distribution so it cannot drift away from the data the model was fitted
    on.
    """
    limitations = [
        "Synthetic dataset only.",
        "This model is a research prototype and is NOT clinically validated.",
        "Not suitable for real clinical triage decisions.",
    ]
    distribution = getattr(manifest, "class_distribution", None) or {}
    if distribution:
        total = sum(distribution.values())
        rarest = min(distribution, key=distribution.get)
        commonest = max(distribution, key=distribution.get)
        limitations.insert(
            1,
            f"All {len(distribution)} ESI levels are present in the training "
            f"cohort. {rarest} is the rarest level "
            f"({distribution[rarest]} of {total} rows, "
            f"{distribution[rarest] / total * 100:.1f}%) and {commonest} the "
            f"most common, so predictions for the rare level are the least "
            "certain.",
        )
    else:
        limitations.insert(
            1,
            "The per-class support of the training cohort is not recorded in "
            "the manifest, so per-level reliability cannot be asserted.",
        )
    return limitations


def _store_assessment(
    request: AssessmentRequest,
    response,
    owner: str,
    duration_ms: int,
) -> tuple[str, Optional[str]]:
    """Store an assessment and its prediction. Returns (status, id)."""
    if not persistence.persistence_configured():
        return "not_configured", None
    if not owner:
        # Without an owner token the record could not be scoped to a caller,
        # so it is not written rather than written to a shared bucket.
        return "no_owner", None
    if response.error is not None or response.prediction is None:
        # Only a real prediction is worth storing.
        return "not_configured", None

    try:
        from backend.api.config import model_state

        manifest = model_state.get("manifest")
        inputs = {
            name: getattr(request, name)
            for name in request.model_fields
            if getattr(request, name, None) is not None
        }
        missing = [
            name
            for name in request.model_fields
            if getattr(request, name, None) is None
        ]
        store = persistence.AssessmentStore()
        assessment_id = store.record_assessment(
            {
                "owner_token": owner,
                "surface": "patient",
                "inputs": inputs,
                "missing_inputs": missing,
                "model_name": getattr(manifest, "model_name", None),
                "model_version": getattr(manifest, "created_utc", None),
                "predicted_esi_level": response.prediction.predicted_esi_level,
                "probabilities": {
                    str(item.esi_level): item.probability
                    for item in response.prediction.probabilities
                },
                "explanation": (
                    response.explanation.model_dump() if response.explanation else None
                ),
                "quality": response.quality.model_dump() if response.quality else None,
                "uncertainty": response.uncertainty.model_dump() if response.uncertainty else None,
                "input_warnings": len(response.quality.warnings) if response.quality else 0,
                "duration_ms": duration_ms,
            }
        )
        return ("saved", assessment_id) if assessment_id else ("failed", None)
    except Exception as exc:  # noqa: BLE001
        log.warning("Could not store the assessment: %s", exc)
        return "failed", None


def create_app() -> FastAPI:
    """Construct a fresh MedGuard FastAPI application.

    The app is built per call (not returned as a singleton) so that CORS and
    artifact configuration are applied from the *current* configuration state
    at construction time. The production default leaves ``allow_origins``
    empty, so cross-origin requests are rejected unless
    ``MEDGUARD_ALLOW_FOREIGN_ORIGIN=1`` is explicitly set.
    """
    app = FastAPI(
        title="MedGuard (Triage One)",
        description=(
            "Research prototype for AI-assisted emergency triage. This service "
            "is NOT clinically validated and must NOT be used for real-time "
            "patient triage."
        ),
        version="0.2.0-demo",
        lifespan=lifespan,
    )

    # CORS: the exact origins listed in MEDGUARD_CORS_ORIGINS (the deployed
    # Vercel frontend and its previews), or "*" for local development.
    # Credentialed requests are never combined with a wildcard origin.
    allow_origins = api_config.CORS_ORIGINS
    allow_credentials = True
    if api_config.ALLOW_FOREIGN_ORIGIN:
        allow_origins = ["*"]
        allow_credentials = False
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allow_origins,
        allow_origin_regex=api_config.CORS_ORIGIN_REGEX,
        allow_credentials=allow_credentials,
        # Methods and headers are not an access-control boundary; the origin
        # list is. Keeping them permissive avoids breaking clients that add
        # their own headers.
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health")
    def health() -> dict[str, str]:
        """Liveness probe. Always 200 as long as the process is up."""
        return {"status": "ok"}

    @app.get("/readyz")
    def readyz():
        """Readiness probe: can the service actually serve a prediction?

        Unlike ``/health`` (process liveness) this verifies that the model
        artifact is present, valid and compatible, and that it has actually
        loaded. A download, validation, compatibility or memory failure is
        reported as a failure with its cause - it is never reported as
        readiness, and no dummy model is ever substituted.
        """
        from backend.api.config import get_or_raise_model, model_status

        try:
            _, manifest, feature_names = get_or_raise_model()
        except RuntimeError as exc:
            state = model_status()
            raise HTTPException(
                status_code=503,
                detail={"status": state["status"], "reason": str(exc)},
            ) from exc
        return {
            "status": "ready",
            "model": manifest.model_name,
            "dataset": manifest.dataset,
            "features": len(feature_names),
        }

    @app.get("/model-info", response_model=ModelInfoResponse)
    def model_info() -> ModelInfoResponse:
        """Expose the loaded model's manifest and known limitations."""
        from backend.api.config import get_or_raise_model

        try:
            _, manifest, _ = get_or_raise_model()
        except RuntimeError as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc

        return ModelInfoResponse(
            model_name=manifest.model_name,
            model_kind=manifest.model_kind,
            target=manifest.target,
            supported_esi_levels=manifest.esi_labels,
            training_rows=manifest.training_rows,
            training_patients=manifest.training_patients,
            random_seed=manifest.random_seed,
            dataset=manifest.dataset,
            created_utc=manifest.created_utc,
            limitations=_limitations_for(manifest),
            note=manifest.note,
        )

    # --- Assessment history ------------------------------------------------
    # The browser never talks to the database directly. It presents an
    # opaque owner token and the backend scopes every query to it, so one
    # caller can never see another caller's history.
    def _owner_token(request: Request) -> str:
        return (request.headers.get(persistence.OWNER_HEADER) or "").strip()

    @app.get("/history")
    def history(request: Request, limit: int = 50, offset: int = 0):
        """Return the caller's stored assessments, newest first."""
        owner = _owner_token(request)
        if not owner:
            return {"status": "no_owner", "assessments": [], "count": 0}
        store = persistence.AssessmentStore()
        if not store.enabled:
            return {"status": "not_configured", "assessments": [], "count": 0}
        try:
            rows = store.list_assessments(owner, limit=min(limit, 200), offset=max(offset, 0))
        except persistence.PersistenceError as exc:
            log.warning("Could not read assessment history: %s", exc)
            return {"status": "error", "assessments": [], "count": 0}
        return {"status": "ok", "assessments": rows, "count": len(rows)}

    @app.get("/history/{assessment_id}")
    def history_item(assessment_id: str, request: Request):
        """Return one stored assessment owned by the caller."""
        owner = _owner_token(request)
        if not owner:
            raise HTTPException(status_code=400, detail="missing owner token")
        store = persistence.AssessmentStore()
        if not store.enabled:
            raise HTTPException(status_code=503, detail="persistence is not configured")
        try:
            row = store.get_assessment(owner, assessment_id)
        except persistence.PersistenceError as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc
        if row is None:
            raise HTTPException(status_code=404, detail="assessment not found")
        return row

    @app.get("/history-status")
    def history_status():
        """Report whether history storage is configured on this service."""
        return {"enabled": persistence.persistence_configured(), "table": "assessments"}

    @app.get("/models/versions")
    def models_versions():
        if list_model_versions is None: raise HTTPException(status_code=500, detail="registry unavailable")
        return list_model_versions()

    @app.get("/models/active")
    def models_active():
        if get_model_version is None: raise HTTPException(status_code=500, detail="registry unavailable")
        return get_model_version()

    @app.post("/experiments/run")
    def exp_run(payload: dict = None):
        if run_new_experiment is None: raise HTTPException(status_code=500, detail="unavailable")
        return run_new_experiment(payload or {})

    @app.get("/experiments")
    def exp_list():
        if list_exps is None: raise HTTPException(status_code=500, detail="unavailable")
        return list_exps()

    @app.get("/experiments/{exp_id}")
    def exp_get(exp_id: str):
        if get_exp is None: raise HTTPException(status_code=500, detail="unavailable")
        return get_exp(exp_id)

    @app.get("/triagegeist/status")
    def triagegeist_status_endpoint():
        if triagegeist_status is None:
            raise HTTPException(status_code=500, detail="Triagegeist endpoint not available")
        return triagegeist_status()

    @app.get("/metrics")
    def metrics_endpoint():
        if metrics_status is None:
            raise HTTPException(status_code=500, detail="Metrics endpoint not available")
        return metrics_status()

    @app.get("/export/report")
    def export_report():
        if export_research_report is None:
            raise HTTPException(status_code=500, detail="Report export not available")
        return export_research_report()

    @app.post("/predict", response_model=PredictResponse, status_code=200)
    def predict_endpoint(
        request: AssessmentRequest,
        http_request: Request,
    ) -> PredictResponse:
        """Predict ESI acuity from the supplied triage assessment.

        The assessment and its prediction are stored so the caller can see
        their own history. Storage is best effort: a storage failure is
        reported in the response but never turns a successful prediction into a
        failed request, because the prediction itself did succeed.
        """
        started = time.perf_counter()
        response = predict(request)
        duration_ms = int((time.perf_counter() - started) * 1000)

        owner = (http_request.headers.get(persistence.OWNER_HEADER) or "").strip()
        response.persistence, response.assessment_id = _store_assessment(
            request, response, owner, duration_ms
        )
        return response

    return app


#: Module-level application for ``uvicorn backend.api.main:app``.
app = create_app()

__all__ = ["app", "create_app"]