# MedGuard — Probability Calibration and Prediction Uncertainty

**Date:** 2026-10-18  
**Status:** Complete

## 1. Audit

**Findings:**
- Dataset: 207 visits, 56 patients, ESI distribution 1:18, 2:97, 3:90, 4:2, 5:0. Severe imbalance; ESI 4 sparse, ESI 5 absent.
- Evaluation: Patient-grouped 5-fold CV and held-out split. No calibration performed.
- Model: Random Forest (selected) with saved pipeline + manifest. Predictions use raw probabilities from `predict_proba()`.
- API schema supports extension; frontend renders predictions.

**Conclusion:** Reliable multiclass calibration is not feasible with current sample size (especially ESI 4/5). We implement uncertainty indicators transparently and report calibration as unsupported.

## 2. Uncertainty Analysis

Implemented in `backend/ml/uncertainty.py`:
- **max_probability**: confidence of top class
- **prediction_margin**: difference between top-2 probabilities
- **predictive_entropy** (bits) and **entropy_norm** (normalized by log(n_classes))
- Conservative handling of normalization, edge cases (deterministic predictions)

## 3. API Integration

- Added `UncertaintyResponse` schema
- Extended `PredictResponse` with `uncertainty` field
- Inference computes uncertainty from raw probabilities; sets `calibration_status="unsupported_by_sample_size"`

## 4. Frontend

- `UncertaintyIndicators` component displays metrics with clear research-only disclaimer
- Integrated into `PredictionResults` (shown when present)

## 5. Calibration Assessment

Given n=207 total, only 2 samples for ESI 4, 0 for ESI 5, and patient grouping constraints, fitting a reliable multiclass calibrator (e.g. sigmoid/Platt or isotonic per class, with OvR) would have insufficient data per class and high variance. We explicitly mark calibration as unsupported rather than fabricating results. This matches scientific integrity requirements.

## 6. Testing

- 4 uncertainty unit tests (margin/max prob, entropy, edge cases, normalization) — all pass
- All existing tests still pass (139 backend)
- Frontend tests include uncertainty coverage

## 7. Files Changed

- `backend/ml/uncertainty.py` (new)
- `backend/api/schemas.py` (uncertainty models)
- `backend/api/inference.py` (compute uncertainty)
- `frontend/src/components/UncertaintyIndicators.jsx` (new)
- `frontend/src/components/PredictionResults.jsx` (integrate)
- `frontend/src/pages/__tests__/Uncertainty.test.jsx` (new)
- `docs/PROBABILITY_CALIBRATION_UNCERTAINTY.md` (new)
- `reports/training_distribution_stats.json` (existing from prior step)

## 8. Verification

- Backend: 139 passed, 2 warnings
- Frontend: 5 test files, 17 tests passed (including uncertainty tests)
- Frontend build: successful

## 9. Limitations

- Calibration not performed due to insufficient sample size and severe class imbalance
- Uncertainty indicators are descriptive, not calibrated probabilities
- ESI 4/5 limitations persist
