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
2. Set the **Runtime** to `Python 3`.
3. Set the **Build Command**:

   ```
   pip install --no-cache-dir -r backend/requirements.txt
   ```

4. Set the **Start Command**:

   ```
   uvicorn backend.api.main:app --host 0.0.0.0 --port $PORT
   ```

5. Add the environment variables listed under **Environment Variables** below.
6. Render sets `$PORT` automatically; do not hardcode it.
7. Deploy. The service will be reachable at your Render URL (e.g. `https://medguard-backend.onrender.com`).

Alternative: use the provided `backend/Dockerfile` with a Docker-based Render service.

## Frontend Deployment (Vercel)

1. Create a new **Project** on Vercel and connect your repository.
2. Set the **Root Directory** to `frontend`.
3. Set the **Framework Preset** to `Vite`.
4. Set the **Build Command**:

   ```
   npm run build
   ```

   (or `pnpm run build` / `yarn build` depending on your package manager)

5. Set the **Output Directory** to `dist`.
6. Add `VITE_API_BASE_URL` pointing to your deployed Render backend URL (e.g. `https://medguard-backend.onrender.com`).
7. Deploy. Vercel will serve the frontend on its assigned domain.

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description | Example |
|---|---|---|
| `MEDGUARD_MODEL_PATH` | Path to the trained model file | `models/triagegeist/triage_model.joblib` |
| `MEDGUARD_MANIFEST_PATH` | Path to the model manifest JSON | `models/triagegeist/triage_model.manifest.json` |
| `MEDGUARD_DATA_ROOT` | Data root directory | `triagegeist` |
| `MEDGUARD_ALLOW_FOREIGN_ORIGIN` | Allow cross-origin requests | `false` |

Copy `backend/.env.example` to `backend/.env` and adjust values for production.

### Frontend (`frontend/.env`)

| Variable | Description | Example |
|---|---|---|
| `VITE_API_BASE_URL` | Base URL of the backend API | `https://medguard-backend.onrender.com` |

Copy `frontend/.env.example` to `frontend/.env` and set the production backend URL.

## Supabase Setup (Optional)

Supabase can be used for authentication and/or persistent data storage.

1. Create a Supabase project at https://supabase.com.
2. Note your **Project URL** and **API Key** (anon/public key).
3. Add them as environment variables in your backend and/or frontend as needed:

   ```
   SUPABASE_URL=https://<project-ref>.supabase.co
   SUPABASE_ANON_KEY=<anon-key>
   ```

4. Enable the required tables/functions in the Supabase SQL Editor.
5. Update your frontend `VITE_API_BASE_URL` or Supabase client configuration accordingly.

Supabase is optional; MedGuard can run without it using local model files and data.

## Verification Steps

### Backend

1. Open the health endpoint in your browser or with `curl`:

   ```
   curl https://medguard-backend.onrender.com/health
   ```

   Expected: a JSON response indicating the service is healthy.

2. Test the prediction endpoint with a sample payload:

   ```
   curl -X POST https://medguard-backend.onrender.com/api/predict \
     -H "Content-Type: application/json" \
     -d '{"symptoms": "chest pain, shortness of breath"}'
   ```

   Expected: a JSON response with a triage prediction and confidence score.

3. Check Render logs if the endpoint returns an error.

### Frontend

1. Open your Vercel deployment URL.
2. Confirm the app loads without console errors.
3. Trigger a prediction through the UI.
4. Confirm the request reaches the backend (check the Network tab or Render logs).
5. Confirm the prediction result is displayed.

### End-to-End

1. Submit a triage request from the frontend.
2. Verify the backend processes it and returns a result.
3. Verify the result renders in the UI.

If any step fails, check the environment variables, CORS settings (`MEDGUARD_ALLOW_FOREIGN_ORIGIN`), and the `VITE_API_BASE_URL` value.
