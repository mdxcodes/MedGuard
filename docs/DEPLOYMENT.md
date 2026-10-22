# MedGuard Deployment Guide

## Prerequisites

- Python 3.11+ (backend)
- Node.js 18+ and npm/pnpm (frontend)
- Git
- A Render account (backend hosting)
- A Vercel account (frontend hosting)
- (Optional) A Supabase account for database/auth

Clone the repository:

```
git clone <repo-url>
cd MedGuard
```

## Backend Deployment (Render)

1. Create a new **Web Service** on Render and connect your repository.
2. Set the **Root Directory** to `.` (the repository root).
3. Set the **Runtime** to Python **3.14.8** (or let `.python-version` drive it).
4. Set the **Build Command** to the canonical production dependency file:

   ```
   pip install --no-cache-dir -r backend/requirements.txt
   ```

   > `backend/requirements.txt` is the canonical production file and contains
   > the **complete** runtime set — the web framework *and* the ML stack
   > (NumPy, pandas, SciPy, scikit-learn, joblib, cloudpickle, SHAP). Installing
   > only the web-framework packages makes the service fail at import with
   > `ModuleNotFoundError: No module named 'numpy'`.
   > See `docs/RENDER_DEPLOYMENT_FIX.md`.

5. Set the **Start Command**:

   ```
   uvicorn backend.api.main:app --host 0.0.0.0 --port $PORT
   ```

6. Add the environment variables listed under **Environment Variables** below,
   including the **model artifact** configuration — the trained pipeline is
   ~250 MB and is therefore not committed to the repository. See
   `docs/RENDER_DEPLOYMENT_FIX.md` §6 for the three delivery options.
7. Render sets `$PORT` automatically; do not hardcode it.
8. Deploy. The service will be reachable at your Render URL.

**Deployed backend:** `https://medguard-8lq1.onrender.com`

A `render.yaml` blueprint in the repository declares these same settings
(build command, start command, runtime, health check). Keep it and Render
applies them automatically, or delete it and set them by hand.

Alternative: use the provided `backend/Dockerfile` (build from the repository
root with `docker build -f backend/Dockerfile .`) for a Docker-based service.

## Frontend Deployment (Vercel)

**Live frontend:** `https://med-guard-livid.vercel.app`
**Project:** `med-guard` (team `mambo-lits-projects`)
**Production aliases:** `med-guard-livid.vercel.app`,
`med-guard-mambo-lits-projects.vercel.app`

1. Import the repository into Vercel and connect it to the `med-guard` project.
2. Set the **Root Directory** to `frontend`.
3. Set the **Framework Preset** to `Vite`.
4. Set the **Build Command** to `npm run build` and the **Output Directory**
   to `dist`.
5. Add `VITE_API_BASE_URL` for **both** Production and Preview:
   `https://medguard-8lq1.onrender.com`
6. Under **Settings → Deployment Protection**, turn **Vercel
   Authentication** off so the site is publicly reachable.
7. Deploy.

### Why the Root Directory is `frontend`

The research pages import their data from **outside** the frontend directory:

```
frontend/src/pages/PerformancePage.jsx  →  ../../../reports/model_evaluation.json
frontend/src/pages/ErrorAnalysisPage.jsx → ../../../reports/evaluation_errors.json
frontend/src/pages/ExplainabilityPage.jsx → ../../../reports/global_shap.json
frontend/src/pages/DatasetExplorerPage.jsx → ../../../reports/triagegeist/*.json
```

Vercel clones the whole repository, so those files are present at build time
even though the project's root directory is `frontend/`. The reverse is not
true: with the root directory set to the repository root, the build output
path would change.

`frontend/vercel.json` holds the SPA rewrite so a deep link such as
`/performance` serves `index.html` instead of a 404:

```json
{ "rewrites": [{ "source": "/((?!api/).*)", "destination": "/index.html" }] }
```

### Secrets on the frontend project

Only `VITE_API_BASE_URL` belongs on the Vercel project. Backend-only
credentials — the Supabase service-role key, the JWT secret and the Postgres
password — were removed from the frontend project: a frontend build has no
reason to hold them, and Vite only inlines `VITE_`-prefixed variables, so a
`VITE_` prefix on a secret would ship it to the browser. Those values live on
Render only.

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description | Example |
|---|---|---|
| `MEDGUARD_MODEL_PATH` | Path to the trained model file | `models/triagegeist/triage_model.joblib` |
| `MEDGUARD_MANIFEST_PATH` | Path to the model manifest JSON | `models/triagegeist/triage_model.manifest.json` |
| `MEDGUARD_DATA_ROOT` | Data root directory (training/reporting only) | `triagegeist` |
| `MEDGUARD_ALLOW_FOREIGN_ORIGIN` | Allow cross-origin requests | `false` |
| `MEDGUARD_MODEL_URL` | Fetch the artifact from remote storage (optional) | `https://.../triage_model.joblib` |
| `MEDGUARD_MODEL_SHA256` | Expected digest of the artifact (optional) | `<sha256>` |

Copy `backend/.env.example` to `backend/.env` and adjust values for
production. `MEDGUARD_MODEL_URL` / `MEDGUARD_MODEL_SHA256` and their manifest
counterparts are used when the artifact is not on disk; the digest is verified
before the artifact is loaded.

### Frontend (`frontend/.env`)

| Variable | Description | Example |
|---|---|---|
| `VITE_API_BASE_URL` | Base URL of the backend API | `https://medguard-8lq1.onrender.com` |

Copy `frontend/.env.example` to `frontend/.env` and set the production backend
URL. When it is set the frontend calls the backend directly; when it is unset
the request stays relative and the Vite dev proxy forwards `/api/*` to
`localhost:8000`.

## Supabase Setup

Supabase is **in use**: it stores the trained model artifact that Render
fetches at startup, because the artifact is too large for GitHub (100 MB) and
too large for Supabase Storage uncompressed (50 MB).

**Project:** `https://tpzfaulcjcvleupjlufu.supabase.co`
**Bucket:** `model-artifacts` (private)

| Object | Size | SHA-256 of the restored file |
|---|---|---|
| `triagegeist/v1.0/triage_model.joblib.xz` | 32.2 MB (xz-compressed from 256.5 MB) | `9c3472ad5e4126e9a99235020e2e75e904b32e77f0add7a4b34f6221aedff305` |
| `triagegeist/v1.0/triage_model.manifest.json` | 893 B | `d30918bd16978ea8ad20295e6241c362cdea2c24a400d89c5aef89ddc4691058` |

The service downloads, decompresses and **verifies the digest** before
loading. An artifact that does not match is refused.

### Credentials

| Variable | Where | Notes |
|---|---|---|
| `SUPABASE_URL` | Render (in `render.yaml`) | Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | **Render dashboard only** | Secret. Bypasses Row Level Security — never in a `VITE_` variable, never committed |
| `VITE_SUPABASE_URL` | Vercel (optional) | Only if the browser talks to Supabase directly |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Vercel (optional) | Publishable key; safe only while RLS is enforced |

### Uploading a new artifact

```bash
xz -9 -T0 -c models/triagegeist/triage_model.joblib > /tmp/triage_model.joblib.xz
sha256sum models/triagegeist/triage_model.joblib

curl -X POST "$SUPABASE_URL/storage/v1/object/model-artifacts/triagegeist/v1.0/triage_model.joblib.xz" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/x-xz" \
  -H "x-upsert: true" \
  --data-binary @/tmp/triage_model.joblib.xz
```

Then update `MEDGUARD_MODEL_SHA256` in `render.yaml` and redeploy.

## Verification Steps

### Backend

1. Open the health endpoint in your browser or with `curl`:

   ```
   curl https://medguard-backend.onrender.com/health
   ```

   Expected: a JSON response indicating the service is healthy.

2. Confirm the model artifact actually arrived:

   ```
   curl https://medguard-backend.onrender.com/readyz
   ```

   Expected: `{"status":"ready","model":"random_forest","dataset":"Triagegeist","features":66}`.
   A 503 here means the artifact was not delivered — check §6 of
   `docs/RENDER_DEPLOYMENT_FIX.md`.

3. Test the prediction endpoint with a sample payload:

   ```
   curl -X POST https://medguard-backend.onrender.com/predict \
     -H "Content-Type: application/json" \
     -d '{"heart_rate":88,"systolic_bp":120,"diastolic_bp":80,"age":45,"sex":"F"}'
   ```

   Expected: a JSON response with the predicted ESI level, the class
   probabilities and the SHAP attributions. The route is `/predict` (the
   frontend's `/api` prefix is stripped when `VITE_API_BASE_URL` is set).

4. Check Render logs if the endpoint returns an error.

### Frontend

1. Open `https://med-guard-livid.vercel.app`. The frontend calls
   `https://medguard-8lq1.onrender.com` (set through `VITE_API_BASE_URL`).
2. Confirm the app loads without console errors.
3. Trigger a prediction through the UI.
4. Confirm the request reaches the backend (check the Network tab or Render logs).
5. Confirm the prediction result is displayed.

### End-to-End

The browser calls the Render API cross-origin, so the API must allow the
Vercel origin. Both are configured:

| Where | Setting |
|---|---|
| Render | `MEDGUARD_CORS_ORIGINS=https://med-guard-livid.vercel.app,https://med-guard-mambo-lits-projects.vercel.app` |
| Render | `MEDGUARD_CORS_ORIGIN_REGEX=https://med-guard-.*\.vercel\.app` (preview deployments) |

1. Submit a triage request from the frontend.
2. Verify the backend processes it and returns a result.
3. Verify the result renders in the UI.

If any step fails, check the environment variables, the CORS origins
(`MEDGUARD_CORS_ORIGINS` / `MEDGUARD_CORS_ORIGIN_REGEX`) and the
`VITE_API_BASE_URL` value.
