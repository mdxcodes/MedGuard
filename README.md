# MedGuard / Triage One

MedGuard is an educational AI/ML research prototype for emergency-department triage acuity prediction (ESI levels 1–5). It is **not clinically validated** and must not be used for real patient-care decisions.

## Project Status

**Dataset:** Triagegeist (synthetic) — now the primary and only dataset in the MedGuard pipeline.
**Model:** Random Forest, trained on Triagegeist training split.
**Performance:** Macro-F1 0.8421 ± 0.0019 (5-fold patient-grouped CV), Macro-F1 0.8418 (holdout).
**Artifacts:** `models/triagegeist/triage_model.joblib` + manifest.

## Two Interfaces, One Application

MedGuard presents the same model through two interfaces, switched from the top
navigation. Both use the **same backend, the same model and the same prediction
request** — the mode changes only what is rendered.

| | Patient Mode | Research Lab |
|---|---|---|
| Audience | Anyone with an assessment result | Researchers and reviewers |
| Navigation | Home · New Assessment · My Result · About | 13 research pages, grouped |
| Assessment | Four-step guided wizard, plain language | The full technical form |
| Result | Plain-language summary, no raw SHAP | Probabilities, SHAP, warnings, metadata |
| Palette | Warm charcoal, roomy cards, larger type | Cool navy, dense, technical |

Patient Mode is the default for a new visitor. The full implementation record is
in `DUAL_MODE_UI_IMPLEMENTATION_REPORT.md`.

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
│   │   ├── app/              # ModeProvider · AssessmentProvider · ModelStatusProvider · AppShell
│   │   ├── lib/              # api.js · modeStorage · modeRoutes · assessment (shared contract)
│   │   ├── components/
│   │   │   ├── mode-switcher/  # ModeSwitcher · ModeTransition
│   │   │   ├── patient/         # Patient layout, wizard, result
│   │   │   ├── research/        # Research navigation
│   │   │   └── ui/              # FormField · ProgressSteps · states
│   │   ├── pages/            # React pages — 13 research pages + pages/patient/
│   │   ├── hooks/            # useMediaQuery
│   │   ├── test/             # Test helpers and setup
│   │   └── App.jsx           # Provider stack + app router
│   ├── scripts/screenshot.mjs  # Headless-Chrome visual capture (DevTools Protocol)
│   ├── dist/                 # Production build output
│   ├── vitest.config.js      # jsdom test environment
│   └── package.json
├── triagegeist/              # Triagegeist dataset — NOT committed (see below)
│   ├── train.csv             # 80,000 labelled visits
│   ├── test.csv              # 20,000 unlabelled visits (holdout)
│   ├── chief_complaints.csv  # Chief complaint text
│   ├── patient_history.csv   # Patient history comorbidities
│   └── sample_submission.csv # Competition submission template
├── models/                   # Model artifacts — NOT committed (~250 MB)
│   └── triagegeist/
│       ├── triage_model.joblib
│       └── triage_model.manifest.json
├── reports/                  # Evaluation artifacts
│   ├── model_evaluation.json       # Holdout + CV evaluation
│   ├── data_quality_report.json    # Cleaning counts, missingness
│   ├── global_shap.json            # Global feature attribution
│   ├── drift_analysis.json         # Train/holdout comparison
│   ├── evaluation_errors.json      # Out-of-fold error records
│   └── triagegeist/
│       ├── benchmark_results.json
│       ├── dataset_profile.json
│       └── experiment_manifest.json
├── docs/                     # Documentation
│   ├── MODEL_CARD.md             # Current model card
│   ├── MODEL_EVALUATION.md       # Current evaluation report
│   ├── FEATURE_SPECIFICATION.md  # Allow-list, target, exclusions
│   ├── ML_PIPELINE_DESIGN.md     # End-to-end pipeline design
│   ├── API_CONTRACT.md           # API request/response contract
│   ├── TRIAGEGEIST_BENCHMARK.md  # Dataset, benchmark, reproduction
│   ├── DATA_QUALITY_REPORT.md    # Generated by the pipeline
│   └── ...
├── tests/                    # Backend test suite
├── .gitignore
├── README.md
├── TRIAGEGEIST_MIGRATION_REPORT.md   # Full migration record
└── DUAL_MODE_UI_IMPLEMENTATION_REPORT.md  # Dual-mode UI implementation record
```

## Quick Start

### Not in Git

Two directories are deliberately **untracked** — they are in `.gitignore` and
are not part of the repository history:

| Path | Why | How to obtain it |
|---|---|---|
| `triagegeist/` (36 MB) | The Triagegeist dataset is redistributed under third-party terms, so it is not redistributed here. | Obtain the dataset from the Kaggle competition and place it at `triagegeist/`. |
| `models/` (~250 MB) | The trained artifact exceeds GitHub's 100 MB per-file limit. | `venv/bin/python -m backend.ml.triagegeist_training`, or download it at startup with `MEDGUARD_MODEL_URL` — see `docs/RENDER_DEPLOYMENT_FIX.md`. |

Everything else in the tree is tracked, including the aggregate evaluation
reports under `reports/`, which contain statistics only (no patient
identifiers and no raw clinical rows).

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
