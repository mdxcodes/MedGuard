# MedGuard — Data Quality Report

Generated: 2026-10-21 11:22 UTC by `backend/ml/run_data_prep.py`

Dataset: **Triagegeist synthetic dataset**. This report contains aggregate counts only — no patient identifiers and no free-text complaints.

## 1. Row counts

| Metric | Value |
|---|---|
| `raw_joined_rows` | 80000 |
| `rows_excluded_missing_target` | 0 |
| `modelling_rows` | 80000 |
| `train_rows` | 64000 |
| `test_rows` | 16000 |
| `train_patients` | 64000 |
| `test_patients` | 16000 |

## 2. Target-label distribution

Original five-level ESI acuity, preserved exactly as recorded (no remapping to Low/Moderate/High/Critical).

| ESI level | Rows | Share of labelled rows |
|---|---|---|
| ESI 1 | 3222 | 4.03% |
| ESI 2 | 13439 | 16.80% |
| ESI 3 | 28921 | 36.15% |
| ESI 4 | 23020 | 28.78% |
| ESI 5 | 11398 | 14.25% |
| **Total labelled** | **80000** | 100.00% |

## 3. Missing-value percentages (modelling rows)

| Feature | Missing % |
|---|---|
| `heart_rate` | 0.00% |
| `respiratory_rate` | 3.83% |
| `temperature_c` | 0.72% |
| `spo2` | 0.00% |
| `systolic_bp` | 5.48% |
| `diastolic_bp` | 5.42% |
| `pain_score` | 13.94% |
| `age` | 0.00% |
| `arrival_hour` | 0.00% |
| `shock_index` | 5.18% |
| `num_prior_ed_visits_12m` | 0.00% |
| `num_active_medications` | 0.00% |
| `arrival_mode` | 0.00% |
| `sex` | 0.00% |
| `insurance_type` | 0.00% |
| `chief_complaint_system` | 0.00% |

## 4. Rejected and converted values

| Rule | Count |
|---|---|
| `rows_dropped_missing_target` | 0 |
| `fahrenheit_converted` | 0 |
| `celsius_detected` | 79426 |
| `temperature_out_of_envelope` | 0 |
| `temperature_unparseable` | 0 |
| `sbp_out_of_range` | 0 |
| `dbp_out_of_range` | 0 |
| `dbp_greater_than_sbp` | 0 |
| `heart_rate_out_of_range` | 0 |
| `respiratory_rate_out_of_range` | 0 |
| `spo2_out_of_range` | 0 |
| `pain_unassessable` | 11156 |
| `pain_unparseable` | 0 |
| `pain_out_of_range` | 0 |

## 5. Numeric feature ranges (after cleaning)

| Feature | n valid | min | p25 | median | p75 | max | mean |
|---|---|---|---|---|---|---|---|
| `temperature_c` | 79426 | 35.10 | 37.00 | 37.50 | 38.10 | 41.80 | 37.63 |
| `heart_rate` | 80000 | 30.00 | 78.20 | 89.60 | 103.20 | 207.70 | 91.86 |
| `respiratory_rate` | 76933 | 8.00 | 15.20 | 17.30 | 20.30 | 51.50 | 18.33 |
| `spo2` | 80000 | 60.40 | 94.10 | 97.00 | 98.90 | 100.00 | 95.79 |
| `systolic_bp` | 75618 | 50.00 | 106.40 | 123.20 | 138.40 | 226.90 | 121.85 |
| `diastolic_bp` | 75666 | 30.00 | 65.60 | 75.40 | 84.30 | 134.80 | 74.57 |
| `pain_score` | 68844 | 0.00 | 3.00 | 5.00 | 7.00 | 10.00 | 5.40 |

## 6. Validation results

| Check | Status | Severity | Detail |
|---|---|---|---|
| `checksum_verification` | **PASS** | info | Not applicable: the Triagegeist release is synthetic and ships without a SHA256SUMS.txt manifest, so there is no checksum to verify. Dataset integrity is instead enforced by schema validation and the one-to-one join assertion. |
| `duplicate_patient_id` | **PASS** | info | 0 duplicate patient_id value(s) in the joined dataset. |
| `one_to_one_join_integrity` | **PASS** | info | joined set kept 80000 of 80000 rows. |
| `missing_target_labels` | **PASS** | info | 0 row(s) had no clinician-assigned ESI label and were excluded from supervised learning. No label was imputed. |
| `esi_level_coverage` | **PASS** | info | All five ESI levels are represented. |
| `esi_level_support` | **PASS** | info | Every present ESI level has at least n_splits rows. |
| `temperature_unit_handling` | **WARN** | warning | 0 value(s) converted from Fahrenheit to Celsius; 79426 value(s) identified as already Celsius; 0 value(s) rejected as implausible and set to missing. |
| `implausible_diastolic_blood_pressure` | **PASS** | info | No implausible diastolic values found. |
| `pain_score_parsing` | **WARN** | warning | 11156 pain entr(ies) invalid: 11156 unassessable sentinel(s), 0 unparseable, 0 out of the 0-10 range. All converted to missing with a retained missingness indicator. |
| `vital_sign_missingness` | **WARN** | warning | Missing vital-sign values (train-fitted median imputation plus explicit indicators): heart_rate=0.0%; respiratory_rate=3.83%; temperature_c=0.72%; spo2=0.0%; systolic_bp=5.48%; diastolic_bp=5.42%; pain_score=13.94%; age=0.0%; arrival_hour=0.0%; shock_index=5.18%; num_prior_ed_visits_12m=0.0%; num_active_medications=0.0%. Missingness is not missing-at-random. |
| `age_availability` | **PASS** | info | Age is supplied by Triagegeist on 80000 row(s); 0 value(s) missing. Age is used as a model feature and is never fabricated or imputed from a missing field. |
| `leakage_column_exclusion` | **PASS** | info | disposition, ed_los_hours, and the post-triage tables diagnosis, pyxis, medrecon are excluded from features. Post-triage vitalsign measurements are excluded. Verified by an automated assertion. |
| `patient_grouped_split` | **PASS** | info | 64000 train rows / 64000 patients and 16000 test rows / 16000 patients; 0 patient(s) appear in both sets (must be 0). |
| `stratified_group_split_feasibility` | **PASS** | info | Sufficient samples per class for stratified grouping |
| `preprocessing_fit_isolation` | **PASS** | info | Preprocessor fitted on training rows only; 63 model-input features emitted with no identifier columns. |

## 7. Check summary

- Total checks: **None**  
- Failed: **None**  
- Warnings: **None**

## 8. Notes

- `FAIL` in a check reflects a documented dataset limitation of the demo subset, not a crash in the pipeline.
- No age field is available in the Triagegeist synthetic dataset. Age was neither fabricated nor imputed.
- Post-triage information (`disposition`, `ed_los_hours`) is excluded from all features.
- Preprocessing statistics are fitted on training rows only, inside each cross-validation fold.
