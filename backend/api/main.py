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
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from backend.api import config as api_config
from backend.api.inference import predict
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

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"] if api_config.ALLOW_FOREIGN_ORIGIN else [],
        allow_credentials=True,
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
        artifact is present and loadable. It is cheap once the model has been
        loaded: the artifact is cached in process state and the check reuses
        it, so no expensive SHAP or evaluation work is performed.
        """
        from backend.api.config import get_or_raise_model

        try:
            _, manifest, feature_names = get_or_raise_model()
        except RuntimeError as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc
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
    def predict_endpoint(request: AssessmentRequest) -> PredictResponse:
        """Predict ESI acuity from the supplied triage assessment."""
        return predict(request)

    return app


#: Module-level application for ``uvicorn backend.api.main:app``.
app = create_app()

__all__ = ["app", "create_app"]