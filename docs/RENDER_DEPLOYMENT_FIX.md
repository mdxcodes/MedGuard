# Render Deployment Fix — MedGuard (Triage One)

**Date:** 2026-10-22
**Reported symptom:** `ModuleNotFoundError: No module named 'numpy'` on Render
**Reported runtime:** Python 3.14.8
**Status:** Fixed in the repository. A successful Render deployment has **not**
yet been observed — the remaining steps need your account.

---

## 1. Root cause

The dependency installation was ambiguous, and the file Render actually
installed did not contain the ML stack.

**What the repository contained before this fix**

| File | Contents |
|---|---|
| `requirements.txt` (root) | The full ML stack (numpy, pandas, scipy, scikit-learn, joblib, cloudpickle, shap) — but the FastAPI/uvicorn/pydantic/python-dotenv lines were **commented out**. |
| `backend/requirements.txt` | **Only** `fastapi`, `uvicorn`, `pydantic`, `python-dotenv`. No NumPy, no pandas, no scikit-learn. |

**What Render was configured to install**

`docs/DEPLOYMENT.md` documented the Render build command as:

```
pip install --no-cache-dir -r backend/requirements.txt
```

That installs the four web-framework packages and nothing else. The service
then failed immediately, because `backend/api/inference.py` executes
`import numpy as np` at **module scope** — so the very first import of the
application raised `ModuleNotFoundError: No module named 'numpy'`, before any
request was served.

**Python 3.14.8 was not the cause.** Every pin in the production set
publishes a `cp314` manylinux wheel (verified below by a clean install on
3.14.8). The crash was caused purely by the wrong dependency file, so the
runtime was left on the version Render already used rather than downgraded.

A **second, independent blocker** was found during verification: the startup
sanity check called `backend.ml.triagegeist_loader.load_all()`, which requires
`train.csv`, `test.csv`, `chief_complaints.csv`, `patient_history.csv` and
`sample_submission.csv`. The whole `triagegeist/` directory is gitignored, so
it is never deployed. The service would have started but every prediction
would have failed with 503. That check is now built from the schema instead of
the dataset (see §3).

---

## 2. Files changed, and why

| File | Change | Reason |
|---|---|---|
| `backend/requirements.txt` | **Rewritten** as the canonical production dependency file: FastAPI, Uvicorn, Pydantic, python-dotenv, httpx **plus** NumPy, pandas, SciPy, scikit-learn, joblib, cloudpickle, SHAP, slicer, threadpoolctl. | This is the file Render installs. It must contain every runtime dependency, not only the web framework. |
| `requirements.txt` (root) | Now `-r backend/requirements.txt` plus the four test-only packages. | One place for the production pins, so the root file cannot drift from what is deployed. `pip install -r requirements.txt` still yields a complete environment. |
| `backend/api/artifacts.py` | **New.** Resolves the model and manifest from disk, or downloads them from a configured URL into a cache directory and verifies their SHA-256 before use. Never substitutes a dummy model. | The artifact is ~250 MB and exceeds GitHub's 100 MB per-file limit, so it cannot be committed. It has to be delivered some other way. |
| `backend/api/config.py` | Loads the artifact through `artifacts.resolve_artifact`; the startup compatibility check is now built from `triagegeist_schema.FEATURE_FIELDS` instead of the training dataset; added `resolve_artifact_paths()`. | Inference needs the model, not the dataset. The old check made the deployed service unable to serve a prediction. |
| `backend/api/main.py` | Added `GET /readyz` (readiness: model loaded and usable) alongside the existing `GET /health` (liveness: process up). | Render health checks should distinguish "the process is alive" from "the service can actually predict". |
| `render.yaml` | **New** blueprint: `rootDir: .`, `buildCommand: pip install --no-cache-dir -r backend/requirements.txt`, `startCommand: uvicorn backend.api.main:app --host 0.0.0.0 --port $PORT`, `healthCheckPath: /health`, `PYTHON_VERSION=3.14.8`. | Makes the deployment configuration explicit so the wrong dependency file cannot be selected again. Deleting it is safe — the same values can be set in the dashboard. |
| `.python-version` | **New:** `3.14.8`. | Pins the runtime that the pinned stack was verified against. Render reads this for its Python runtime. |
| `.dockerignore` | **New.** Excludes secrets, venvs, `node_modules`, the licensed dataset and the model artifacts from the image build context. | Keeps secrets and large files out of the image, and keeps the context small. |
| `backend/Dockerfile` | **Rewritten.** Builds from the repository root, installs `backend/requirements.txt`, uses `python:3.14.8-slim`, adds a `HEALTHCHECK`, and no longer tries to `COPY` the gitignored `models/` or `reports/` directories. | The old file copied paths that do not exist in the build context, so the image build would fail. |
| `frontend/src/lib/api.js` | Resolves `VITE_API_BASE_URL` at import time; the `/api` prefix is stripped when a base URL is configured. | The variable was documented but ignored, so the deployed frontend would have called its own origin and never reached the API. |
| `frontend/vitest.config.js` | Pins `VITE_API_BASE_URL: ''` for the test environment. | A developer's local `frontend/.env` otherwise changes every request URL under test. |
| `frontend/src/lib/__tests__/apiBaseUrl.test.js` | **New:** 4 tests for base-URL resolution. | Covers the new behaviour. |
| `tests/test_artifacts.py` | **New:** 7 tests for artifact discovery, digest verification and the no-dummy guarantee. | The download path is security-relevant: it must reject an artifact whose digest does not match, and must never substitute a placeholder. |
| `backend/.env.example`, `frontend/.env.example` | **Real Supabase credentials removed**, replaced with placeholders. | A live `service_role` key had been committed. That key bypasses Row Level Security entirely. **See §7 — the key must be rotated.** |
| `docs/DEPLOYMENT.md` | Updated to the canonical build command and the artifact-delivery options. | The old build command is what caused the failure. |

---

## 3. Selected Python version

**CPython 3.14.8** — unchanged from what Render was already using.

Evidence, not assumption:

- Every production pin publishes a `cp314` manylinux wheel. A clean install
  of `backend/requirements.txt` on 3.14.8 completed with **no source builds**.
- The full backend suite (170 tests) passes on 3.14.8.
- The saved model artifact loads and predicts on 3.14.8 with the pinned
  scikit-learn 1.9.1.
- 3.12/3.13 was **not** selected: the model was serialized under Python
  3.14, and downgrading the runtime without need would move the artifact away
  from the environment it was produced in. The task is satisfied without a
  downgrade, so none was performed.

`.python-version` records `3.14.8`; `render.yaml` sets `PYTHON_VERSION=3.14.8`.

---

## 4. Canonical dependency installation command

```
pip install --no-cache-dir -r backend/requirements.txt
```

`backend/requirements.txt` is the single canonical production file. The root
`requirements.txt` references it and adds only the test packages, so there is
exactly one place where the production pins live.

---

## 5. Local verification (clean environment)

A fresh virtual environment on Python 3.14.8 — **not** the project's
development venv — was used, so nothing was inherited from globally
installed packages.

```
$ python3.14 -m venv /tmp/rendercheck
$ /tmp/rendercheck/bin/python --version
Python 3.14.8
$ pip install --no-cache-dir -r backend/requirements.txt
Successfully installed annotated-doc-0.0.5 ... fastapi-0.143.3 ... joblib-1.6.0
  numpy-2.5.4 ... pandas-3.0.6 ... pydantic-2.14.1 ... scikit-learn-1.9.1
  scipy-1.18.1 ... shap-0.53.0 ... uvicorn-0.54.0
```

| # | Check | Result |
|---|---|---|
| 1 | Install with the exact Render command | **PASS** — all wheels, no source builds |
| 2 | Import numpy, pandas, scipy, sklearn, joblib, shap, fastapi, pydantic, dotenv, httpx, uvicorn | **PASS** — every import resolves |
| 3 | `import backend.api.main` | **PASS** — FastAPI app with all 16 routes registered |
| 4 | Backend test suite in the clean venv | **PASS** — `177 passed` in 387 s (170 pre-existing + 7 new artifact-delivery tests) |
| 5 | `GET /health` | **PASS** — `200 {"status":"ok"}` |
| 6 | `GET /readyz` (new) | **PASS** — `200 {"status":"ready","model":"random_forest","dataset":"Triagegeist","features":66}` |
| 7 | Model artifact discovery and loading | **PASS** — loaded in 2.5 s; 66 transformed features; no dummy substitution |
| 8 | Synthetic inference through the real API path | **PASS** — `POST /predict` → 200, ESI 4, probabilities sum to 1.0, 10 SHAP features |
| 9 | Invalid input rejected | **PASS** — `POST /predict {"heart_rate":9999}` → 422 |
| 10 | Dataset is never read at inference | **PASS** — `load_all` was replaced with a function that raises; startup and `/predict` still succeeded |
| 11 | Frontend suite after the api-client change | **PASS** — 129 passed across 16 files (125 pre-existing + 4 new base-URL tests) |
| 12 | Frontend production build | **PASS** — built successfully |

### Checks that could not be run

- **A live Render deployment.** No Render account, service or credentials are
  available in this environment, so nothing here has been confirmed against a
  real deployment.
- **A real Supabase Storage fetch.** The artifact-download path in
  `backend/api/artifacts.py` is implemented and its digest verification is
  covered by 7 unit tests (including the mismatch-rejection and
  no-placeholder guarantees), but it has not been exercised against a live
  bucket with real credentials.

---

## 6. Model artifact requirements

The artifact is **not** in the repository:

| Item | Value |
|---|---|
| Path | `models/triagegeist/triage_model.joblib` |
| Size | ~250 MB (256,504,435 bytes) |
| Why it is absent | GitHub rejects files over 100 MB, and `.gitignore` excludes `models/` and `*.joblib`. |
| Manifest | `models/triagegeist/triage_model.manifest.json` (< 1 KB) |
| Compatibility | Requires `scikit-learn==1.9.1`, `numpy==2.5.4`, `pandas==3.0.6` — the exact pinned versions. A different scikit-learn may refuse to load the artifact. |
| Regeneration | `venv/bin/python -m backend.ml.triagegeist_training` (takes several minutes; produces a deterministic artifact for the same seed) |

### Three ways to supply it on Render — pick one

**A. Persistent disk (simplest)**
Create a Render disk mounted at `/app/models`, upload `triage_model.joblib`
and `triage_model.manifest.json` into `/app/models/triagegeist/`, and set
`MEDGUARD_MODEL_PATH=models/triagegeist/triage_model.joblib`. The artifact
persists across deploys.

**B. Supabase Storage (recommended for a small bucket)**
Upload both files to a **private** bucket, then set:

```
MEDGUARD_MODEL_URL=https://<project-ref>.supabase.co/storage/v1/object/<bucket>/triage_model.joblib
MEDGUARD_MODEL_SHA256=<sha256 of the joblib>
MEDGUARD_MANIFEST_URL=https://<project-ref>.supabase.co/storage/v1/object/<bucket>/triage_model.manifest.json
MEDGUARD_MANIFEST_SHA256=<sha256 of the manifest>
MEDGUARD_ARTIFACT_DIR=/tmp/medguard-artifacts
```

The service downloads once at startup, verifies the digest, and refuses to load
an artifact that does not match. A failed download leaves the service running
with `/readyz` returning 503 and an explicit message — it never loads a
partial or unverified file.

**C. Bake it into the image**
Not viable as-is: the artifact exceeds Docker's practical layer sizes and
GitHub's file limit. `backend/Dockerfile` therefore expects the artifact to be
mounted or fetched at runtime.

Compute the digests with:

```
sha256sum models/triagegeist/triage_model.joblib models/triagegeist/triage_model.manifest.json
```

---

## 7. Security action required

The repository previously contained a **live Supabase `service_role` key** in
`backend/.env.example` and the project URL plus a publishable key in
`frontend/.env.example`. Both files are committed to git, so the key is in the
history of commit `794a960`.

That key bypasses Row Level Security entirely: anyone holding it has full
read/write access to the database, regardless of the policies.

**Done here:** both `.env.example` files now contain placeholders only.

**Still required, and it cannot be done from here:**

1. **Rotate the key** — Supabase dashboard → Project Settings → API. Revoke
   the exposed `service_role` key and issue a new one. Store the new one only
   in the Render environment variables.
2. Treat the old key as compromised and check the audit log for unexpected
   access.
3. Decide whether to purge the key from git history. Rewriting history is a
   destructive operation and was deliberately **not** performed. If you want
   it removed, `git filter-repo` or a BFG rewrite followed by a force-push is
   required, and every clone must be discarded. The key must be rotated
   regardless, because a rewrite does not un-leak it.

---

## 8. Render dashboard settings still requiring manual action

| Setting | Value |
|---|---|
| Service type | Web Service |
| Root directory | `.` (repository root) — **not** `backend/` |
| Runtime | Python 3.14.8 (or let `.python-version` drive it) |
| Build command | `pip install --no-cache-dir -r backend/requirements.txt` |
| Start command | `uvicorn backend.api.main:app --host 0.0.0.0 --port $PORT` |
| Health check path | `/health` (liveness). Use `/readyz` to confirm the model arrived. |
| Environment | `MEDGUARD_MODEL_PATH`, `MEDGUARD_MANIFEST_PATH`, `MEDGUARD_DATA_ROOT`, plus the artifact-delivery variables from §6 |
| Secret values | The Supabase service-role key — **backend only**, never in a `VITE_` variable |

If you keep `render.yaml` in the repository, Render applies these values
automatically and the dashboard fields are ignored for the settings declared
in the blueprint. If you would rather configure the dashboard by hand, delete
`render.yaml` and enter the same values.

### After deploying, run these

```
curl -i https://<your-service>.onrender.com/health     # expect 200 {"status":"ok"}
curl -i https://<your-service>.onrender.com/readyz     # expect 200 {"status":"ready",...}
curl -X POST https://<your-service>.onrender.com/predict \
  -H 'Content-Type: application/json' \
  -d '{"heart_rate":88,"systolic_bp":120,"diastolic_bp":80,"age":45,"sex":"F"}'
```

The third call must return a prediction from the real model. If it returns
503, the artifact did not arrive — check the Render log for the artifact
message and the `MEDGUARD_MODEL_*` variables.

---

## 9. Unresolved limitations

1. **Nothing has been deployed.** Every result in §5 is from a local clean
   environment. A Render deployment has not been attempted or observed.
2. **The artifact is not in the repository.** The service cannot predict until
   one of the three delivery options in §6 is configured. This is a manual
   step by nature.
3. **The remote-download path is unexercised end-to-end.** Its unit tests
   cover digest verification and failure handling; it has not been run against
   a live bucket.
4. **A committed secret remains in git history** until the key is rotated and
   the history is rewritten (§7).
5. **Cold starts.** Render's free tier spins the instance down when idle, so
   the first request after a quiet period pays the model load (measured at
   2.5 s here) — and, with remote delivery, the artifact download as well.
   A paid instance avoids the spin-down but not the load.
6. **The frontend bundle is ~14.4 MB**, dominated by the 64,000-record
   out-of-fold error set that the research pages import statically. This is
   pre-existing and unrelated to the deployment failure.
