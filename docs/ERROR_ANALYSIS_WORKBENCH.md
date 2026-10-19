# MedGuard — Error Analysis Workbench

**Date:** 2026-10-18  
**Feature:** Error Analysis Workbench  
**Status:** Complete

## 1. Data Feasibility Audit

### Phase 1 Findings

**Available artifacts:**
- `reports/model_evaluation.json` — Contains aggregate metrics (fold summaries, aggregate confusion matrix, diagnostics). No per-sample predictions with inputs.
- `reports/fold_metrics.csv` — Per-fold aggregate metrics (F1/recall per class). No individual sample records.
- `reports/confusion_matrix.csv` — Aggregate confusion matrix from CV. Insufficient to reconstruct individual misclassifications.
- `backend/ml/evaluate.py` — Computes metrics but doesn't persist per-sample out-of-fold (OOF) predictions.
- `backend/ml/run_experiment.py` — Runs CV and saves aggregates; does not export per-sample predictions.

**Conclusion:** Genuine per-sample evaluation records did not exist in the repository. The aggregate reports alone cannot reconstruct which specific samples were misclassified.

### Phase 2 Approach

Since per-sample records were missing, we:
1. Added `run_grouped_cv_oof()` to `backend/ml/evaluate.py` to collect out-of-fold predictions with proper class alignment (handling cases where estimator classes may not include all 5 ESI levels in a sparse fold).
2. Generated a sanitized evaluation error artifact `reports/evaluation_errors.json` containing OOF predictions for all 207 modeling samples from patient-grouped 5-fold CV.
3. Ensured the artifact contains **no patient identifiers** (no subject_id, stay_id, patient_id, visit_id). Only aggregate metadata and per-sample evaluation data.
4. Classified errors as `adjacent` (|true-pred| == 1), `multi_level` (|true-pred| > 1), or `other`. Preserved fold membership and probability information.

The generated artifact contains 207 samples with 82 misclassified cases (39.6%), all from patient-grouped CV where each sample's prediction comes from a model trained without that patient's data.

## 2. Implementation

### Backend Changes
- **`backend/ml/evaluate.py`** — Added `run_grouped_cv_oof()` function:
  - Performs GroupKFold with patient grouping (using SUBJECT_ID)
  - Collects OOF predictions and class probabilities for each sample in original order
  - Properly aligns probabilities to all 5 ESI classes [1,2,3,4,5]
  - Returns y_true, y_pred, y_pred_proba, fold indices, classes, n_samples
  - No identifiers exposed in return values

### Generated Artifact
- **`reports/evaluation_errors.json`** — Sanitized per-sample OOF evaluation records:
  ```json
  {
    "generated_at": "...",
    "n_samples": 207,
    "classes": [1,2,3,4,5],
    "records": [{
      "index": 0,
      "true_label": 3,
      "pred_label": 2,
      "is_misclassified": true,
      "error_category": "adjacent",
      "max_prob": 0.64125,
      "prob_true": 0.18375,
      "prob_pred": 0.64125,
      "fold": 2,
      "evaluation_protocol": "patient_grouped_5fold_cv_out_of_fold"
    }, ...]
  }
  ```
  - No subject_id, stay_id, or any patient identifiers
  - Each record includes fold index confirming patient-grouped evaluation
  - Probabilities for true and predicted classes included for analysis

### Frontend
- **`frontend/src/pages/ErrorAnalysisPage.jsx`** — New workbench page:
  - Displays aggregate stats (total, correct, misclassified, OOF accuracy, adjacent/multi-level counts)
  - Filterable table by true/predicted class, misclassified-only toggle, text search
  - Error categorization badges (Adjacent ±1, Multi-level >1)
  - Detail modal showing per-case probabilities and fold info
  - Clear indication of evaluation protocol (patient-grouped 5-fold CV OOF)
  - Explicit limitations section covering ESI 4 sparsity (2 examples), ESI 5 absence (0 examples), and that these are evaluation patterns not causal explanations
- **`frontend/src/App.jsx`** — Added route `/errors`
- **`frontend/src/components/Sidebar.jsx`** — Added "Errors" nav item with AlertTriangle icon

### Tests
- **`frontend/src/pages/__tests__/ErrorAnalysis.test.jsx`** — 4 tests verifying:
  1. No patient identifiers in evaluation records
  2. Uses patient-grouped out-of-fold protocol with fold indices
  3. Correct error categorization (adjacent vs multi-level)
  4. Valid probability ranges [0,1]

## 3. Verification

### Frontend Build
```bash
cd /secondary/MedGuard/frontend && node node_modules/vite/bin/vite.js build
```
- ✓ built successfully (13.18s)

### Frontend Tests
```bash
cd /secondary/MedGuard/frontend && npx vitest run
```
- Test Files: 3 passed (DatasetExplorer, ScenarioComparison, ErrorAnalysis)
- Tests: 10 passed total

### Backend Tests
```bash
cd /secondary/MedGuard && venv/bin/python -m pytest tests/ -v
```
- 139 passed, 2 warnings (unchanged baseline)
- No regressions

### Data Verification
- Generated artifact has 207 samples matching modeling set size
- 82 misclassified (39.6%), 125 correct (60.4%) — consistent with CV performance
- All records have evaluation_protocol = "patient_grouped_5fold_cv_out_of_fold"
- Fold indices range 0-4, confirming 5-fold structure
- No identifiers present in any record

## 4. Limitations

- **Sparse classes:** ESI 4 has only 2 examples in the dataset; error patterns for ESI 4 are not statistically meaningful.
- **Absent class:** ESI 5 has 0 labeled training examples; no correct predictions possible for ESI 5 in the evaluation set.
- **Demo subset:** 207 visits from 56 patients (MIMIC-IV-ED v2.2 demo) — not representative of full population.
- **Not causal:** Error categories show proximity in ESI scale, not clinical reasoning or causation.
- **Probabilities not calibrated:** Displayed probabilities are raw model confidences.
- **Static artifact:** The evaluation_errors.json was generated from the current trained model; if model/training data changes, it should be regenerated. However, the artifact is separate from runtime inference and the public demo.

## 5. Files Changed

**Created:**
- `frontend/src/pages/ErrorAnalysisPage.jsx` — Error analysis workbench UI
- `frontend/src/pages/__tests__/ErrorAnalysis.test.jsx` — Data integrity tests
- `reports/evaluation_errors.json` — Sanitized OOF evaluation records (no identifiers)
- `docs/ERROR_ANALYSIS_WORKBENCH.md` — This documentation

**Modified:**
- `backend/ml/evaluate.py` — Added `run_grouped_cv_oof()` function
- `frontend/src/App.jsx` — Added `/errors` route
- `frontend/src/components/Sidebar.jsx` — Added Errors nav item

**No changes to:** API contract, prediction logic, model training, or existing evaluation metrics. All existing tests pass.
