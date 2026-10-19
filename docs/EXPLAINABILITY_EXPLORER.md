# MedGuard — Explainability Explorer

**Date:** 2026-10-18  
**Feature:** Global SHAP Explorer + Enhanced Explanations  
**Status:** Complete

## 1. Audit Findings

**Existing implementation discovered:**
- `backend/ml/explain.py` already provides `explain_prediction()` with robust SHAP handling (TreeExplainer for RF, LinearExplainer for LR, KernelExplainer fallback). Correctly aligns feature names via `leakage_free_feature_names()`, handles multi-class SHAP shapes (list vs ndarray, 2D/3D), and returns top features by absolute SHAP. Explanation fails gracefully returning 'unavailable' status.
- `backend/api/inference.py` already integrates SHAP into predict endpoint; returns ExplanationResponse with explanation_status, top_features (capped at 10), sample values. Preserves all 5 ESI levels.
- `frontend/src/components/PredictionResults.jsx` already displays local SHAP explanations with horizontal bars, feature names, SHAP values, sample values, and honest 'unavailable' state. Includes proper disclaimers about attribution not implying causation.
- `frontend/src/pages/ScenarioComparisonPage.jsx` already shows explanations for both scenarios via PredictionResults.

**Gaps identified:**
- No global feature importance view (mean |SHAP| across samples). Only local explanations existed.
- No precomputed global SHAP artifact for the UI to consume efficiently.
- explain.py had no `explain_global()` function.

## 2. Implementation

### Backend Changes
- **`backend/ml/explain.py`** — Added `explain_global()`:
  - Computes mean absolute SHAP values across reference samples and across classes (aggregated)
  - Handles RF (TreeExplainer), LR (LinearExplainer), and generic cases
  - Returns ranked feature importances (mean |SHAP|) with model metadata
  - Uses background/reference sampling for efficiency; configurable sizes
  - Includes disclaimer about behavior vs causation

### Generated Artifact
- **`reports/global_shap.json`** — Precomputed global SHAP on held-out test split (patient-grouped):
  ```json
  {
    "generated_at": "2026-10-18T08:30:00Z",
    "model": "random_forest",
    "reference_dataset": "heldout_test_split_patient_grouped",
    "n_reference_samples": 44,
    "feature_importances": [
      {"feature": "shock_index", "mean_abs_shap": 0.0311},
      ...
    ],
    "note": "Global SHAP importance (mean |SHAP|). Describes model behavior, not medical causation."
  }
  ```
  - No patient identifiers
  - Reference is held-out test set from patient-grouped split (appropriate, separate from training)

### Frontend
- **`frontend/src/pages/ExplainabilityPage.jsx`** — New Global SHAP Explorer:
  - Reads global_shap.json statically (no runtime API calls)
  - Vertical bar chart of top features by mean |SHAP| (Recharts)
  - Shows model, reference dataset, sample count, generation time
  - Includes "About Global SHAP" and "Limitations" sections
  - Clear disclaimers about model behavior vs causation; notes small n (44) and class imbalance
- **`frontend/src/App.jsx`** — Added route `/explain`
- **`frontend/src/components/Sidebar.jsx`** — Added "Explain" nav item with Lightbulb icon

### Tests
- **`frontend/src/pages/__tests__/Explainability.test.jsx`** — 4 tests verifying:
  1. Valid provenance (model, reference dataset, non-empty importances)
  2. Feature importances sorted descending by mean_abs_shap
  3. Non-negative values
  4. No patient identifiers in artifact

## 3. Verification

**Frontend Build:** ✓ built in 7.51s  
**Frontend Tests:** 4/4 passed (14 total across all test files)  
**Backend Tests:** 139 passed, 2 warnings (unchanged)

All existing functionality preserved. Local SHAP explanations in PredictionResults and ScenarioComparison remain unchanged and working. No API contract changes.

## 4. Scientific Considerations

- **Reference dataset choice:** Used held-out test split from patient-grouped evaluation (n=44). This is a reasonable choice but small; limitations documented.
- **Aggregation:** Mean |SHAP| across classes provides a global view; per-class global SHAP could also be computed but mean |SHAP| is standard and clear.
- **No impurity importance:** We compute SHAP values, not RF's built-in impurity-based feature importances. Correctly labeled as "mean |SHAP|".
- **Provenance:** Artifact clearly documents model, reference dataset, sample count, generation time.
- **Transparency:** Limitations explicitly stated (small sample, class imbalance, ESI 4 sparse/ESI 5 absent).

## 5. Files Changed

**Created:**
- `frontend/src/pages/ExplainabilityPage.jsx`
- `frontend/src/pages/__tests__/Explainability.test.jsx`
- `reports/global_shap.json`
- `docs/EXPLAINABILITY_EXPLORER.md`

**Modified:**
- `backend/ml/explain.py` (added explain_global)
- `frontend/src/App.jsx` (route)
- `frontend/src/components/Sidebar.jsx` (nav)

No API changes, no model changes.
