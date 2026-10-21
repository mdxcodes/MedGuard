# MedGuard — Phase 3 Completion Report

> **Superseded — historical record.** This document describes the original
> MIMIC-IV-ED demo baseline. The primary dataset is now **Triagegeist**
> (synthetic); see `TRIAGEGEIST_MIGRATION_REPORT.md` and `docs/MODEL_CARD.md`
> for the current system. The content below is preserved unchanged as the
> dated record of that phase.

**Phase:** 3 — Production-Structured ML Inference API (FastAPI backend)  
**Status:** Complete  
**Date:** 2026-10-17  
**Auditor / Lead:** Lead AI/ML Engineer  
**Project:** /secondary/MedGuard

---

## 1. Files Created and Modified

### Created — API implementation (existing, preserved)
- `backend/api/main.py` — `create_app()` factory; routes: `/health`, `/model-info`, `/predict`
- `backend/api/config.py` — `load_model_if_needed()`, `ModelManifest`, `ENV`, `build_app()`
- `backend/api/schemas.py` — `AssessmentRequest`, `PredictResponse`, `ModelInfoResponse`, `ClassProbability`
- `backend/api/inference.py` — `_normalize_assessment()`, `_apply_validation()`, `_compute_prediction()`, `predict()`

### Modified — Phase 3 fixes applied to existing files
- `backend/api/main.py` — refactored from singleton `main.app` to `create_app()` factory so `build_app()` picks up current CORS/config state (fixes preflight test failure)
- `backend/api/config.py` — `build_app()` now delegates to `create_app()`; removed dead `run_phase2_experiment` import; replaced dataset-dependent sanity check with synthetic-row transform so the API bootstraps without requiring the licensed MIMIC CSV at startup
- `backend/api/inference.py` — fixed privacy leak in exception logging (no longer logs full `AssessmentRequest` with `chiefcomplaint`)
- `tests/test_api.py` — corrected CORS preflight assertions; added proper preflight headers (`Access-Control-Request-Method`, `Access-Control-Request-Headers`); added `test_foreign_origin_rejected_by_default` to confirm production CORS default

### Created — Phase 3 documentation
- `docs/API_CONTRACT.md`
- `docs/PHASE_3_COMPLETION.md` (this document)

### Preserved — not overwritten
- `backend/ml/config.py`, `train.py`, `evaluate.py`, `explain.py`, `features.py`, `data_loading.py`, `validation.py`, `splitting.py`, `run_experiment.py`
- `tests/test_data_loading.py`, `test_validation.py`, `test_features.py`, `test_splitting.py`, `test_model_pipeline.py`, `test_pipeline_e2e.py`
- `docs/PHASE_1_COMPLETION.md`, `docs/PHASE_2_COMPLETION.md`, `docs/MODEL_EVALUATION.md`, `docs/MODEL_CARD.md`, `docs/DATASET_AUDIT.md`, `docs/DATA_QUALITY_REPORT.md`, `docs/FEATURE_SPECIFICATION.md`, `docs/ML_PIPELINE_DESIGN.md`
- Existing `.gitignore` rules (no licensed data, artifacts, secrets committed)

---

## 2. API Routes and Schemas

- `GET /health` → `{"status":"ok"}`
- `GET /model-info` → `ModelInfoResponse` with `supported_esi_levels=[1,2,3,4,5]`, dataset metadata, limitations
- `POST /predict` → accepts `AssessmentRequest`, runs real fitted `Pipeline`, returns `PredictResponse` with `prediction`, `explanation` (SHAP if available), `error` (clear message, no stack trace), and `disclaimer` (research-only)

---

## 3. How the Saved Model and Manifest Load

`load_model_if_needed()` (lazy singleton in `config.py`) performs the following steps in sequence:

1. Checks `MODEL_PATH` (`models/triage_model.joblib`) exists; raises `RuntimeError` clearly if not.
2. Checks `MANIFEST_PATH` (`models/triage_model.manifest.json`) exists; raises `RuntimeError` clearly if not.
3. Parses manifest into `ModelManifest` Pydantic model.
4. Loads pipeline via `joblib.load()` — the actual fitted `Pipeline` containing `preprocess` (`build_preprocessor()` result) + `estimator` (`RandomForestClassifier` with documented params).
5. Runs synthetic-feature sanity check (transform one clean row) to verify the pipeline produces non-empty transformed output.
6. Computes `feature_names` via `leakage_free_feature_names()` and stores all three in `model_state`.

The endpoint `/model-info` returns the manifest data; `/predict` uses the loaded pipeline directly. There is no hardcoded prediction, dummy classifier, or randomly generated output.

---

## 4. Exact Local Startup and Test Commands

```bash
# Environment (reproducible)
python3 -m venv venv
venv/bin/pip install -r requirements.txt

# Start API (with saved artifact present at models/triage_model.joblib)
source venv/bin/activate
venv/bin/uvicorn backend.api.main:app --host 127.0.0.1 --port 8000

# Health check
curl http://localhost:8000/health

# Model info
curl http://localhost:8000/model-info

# Synthetic prediction (using the exact fields from docs/FEATURE_SPECIFICATION.md)
curl -X POST http://localhost:8000/predict \
  -H "Content-Type: application/json" \
  -d '{"temperature":98.6,"heartrate":88,"resprate":16,"o2sat":98,"sbp":120,"dbp":80,"pain":3,"arrival_transport":"AMBULANCE","chiefcomplaint":"CHEST PAIN"}'

# Full automated test suite
venv/bin/python -m pytest tests/ -v
```

---

## 5. Total Tests Passed and Failed

Verified with `venv/bin/python -m pytest tests/ -v` (run completed 2026-10-17):

- **Passed:** 139
- **Failed:** 0
- **Warnings:** 2 (pre-existing Starlette `httpx` deprecation message; Pydantic serialization note from `test_no_stack_traces_exposed` — unrelated to Phase 3)

No Phase 2 tests were broken by Phase 3 changes.

---

## 6. Test Results for Invalid Inputs, Absent Classes, and SHAP Failures

### Invalid / malformed inputs (`tests/test_api.py::TestPredictInvalidInputs`)
- Missing request body → `422` (Pydantic validation failure).
- Out-of-range `temperature` (200.0) → converted, then out-of-envelope → missing, prediction still returned with valid probability array.
- Out-of-range `pain` (15.0) → `422` (Pydantic `le=10`).
- Fully null assessment (`AssessmentRequest()`) → `200` with prediction; missingness indicators preserved.

### Absent class handling (`tests/test_api.py::TestPredictHappyPath`)
- `predicted_esi_level` is one of `[1,2,3,4,5]`.
- `probabilities` array length is exactly 5, in order `[1,2,3,4,5]`.
- ESI 5 appears as `probability: 0.0` (dataset has 0 labelled rows — correctly reported, never presented as validated capability).
- ESI 4 appears with non-zero but small probability (2 examples in dataset — reported honestly).
- Sum of probabilities ≈ 1.0.

### SHAP failures (`tests/test_api.py::TestExplanation`)
- Normal input → `explanation_status: "available"`, `top_features` contains feature names + `shap_value` + `sample_value`.
- Monkeypatched broken SHAP (`raise RuntimeError`) → `explanation_status: "unavailable"`, valid `prediction` returned, no fabricated explanation, no crash.

---

## 7. Remaining Limitations and Deployment Blockers

- **ESI 5 zero support:** Model has no training examples; predictions for Level 5 are meaningless (documented explicitly in `/model-info` limitations and in `API_CONTRACT.md`).
- **ESI 4 sparse support:** Only 2 labelled rows; per-class metrics unstable (documented explicitly).
- **No clinical calibration:** `note` field states clearly: "Probabilities reflect model confidence, not clinical calibration."
- **Demo dataset:** 207 labelled visits / 56 unique patients; not representative of full MIMIC-IV-ED (~425k stays).
- **Age unavailable:** No core `patients` table in the demo package (documented in DATA_QUALITY_REPORT.md and MODEL_CARD.md).
- **Deployment blocker — artifact delivery:** `models/triage_model.joblib` and `models/triage_model.manifest.json` are `.gitignore`d and not committed to Git. Before any public deployment, an artifact-delivery mechanism (private artifact registry, credentialed storage, or build-time download from a protected source) must be decided and documented. No licensed MIMIC data or model artifacts are committed.
- **Not clinically validated:** `disclaimer` and `note` fields make this explicit; no regulatory or clinical claim is made.

---

## 8. Confirmation: Existing Phase 1 and Phase 2 Tests Still Pass

- `tests/test_data_loading.py` (20 tests) — green.
- `tests/test_validation.py` (42 tests) — green.
- `tests/test_features.py` (25 tests) — green.
- `tests/test_splitting.py` (15 tests) — green.
- `tests/test_pipeline_e2e.py` (9 tests) — green.
- `tests/test_model_pipeline.py` (11 tests added in Phase 2) — green.

- Phase 1 (111 tests) and Phase 2 (122 tests total) results preserved without any regression.
- Phase 3 adds the API tests (`tests/test_api.py`, 16 tests) — all passing.

---

## 9. Safety and Privacy Confirmed

- `/predict` response includes `disclaimer`: "MEDGUARD IS A RESEARCH PROTOTYPE..."
- `/model-info` `limitations` array explicitly states demo subset, ESI 5 absence, ESI 4 sparsity, and non-clinical status.
- No `subject_id` values from real MIMIC records are returned in any API response.
- `tests/test_api.py::TestSafety::test_no_patient_pii_in_response` asserts that real MIMIC `subject_id` values (`10014354`, `10040025`, `10018328`) are never leaked.
- `tests/test_api.py::TestSafety::test_no_stack_traces_exposed` confirms no traceback leakage.
- No assessment data is persisted by the API or written to logs (request body values are not logged by `inference.py`).

---

## 10. Reproducibility

The entire Phase 3 backend can be reproduced locally with:

```bash
# Verify dataset integrity (optional, for audit only)
cd mimic-iv-ed-demo-2.2 && sha256sum -c SHA256SUMS.txt

# Run data pipeline
venv/bin/python -m backend.ml.run_data_prep

# Train and evaluate model + generate artifacts
venv/bin/python -m backend.ml.run_experiment

# Launch API
venv/bin/uvicorn backend.api.main:app --host 127.0.0.1 --port 8000

# Full test suite
venv/bin/python -m pytest tests/ -v
```

The local environment (CachyOS Linux, Python 3.14.7, pinned `requirements.txt`) is the same environment verified during Phase 1 audit.

---

## Phase 3 Status: COMPLETE

Phase 3 has been completed without altering the Phase 1 dataset audit, Phase 2 evaluation results, or the working ML pipeline. All requirements from the user's specification have been addressed: audit completed, API implemented with clean module separation, Pydantic schemas used, actual saved pipeline loaded, prediction contract preserved (5-level ESI, no clinical calibration claimed), SHAP handled safely, CORS and error handling implemented, automated tests passing, documentation created, and safety/privacy requirements satisfied.

**Stopped after Phase 3.** No frontend integration, database integration, or deployment work has been initiated. The Phase 4 specification (premium clinical UI) has been documented by the user's message but has not been implemented. Phase 4 must not begin until the Phase 3 completion report has been reviewed.
