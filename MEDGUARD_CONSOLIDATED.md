# MedGuard — Consolidated Documentation

> **Research Prototype:** Not clinically validated. Must not be used for real patient-care decisions.  
> **Dataset:** Triagegeist (synthetic) | **Target:** ESI Acuity 1-5 | **Model:** Logistic Regression (deployed)

---

## 1. Overview

MedGuard is an educational AI/ML research prototype for emergency-department triage acuity prediction using the five-level Emergency Severity Index (ESI). The system uses synthetic data only and serves predictions through both a Research Lab interface and Patient Mode interface.

**Key Points:**
- Synthetic dataset only (Triagegeist from Kaggle competition)
- Patient-grouped validation to prevent data leakage
- Research demonstration, not clinically validated
- Focus on leakage prevention and reproducible methodology

---

## 2. Dataset

**Triagegeist (synthetic)**
- **Train:** 80,000 labeled encounters, 80,000 unique patients
- **Test:** 20,000 encounters, 20,000 unique patients (labels withheld)
- **Supporting:** `chief_complaints.csv` (100,000), `patient_history.csv` (100,000)
- **Patient overlap:** 0 between train/test sets

**Class Distribution (Training):**
| ESI Level | Count | Percentage |
|-----------|-------|------------|
| ESI 1 | 3,222 | 4.03% |
| ESI 2 | 13,439 | 16.80% |
| ESI 3 | 28,921 | 36.15% |
| ESI 4 | 23,020 | 28.78% |
| ESI 5 | 11,398 | 14.25% |

**Provenance:** Kaggle competition (hackathon-provided), synthetic. No embedded license; non-commercial research use assumed.

---

## 3. Model & Performance

**Deployed Model:** Logistic Regression pipeline in `models/triagegeist/triage_model.joblib`  
- Parameters: `C=1.0`, `class_weight='balanced'`, `max_iter=1000`, `solver='lbfgs'`, `random_state=20260915`
- Preprocessing: median imputation, StandardScaler (numeric); most-frequent imputation, OneHotEncoder (categorical)

**Performance (on synthetic data):**

| Metric | 5-Fold CV (64,000) | Holdout (16,000) |
|--------|-------------------|-------------------|
| Macro-F1 | 0.7822 ± 0.0072 | 0.7727 |
| Balanced Accuracy | 0.8225 ± 0.0040 | 0.8114 |
| Quadratic Weighted Kappa | 0.8838 ± 0.0033 | 0.8770 |

**Per-Class (Holdout):**
| ESI Level | Precision | Recall | F1-Score | Support |
|-----------|-----------|--------|----------|---------|
| ESI 1 | 0.812 | 0.937 | 0.870 | 653 |
| ESI 2 | 0.918 | 0.909 | 0.914 | 2,612 |
| ESI 3 | 0.825 | 0.784 | 0.804 | 5,828 |
| ESI 4 | 0.697 | 0.488 | 0.574 | 4,564 |
| ESI 5 | 0.561 | 0.939 | 0.702 | 2,343 |

**Note:** Errors are predominantly adjacent ESI levels. Model selection shows logistic regression performs better on holdout than random forest in this evaluation.

---

## 4. Features

**Included (at triage):** Vitals (HR, RR, temp, SpO2, BP), demographics, arrival context, severity scores (GCS, NEWS2), anthropometrics, utilization counts, derived values (shock index, pulse pressure, MAP, BMI), chief complaint system category.

**Excluded (leakage):** `disposition`, `ed_los_hours`, identifiers (`patient_id`, `site_id`, `triage_nurse_id`).  
**Not used:** 25 comorbidity flags from `patient_history.csv` (not supplied by assessment API).

**Preprocessing:** Schema-driven with median/most-frequent imputation, missingness indicators, outlier envelope checks, patient-grouped splitting.

---

## 5. Methodology

- **Leakage Prevention:** Patient-grouped splits (GroupShuffleSplit/GroupKFold), preprocessing fit only on training folds, explicit leakage column rejection
- **Validation:** 5-fold patient-grouped CV + held-out split, seed `20260915`, zero patient overlap
- **Evaluation:** Macro-F1, balanced accuracy, quadratic weighted kappa, per-class metrics, confusion matrices, under/over-triage analysis
- **Explainability:** SHAP (TreeExplainer) for feature attribution
- **Data Quality:** Validation rules for vitals, temperature unit normalization, pain score parsing, sentinel handling

---

## 6. API Contract

**Endpoints:**
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Liveness check |
| `/model-info` | GET | Model metadata and manifest |
| `/predict` | POST | Triage prediction with optional SHAP explanation |

**Prediction Response:** Returns predicted ESI level (1-5), probabilities for all levels, optional explanation with top features, and research disclaimer.

All responses include safety disclaimers. No PII is logged or persisted.

---

## 7. Key Limitations

- **Synthetic only:** All metrics from synthetic Triagegeist data; no real clinical validation
- **No test set metrics:** `test.csv` labels withheld
- **Limited features:** Comorbidity history not available in assessment interface
- **Class imbalance:** ESI 1 rare (4%) affects stability
- **Research prototype:** Not for clinical use
- **License unverified:** Dataset redistribution terms need verification

---

**Note:** For detailed implementation specifics, see the individual documentation files in `docs/`. `REPORT_OUTLINE.md` and `EVIDENCE_INVENTORY.md` remain unchanged as requested.
