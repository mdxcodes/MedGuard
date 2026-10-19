# MedGuard — Input Quality & Out-of-Distribution Safeguards

**Date:** 2026-10-18  
**Feature:** Input quality assessment and distribution-based warnings  
**Status:** Complete

## 1. Audit Findings

**Existing validation (preserved):**
- `backend/ml/validation.py` provides comprehensive validation: target validation, temperature C/F normalization, vital sign validation (heartrate/resprate/o2sat), blood pressure validation and consistency checks, pain parsing (handles numeric and sentinels like UA/unable), chief complaint normalization, missingness indicators. All rules are explicit with counts.
- API inference (`backend/api/inference.py`) already applies these validations before prediction.

**Gaps:**
- No distribution-based OOD assessment against training data
- No warnings for inputs outside observed training ranges or unusual values
- No training distribution statistics persisted for reference

## 2. Implementation

### Training Distribution Statistics
- **Generated:** `reports/training_distribution_stats.json` from training split only (patient-grouped)
- Contains numeric stats (mean, std, min, max, p25/p75, median, count) for vitals + pain
- Contains categorical stats for arrival_transport
- Source marked as `training_set_patient_grouped` with n_samples
- No patient identifiers

### Input Quality Module
- **`backend/ml/input_quality.py`** — Conservative assessment:
  - Range check: warns if value outside [min,max] of training distribution
  - Z-score check (|z| > 3.0): warns if unusually far from mean
  - Insufficient data guard: warns if training count < 5
  - Categorical check: warns if arrival_transport not seen in training
  - Returns structured warnings/errors (no auto-rejection)

### API Integration
- **`backend/api/schemas.py`** — Added:
  - `QualityWarning` model
  - `InputQualityResponse` model (has_errors, has_warnings, warnings, errors)
  - `quality` field in `PredictResponse`
- **`backend/api/inference.py`** — Calls `assess_input_quality()` after prediction; attaches quality to response. Graceful fallback if assessment fails.

### Frontend
- **`frontend/src/components/QualityWarnings.jsx`** — Displays warnings/errors with codes, messages, affected features. Uses amber for warnings (informational), rose for errors. Clear disclaimer that it's research tool, not clinical safety check.
- **`frontend/src/components/PredictionResults.jsx`** — Renders QualityWarnings when present
- **`frontend/src/pages/ScenarioComparisonPage.jsx`** — Inherits warnings via PredictionResults (already shows them)

### Tests
- **`frontend/src/pages/__tests__/InputQuality.test.jsx`** — Verifies training stats integrity (source, required fields, no identifiers)

## 3. Verification

**Backend Tests:** 139 passed, 2 warnings (unchanged)  
**Frontend Tests:** 5 test files, 17 tests passed  
**Frontend Build:** ✓ built successfully  
**No regressions:** All existing behavior preserved

## 4. Scientific Safeguards

- **Conservative thresholds:** Z-score > 3.0 is conservative to reduce false positives
- **No rejection:** Inputs are never rejected based on distribution; only warnings shown
- **Training-only stats:** Reference stats computed from training set only (no leakage from test/validation)
- **Transparent:** Each warning includes code, message, feature, details
- **Not safety-critical:** Clearly labeled as research tool; predictions unchanged
- **No identifiers:** Training stats contain no patient IDs

## 5. Files Changed

**Created:**
- `backend/ml/input_quality.py`
- `reports/training_distribution_stats.json`
- `frontend/src/components/QualityWarnings.jsx`
- `frontend/src/pages/__tests__/InputQuality.test.jsx`
- `docs/INPUT_QUALITY_OOD.md`

**Modified:**
- `backend/api/schemas.py` (added quality models/field)
- `backend/api/inference.py` (integrate quality assessment)
- `frontend/src/components/PredictionResults.jsx` (render warnings)
