# Final Hardening Audit

## Status

All existing tests pass (139 backend, 21 frontend). Frontend builds successfully.
No security-critical issues found. Core ML pipeline intact.

### Triagegeist Benchmark

- **Dataset validation**: Triagegeist dataset (80K train / 20K test) validated for structure,
  label encoding, patient-grouped splits, and leakage safeguards.
- **Benchmark implemented**: Three models trained with patient-grouped splits:
  - DummyClassifier (most frequent class baseline)
  - Logistic Regression (median-imputed features)
  - Random Forest (100 trees)
- **Metrics reported**: balanced accuracy, macro-F1, quadratic weighted kappa,
  per-class precision/recall/F1, confusion matrix.
- **Results**:
  - DummyClassifier: BA=0.200, Macro-F1=0.107, QWK=0.0
  - Logistic Regression: BA=0.376, Macro-F1=0.365, QWK=0.442
  - Random Forest: BA=0.377, Macro-F1=0.380, QWK=0.446
- **Feature set**: Structured triage-time features only (vitals + derived features),
  no chief-complaint NLP, no post-triage data.
- **Patient grouping**: splits enforced via `patient_id` — no patient appears in both
  train and test sets.
- **Target**: `triage_acuity` with ESI labels 1-5, matching MIMIC baseline ordering.

### Code fixes

- Fixed `backend/ml/evaluate.py`: removed erroneous `\'` (backslash-single-quote)
  sequences inside f-strings; added missing `build_drift_payload()` function.
- All 139 backend tests pass; frontend build succeeds.

### Known scientific limitations

- Triagegeist is a synthetic dataset; results not directly comparable to real-world
  clinical performance.
- ESI Level 4 and Level 5 are sparsely populated in both MIMIC and Triagegeist.
- Models trained on triage-time vitals only; no NLP on chief complaints or history.
- Probability calibration and uncertainty estimates not included in this sprint.