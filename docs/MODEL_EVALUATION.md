# MedGuard — Phase 2 Model Evaluation Report

**Project:** MedGuard (Triage One)  
**Evaluation Date:** 2026-10-16  
**Auditor / ML Lead:** Lead AI/ML Engineer  
**Dataset:** MIMIC-IV-ED v2.2 Demo Subset (207 usable rows, 56 unique patients)  
**Target:** Original Five-Level Emergency Severity Index (ESI) Acuity (`1, 2, 3, 4, 5`)  
**Random Seed:** 20260915  

---

## 1. Executive Summary & Clinical Disclaimer

- **Software and Methodology Demonstration Only:** This evaluation demonstrates a reproducible, leakage-safe machine learning workflow for emergency triage. **It is not clinically validated and must never be used for real-time patient triage.**
- **Extreme Class Imbalance & Absent Classes:** In this demo dataset:
  - **ESI 1:** 18 visits (8.7%)
  - **ESI 2:** 97 visits (46.9%)
  - **ESI 3:** 90 visits (43.5%)
  - **ESI 4:** 2 visits (0.97%) — sparse support
  - **ESI 5:** 0 visits (0.0%) — completely absent
- **Patient Grouping Mandatory:** Repeated visits from the same patient are kept strictly within either the training partition or the evaluation partition. The overlap between train and test patients across every fold is verified to be 0.
- **Stratified Group Splitting Infeasible:** Standard stratified group splitting cannot place ESI 5 (0 samples) or ESI 4 (2 samples) across 5 folds. Unstratified `GroupKFold` is used, and sparse classes are evaluated honestly with `zero_division=0`.

---

## 2. Experimental Setup

### 2.1 Splits
1. **Held-Out Test Split:**
   - Strategy: `GroupShuffleSplit(test_size=0.2, random_state=20260915)` grouped by `subject_id`.
   - Training partition: 163 rows across 44 patients.
   - Held-out partition: 44 rows across 12 patients.
   - Patient overlap: **0 patients**.
2. **Cross-Validation:**
   - Strategy: 5-fold `GroupKFold` grouped by `subject_id` over all 207 rows.
   - Preprocessing steps (imputer medians, scaling, one-hot categories, TF-IDF vocabulary) are fitted exclusively on training rows within each fold.

### 2.2 Model Inventory
- **Baselines:**
  - `dummy_most_frequent`: Always predicts the most common class (ESI 2).
  - `dummy_stratified`: Random predictions proportional to empirical training class distributions.
- **Candidates:**
  - `logistic_regression`: Multiclass `LogisticRegression(solver='saga', C=0.5, max_iter=5000)`.
  - `random_forest`: `RandomForestClassifier(n_estimators=80, max_depth=6, min_samples_leaf=4, class_weight='balanced_subsample')`.

---

## 3. Comparative Results

### 3.1 Held-Out Test Evaluation (Identical Test Cohort: 44 rows, 12 patients)

| Model | Model Type | Macro-F1 | Balanced Accuracy | Quadratic-Weighted Kappa (QWK) |
|---|---|---|---|---|
| `dummy_most_frequent` | Baseline | 0.2011 | 0.3333 | 0.0000 |
| `dummy_stratified` | Baseline | 0.2444 | 0.2570 | -0.3063 |
| `logistic_regression` | Candidate | 0.3835 | 0.3772 | 0.2232 |
| `random_forest` | Candidate | **0.5303** | **0.5719** | **0.4974** |

*Note: All models were evaluated on the exact same held-out test partition.*

### 3.2 5-Fold Patient-Grouped Cross-Validation (Full 207 rows, 56 patients)

| Candidate Model | Mean Macro-F1 | Std Macro-F1 | Mean Balanced Accuracy | Std Balanced Accuracy | Mean QWK |
|---|---|---|---|---|---|
| `logistic_regression` | 0.5540 | ±0.1090 | 0.5379 | ±0.1092 | 0.4417 |
| `random_forest` | **0.5739** | ±0.1053 | **0.6004** | ±0.1026 | **0.5032** |

---

## 4. Fold-by-Fold Breakdown (Random Forest Candidate)

| Fold | Train Rows (Pts) | Val Rows (Pts) | Val Class Counts | Macro-F1 | Balanced Acc | QWK |
|---|---|---|---|---|---|---|
| Fold 0 | 165 (45) | 42 (11) | ESI 1: 3, ESI 2: 24, ESI 3: 15 | 0.6465 | 0.6528 | 0.5070 |
| Fold 1 | 165 (44) | 42 (12) | ESI 1: 3, ESI 2: 19, ESI 3: 20 | 0.6838 | 0.7263 | 0.5274 |
| Fold 2 | 166 (45) | 41 (11) | ESI 1: 5, ESI 2: 20, ESI 3: 16 | 0.5972 | 0.5750 | 0.4549 |
| Fold 3 | 166 (45) | 41 (11) | ESI 1: 3, ESI 2: 14, ESI 3: 22, ESI 4: 2 | 0.4199 | 0.4491 | 0.4797 |
| Fold 4 | 166 (45) | 41 (11) | ESI 1: 4, ESI 2: 20, ESI 3: 17 | 0.5219 | 0.5990 | 0.5468 |
| **Mean ± Std** | — | — | — | **0.5739 ± 0.1053** | **0.6004 ± 0.1026** | **0.5032 ± 0.0345** |

### Key Observations:
- **Fold 3 Performance Drop:** Fold 3 contains both of the dataset's ESI 4 examples. Because the training set in Fold 3 has 0 examples of ESI 4, the model predictably achieves 0 recall on ESI 4, dropping the unweighted Macro-F1 to 0.4199.
- **High Acuity Recognition (ESI 1):** In Fold 1, ESI 1 recall was 100% (3/3). Overall cross-validation aggregate recall for ESI 1 was 66.7% (12/18).

---

## 5. Aggregate Confusion Matrix (Random Forest, 5-Fold CV)

Rows represent True Clinician Labels; Columns represent Model Predictions:

| | Predicted ESI 1 | Predicted ESI 2 | Predicted ESI 3 | Predicted ESI 4 | Predicted ESI 5 | Total True | Class Recall |
|---|---|---|---|---|---|---|---|
| **True ESI 1** | **12** | 6 | 0 | 0 | 0 | 18 | **66.7%** |
| **True ESI 2** | 10 | **53** | 34 | 0 | 0 | 97 | **54.6%** |
| **True ESI 3** | 1 | 29 | **60** | 0 | 0 | 90 | **66.7%** |
| **True ESI 4** | 0 | 1 | 1 | **0** | 0 | 2 | **0.0%** (Sparse) |
| **True ESI 5** | 0 | 0 | 0 | 0 | **0** | 0 | **N/A** (Absent) |

---

## 6. Model Selection Justification

`RandomForestClassifier` is selected as the primary research prototype model over `LogisticRegression` for the following reasons:
1. **Superior Acuity Separation:** Balanced accuracy of 60.04% vs 53.79%, and Macro-F1 of 0.5739 vs 0.5540.
2. **Clinical Order Alignment:** QWK of 0.5032 indicates moderate agreement on the ordinal scale (penalizing large jumps between ESI 1 and ESI 3).
3. **Robust Non-linear Boundaries:** Handles non-linear physiological relationships (e.g., shock index, abnormal vital counts, oxygen saturation cutoffs).
4. **Fast and Exact Explainability:** Compatible with exact, tree-based SHAP (`shap.TreeExplainer`), providing deterministic feature attributions without approximation error.
