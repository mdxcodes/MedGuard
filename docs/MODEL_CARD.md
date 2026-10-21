# MedGuard Model Card — Demo Acuity Classifier

> **Dataset:** Triagegeist (synthetic). This model card describes the current
> Triagegeist model. The earlier MIMIC-IV-ED demo card is retained in the
> git history.

## 1. Model Details
- **Model Name:** MedGuard Triage One (Demo Research Prototype)
- **Model Version:** 0.2.0-demo
- **Model Type:** Scikit-learn Pipeline with `RandomForestClassifier`
- **Parameters** (read back from the deployed estimator):
  - `n_estimators`: 100
  - `max_depth`: `None` (fully grown trees)
  - `min_samples_leaf`: 1
  - `min_samples_split`: 2
  - `class_weight`: `"balanced_subsample"`
  - `random_state`: 20260915
- **Input Features (66 transformed features from 31 source columns):**
  - Numeric triage variables: age, arrival context (`arrival_hour`, `arrival_day`, `arrival_month`), vitals (`heart_rate`, `respiratory_rate`, `temperature_c` normalized to Celsius, `spo2`, `systolic_bp`, `diastolic_bp`), `pain_score`, `gcs_total`, `weight_kg`, `height_cm`, `bmi`, `news2_score`, and utilisation counts.
  - Derived physiology: `shock_index` (`heart_rate / systolic_bp`), `pulse_pressure` (`systolic_bp - diastolic_bp`), `mean_arterial_pressure`.
  - Categorical context: `sex`, `language`, `insurance_type`, `arrival_mode`, `transport_origin`, `arrival_season`, `shift`, `chief_complaint_system` (one-hot encoded).
  - The 25 `hx_*` comorbidity flags in `patient_history.csv` are **not** consumed: the assessment API cannot supply them for a new presentation, and filling them with "no comorbidity" would fabricate clinical history. The join is still exercised by the data-preparation pipeline.
- **Target:** Emergency Severity Index (ESI) Acuity: `1, 2, 3, 4, 5`.
- **Excluded from the model:** `patient_id`, `site_id`, `triage_nurse_id` (identifiers) and `disposition`, `ed_los_hours` (post-triage outcome — leakage).

## 2. Intended Use
- **Intended Purpose:** Research, technical feasibility assessment, and educational demonstration of machine learning engineering for healthcare data.
- **Out-of-Scope / Prohibited Uses:**
  - Live patient triage.
  - Clinical diagnostic decision support.
  - Autonomous emergency department routing.
  - Any commercial deployment without full-scale clinical trials and regulatory authorization.
  - Any inference on real patient data of any kind: the model was fitted on synthetic records only.

## 3. Training & Evaluation Data
- **Dataset:** Triagegeist synthetic release (`triagegeist/`), Kaggle competition files.
- **Records:** 80,000 labelled training encounters (80,000 unique patients) and 20,000 unlabelled test encounters (20,000 unique patients).
- **Patient Grouping:** Enforced strictly via `patient_id`. The train and test releases share no patient, and the within-cohort split assigns every patient to exactly one side (0 overlap, asserted at runtime).
- **Known Data Skew:**
  - ESI 1: 3,222 encounters (4.0%)
  - ESI 2: 13,439 encounters (16.8%)
  - ESI 3: 28,921 encounters (36.2%)
  - ESI 4: 23,020 encounters (28.8%)
  - ESI 5: 11,398 encounters (14.2%)
- **All five ESI levels are present.** The rarest level is ESI 1; it has enough support to be learned and measured, but its per-class metrics remain the least stable.

## 4. Performance Summary
- **5-Fold Patient-Grouped Cross-Validation** (64,000 training encounters):
  - Macro-F1: 0.8421 ± 0.0019
  - Balanced Accuracy: 0.8338 ± 0.0035
  - Quadratic-Weighted Kappa: 0.9134 ± 0.0021
- **Held-Out Split** (16,000 encounters / 16,000 patients):
  - Macro-F1: 0.8418
  - Balanced Accuracy: 0.8338
  - Quadratic-Weighted Kappa: 0.9120
  - Baselines on the same holdout: dummy 0.1068 macro-F1, logistic regression 0.8076 macro-F1.
- **Per-Class Performance (holdout):**
  - ESI 1: precision 0.964, recall 0.899, F1 0.930 (n = 653)
  - ESI 2: precision 0.962, recall 0.962, F1 0.962 (n = 2,612)
  - ESI 3: precision 0.865, recall 0.861, F1 0.863 (n = 5,828)
  - ESI 4: precision 0.705, recall 0.741, F1 0.723 (n = 4,564)
  - ESI 5: precision 0.758, recall 0.706, F1 0.731 (n = 2,343)

## 5. Explainability (SHAP)
- **Methodology:** Exact tree-based SHAP values using `shap.TreeExplainer` on the transformed feature representations.
- **Top Attributions:** `news2_score`, `gcs_total`, `pain_score`, `spo2`, `temperature_c`, `respiratory_rate`, `num_prior_ed_visits_12m`, `mean_arterial_pressure` — severity scores and vital signs dominate, which is consistent with how ESI is assigned clinically.
- **Ethical & Safety Notice:** SHAP values represent statistical attribution within the tree ensemble; they do not imply biological causality, pathological etiology, or clinical justification.

## 6. Known Limitations
1. **Synthetic data only.** Every number above is measured on synthetic records. None of it is evidence of performance on real emergency-department patients.
2. **Rarest class remains ESI 1.** With 4.0% of the cohort, per-class metrics for ESI 1 are less stable than for the dominant levels.
3. **No clinical validation.** The model has never been validated against clinician-assigned acuity on real data and must not be used clinically.
4. **Model artifacts are not committed.** `models/` is git-ignored; a deployment needs an artifact-delivery mechanism (private registry, credentialed storage, or a build-time fetch from a protected source).
5. **Licensing unverified.** The local Triagegeist files carry no embedded license text. Confirm the redistribution terms before sharing data or derived artifacts.
