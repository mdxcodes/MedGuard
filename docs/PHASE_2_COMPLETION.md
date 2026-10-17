# MedGuard — Phase 2 Completion Report

**Phase:** Phase 2 — ML Model Training, Evaluation, and Explainability  
**Status:** Complete  
**Date:** 2026-10-16  
**Auditor / ML Lead:** Lead AI/ML Engineer  

---

## 1. Summary of Completed Work

1. **Baseline Implementation:**
   - Implemented `DummyClassifier` baselines (`most_frequent` and `stratified`) using patient-grouped evaluation.
   - Evaluated baselines on the held-out test split (44 stays across 12 patients) to establish unambiguous minimum performance thresholds.

2. **Candidate Model Training:**
   - Implemented two candidate architectures:
     - Multiclass `LogisticRegression(solver='saga', C=0.5, max_iter=5000)`.
     - `RandomForestClassifier(n_estimators=80, max_depth=6, min_samples_leaf=4, class_weight='balanced_subsample')`.
   - Used full end-to-end `Pipeline` objects to ensure all imputation, feature engineering, scaling, and TF-IDF steps were fitted exclusively on training rows within each fold.
   - Preserved original 5-level ESI acuity labels without artificial collapsing or merging.

3. **Evaluation Design & Metrics:**
   - Conducted 5-fold patient-grouped cross-validation using `GroupKFold` on `subject_id` (0 patient overlap across all folds).
   - Evaluated Macro-F1, Balanced Accuracy, Quadratic-Weighted Kappa (QWK), and per-class precision/recall/F1 with explicit class labels `[1, 2, 3, 4, 5]`.
   - Audited stratification feasibility: correctly documented that stratified group splitting is infeasible due to absent ESI 5 and sparse ESI 4.

4. **Model Explainability:**
   - Implemented SHAP explainability module (`backend/ml/explain.py`) supporting exact tree attributions for Random Forest and linear attributions for Logistic Regression.
   - Verified that feature names correctly match transformed pipeline representations.

5. **Artifacts & Model Registry:**
   - Persisted selected model pipeline (`models/triage_model.joblib`) along with a comprehensive metadata manifest (`models/triage_model.manifest.json`).
   - Generated `reports/model_evaluation.json`, `reports/model_comparison.csv`, `reports/confusion_matrix.csv`, and `reports/fold_metrics.csv`.
   - Kept model artifacts, research datasets, and reports safely excluded from Git via `.gitignore`.

6. **Comprehensive Test Suite:**
   - Added 11 automated unit and integration tests covering determinism, patient separation, identical comparison cohorts, explicit class labels, missing class handling, leakage exclusion, model persistence, SHAP output shape, and experiment runner execution.
   - Full test suite has **122 passed tests**.

---

## 2. Key Metrics Summary

| Model | Evaluation Strategy | Macro-F1 | Balanced Accuracy | Quadratic-Weighted Kappa |
|---|---|---|---|---|
| `dummy_most_frequent` | Held-Out Test (44 rows, 12 pts) | 0.2011 | 0.3333 | 0.0000 |
| `dummy_stratified` | Held-Out Test (44 rows, 12 pts) | 0.2444 | 0.2570 | -0.3063 |
| `logistic_regression` | Held-Out Test (44 rows, 12 pts) | 0.3835 | 0.3772 | 0.2232 |
| `random_forest` | Held-Out Test (44 rows, 12 pts) | **0.5303** | **0.5719** | **0.4974** |
| `logistic_regression` | 5-Fold Grouped CV (207 rows, 56 pts) | 0.5540 ± 0.1090 | 0.5379 ± 0.1092 | 0.4417 ± 0.0886 |
| `random_forest` | 5-Fold Grouped CV (207 rows, 56 pts) | **0.5739 ± 0.1053** | **0.6004 ± 0.1026** | **0.5032 ± 0.0345** |

### Per-Class Recall (Random Forest 5-Fold CV Aggregate):
- **ESI 1:** 66.7% (12 / 18)
- **ESI 2:** 54.6% (53 / 97)
- **ESI 3:** 66.7% (60 / 90)
- **ESI 4:** 0.0% (0 / 2 — sparse)
- **ESI 5:** N/A (0 samples)

---

## 3. Repetition & Execution Commands

Run data preparation:
```bash
venv/bin/python -m backend.ml.run_data_prep
```

Run Phase 2 model training, evaluation, SHAP verification, and artifact generation:
```bash
venv/bin/python -m backend.ml.run_experiment
```

Run the entire automated test suite:
```bash
venv/bin/python -m pytest -v
```

---

## 4. Deliverables Created in Phase 2

- `backend/ml/train.py`
- `backend/ml/evaluate.py`
- `backend/ml/explain.py`
- `backend/ml/run_experiment.py`
- `tests/test_model_pipeline.py`
- `docs/MODEL_CARD.md`
- `docs/MODEL_EVALUATION.md`
- `docs/PHASE_2_COMPLETION.md`
- Generated in `reports/`: `model_evaluation.json`, `model_comparison.csv`, `confusion_matrix.csv`, `fold_metrics.csv`, `model_card.md`
- Generated in `models/`: `triage_model.joblib`, `triage_model.manifest.json`
