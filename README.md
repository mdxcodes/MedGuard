# MedGuard / Triage One

MedGuard is an educational AI/ML research prototype for emergency-department triage acuity prediction (ESI levels 1–5). It is **not clinically validated** and must not be used for real patient-care decisions.

## Project Status

**Dataset:** Triagegeist (synthetic) — now the primary and only dataset in the MedGuard pipeline.
**Model:** Random Forest, trained on Triagegeist training split.
**Performance:** Macro-F1 0.841 ± 0.003 (5-fold patient-grouped CV), Macro-F1 0.840 (holdout).
**Artifacts:** `models/triagegeist/triage_model.joblib` + manifest.

## Repository Structure

```
/secondary/MedGuard/
├── backend/
│   ├── api/                  # FastAPI application
│   │   ├── main.py           # App factory, routes
│   │   ├── schemas.py        # Pydantic request/response schemas (Triagegeist fields)
│   │   ├── config.py         # API configuration (model paths, CORS)
│   │   ├── inference.py      # Prediction logic
│   │   ├── metrics_endpoint.py   # Evaluation metrics API
│   │   ├── report_endpoint.py  # PDF report export
│   │   ├── registry_endpoint.py    # Model registry
│   │   ├── experiment_endpoint.py    # Experiment runner
│   │   └── triagegeist_endpoint.py   # Dataset status
│   ├── ml/                   # ML pipeline
│   │   ├── triagegeist_schema.py   # Feature schema & eligibility
│   │   ├── triagegeist_loader.py   # Dataset loading & validation
│   │   ├── triagegeist_preprocessing.py  # Preprocessing pipeline
│   │   ├── triagegeist_validation.py   # Input quality & OOD checks
│   │   ├── triagegeist_training.py   # Model training & evaluation
│   │   ├── evaluate.py         # Evaluation metrics
│   │   ├── explain.py          # SHAP explanations
│   │   ├── splitting.py        # Patient-grouped splits
│   │   ├── experiment.py       # Experiment runner
│   │   └── config.py           # Central configuration
│   └── ...
├── frontend/
│   ├── src/
│   │   ├── pages/            # React pages (Overview, Assessment, Prediction, etc.)
│   │   ├── components/       # React components (AssessmentForm, PredictionResults, etc.)
│   │   ├── lib/api.js        # API fetch wrapper
│   │   ├── ui/states.jsx     # Shared UI state components
│   │   └── App.jsx           # App router
│   ├── dist/                 # Production build output
│   └── package.json
├── triagegeist/              # Triagegeist synthetic dataset (CSV files)
│   ├── train.csv             # 80,000 labelled visits
│   ├── test.csv              # 20,000 unlabelled visits (holdout)
│   ├── chief_complaints.csv  # Chief complaint text
│   ├── patient_history.csv   # Patient history comorbidities
│   └── sample_submission.csv # Competition submission template
├── models/
│   └── triagegeist/          # Model artifacts
│       ├── triage_model.joblib
│       └── triage_model.manifest.json
├── reports/                  # Evaluation artifacts
│   └── triagegeist/
│       ├── benchmark_results.json
│       ├── dataset_profile.json
│       └── experiment_manifest.json
├── docs/                     # Documentation
│   ├── TRIAGEGEIST_BENCHMARK.md
│   ├── TRIAGEGEIST_COMPATIBILITY_AUDIT.md
│   ├── TRIAGEGEIST_MIGRATION_REPORT.md
│   └── ...
├── tests/                    # Backend test suite
├── .gitignore
└── README.md
```

## Quick Start

### Backend (FastAPI)

```bash
cd /secondary/MedGuard

# Install dependencies
pip install -r backend/requirements.txt  # or use existing venv

# Activate virtual environment
source venv/bin/activate

# Start the API server
python -m uvicorn backend.api.main:app --host 127.0.0.1 --port 8000

# Verify health
curl http://127.0.0.1:8000/health
# {"status":"ok"}

# Verify model info
curl http://127.0.0.1:8000/model-info
```

### Frontend (React + Vite)

```bash
cd /secondary/MedGuard/frontend

# Install dependencies
npm install

# Start development server
npm run dev  # vite --port 5173 --host 0.0.0.0

# Build for production
npm run build  # vite build
```

Then open http://localhost:5173/ in your browser.

### Training (Retrain Model)

```bash
cd /secondary/MedGuard
source venv/bin/activate
python -m backend.ml.triagegeist_training
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Liveness probe |
| `/model-info` | GET | Model metadata and manifest |
| `/predict` | POST | Submit triage assessment, get prediction |
| `/metrics` | GET | Evaluation metrics from reports |
| `/triagegeist/status` | GET | Dataset status and provenance |
| `/export/report` | GET | Download research report PDF |
| `/models/versions` | GET | List model versions |
| `/models/active` | GET | Get active model info |
| `/experiments` | GET | List experiments |
| `/experiments/run` | POST | Run a new experiment |

## Data

The Triagegeist dataset is synthetic and provided under the Kaggle competition terms. It contains:

- **train.csv**: 80,000 labelled visits with ESI labels (1–5)
- **test.csv**: 20,000 unlabelled visits (ground truth withheld)
- **chief_complaints.csv**: 100,000 chief complaint records
- **patient_history.csv**: 100,000 patient history records
- **sample_submission.csv**: Competition submission template

## Research Disclaimer

MedGuard is an **educational research prototype**. It is **not clinically validated** and must **not** be used to make real patient-care decisions. Predictions are statistical inferences from a synthetic dataset and should not be interpreted as medical advice.

## License

Triagegeist dataset: Non-commercial research (verify locally before redistribution).
MedGuard code: See LICENSE file.
