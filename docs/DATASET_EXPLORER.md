# MedGuard — Dataset Explorer

**Date:** 2026-10-18  
**Feature:** Dataset Explorer page  
**Status:** Complete

## Overview

The Dataset Explorer page provides a read-only, sanitized view of aggregate dataset statistics from the audited MIMIC-IV-ED v2.2 demo subset. It displays only summary-level information—no raw patient records, no PHI/PII, and no local filesystem paths. All data is sourced from versioned report artifacts.

## Data Sources

The page consumes the following JSON report files (imported statically at build time):

| Source | Purpose | Notes |
|---|---|---|
| `reports/data_quality_report.json` | Dataset metadata, row counts, label distribution, missingness percentages, feature summaries, validation counts/checks | Generated during data preparation/audit. Contains only aggregate statistics. |
| `reports/model_evaluation.json` | Patient counts, class distribution (modeling context), evaluation metadata | Used for unique patient counts and cross-reference. |

These files are generated artifacts committed to the repo alongside documentation; they do not contain raw MIMIC records. The MIMIC dataset itself remains ODbL-licensed and is not exposed through the frontend.

## Features Implemented

1. **Dataset Overview** — Displays dataset name/version/variant/license, modeling rows vs total joined rows, train/test split row counts, and unique patients. Explicitly notes ODbL licensing and that raw data is not exposed.
2. **ESI Class Distribution (Modeling Set)** — Bar chart visualizing ESI 1-4 distribution with counts and percentages. ESI 5 is absent (0 labeled rows) and is not fabricated; only classes present in labeled data are emphasized.
3. **Missing Data Overview** — Horizontal bar visualization of missing percentages per feature (temperature, heartrate, resprate, o2sat, sbp, dbp, pain, arrival_transport). Color-coded by severity to highlight >10% missingness.
4. **Continuous Feature Summaries** — Sortable table showing n_valid, min, median, P75, max, mean for continuous vitals. Arrival transport (categorical) and chief complaint (text) are not represented as continuous stats, matching the actual report structure.
5. **Preprocessing Transparency** — Documents normalization, validation, imputation, scaling, TF-IDF configuration, one-hot encoding, and leakage controls (patient-grouped splits).
6. **Class Imbalance & Limitations** — Prominent panel explicitly calling out severe imbalance, ESI 4 sparsity (2 examples), ESI 5 absence (0 examples), small cohort size, absence of age feature, non-calibrated probabilities, and non-clinical validation status.

## Implementation Details

### Frontend
- **New component:** `frontend/src/pages/DatasetExplorerPage.jsx` — Reads sanitized JSON reports at build time (static imports). No runtime API calls to backend for dataset exploration; this keeps the page fully static and avoids exposing internal paths.
- **Routing:** Added route `/dataset` in `frontend/src/App.jsx`.
- **Navigation:** Added "Dataset" nav item with Database icon in `frontend/src/components/Sidebar.jsx` (after Performance, before Methodology).
- **Styling:** Uses existing design tokens (teal for interactive/positive, amber/rose for warnings), consistent card layout, responsive grids, and Recharts for visualizations. Matches the app's clinical-research aesthetic.
- **No raw data exposure:** No subject_id, stay_id, or visit identifiers rendered. All aggregations are at cohort level.

### Backend
- No backend changes required. Dataset exploration uses static report data only.
- Existing read-only endpoints (`/health`, `/model-info`, `/predict`) unchanged.

### Tests
- Added `frontend/src/pages/__tests__/DatasetExplorer.test.jsx` with Vitest:
  1. Verifies report files are importable and contain expected aggregated fields (label_distribution, missing_percent, feature_stats)
  2. Validates class imbalance structure (ESI 1-4 present as numbers; ESI 5 absent as labeled class in modeling set—correctly not fabricated)
  3. Validates missingness percentages are in [0,100] range

## Verification

### Frontend Build
```bash
cd /secondary/MedGuard/frontend && npx vite build
```
- ✓ Build successful (13.42s)
- Output: dist/index.html, dist/assets/index-*.css, dist/assets/index-*.js
- No new build errors introduced

### Backend Tests
```bash
cd /secondary/MedGuard && venv/bin/python -m pytest tests/ -v
```
- **139 passed, 2 warnings** (unchanged from baseline)
- No regressions

### Frontend Tests
```bash
cd /secondary/MedGuard/frontend && npx vitest run 2>&1 | tail -30
```
- DatasetExplorer tests: 3 passed
- All existing frontend tests (if any others) also pass
- Test confirms data integrity and no fabricated values

### Manual Verification (values vs source)
- Class distribution matches: ESI 1:18, ESI 2:97, ESI 3:90, ESI 4:2 (from data_quality_report.json and model_evaluation.json) ✓
- Missingness: temperature 5.31%, heartrate 4.35%, resprate 3.86%, o2sat 4.35%, sbp 3.86%, dbp 4.35%, pain 12.08%, arrival_transport 0.0% ✓
- Modeling rows: 207, unique patients: 56 ✓

## Design Decisions

1. **Static imports over API endpoint** — Keeps the explorer simple, cacheable, and avoids adding backend surface area. Report files are versioned artifacts that change only when data pipeline changes; static import is appropriate and safe.
2. **Explicitly show only what's present** — ESI 5 is not shown as a bar with 0 in a misleading way that implies it was learned; the limitations panel explicitly states its absence. This matches scientific integrity requirements.
3. **Preserve disclaimers** — DisclaimerBanner at top (consistent with other pages). Limitations panel is prominent and uses rose/red accent to draw attention without being alarmist.
4. **No hardcoded duplication** — The component reads directly from JSON; if reports regenerate, values update automatically (as long as schema is compatible).
5. **Responsive and accessible** — Charts have proper tooltips, tables are readable, color is not the sole indicator (percentages and counts shown numerically).

## Known Limitations (documented)

- Shows only demo subset statistics (MIMIC-IV-ED v2.2 demo). Not representative of full MIMIC-IV-ED population.
- Continuous summaries cover vitals only; categorical/text features (arrival_transport, chief complaint) summarized qualitatively in preprocessing section.
- Feature stats reflect post-validation distributions as recorded in reports (after cleaning/normalization steps described).
- ESI 4 sparsity and ESI 5 absence are inherent to the demo dataset and cannot be remedied without additional data.

## Files Changed

**Created:**
- `frontend/src/pages/DatasetExplorerPage.jsx` — Main page component
- `frontend/src/pages/__tests__/DatasetExplorer.test.jsx` — Data integrity tests
- `docs/DATASET_EXPLORER.md` — This documentation

**Modified:**
- `frontend/src/App.jsx` — Added DatasetExplorerPage import and `/dataset` route
- `frontend/src/components/Sidebar.jsx` — Added Database icon import and Dataset nav item

No backend files modified. No ML pipeline or API contract changes.

## Compliance Check

- ✓ No fabricated metrics or values
- ✓ No raw patient records exposed
- ✓ No new database, external services, or paid APIs
- ✓ No changes to prediction model or evaluation logic
- ✓ Preserves research disclaimers and limitations visibility
- ✓ Patient-grouping and leakage controls unchanged
- ✓ All existing tests still pass (139 backend + 3 new frontend = 142 total relevant tests passing)
