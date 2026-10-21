# MedGuard — Model Evaluation Report

**Project:** MedGuard (Triage One)  
**Dataset:** Triagegeist (synthetic) — 80,000 labelled training encounters  
**Target:** Five-level Emergency Severity Index (ESI) Acuity (`1, 2, 3, 4, 5`)  
**Random Seed:** 20260915  

---

## 1. Executive Summary & Clinical Disclaimer

- **Software and Methodology Demonstration Only:** This evaluation demonstrates a reproducible, leakage-safe machine learning workflow for emergency triage. **It is not clinically validated and must never be used for real-time patient triage.** Every number below is measured on synthetic records.
- **All Five Levels Present:** The cohort covers the complete ESI range:
  - **ESI 1:** 3,222 encounters (4.03%) — rarest level
  - **ESI 2:** 13,439 encounters (16.80%)
  - **ESI 3:** 28,921 encounters (36.15%) — dominant level
  - **ESI 4:** 23,020 encounters (28.78%)
  - **ESI 5:** 11,398 encounters (14.25%)
- **Patient Grouping Mandatory:** Patients are kept strictly within either the training partition or the evaluation partition. Overlap between train and test patients is asserted to be 0 at runtime, and the released `train.csv` / `test.csv` files share no patient.
- **Stratified Group Splitting Feasible:** Every level has enough support to be placed across 5 folds, so stratified grouped splitting is used and no level is collapsed.

---

## 2. Experimental Setup

### 2.1 Splits
1. **Held-Out Split:**
   - Strategy: `GroupShuffleSplit(test_size=0.2, random_state=20260915)` grouped by `patient_id`.
   - Training partition: 64,000 rows / 64,000 patients.
   - Held-out partition: 16,000 rows / 16,000 patients.
   - Patient overlap: **0 patients**.
2. **Cross-Validation:**
   - Strategy: 5-fold patient-grouped CV over the 64,000 training rows.
   - Preprocessing (imputer medians, scaling, one-hot categories) is fitted exclusively on the training rows of each fold.

### 2.2 Model Inventory
- **Baselines:**
  - `dummy`: Always predicts the most common class (ESI 3).
- **Candidates:**
  - `logistic_regression`: `LogisticRegression(max_iter=1000, class_weight='balanced', random_state=20260915)`.
  - `random_forest`: `RandomForestClassifier(n_estimators=100, max_depth=None, class_weight='balanced_subsample', random_state=20260915)`.

---

## 3. Comparative Results

### 3.1 Held-Out Evaluation (Identical Cohort: 16,000 rows, 16,000 patients)

| Model | Model Type | Macro-F1 | Balanced Accuracy | Quadratic-Weighted Kappa (QWK) |
|---|---|---|---|---|
| `dummy` | Baseline | 0.1068 | 0.2000 | 0.0000 |
| `logistic_regression` | Candidate | 0.8076 | 0.8280 | 0.8956 |
| `random_forest` | Candidate | **0.8418** | **0.8338** | **0.9120** |

*Note: All models were evaluated on the exact same held-out partition.*

### 3.2 5-Fold Patient-Grouped Cross-Validation (64,000 rows, 64,000 patients)

| Candidate Model | Mean Macro-F1 | Std Macro-F1 | Mean Balanced Accuracy | Std Balanced Accuracy | Mean QWK |
|---|---|---|---|---|---|
| `logistic_regression` | 0.8054 | ±0.0033 | 0.8265 | ±0.0021 | 0.8964 |
| `random_forest` | **0.8421** | ±0.0019 | **0.8338** | ±0.0035 | **0.9134** |

---

## 4. Aggregate Confusion Matrix (Random Forest, 5-Fold CV)

Rows represent True Clinician Labels; Columns represent Model Predictions:

| | Predicted ESI 1 | Predicted ESI 2 | Predicted ESI 3 | Predicted ESI 4 | Predicted ESI 5 | Total True | Class Recall |
|---|---|---|---|---|---|---|---|
| **True ESI 1** | **2298** | 271 | 0 | 0 | 0 | 2569 | **89.5%** |
| **True ESI 2** | 97 | **10379** | 351 | 0 | 0 | 10827 | **95.9%** |
| **True ESI 3** | 0 | 136 | **20021** | 2837 | 99 | 23093 | **86.7%** |
| **True ESI 4** | 0 | 0 | 2728 | **13757** | 1971 | 18456 | **74.5%** |
| **True ESI 5** | 0 | 0 | 99 | 2584 | **6372** | 9055 | **70.4%** |

### Key Observations:
- **Errors Are Adjacent, Not Distant:** Almost every mistake is a neighbouring level — no row shows a jump from ESI 1 to ESI 4 or 5. This is why the quadratic-weighted kappa (0.9134) is far higher than the unweighted macro-F1 (0.8421): the ordinal structure is respected even where the exact level is wrong.
- **Difficulty Concentrates on the Lower-Urgency Levels:** Recall falls from 95.9% (ESI 2) to 74.5% (ESI 4) and 70.4% (ESI 5). These levels share a wide, overlapping clinical profile, and the ESI 4 / ESI 5 boundary accounts for 1,971 + 2,584 = 4,555 confusions — by far the largest single error mode.
- **No Systematic Under-Triage of the Most Urgent Cases:** ESI 1 is never confused with ESI 3 or lower; the residual ESI 1 errors are ESI 1 → ESI 2 (271 cases, 10.5% of the level), which is the clinically safest direction of error.

---

## 5. Model Selection Justification

`RandomForestClassifier` is selected as the primary research prototype model over `LogisticRegression` for the following reasons:
1. **Superior Acuity Separation:** Macro-F1 of 0.8418 vs 0.8076, balanced accuracy 0.8338 vs 0.8280, and QWK 0.9120 vs 0.8956.
2. **Clinical Order Alignment:** A QWK of 0.9120 indicates strong agreement on the ordinal scale, with errors concentrated between neighbouring levels rather than across the range.
3. **Robust Non-linear Boundaries:** Handles non-linear physiological relationships (e.g. shock index, abnormal vital counts, oxygen saturation cutoffs) and the interaction between severity scores and vitals.
4. **Fast and Exact Explainability:** Compatible with exact, tree-based SHAP (`shap.TreeExplainer`), providing deterministic feature attributions without approximation error.

The published figures come from `backend/ml/build_reports.py` and describe the **same feature set and the same estimator configuration as the deployed artifact** (`models/triagegeist/triage_model.joblib`). The deployed model is refitted on all 80,000 labelled rows after selection, which is why the holdout numbers above come from the evaluation-time model rather than from the final refit.
