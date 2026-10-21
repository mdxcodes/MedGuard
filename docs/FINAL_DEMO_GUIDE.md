# MedGuard — Final Demo Guide (Synthetic-Only)

**Repository:** /secondary/MedGuard  
**Purpose:** Reproducible academic demonstration using synthetic data only.  
**Not clinically validated — not for real triage decisions.**

## 1. Setup

### Backend (FastAPI)
Requirements: Python 3.14, `venv` at `./venv`.
```bash
cd /secondary/MedGuard
venv/bin/python -m uvicorn backend.api.main:app --host 127.0.0.1 --port 8000
```

### Frontend (React + Vite)
Requirements: Node.js, `frontend/node_modules` installed.
```bash
cd /secondary/MedGuard/frontend
npx vite --port 5173 --host 127.0.0.1
```

Open: http://127.0.0.1:5173/

## 2. Demonstration Sequence

1. **Overview (`/`)** — Project identity, research disclaimer, synthetic-only notice.
2. **Assessment (`/assessment`)** — Enter synthetic vitals (e.g. temp 37.0, HR 88, RR 16, O2 98, SBP 120, DBP 80, pain 3, age 45, arrival AMBULANCE, complaint Cardiovascular). Submit → real model inference via `POST /api/predict`.
3. **Prediction (`/prediction`)** — View real predicted ESI level, class probabilities (all 5 levels), max probability, SHAP explanation, research disclaimer.
4. **Performance (`/performance`)** — Verified CV and holdout metrics, confusion matrix, per-class table, limitations panel.
5. **Dataset Explorer (`/dataset`)** — Aggregate Triagegeist stats, class distribution, missingness, preprocessing transparency, limitations.
6. **Scenario Comparison (`/compare`)** — Two independent synthetic assessments submitted to the real API; side-by-side results.
7. **Error Analysis (`/errors`)** — Out-of-fold error categories, filters, detail view.
8. **Explainability (`/explain`)** — Global SHAP feature importance (mean |SHAP|), methodology, limitations.
9. **Triagegeist Benchmark (`/triagegeist`)** — Dataset profile, model results table, ESI class distribution, synthetic-data disclaimer.
10. **Model Registry (`/registry`)** — Active model version + integrity status.
11. **Experiments (`/experiments`)** — Experiment submission + history.
12. **Drift (`/drift`)** — Drift analysis placeholder.

## 3. Expected Behavior

- Every route renders without a blank screen.
- `/predict` returns real model output (not hardcoded), with ESI probabilities summing to ~1 across all five levels.
- Invalid inputs return structured validation errors (no stack traces).
- Missing optional artifacts (e.g. global SHAP) show "unavailable" states, not crashes.
- All disclaimers visible: "Not clinically validated. Educational research only."

## 4. Known Limitations

- All five ESI levels are present in Triagegeist. ESI 1 is the rarest (4.0% of the cohort), so its per-class metrics are the least stable.
- The metrics are measured on synthetic data only. They are not comparable to any earlier MIMIC-IV-ED demo figures and they do not establish clinical validity.
- No real browser automation was used to confirm pixel-level rendering (routes verified via HTTP 200 + build success).
- No deployment to a hosted environment performed.

## 5. Commands Reference

| Purpose | Command |
|---------|---------|
| Backend tests | `cd /secondary/MedGuard && venv/bin/python -m pytest tests/ -v` |
| Frontend tests | `cd /secondary/MedGuard/frontend && npx vitest run` |
| Frontend build | `cd /secondary/MedGuard/frontend && npx vite build` |
| Triagegeist benchmark | `cd /secondary/MedGuard && PYTHONPATH=. venv/bin/python reports/triagegeist/train_benchmark.py` |
