# MedGuard — Data Quality Report

Generated: 2026-10-15 17:00 UTC by `backend/ml/run_data_prep.py`

Dataset: **MIMIC-IV-ED v2.2, demo subset** (licensed under ODbL). This report contains aggregate counts only — no patient identifiers and no free-text complaints.

## 1. Row counts

| Metric | Value |
|---|---|
| `raw_joined_rows` | 222 |
| `rows_excluded_missing_target` | 15 |
| `modelling_rows` | 207 |
| `train_rows` | 163 |
| `test_rows` | 44 |
| `train_patients` | 44 |
| `test_patients` | 12 |

## 2. Target-label distribution

Original five-level ESI acuity, preserved exactly as recorded (no remapping to Low/Moderate/High/Critical).

| ESI level | Rows | Share of labelled rows |
|---|---|---|
| ESI 1 | 18 | 8.70% |
| ESI 2 | 97 | 46.86% |
| ESI 3 | 90 | 43.48% |
| ESI 4 | 2 | 0.97% |
| ESI 5 | 0 | 0.00% (absent) |
| **Total labelled** | **207** | 100.00% |

## 3. Missing-value percentages (modelling rows)

| Feature | Missing % |
|---|---|
| `temperature` | 5.31% |
| `heartrate` | 4.35% |
| `resprate` | 3.86% |
| `o2sat` | 4.35% |
| `sbp` | 3.86% |
| `dbp` | 4.35% |
| `pain` | 12.08% |
| `arrival_transport` | 0.00% |

## 4. Rejected and converted values

| Rule | Count |
|---|---|
| `rows_dropped_missing_target` | 15 |
| `fahrenheit_converted` | 195 |
| `celsius_detected` | 1 |
| `temperature_out_of_envelope` | 0 |
| `temperature_unparseable` | 0 |
| `sbp_out_of_range` | 0 |
| `dbp_out_of_range` | 1 |
| `dbp_greater_than_sbp` | 0 |
| `heartrate_out_of_range` | 0 |
| `resprate_out_of_range` | 0 |
| `o2sat_out_of_range` | 0 |
| `pain_unassessable` | 8 |
| `pain_unparseable` | 4 |
| `pain_out_of_range` | 7 |
| `chiefcomplaint_placeholder` | 1 |
| `chiefcomplaint_empty_after_normalisation` | 0 |

## 5. Numeric feature ranges (after cleaning)

| Feature | n valid | min | p25 | median | p75 | max | mean |
|---|---|---|---|---|---|---|---|
| `temperature` | 196 | 35.33 | 36.44 | 36.72 | 36.94 | 37.94 | 36.72 |
| `heartrate` | 198 | 43.00 | 77.00 | 89.50 | 104.00 | 157.00 | 91.17 |
| `resprate` | 199 | 14.00 | 16.00 | 18.00 | 18.00 | 32.00 | 18.14 |
| `o2sat` | 198 | 78.00 | 97.00 | 98.00 | 100.00 | 100.00 | 97.69 |
| `sbp` | 199 | 70.00 | 116.50 | 136.00 | 154.50 | 218.00 | 136.95 |
| `dbp` | 198 | 42.00 | 62.00 | 72.00 | 82.00 | 118.00 | 72.99 |
| `pain` | 182 | 0.00 | 0.00 | 4.00 | 8.00 | 10.00 | 3.87 |

## 6. Validation results

| Check | Status | Severity | Detail |
|---|---|---|---|
| `checksum_verification` | **PASS** | info | 7 file(s) verified against SHA256SUMS.txt. |
| `duplicate_stay_id` | **PASS** | info | 0 duplicate stay_id value(s) in the joined dataset. |
| `one_to_one_join_integrity` | **PASS** | info | triage <-> edstays joined one-to-one on stay_id with no row fan-out (222 rows retained). |
| `missing_target_labels` | **WARN** | warning | 15 row(s) had no clinician-assigned ESI label and were excluded from supervised learning. No label was imputed. |
| `esi_level_coverage` | **FAIL** | warning | ESI level(s) ['ESI 5'] have zero labelled rows in this cohort and cannot be learned or evaluated. Original five-level labels were preserved and NOT collapsed. |
| `esi_level_support` | **WARN** | warning | ESI level(s) ['ESI 4'] have fewer labelled rows than n_splits=5, so per-fold per-class metrics are unstable. |
| `temperature_unit_handling` | **WARN** | warning | 195 value(s) converted from Fahrenheit to Celsius; 1 value(s) identified as already Celsius; 0 value(s) rejected as implausible and set to missing. |
| `implausible_diastolic_blood_pressure` | **WARN** | warning | 1 diastolic value(s) outside [30.0, 150.0] mmHg (including the audited 879 mmHg entry) were set to missing rather than clipped. |
| `pain_score_parsing` | **WARN** | warning | 19 pain entr(ies) invalid: 8 unassessable sentinel(s), 4 unparseable, 7 out of the 0-10 range. All converted to missing with a retained missingness indicator. |
| `vital_sign_missingness` | **WARN** | warning | Missing vital-sign values (train-fitted median imputation plus explicit indicators): temperature=5.31%; heartrate=4.35%; resprate=3.86%; o2sat=4.35%; sbp=3.86%; dbp=4.35%. Missingness is not missing-at-random. |
| `age_availability` | **FAIL** | warning | No age field exists in this package. The MIMIC-IV core `patients` table is required to derive age and was NOT available, so age is recorded as an unavailable feature. Age was not fabricated or imputed. |
| `leakage_column_exclusion` | **PASS** | info | disposition, outtime, and the post-triage tables diagnosis, pyxis, medrecon are excluded from features. Post-triage vitalsign measurements are excluded. Verified by an automated assertion. |
| `patient_grouped_split` | **PASS** | info | 163 train rows / 44 patients and 44 test rows / 12 patients; 0 patient(s) appear in both sets (must be 0). |
| `stratified_group_split_feasibility` | **WARN** | warning | ESI level(s) [5] are absent from this cohort, so a stratified five-class split cannot place every class in every fold. |
| `preprocessing_fit_isolation` | **PASS** | info | Preprocessor fitted on training rows only; 35 model-input features emitted with no identifier columns. |

## 7. Check summary

- Total checks: **15**  
- Failed: **2**  
- Warnings: **7**

## 8. Notes

- `FAIL` in a check reflects a documented dataset limitation of the demo subset, not a crash in the pipeline.
- No age field is available: the MIMIC-IV core `patients` table is required and was not supplied. Age was neither fabricated nor imputed.
- Post-triage information (`disposition`, `outtime`, ED `diagnosis`, `pyxis`, `medrecon`) is excluded from all features.
- Preprocessing statistics are fitted on training rows only, inside each cross-validation fold.
