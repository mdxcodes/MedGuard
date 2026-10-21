# MedGuard — Triagegeist Dataset & Benchmark

**Repository:** /secondary/MedGuard  
**Dataset:** Triagegeist (synthetic, Kaggle competition, hackathon-provided)  
**Status:** **Primary dataset.** Triagegeist replaced the MIMIC-IV-ED demo
baseline as the modelling cohort; the earlier baseline is preserved in the git
history and in the superseded phase documents.

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

`patient_history.csv` is joined one-to-one onto `train.csv` and `test.csv` on
`patient_id`; the join asserts no row loss and no duplicate keys.

## 2. Target Distribution (training)

- ESI 1: 3,222 (4.0%)
- ESI 2: 13,439 (16.8%)
- ESI 3: 28,921 (36.2%)
- ESI 4: 23,020 (28.8%)
- ESI 5: 11,398 (14.2%)

All five ESI classes are present. ESI 1 is the least frequent, so its per-class
metrics are the least stable.

## 3. License & Provenance

- Described as synthetic in `triagegeist/NOTE.md`.
- References Kaggle competition `triagegeist/data`; **no license text is embedded in the local files**.
- Non-commercial research use assumed; **verify before redistribution**.
- The dataset files themselves are not committed to git.

## 4. Feature Set

Triage-time features used by the deployed model:
- `heart_rate`, `respiratory_rate`, `temperature_c`, `spo2`, `systolic_bp`, `diastolic_bp`, `pain_score`
- `age`, `sex`, `language`, `insurance_type`, `arrival_mode`, `transport_origin`, `arrival_season`, `shift`, `arrival_hour`, `arrival_day`, `arrival_month`
- Severity scores: `gcs_total`, `news2_score`
- Anthropometrics: `weight_kg`, `height_cm`, `bmi`
- Utilisation: `num_prior_ed_visits_12m`, `num_prior_admissions_12m`, `num_active_medications`, `num_comorbidities`
- Derived: `shock_index`, `pulse_pressure`, `mean_arterial_pressure`
- Categorical chief-complaint **system** (`chief_complaint_system`)

Excluded (leakage-prone / post-triage): `disposition`, `ed_los_hours`;
identifiers (`patient_id`, `site_id`, `triage_nurse_id`).

The 25 `hx_*` comorbidity flags in `patient_history.csv` are joined by the
data-preparation pipeline but are **not** consumed by the deployed model: the
assessment API cannot supply them for a new presentation, and defaulting them
to "no comorbidity" would fabricate clinical history.

## 5. Evaluation Protocol

- Patient-grouped holdout split on `train.csv` only (GroupShuffleSplit, seed 20260915, test_size 0.2) → 64,000 train / 16,000 holdout rows, 0 patient overlap.
- 5-fold patient-grouped cross-validation over the 64,000 training rows.
- Preprocessing/imputation fitted on the training partition (or each fold's training partition) only.
- `test.csv` labels are withheld → **no test-set metrics are reported**, and the file is never used for selection, tuning or calibration.
- Models: DummyClassifier, Logistic Regression, Random Forest.
- Metrics: macro-F1, balanced accuracy, per-class precision/recall/F1, confusion matrix, quadratic weighted kappa.

## 6. Results

### 6.1 Held-Out Split (16,000 rows, 16,000 patients)

| Model | Balanced Acc | Macro-F1 | QWK |
|-------|-------------|----------|-----|
| DummyClassifier | 0.200 | 0.107 | 0.000 |
| Logistic Regression | 0.828 | 0.808 | 0.896 |
| Random Forest | **0.834** | **0.842** | **0.912** |

### 6.2 5-Fold Patient-Grouped Cross-Validation

| Model | Macro-F1 (mean ± std) | Balanced Acc | QWK |
|-------|----------------------|--------------|-----|
| Logistic Regression | 0.8054 ± 0.0033 | 0.8265 | 0.8964 |
| Random Forest | **0.8421 ± 0.0019** | **0.8338** | **0.9134** |

These are synthetic-dataset validation metrics only. They do not establish
clinical validity, and they are not comparable to any metrics measured on the
superseded MIMIC-IV-ED demo baseline (different dataset, protocol and labels).

## 7. Artifacts (aggregate only — no raw records)

- `reports/triagegeist/dataset_profile.json` — dataset inventory, class distribution, missingness
- `reports/triagegeist/experiment_manifest.json` — config, provenance, file inventory
- `reports/triagegeist/benchmark_results.json` — per-model metrics + confusion matrix
- `reports/model_evaluation.json` — full holdout + CV evaluation of the deployed model
- `reports/data_quality_report.json` — cleaning counts, missingness, feature statistics

## 8. Frontend Integration

- Route `/triagegeist` renders `SyntheticBenchmarkPage.jsx` via `GET /api/triagegeist/status`.
- Shows provenance card, results table, class distribution, synthetic-data disclaimer.
- Graceful unavailable/error states if artifacts missing.

## 9. Reproduction

```bash
cd /secondary/MedGuard
venv/bin/python -m backend.ml.build_reports     # aggregate report artifacts
venv/bin/python -m backend.ml.run_data_prep     # data-quality report
venv/bin/python -m backend.ml.triagegeist_training   # refit + persist the model
```

Restart the backend afterwards so `/api/triagegeist/status` serves the fresh
artifacts.

## 10. Limitations

- Synthetic data only; not real patient data.
- The deployed model is refitted on all 80,000 labelled rows after model selection; the holdout numbers are measured with the evaluation-time model, not the refitted artifact.
- `test.csv` ground truth is withheld, so no claim can be made about the competition test set.
- Not clinically validated; research demonstration only.
