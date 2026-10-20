# MedGuard — Triagegeist Synthetic Benchmark

**Repository:** /secondary/MedGuard  
**Dataset:** Triagegeist (synthetic, Kaggle competition, hackathon-provided)  
**Status:** Implemented — separate benchmark, NOT merged with MIMIC-IV-ED baseline

## 1. Dataset Properties (verified against local files)

| Property | Value |
|----------|-------|
| train.csv | 80,000 rows, 80,000 unique patients, labels present |
| test.csv | 20,000 rows, 20,000 unique patients, NO labels (withheld) |
| chief_complaints.csv | 100,000 rows |
| patient_history.csv | 100,000 rows |
| sample_submission.csv | 20,000 rows |
| Train/test patient overlap | 0 (no patient in both) |
| Test labels available | No (competition ground truth withheld) |

## 2. Target Distribution (training)

- ESI 1: 3,222 (4.0%)
- ESI 2: 13,439 (16.8%)
- ESI 3: 28,921 (36.2%)
- ESI 4: 23,020 (28.8%)
- ESI 5: 11,398 (14.2%)

All five ESI classes present. ESI 1 is least frequent → per-class ESI-1 metrics less stable.

## 3. License & Provenance

- Described as synthetic in `triagegeist/NOTE.md`.
- References Kaggle competition `triagegeist/data`; no license text embedded locally.
- Non-commercial research use assumed; verify before redistribution.
- **Not committed by this session:** `triagegeist/test.csv` left untracked. Pre-existing tracked dataset files were not added.

## 4. Feature Mapping vs MedGuard MIMIC

Directly compatible triage-time features:
- `heart_rate`, `respiratory_rate`, `temperature_c`, `spo2` (O2 sat), `systolic_bp`, `diastolic_bp`, `pain_score`
- `age`, `sex`, `insurance_type`, `arrival_mode`
- Derived: `shock_index`, `pulse_pressure`, `map`, `abnormal_vital_count`, `news2_score`

Excluded (leakage-prone / post-triage): `disposition`, `ed_los_hours`, identifiers (`patient_id`, `site_id`, `triage_nurse_id`), free-text complaints (`chief_complaint_system` NLP deferred).

## 5. Evaluation Protocol

- Patient-grouped holdout split on `train.csv` only (GroupShuffleSplit, seed 20260915, test_size 0.2).
- Preprocessing/imputation fit on training partition only.
- Test.csv labels withheld → no test-set metrics reported (not used for selection/tuning/calibration).
- Models: DummyClassifier, Logistic Regression, Random Forest.
- Metrics: macro-F1, balanced accuracy, per-class precision/recall/F1, confusion matrix, quadratic weighted kappa.

## 6. Results (validation holdout)

| Model | Balanced Acc | Macro-F1 | QWK |
|-------|-------------|----------|-----|
| DummyClassifier | 0.200 | 0.107 | 0.000 |
| Logistic Regression | 0.809 | 0.814 | 0.897 |
| Random Forest | 0.843 | 0.850 | 0.918 |

These are synthetic-dataset validation metrics only. They are NOT comparable to the MIMIC-IV-ED demo baseline (different dataset, protocol, and labels) and do not establish clinical validity.

## 7. Artifacts (aggregate only — no raw records)

- `reports/triagegeist/dataset_profile.json` — dataset inventory, class distribution, leakage safeguards
- `reports/triagegeist/experiment_manifest.json` — config, provenance, software versions
- `reports/triagegeist/benchmark_results.json` — per-model metrics + confusion matrix

## 8. Frontend Integration

- Route `/triagegeist` renders `SyntheticBenchmarkPage.jsx` via `GET /api/triagegeist/status`.
- Shows provenance card, results table, class distribution, synthetic-data disclaimer.
- Graceful unavailable/error states if artifacts missing.

## 9. Reproduction

```bash
cd /secondary/MedGuard
PYTHONPATH=. venv/bin/python reports/triagegeist/train_benchmark.py
```
Regenerates `reports/triagegeist/benchmark_results.json`. Restart backend to serve via `/api/triagegeist/status`.

## 10. Limitations

- Synthetic data only; not real patient data.
- No cross-validation reported (single holdout); results may vary with split seed.
- Chief-complaint NLP and patient-history features not used in baseline (deferred ablation).
- Not clinically validated; research demonstration only.
