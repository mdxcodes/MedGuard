# MedGuard Model Card — Demo Acuity Classifier

## 1. Model Details
- **Model Name:** MedGuard Triage One (Demo Research Prototype)
- **Model Version:** 0.2.0-demo
- **Model Type:** Scikit-learn Pipeline with `RandomForestClassifier`
- **Parameters:**
  - `n_estimators`: 80
  - `max_depth`: 6
  - `min_samples_leaf`: 4
  - `min_samples_split`: 6
  - `class_weight`: `"balanced_subsample"`
  - `random_state`: 20260915
- **Input Features (35 transformed features):**
  - Triage vitals (temperature normalized to Celsius, heart rate, respiratory rate, oxygen saturation, systolic BP, diastolic BP with outlier removal).
  - Derived physiology: Shock Index (`heartrate / sbp`), Pulse Pressure (`sbp - dbp`), Abnormal Vital Count (thresholded vs clinical constants).
  - Categorical context: `arrival_transport` (one-hot encoded with frequency thresholding).
  - Free-text chief complaint: normalized text processed with sublinear TF-IDF (vocabulary fitted on training split only).
  - Missingness indicators: 7 binary indicators (`temperature_missing`, `heartrate_missing`, `resprate_missing`, `o2sat_missing`, `sbp_missing`, `dbp_missing`, `pain_missing`).
- **Target:** Emergency Severity Index (ESI) Acuity: `1, 2, 3, 4, 5`.

## 2. Intended Use
- **Intended Purpose:** Research, technical feasibility assessment, and educational demonstration of machine learning engineering for healthcare data.
- **Out-of-Scope / Prohibited Uses:**
  - Live patient triage.
  - Clinical diagnostic decision support.
  - Autonomous emergency department routing.
  - Any commercial deployment without full-scale clinical trials and regulatory authorization.

## 3. Training & Evaluation Data
- **Dataset:** MIMIC-IV Emergency Department (MIMIC-IV-ED) Demo Subset v2.2.
- **Records:** 207 labeled emergency visits from 56 unique patients (out of 222 total stays; 15 visits dropped due to missing clinician acuity labels).
- **Patient Grouping:** Enforced strictly via `subject_id`. No patient overlap occurred between training and testing sets.
- **Known Data Skew:**
  - ESI 1: 18 visits (8.7%)
  - ESI 2: 97 visits (46.9%)
  - ESI 3: 90 visits (43.5%)
  - ESI 4: 2 visits (0.97%)
  - ESI 5: 0 visits (0.0%)

## 4. Performance Summary
- **5-Fold Patient-Grouped Cross-Validation:**
  - Macro-F1: 0.5739 ± 0.1053
  - Balanced Accuracy: 0.6004 ± 0.1026
  - Quadratic-Weighted Kappa: 0.5032 ± 0.0345
- **Held-Out Test Set (44 visits across 12 patients):**
  - Macro-F1: 0.5303 (Baseline Most Frequent: 0.2011)
  - Balanced Accuracy: 0.5719 (Baseline Most Frequent: 0.3333)
  - Quadratic-Weighted Kappa: 0.4974
- **Per-Class Recall (CV Aggregate):**
  - ESI 1: 66.7% (12 / 18)
  - ESI 2: 54.6% (53 / 97)
  - ESI 3: 66.7% (60 / 90)
  - ESI 4: 0.0% (0 / 2 — sparse support)
  - ESI 5: N/A (0 samples in dataset)

## 5. Explainability (SHAP)
- **Methodology:** Exact tree-based SHAP values using `shap.TreeExplainer` on the transformed feature representations.
- **Top Attributions:** Physiological signals (systolic blood pressure, shock index, oxygen saturation) and key chief-complaint tokens (e.g. `s/p`, `chest`, `altered`).
- **Ethical & Safety Notice:** SHAP values represent statistical attribution within the tree ensemble; they do not imply biological causality, pathological etiology, or clinical justification.

## 6. Known Limitations
1. **Zero Support for ESI 5:** The model cannot identify Level 5 triage cases because none exist in the training subset.
2. **Inadequate Support for ESI 4:** Only 2 cases exist; metrics for this class are not statistically reliable.
3. **Small Sample Size:** 207 visits across 56 patients is insufficient for production clinical machine learning.
4. **Absence of Age Field:** Age was not available in this demo subset (requires MIMIC-IV Core `patients` table).
