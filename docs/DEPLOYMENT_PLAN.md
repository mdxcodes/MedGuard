# MedGuard Deployment Plan — Remote Model Artifact Delivery & Persistence

**Status:** Ready for implementation. No production changes made yet.
**Affected services:** FastAPI backend (Render), React frontend (Vercel), Supabase (Storage + Postgres).

---

## 1. Problem Statement

- The deployed backend reports `GET /readyz` → 503: the model artifact is not loaded.
- The 256 MB `triage_model.joblib` is not committed (GitHub 100 MB limit) and is not on Render's disk.
- Render free tier = 512 MiB RAM. Local profiling shows model deserialization peaks at **~706 MiB RSS** (a ~662 MiB increase from a ~44 MiB baseline). A 1 GB+ Render instance is required.
- SHAP is already lazy-loaded per-request (not at startup) — no change needed there.
- Pages depending on the model (assessment, result, history) return errors or unavailable states when the model is absent.

---

## 2. Supabase Storage Bucket & Object Paths

Use a single **PRIVATE** bucket for versioned model artifacts only. Never upload the raw training dataset (`triagegeist/`) to this bucket.

| Resource | Value |
|---|---|
| Supabase project URL | `https://tpzfaulcjcvleupjlufu.supabase.co` (already configured) |
| Bucket name | `model-artifacts` (PRIVATE) |
| Bucket purpose | Versioned model artifacts only — never training data |
| Model object path | `triagegeist/v1.0/triage_model.joblib.xz` |
| Manifest object path | `triagegeist/v1.0/triage_model.manifest.json` |
| Model object size | ~32 MB (xz-compressed from 256.5 MB) |
| Manifest object size | 893 B |
| Model SHA-256 (restored) | `9c3472ad5e4126e9a99235020e2e75e904b32e77f0add7a4b34f6221aedff305` |
| Manifest SHA-256 | `d30918bd16978ea8ad20295e6241c362cdea2c24a400d89c5aef89ddc4691058` |

The backend constructs object URLs as:

```
{SUPABASE_URL}/storage/v1/object/{bucket}/{object_path}
```

e.g. `https://tpzfaulcjcvleupjlufu.supabase.co/storage/v1/object/model-artifacts/triagegeist/v1.0/triage_model.joblib.xz`

---

## 3. Required Render Environment Variable NAMES (never values)

Set these in the Render dashboard under Environment Variables. Values are **not** committed to the repository.

### Model artifact delivery (pick ONE of A or B)

**A. Direct URLs (takes precedence when set):**

| Variable name | Purpose |
|---|---|
| `MEDGUARD_MODEL_URL` | Direct Supabase Storage URL of the compressed model artifact |
| `MEDGUARD_MODEL_SHA256` | SHA-256 of the restored (decompressed) model artifact |
| `MEDGUARD_MANIFEST_URL` | Direct Supabase Storage URL of the manifest JSON |
| `MEDGUARD_MANIFEST_SHA256` | SHA-256 of the manifest file |

**B. Bucket + object paths (least-privilege alternative):**

| Variable name | Purpose |
|---|---|
| `MEDGUARD_ARTIFACT_BUCKET` | Private Supabase Storage bucket name (`model-artifacts`) |
| `MEDGUARD_ARTIFACT_MODEL_OBJECT` | Object path of the compressed model artifact |
| `MEDGUARD_ARTIFACT_MANIFEST_OBJECT` | Object path of the manifest JSON |

### Transfer controls (optional, have defaults)

| Variable name | Default | Purpose |
|---|---|---|
| `MEDGUARD_ARTIFACT_DIR` | `/tmp/medguard-artifacts` | Cache directory for verified artifacts |
| `MEDGUARD_ARTIFACT_TIMEOUT` | `300` | Download timeout in seconds |
| `MEDGUARD_ARTIFACT_RETRIES` | `3` | Bounded retry count for transient failures |

### Supabase (backend only)

| Variable name | Purpose | Dashboard visibility |
|---|---|---|
| `SUPABASE_URL` | Supabase project URL | Already in `render.yaml` |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side key for Storage + Postgres access | **Set in dashboard only** (`sync: false` in `render.yaml`) |

### CORS

| Variable name | Purpose |
|---|---|
| `MEDGUARD_CORS_ORIGINS` | Comma-separated exact Vercel frontend origins |
| `MEDGUARD_CORS_ORIGIN_REGEX` | Regex for Vercel preview deployments |

### Data

| Variable name | Purpose |
|---|---|
| `MEDGUARD_DATA_ROOT` | Triagegeist dataset directory (training/reporting only, not inference) |

---

## 4. Required Supabase Dashboard Actions

### 4.1 Create the private bucket

1. Supabase Dashboard → Storage → New Bucket
2. Name: `model-artifacts`
3. **Public bucket: OFF** (private — requires server-side key for access)
4. Do NOT upload `train.csv`, `test.csv`, or any raw training data here.

### 4.2 Upload artifacts

Upload these two objects to `model-artifacts/triagegeist/v1.0/`:

- `triage_model.joblib.xz` — xz-compressed model (~32 MB)
- `triage_model.manifest.json` — manifest metadata (893 B)

Generate the compressed artifact locally:

```bash
xz -9 -T0 -c models/triagegeist/triage_model.joblib > triage_model.joblib.xz
sha256sum models/triagegeist/triage_model.joblib models/triagegeist/triage_model.manifest.json
```

Upload via the Supabase dashboard or the Storage API with `SUPABASE_SERVICE_ROLE_KEY` (backend-only, never in frontend).

### 4.3 Enable Row Level Security on Postgres tables

The migration `supabase/migrations/0001_initial_schema.sql` already creates `assessments`, `predictions`, `model_registry` tables with RLS enabled and **no policies for browser roles**. Verify in Supabase Dashboard → Database → Tables that:

- `assessments` — RLS enabled, no `anon`/`authenticated` policies
- `predictions` — RLS enabled, no `anon`/`authenticated` policies
- `model_registry` — RLS enabled, no `anon`/`authenticated` policies

All reads/writes are mediated by the FastAPI backend using `SUPABASE_SERVICE_ROLE_KEY`, scoped by `owner_token`.

---

## 5. Render Dashboard Actions

| Setting | Value |
|---|---|
| Service type | Web Service |
| Name | `MedGuard` (must match `render.yaml` exactly) |
| Root directory | `.` (repository root) |
| Runtime | Python 3.14.8 (or `.python-version`) |
| Build command | `pip install --no-cache-dir -r backend/requirements.txt` |
| Start command | `uvicorn backend.api.main:app --host 0.0.0.0 --port $PORT` |
| Health check path | `/health` |
| Instance type | **1 GB or more** (free tier 512 MiB is insufficient — model peaks at ~706 MiB RSS) |
| `render.yaml` | Keep in repository; Render applies blueprint values automatically |

### Secret values (dashboard only, never committed)

- `SUPABASE_SERVICE_ROLE_KEY` — marked `sync: false` in `render.yaml`
- `MEDGUARD_MODEL_SHA256` / `MEDGUARD_MANIFEST_SHA256` — pinned digests
- `MEDGUARD_MODEL_URL` / `MEDGUARD_MANIFEST_URL` (or bucket + object equivalents)

---

## 6. Code Changes Already Implemented (local, tested)

| Area | File | What was done |
|---|---|---|
| Artifact download | `backend/ml/artifacts.py` | Explicit bucket/object paths, timeout, bounded retries with backoff, temp-file + atomic replacement, SHA-256 + manifest validation, caching (never re-download per request), no automatic destructive overwrite of known-good artifact |
| Manifest compatibility | `backend/ml/artifacts.py` | Validates dataset, target, ESI labels, scikit-learn/numpy/pandas versions BEFORE deserialization |
| Model loading | `backend/api/config.py` | Lazy load, truthful status (`unknown`/`loading`/`ready`/`unavailable`/`error`), no dummy fallback, memory failure reported as error |
| SHAP lazy loading | `backend/api/inference.py` | `shap` imported inside `_compute_prediction` only when a prediction is requested, never at startup |
| Persistence | `backend/ml/persistence.py` | Assessment + prediction storage via Supabase PostgREST, owner-token scoping, RLS-compatible, best-effort (storage failure never fails the request) |
| History API | `backend/api/main.py` | `GET /history`, `GET /history/{id}`, `GET /history-status`, `POST /predict` stores assessment |
| Frontend history | `frontend/src/pages/patient/PatientHistoryPage.jsx` + route | Displays caller-scoped assessment history |
| Tests | `tests/test_artifacts.py`, `tests/test_persistence.py`, `tests/test_api.py` | 207 tests passing: download/load, missing artifacts, digest mismatch, incompatible manifest, failed downloads, caching, retries, synthetic inference, persistence |

### Tests NOT yet added (requirement 9 — partially complete)

The existing test suite covers: successful download/load, missing artifacts, incorrect checksums, incompatible manifests, failed downloads, caching, retries, and inference using synthetic inputs. Additional tests that could be added:
- SHAP explainability with mocked explainer failure (covered by `test_explanation_unavailable_when_shap_fails`)
- Persistence round-trip against a real Supabase instance (not done — requires production access, which we do not have)

---

## 7. Measured Memory Usage (local, controlled environment)

| Measurement | Value |
|---|---|
| Baseline RSS (before model load) | ~44 MiB |
| Peak RSS (after model load) | ~706 MiB |
| RSS increase from model deserialization | ~662 MiB |
| tracemalloc peak (Python allocations only) | ~324 MiB (underreports C-extension allocations) |
| Model: RandomForestClassifier | 100 estimators, max_depth=6, 66 features |
| Artifact size on disk | 256.5 MB (uncompressed), ~32 MB (xz-compressed) |

**Conclusion:** The peak memory comes from **model deserialization** (100-tree RandomForest), not from SHAP, preprocessing, or duplicated instances. SHAP is not loaded at startup. Render free tier (512 MiB) is insufficient; a 1 GB+ instance is required.

---

## 8. Remaining Blockers (require user action)

| Blocker | Required action |
|---|---|
| Model not on Render | Upload `triage_model.joblib.xz` and `triage_model.manifest.json` to Supabase Storage bucket `model-artifacts` |
| Render instance too small | Upgrade Render service to 1 GB+ RAM instance |
| `SUPABASE_SERVICE_ROLE_KEY` not set | Set in Render dashboard (marked `sync: false` in `render.yaml`) |
| Remote artifact env vars not active | The 5 artifact download variables are commented out in `render.yaml`; uncomment and set values in dashboard |
| Production secret rotation | A live `service_role` key was previously committed (git history). Rotate it in Supabase dashboard → Project Settings → API |
| No live end-to-end deploy observed | All testing is local; a real Render deploy against a live Supabase bucket has not been attempted |

---

## 9. Verification Steps (after deploy)

```bash
# 1. Liveness (always 200)
curl -i https://<render-service>.onrender.com/health
# Expected: 200 {"status":"ok"}

# 2. Readiness (model loaded and usable)
curl -i https://<render-service>.onrender.com/readyz
# Expected: 200 {"status":"ready","model":"random_forest","dataset":"Triagegeist","features":66}
# A 503 means the artifact did not arrive — check Render logs and env vars

# 3. Prediction
curl -X POST https://<render-service>.onrender.com/predict \
  -H 'Content-Type: application/json' \
  -d '{"heart_rate":88,"systolic_bp":120,"diastolic_bp":80,"age":45,"sex":"F"}'
# Expected: 200 with prediction, probabilities, explanation

# 4. History storage
curl -i https://<render-service>.onrender.com/history-status
# Expected: {"enabled":true,"table":"assessments"} (when SUPABASE_URL + key configured)
```

---

## 10. Security Notes

- `SUPABASE_SERVICE_ROLE_KEY` bypasses Row Level Security — **never** expose to frontend, Git, logs, or API responses
- The frontend has no Supabase dependency and no `VITE_SUPABASE_*` variables
- All artifact credentials are attached only to requests to the configured Supabase project host (verified by `_auth_headers` host check in `artifacts.py`)
- No signed URLs or storage credentials are returned in API responses or error messages
- The raw training dataset (`triagegeist/`) is never part of the inference download path