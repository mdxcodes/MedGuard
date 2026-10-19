# MedGuard — Scenario Comparison

**Date:** 2026-10-18  
**Feature:** Synthetic Scenario Comparison  
**Status:** Complete

## Overview

The Scenario Comparison page allows users to compare two synthetic patient assessments side by side using the real MedGuard inference API (`POST /api/predict`). Both scenarios are submitted independently, with results displayed in parallel for easy comparison. The feature emphasizes model behavior analysis rather than clinical decision-making.

## Features Implemented

1. **Dual Assessment Panels** — Two independent panels (Scenario A and Scenario B), each containing the full AssessmentForm with validation.
2. **Real API Integration** — Both scenarios submit to the existing `/api/predict` endpoint independently; no new backend endpoints or models.
3. **Side-by-Side Results** — Displays predicted ESI class, max probability, full 5-class probability bars, and SHAP explanation (when available) for each scenario via the existing PredictionResults component.
4. **Comparison Summary** — Aggregates key differences: predicted classes, max probabilities, agreement status, and max probability difference. Includes scientific caution text.
5. **Edit & Rerun** — Users can clear/edit either scenario and rerun the comparison without losing the other. Rerun button resubmits both if both have payloads.
6. **Loading & Error States** — Proper loading indicators, API error messages, and graceful handling of explanation unavailability.
7. **Scientific Safeguards** — Prominent disclaimers stating results illustrate model behavior, not medical causation. Both scenarios clearly labeled as synthetic.
8. **Consistent Design** — Uses existing design tokens, components (AssessmentForm, PredictionResults, DisclaimerBanner), and chart libraries. Matches overall app aesthetic.

## Implementation Details

### Frontend
- **New component:** `frontend/src/pages/ScenarioComparisonPage.jsx` — Main comparison page with state management for two independent scenarios.
- **Routing:** Added `/compare` route in `frontend/src/App.jsx`.
- **Navigation:** Added "Compare" nav item with GitCompare icon in `frontend/src/components/Sidebar.jsx` (after Dataset).
- **State management:** Tracks payload, result, loading, and error separately for Scenario A and B. No persistence to backend/storage.
- **Reuses existing components:** AssessmentForm (validation, synthetic examples), PredictionResults (ESI display, probabilities, SHAP), DisclaimerBanner.

### Backend
- **No changes.** Uses existing `POST /api/predict` endpoint from backend/api/main.py. Response structure (prediction with probabilities for all 5 ESI levels, explanation with explanation_status/top_features) is fully preserved.

### Tests
- Added `frontend/src/pages/__tests__/ScenarioComparison.test.jsx` with 3 tests:
  1. Validates API contract compatibility (predict response structure)
  2. Handles missing explanations gracefully (explanation_status 'unavailable')
  3. Preserves all ESI levels including absent class ESI 5 with probability 0.0

## Verification

### Frontend Build
```bash
cd /secondary/MedGuard/frontend && node node_modules/vite/bin/vite.js build
```
- ✓ built in 13.91s
- No new build errors

### Frontend Tests
```bash
cd /secondary/MedGuard/frontend && npx vitest run
```
- Test Files: 2 passed (DatasetExplorer + ScenarioComparison)
- Tests: 6 passed total (3 + 3)
- All new tests pass

### Backend Tests
```bash
cd /secondary/MedGuard && venv/bin/python -m pytest tests/ -v
```
- 139 passed, 2 warnings (unchanged baseline)
- No regressions to API, inference, or ML pipeline

### Manual Verification Notes
- Both panels submit independently to real API
- Comparison summary correctly computes agreement and probability differences
- Rerun resubmits both scenarios with their last payloads
- Explanation unavailable state displays correctly when SHAP fails
- All disclaimers preserved; synthetic labeling clear

## Scientific Safeguards

- **No hardcoded outputs:** All predictions come from real model inference via API
- **No medical causation claims:** UI explicitly states "differences illustrate model behavior, not medical causation"
- **Class imbalance preserved:** Probabilities shown for all ESI levels [1,2,3,4,5] with ESI 5 correctly shown as 0.0 when absent
- **Uncertainty transparency:** Max probabilities shown; explanation availability clearly indicated
- **Research-only:** Disclaimers present; not presented as clinically validated
- **Synthetic only:** Component reuses existing synthetic examples; no real patient data

## Design Decisions

1. **Reuse over reinvent:** Leverages AssessmentForm and PredictionResults to avoid duplication and ensure consistency with API contract.
2. **Independent submissions:** Each panel manages its own state and API call, allowing users to compare different scenarios without coupling.
3. **Clear difference highlighting:** Comparison summary shows agreement and probability delta to draw attention to meaningful differences without overinterpreting.
4. **Graceful degradation:** If API fails or explanation unavailable, UI handles cleanly with appropriate messaging.
5. **Local-only state:** No backend persistence; comparison is ephemeral per session.

## Files Changed

**Created:**
- `frontend/src/pages/ScenarioComparisonPage.jsx` — Main comparison page
- `frontend/src/pages/__tests__/ScenarioComparison.test.jsx` — Unit tests for comparison logic

**Modified:**
- `frontend/src/App.jsx` — Added ScenarioComparisonPage import and `/compare` route
- `frontend/src/components/Sidebar.jsx` — Added GitCompare icon import and "Compare" nav item

**No backend changes.** All existing API behavior preserved.

## Compliance

- ✓ Uses existing real API only
- ✓ No new models, training, or backend endpoints
- ✓ No database or external services
- ✓ Preserves disclaimers and limitations
- ✓ All ESI classes handled correctly (including absent ESI 5)
- ✓ No fabricated values
- ✓ Existing tests still pass; new tests added
- ✓ Frontend builds successfully
