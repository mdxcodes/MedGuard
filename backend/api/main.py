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
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from backend.api.config import ALLOW_FOREIGN_ORIGIN, build_app
from backend.api.inference import predict
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
    allow_origins=["*"] if ALLOW_FOREIGN_ORIGIN else [],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    """Liveness probe. Always 200 as long as the process is up."""
    return {"status": "ok"}


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
        note=manifest.note,
    )


@app.post("/predict", response_model=PredictResponse, status_code=200)
def predict_endpoint(request: AssessmentRequest) -> PredictResponse:
    """Predict ESI acuity from the supplied triage assessment."""
    return predict(request)


# Re-export for callers that do `from backend.api.main import app`.
__all__ = ["app"]
