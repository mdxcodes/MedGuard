# Final Demo Guide

## Quick Start

### Starting the Backend (FastAPI)

```bash
cd /secondary/MedGuard
# Install dependencies
pip install -r requirements.txt
# Start the API server
uvicorn backend.api.main:app --host 0.0.0.0 --port 8000
```

### Starting the Frontend (Vite/React)

```bash
cd /secondary/MedGuard/frontend
npm install
npm run dev
```

The frontend will be available at `http://localhost:5173`.

## Application Routes

| Route | Description |
|-------|-------------|
| `/` | Root page — assessment submission interface |
| `/assessment` | Triage assessment form |
| `/prediction` | Model prediction display |
| `/performance` | Model performance metrics and confusion matrix |
| `/dataset` | Dataset explorer and profile |
| `/compare` | Scenario comparison tool |
| `/errors` | Error analysis workbench |
| `/explain` | Explainability Explorer and SHAP |
| /registry | Model version registry and artifact integrity |
| /experiments | Reproducible experiment runner |
| /drift | Probability calibration and drift detection |

## Triagegeist Benchmark Section

A distinct **Synthetic Benchmark** section is available in the frontend:

- **Path**: accessible via the navigation menu or at `/synthetic-benchmark`
- **Disclaimer**: "Research-only benchmark over the Triagegeist synthetic dataset. Results here are separated
  from the real-data MIMIC-IV-ED baseline and must not be presented as clinically comparable."
- **Shows**:
  - Verified dataset profile and provenance
  - Synthetic-data disclaimer
  - Model and feature configuration (DummyClassifier / Logistic Regression / Random Forest)
  - Evaluation protocol (patient-grouped splits, triage-time features only)
  - Class distribution (ESI 1-5)
  - Confusion matrix and metrics per model
  - Limitations and supported comparisons
- **Clearly separated** from real-data results — production predictions remain on the
  canonical MIMIC-IV-ED model.

## Running the Triagegeist Benchmark Training

```bash
cd /secondary/MedGuard
PYTHONPATH=/secondary/MedGuard:$PYTHONPATH python3 reports/triagegeist/train_benchmark.py
```

This produces `reports/triagegeist/benchmark_results.json` with:

- Per-model balanced accuracy, macro-F1, quadratic weighted kappa
- Per-class precision/recall/F1 and support
- Confusion matrices
- Patient counts (80K train / 20K test from unique patients)

## Assessment and Prediction Flow

1. Navigate to `/assessment` or `/`
2. Fill in triage vital signs (temperature, heartrate, respiratory rate, O2 saturation,
   systolic/diastolic blood pressure, pain score)
3. Submit → `/prediction` shows the predicted ESI level with probability scores
4. The prediction uses the trained MIMIC-IV-ED model pipeline (not Triagegeist)

## Important Disclaimers

- **This is not a clinically validated triage system** and must not be presented as
  suitable for actual triage decisions.
- Results are for **research and academic demonstration only**.
- Triagegeist benchmark results are **synthetic-only** and must not be presented as
  directly comparable to real clinical performance.
- The canonical model is trained on MIMIC-IV-ED; Triagegeist is a separate synthetic
  dataset for benchmarking purposes only.
- ESI Level 4 and Level 5 are sparsely populated; models may show reduced performance
  on these classes.

## Environment Configuration

- Copy `.env.example` to `.env` and set required values.
- No secrets or credentials should be committed; use `sites_set_secret` for server-side
  API keys if deploying to Cloudflare Sites.
- `.gitignore` excludes datasets, secrets, and private generated files.

## Testing

```bash
# Backend tests
cd /secondary/MedGuard
python -m pytest tests/

# Frontend tests
cd /secondary/MedGuard/frontend
npm test

# Frontend build
cd /secondary/MedGuard/frontend
npm run build
```