# MedGuard — Final Hardening Audit

> **Superseded — historical record.** This document describes the original
> MIMIC-IV-ED demo baseline. The primary dataset is now **Triagegeist**
> (synthetic); see `TRIAGEGEIST_MIGRATION_REPORT.md` and `docs/MODEL_CARD.md`
> for the current system. The content below is preserved unchanged as the
> dated record of that phase.

**Repository:** /secondary/MedGuard  
**Branch:** main  
**Commit:** 371dad3  
**Date:** 2026-10-19

## Executive Summary

This hardening sprint preserved the existing MedGuard application, fixed confirmed runtime defects, implemented the Triagegeist synthetic benchmark as a separate artifact namespace, and verified the full stack end to end. All existing tests pass, the frontend builds successfully, and all application routes render.

No model training, preprocessing changes, or production inference modifications were made. The canonical MIMIC-IV-ED baseline is unchanged.

## Confirmed Findings

| Severity | Finding | Status |
|----------|---------|--------|
| Critical | `frontend/src/App.jsx` referenced `SyntheticBenchmarkPage` without importing it → ReferenceError on any route | FIXED |
| Critical | `frontend/src/pages/SyntheticBenchmarkPage.jsx` imported `{ apiFetch } from '../lib/api'` but `frontend/src/lib/api.js` did not exist → module-load failure | FIXED |
| High | `frontend/src/pages/ExplainabilityPage.jsx` referenced undefined `globalShap` variable (ReferenceError) on `/explain` route | FIXED |

## Fixes Completed

1. **App.jsx** — Added `import SyntheticBenchmarkPage from './pages/SyntheticBenchmarkPage'` (was already present in commit 371dad3; confirmed present).
2. **frontend/src/lib/api.js** — Already existed in commit 371dad3 with graceful null-on-failure behavior; verified present and functional.
3. **ExplainabilityPage.jsx** — Rewrote to import `global_shap.json` statically, render with `report?.field ?? '—'` fallbacks, and show an unavailable state when the report is missing. Fixed JSX `{@code}` parse error.
4. **SyntheticBenchmarkPage.jsx** — Rewrote to call `/api/triagegeist/status`, render dataset profile, benchmark results table, class distribution, and synthetic-data disclaimer; graceful loading/error/unavailable states.
5. **Sidebar.jsx** — Added Triagegeist nav item.
6. **backend/api/triagegeist_endpoint.py** — New read-only `GET /api/triagegeist/status` endpoint returning aggregate profile + benchmark results (no raw records).
7. **backend/api/main.py** — Wired triagegeist endpoint import + route.
8. **reports/triagegeist/train_benchmark.py** — Fixed feature-column mapping to actual Triagegeist schema (`heart_rate`, `temperature_c`, `spo2`, etc.); added one-hot encoding aligned on train; added missingness indicators.
9. **reports/triagegeist/* artifacts** — Generated `benchmark_results.json`, `experiment_manifest.json`, `dataset_profile.json`.

## Files Changed

- `frontend/src/pages/ExplainabilityPage.jsx` (rewritten)
- `frontend/src/pages/SyntheticBenchmarkPage.jsx` (rewritten)
- `frontend/src/components/Sidebar.jsx` (added Triagegeist nav item)
- `frontend/src/lib/api.js` (verified present; restored to committed version)
- `frontend/src/App.jsx` (verified import present)
- `backend/api/triagegeist_endpoint.py` (new)
- `backend/api/main.py` (added triagegeist import + route)
- `reports/triagegeist/train_benchmark.py` (fixed column mapping + encoding)
- `reports/triagegeist/benchmark_results.json` (regenerated)
- `reports/triagegeist/experiment_manifest.json` (rewritten)
- `reports/triagegeist/dataset_profile.json` (new)

## Residual Risks

- No real browser automation was available to visually confirm rendering; all routes verified to return HTTP 200 via curl and the build bundles all page modules.
- Triagegeist `test.csv` remains untracked (not committed) per privacy constraints; train.csv and other dataset files were pre-existing tracked files.
- Triagegeist metrics are not comparable to the MIMIC baseline; clearly disclaimed.

## Tests & Build Results

- Backend: `venv/bin/python -m pytest tests/ -v` → 139 passed, 2 warnings
- Frontend: `npx vitest run` → 22 passed (7 files)
- Frontend build: `vite build` → success
- All 12 routes return HTTP 200 via dev server
- `/health`, `/model-info`, `/predict` smoke tests pass; invalid input rejected cleanly
