# MedGuard — API Contract (Phase 3)

**Status:** Complete — Phase 3 backend implementation verified against `tests/test_api.py` (139 passed, 2 warnings).

**Base URL:** `http://localhost:8000` (local `uvicorn backend.api.main:app`)

---

## 1. Routes

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Service liveness (always 200 if process is up; does not require model artifact) |
| GET | `/model-info` | Model manifest, artifact version, target definition, supported ESI levels, limitations |
| POST | `/predict` | Validate assessment, execute saved pipeline, return prediction + optional SHAP explanation |

---

## 2. Request Schema (`/predict`)

```json
{
  "patient_id": "demo-001",
  "temperature_c": 37.0,
  "heart_rate": 88.0,
  "respiratory_rate": 16.0,
  "spo2": 98.0,
  "systolic_bp": 120.0,
  "diastolic_bp": 80.0,
  "pain_score": 3.0,
  "arrival_mode": "AMBULANCE",
  "chief_complaint_system": "Cardiovascular",
  "age": 45.0,
  "sex": "F"
}
```

Every field is optional. A missing vital is treated as informative: it is
imputed with the training median and flagged with a missingness indicator
rather than rejected. `patient_id` is an opaque debug label and must never
carry real patient PII.

- All fields optional except nothing required by schema.
- Numeric fields validated against clinical envelopes (`backend/ml/config.py`).
- Temperature handled as mixed °C/°F per dataset audit (§4.3 of DATASET_AUDIT.md).
- `pain` coerced from text / sentinels per validation rules.

---

## 3. Response Schema (`/predict`)

```json
{
  "prediction": {
    "predicted_esi_level": 2,
    "probabilities": [
      {"esi_level": 1, "probability": 0.05},
      {"esi_level": 2, "probability": 0.72},
      {"esi_level": 3, "probability": 0.20},
      {"esi_level": 4, "probability": 0.03},
      {"esi_level": 5, "probability": 0.00}
    ],
    "note": "Probabilities reflect model confidence, not clinical calibration."
  },
  "explanation": {
    "explanation_status": "available",
    "predicted_class": 2,
    "explained_class": 2,
    "top_features": [
      {"feature": "sbp_scaled", "shap_value": 0.18, "sample_value": 0.42},
      {"feature": "shock_index", "shap_value": 0.12, "sample_value": 0.73}
    ],
    "note": "Attribution indicates model feature sensitivity, not medical causation."
  },
  "disclaimer": "MEDGUARD IS A RESEARCH PROTOTYPE. This output must NOT be used for clinical decision-making, triage routing, or treatment guidance.",
  "error": null
}
```

- `predicted_esi_level` in `[1,2,3,4,5]`; preserved exactly (no collapse to Low/Moderate/High).
- `probabilities` always reports all 5 levels in order; absent ESI 5 shown at `0.0`; sparse ESI 4 reported honestly.
- Explanation included only if `explain_prediction()` succeeds; otherwise `explanation_status: "unavailable"` with valid prediction returned.

---

## 4. Model Loading

The API loads the actual saved artifact at startup (lazy via `load_model_if_needed()`):

- **Artifact:** `models/triage_model.joblib` (saved by `backend/ml/train.py` `persist_pipeline`)
- **Manifest:** `models/triage_model.manifest.json`
- **Pipeline:** `Pipeline([("preprocess", ...), ("estimator", RandomForestClassifier(...))])`
- **Preprocessing:** fitted `build_preprocessor()` from `backend/ml/features.py` — median imputation, `StandardScaler`, `OneHotEncoder` (`min_frequency=5`), `TfidfVectorizer`, missingness indicators.

If the artifact or manifest is missing / incompatible / fails sanity check, the API fails clearly:
- `GET /model-info` → `503` with error message.
- `POST /predict` → `200` with `error` envelope (no fabricated prediction).

---

## 5. Safety / Privacy

- **Disclaimer:** Included in every `/predict` response (`disclaimer` field) and in `/model-info` (`note` field).
- **No clinical claim:** Schema documentation explicitly states "Not clinically validated."
- **No real identifiers required:** `patient_id` is optional; if provided it is synthetic/non-identifying (`demo-001` style). No PII is persisted or logged.
- **No data persistence:** Assessment request bodies are never written to disk, database, or analytics.
- **No sensitive-value logging:** `inference.py` no longer logs full request bodies (fixed in Phase 3).
- **Synthetic only:** All tests and demo examples use `tests/fixtures.py` synthetic fixtures, never real patient records.
- **No artifact / secret exposure:** Stack traces, env vars, model paths, and dataset paths never appear in API responses.

---

## 6. Error Responses

Stabilized error envelope (`ErrorResponse`):

```json
{"detail": "...", "code": "MODEL_UNAVAILABLE"}
```

Status codes:
- `200` — healthy prediction (with or without explanation)
- `422` — Pydantic validation error (invalid fields, out-of-range, malformed request)
- `503` — model / manifest unavailable (`/model-info` or pipeline load failure)
- `500` — unexpected inference failure (returned as `PredictResponse.error`, never stack trace)

---

## 7. CORS / Security

- `ALLOW_FOREIGN_ORIGIN` (env `MEDGUARD_ALLOW_FOREIGN_ORIGIN`) controls CORS.
- Default (`unset/0`): `allow_origins=[]` — arbitrary origins blocked.
- `1`: `allow_origins=["*"]` — permitted for local/demo use; still requires `Access-Control-Request-Method` / `Access-Control-Request-Headers` on preflight.
- No arbitrary origin trusted by default.
- No secrets in frontend or environment documentation.

---

## 8. Environment Variables

| Variable | Default | Purpose |
|---|---|---|
| `MEDGUARD_MODEL_PATH` | `models/triagegeist/triage_model.joblib` | Path to saved pipeline |
| `MEDGUARD_MANIFEST_PATH` | `models/triagegeist/triage_model.manifest.json` | Path to manifest JSON |
| `MEDGUARD_DATA_ROOT` | `triagegeist` | Synthetic dataset root (used only by the loader; never exposed) |
| `MEDGUARD_ALLOW_FOREIGN_ORIGIN` | `0` | CORS foreign-origin permit |

---

## 9. Local Startup

```bash
source venv/bin/activate
venv/bin/uvicorn backend.api.main:app --host 127.0.0.1 --port 8000
```

Verify:
```bash
curl http://localhost:8000/health
curl http://localhost:8000/model-info
curl -X POST http://localhost:8000/predict \
  -H "Content-Type: application/json" \
  -d '{"temperature":98.6,"heartrate":88,"resprate":16,"o2sat":98,"sbp":120,"dbp":80,"pain":3,"arrival_transport":"AMBULANCE","chiefcomplaint":"CHEST PAIN"}'
```

---

## 10. Testing Commands

```bash
# All backend tests
venv/bin/python -m pytest tests/ -v

# Focused API / CORS
venv/bin/python -m pytest tests/test_api.py -v

# Focused CORS verification
venv/bin/python -m pytest tests/test_api.py::TestCORS -v
```

Actual result (verified 2026-10-17): `139 passed, 2 warnings`. No failures. The 2 warnings are pre-existing Starlette `httpx` deprecation and a Pydantic serialization note — neither relates to Phase 3 changes.
