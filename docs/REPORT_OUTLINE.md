# MedGuard — Proposed Academic Report Outline

**Project:** MedGuard / Triage One — Emergency-Department Triage Acuity Prediction (ESI 1–5)  
**Status:** Phase 1 — Documentation Planning (outline only; full report not yet written)  
**Dataset:** Triagegeist (synthetic, Kaggle competition, hackathon-provided)  
**Model served:** RandomForestClassifier (triage_model.joblib)  
**Report style:** Academic lab report, Word/PDF, numbered sections, TOCT, tables/figures with captions  
**Constraint:** No content derived from any reference PDF. All claims trace to repository source, artifacts, or test output.

---

## 1. Proposed Table of Contents

```
Abstract .................................................................... page 1
1. Introduction ............................................................ page 2
   1.1 Context and Motivation ........................................ page 2
   1.2 Problem Statement ............................................. page 3
   1.3 Research Disclaimer ........................................... page 3
2. Aim and Objectives .................................................... page 4
   2.1 Aim ............................................................. page 4
   2.2 Objectives ...................................................... page 4
3. Requirements ............................................................ page 5
   3.1 Functional Requirements ....................................... page 5
   3.2 Non-Functional Requirements ................................... page 5
   3.3 Data and Privacy Constraints .................................. page 6
4. Theoretical Background ................................................ page 7
   4.1 Emergency Severity Index (ESI) Triage ....................... page 7
   4.2 Supervised Multiclass Classification ........................ page 8
   4.3 Random Forest and Logistic Regression ....................... page 9
   4.4 Patient-Grouped Cross-Validation and Leakage Prevention ... page 10
   4.5 SHAP Explainability ........................................... page 11
   4.6 Evaluation Metrics for Imbalanced Multiclass ................ page 12
5. Methodology ............................................................ page 13
   5.1 Data Provenance and Dataset Profile ......................... page 13
   5.2 Data Cleaning and Preprocessing ............................. page 15
   5.3 Feature Engineering ........................................... page 17
   5.4 Train/Validation/Test Strategy ................................ page 18
   5.5 Model Training and Selection .................................. page 19
   5.6 Model Evaluation .............................................. page 20
   5.7 Explainability Pipeline ....................................... page 21
   5.8 Backend Inference API ......................................... page 22
   5.9 Frontend Application .......................................... page 24
   5.10 Testing and Quality Assurance ................................ page 25
   5.11 Deployment Architecture ...................................... page 26
6. Implementation: Code and Output ....................................... page 27
   6.1 Backend ML Pipeline (key modules and snippets) .............. page 27
   6.2 FastAPI Routes and Schemas .................................... page 29
   6.3 React Frontend Pages and Workflow ............................. page 31
   6.4 Model Artifact and Manifest ................................... page 33
   6.5 Reproduction Commands ......................................... page 34
7. Results and Discussion ................................................ page 35
   7.1 Dataset Profile ............................................... page 35
   7.2 Data Quality .................................................... page 37
   7.3 Model Comparison and Selection ................................ page 38
   7.4 Holdout Evaluation (Random Forest) ............................ page 40
   7.5 Five-Fold Patient-Grouped Cross-Validation .................... page 42
   7.6 Per-Class Performance and Confusion Matrix .................... page 44
   7.7 Triage Direction (Undertriage / Overtriage) ................... page 46
   7.8 Global SHAP Explainability .................................... page 47
   7.9 Drift Analysis .................................................. page 48
   7.10 Limitations .................................................... page 49
8. Conclusion .............................................................. page 50
9. Future Scope ............................................................ page 51
10. References ............................................................. page 52
Appendix A. Evidence Inventory ........................................... page 54
Appendix B. Screenshot Index ............................................. page 55
```

---

## 2. Suggested Page Allocation

| Section | Suggested Pages | Notes |
|---------|----------------|-------|
| Abstract | 1 | Structured abstract (background, method, results, disclaimer) |
| 1. Introduction | 2 | Context, problem statement, research disclaimer |
| 2. Aim and Objectives | 1 | Aim + 5–6 measurable objectives |
| 3. Requirements | 2 | Functional, non-functional, data/privacy |
| 4. Theoretical Background | 6 | ESI triage, ML theory, CV, leakage, SHAP, metrics |
| 5. Methodology | 14 | Data provenance → deployment (11 subsections) |
| 6. Implementation: Code and Output | 8 | Backend ML, API, frontend, artifact, reproduction |
| 7. Results and Discussion | 15 | Dataset → limitations (10 subsections) |
| 8. Conclusion | 1 | Summary, research-only positioning |
| 9. Future Scope | 1 | Clinical validation, real data, deployment hardening |
| 10. References | 1 | Primary sources only (datasets, algorithms, libraries) |
| Appendices | 2 | Evidence inventory, screenshot index |
| **Total** | **~54** | Target range: 50–60 pages |

---

## 3. List of Tables (Proposed)

| Table | Section | Caption (proposed) | Source |
|-------|---------|-------------------|--------|
| T1 | §3.1 | Functional requirements traceability matrix | API_CONTRACT.md, modeRoutes.js |
| T2 | §3.2 | Non-functional requirements | render.yaml, vercel.json |
| T3 | §5.1 | Triagegeist file inventory (rows, labels present/withheld) | reports/triagegeist/dataset_profile.json |
| T4 | §5.1 | ESI class distribution (training cohort) | reports/model_evaluation.json |
| T5 | §5.2 | Missing-value percentage by feature | reports/data_quality_report.json |
| T6 | §5.3 | Feature allow-list (numeric, categorical, derived, indicators) | backend/ml/config.py |
| T7 | §5.4 | Patient-grouped split: train / holdout rows and patients | splitting.py, DATA_QUALITY_REPORT.md |
| T8 | §5.5 | Model candidate inventory (baselines + candidates) | triagegeist_training.py |
| T9 | §7.3 | Model comparison: holdout metrics (dummy, LR, RF) | reports/triagegeist/benchmark_results.json |
| T10 | §7.5 | CV summary: mean ± std macro-F1, balanced accuracy, QWK | reports/model_evaluation.json |
| T11 | §7.6 | Aggregate confusion matrix (5-fold CV, Random Forest) | reports/model_evaluation.json |
| T12 | §7.6 | Per-class precision, recall, F1, support (holdout) | reports/model_evaluation.json |
| T13 | §7.7 | Undertriage / overtriage counts | reports/model_evaluation.json |
| T14 | §7.8 | Global SHAP mean |SHAP| top 20 features | reports/global_shap.json |
| T15 | §7.9 | PSI drift: top features, train vs holdout | reports/drift_analysis.json |

---

## 4. List of Figures (Proposed)

| Figure | Section | Caption (proposed) | Source |
|--------|---------|-------------------|--------|
| F1 | §5.1 | ML pipeline stage diagram (load → validate → split → preprocess → train → evaluate → explain → serve) | ML_PIPELINE_DESIGN.md §3 |
| F2 | §5.4 | Patient-grouped split illustration (no patient in both partitions) | splitting.py |
| F3 | §5.5 | Model factory / training flow (baselines → CV → selection → persist) | triagegeist_training.py |
| F4 | §6.1 | Preprocessing ColumnTransformer structure (numeric, categorical, derived, text, flags) | features.py |
| F5 | §6.2 | FastAPI route map (/health, /model-info, /predict, /metrics, /triagegeist/status) | backend/api/main.py |
| F6 | §6.3 | Frontend route registry (patient vs research pages) | frontend/src/lib/modeRoutes.js |
| F7 | §7.1 | ESI class distribution bar chart (training cohort) | reports/model_evaluation.json |
| F8 | §7.2 | Missing-value percentage bar chart by feature | reports/data_quality_report.json |
| F9 | §7.3 | Model comparison bar chart (macro-F1, balanced accuracy, QWK) | reports/triagegeist/benchmark_results.json |
| F10 | §7.5 | CV fold metric distribution (mean ± std) | reports/model_evaluation.json |
| F11 | §7.6 | Confusion matrix heatmap (5-fold CV aggregate) | reports/model_evaluation.json |
| F12 | §7.7 | Undertriage vs overtriage bar chart | reports/model_evaluation.json |
| F13 | §7.8 | Global SHAP mean |SHAP| horizontal bar chart (top 20) | reports/global_shap.json |
| F14 | §7.9 | PSI drift feature ranking | reports/drift_analysis.json |
| F15 | §6.3 / §7.10 | Application screenshot index (Research Lab + Patient Mode) | frontend/src/pages/ |

---

## 5. Section-by-Section Evidence Checklist

| Section | Evidence Needed | Source File / Artifact | Status |
|---------|----------------|----------------------|--------|
| Abstract | Dataset name, model type, key metrics, disclaimer | README.md, MODEL_CARD.md, reports/*.json | Partial — metric discrepancy unresolved (§7.3 below) |
| §1 Introduction | Problem context, research-only positioning | README.md §1, §Research Disclaimer | Verified |
| §2 Aim/Objectives | Aim statement, measurable objectives | To be drafted from repo facts | Not yet drafted |
| §3 Requirements | Functional, non-functional, privacy | API_CONTRACT.md, render.yaml, vercel.json | Verified |
| §4 Theory | ESI triage, ML algorithms, SHAP, metrics | Primary references (to be cited) | Not yet cited |
| §5.1 Data Provenance | File inventory, row counts, labels withheld | reports/triagegeist/dataset_profile.json | Verified |
| §5.2 Cleaning | Missing-value %, sentinel handling, envelopes | reports/data_quality_report.md, validation.py | Verified |
| §5.3 Features | Allow-list, derived features, exclusions | FEATURE_SPECIFICATION.md, config.py | Verified |
| §5.4 Split | Patient-grouped split, 0 overlap, seed | splitting.py, DATA_QUALITY_REPORT.md | Verified |
| §5.5 Training | Model factories, selection rationale | triagegeist_training.py | Verified |
| §5.6 Evaluation | Metrics definitions, CV protocol | evaluate.py, triagegeist_training.py | Verified |
| §5.7 Explainability | SHAP method, TreeExplainer, limitations | explain.py, MODEL_CARD.md §5 | Verified |
| §5.8 Backend API | Routes, schemas, error handling | API_CONTRACT.md, schemas.py, main.py | Verified |
| §5.9 Frontend | Pages, workflow, API integration | frontend/src/pages/, modeRoutes.js | Verified |
| §5.10 Testing | Test counts, pass/fail, limitations | tests/, API_CONTRACT.md §10 | Verified |
| §5.11 Deployment | Render config, model fetch, CORS | render.yaml, .vercel/, README.md | Verified |
| §6 Implementation | Code snippets, key modules | backend/, frontend/ | Verified |
| §7 Results | All metrics, confusion matrices, SHAP | reports/*.json | Partial — see metric discrepancy |
| §8 Conclusion | Summary, research-only positioning | README.md, MODEL_CARD.md | Verified |
| §9 Future Scope | Enhancements, clinical validation path | MODEL_CARD.md §6, MODEL_EVALUATION.md | Partially sourced |
| §10 References | Primary citations | To be assembled | Not yet assembled |

---

## 6. Screenshots to Capture from the Real Application

The following screenshots should be captured by running the application locally (frontend dev server + FastAPI backend) and are **not** yet available in the repository (no .png/.jpg files exist):

| Screenshot | Page / Component | Purpose in Report |
|------------|-----------------|-------------------|
| S1 | Home / Overview page (Research Lab) | §6.3, §7.1 — headline metrics, class distribution |
| S2 | Assessment form (Research Lab) | §6.3 — input schema, field list |
| S3 | Prediction result with SHAP | §6.3, §7.8 — probabilities, SHAP attribution |
| S4 | Prediction result without SHAP (unavailable state) | §6.3 — graceful degradation |
| S5 | Model Performance page | §7.3–7.6 — CV metrics, confusion matrix, per-class table |
| S6 | Dataset Explorer page | §7.1 — file inventory, class distribution, missing data |
| S7 | Synthetic Benchmark page | §7.3 — benchmark results table |
| S8 | Error Analysis page | §7.7 — undertriage/overtriage, error records |
| S9 | Explainability page | §7.8 — global SHAP bar chart |
| S10 | Drift Analysis page | §7.9 — PSI drift table |
| S11 | Model Registry page | §6.4 — active model, artifact integrity |
| S12 | Scenario Comparison page | §6.3 — A/B comparison, diff summary |
| S13 | Patient Mode home page | §6.3 — dual-mode UI contrast |
| S14 | Patient Mode assessment wizard (4-step) | §6.3 — patient workflow |
| S15 | Patient Mode result page | §6.3 — plain-language result |
| S16 | API /predict response (cURL or browser) | §5.8 — request/response schema example |

Capture method: `frontend/scripts/screenshot.mjs` (headless Chrome, DevTools Protocol) or manual browser capture. All inputs must be clearly labeled as synthetic demo data.

---

## 7. Unresolved Questions and Missing Evidence

| # | Question / Gap | Impact on Report | Recommended Action |
|---|---------------|------------------|--------------------|
| U1 | **Metric discrepancy:** README.md and MODEL_CARD.md cite Macro-F1 0.8421 ± 0.0019 (CV) and 0.8418 (holdout), but reports/model_evaluation.json and reports/triagegeist/benchmark_results.json show Macro-F1 0.7822 ± 0.0072 (CV) and 0.7727 (holdout) for Random Forest. Which figures are current? | Affects §7.3–7.6; reporting wrong metrics would violate scientific integrity | Use reports/*.json as source of truth (generated by build_reports.py). Note the discrepancy and flag README/MODEL_CARD as potentially stale. |
| U2 | **Model artifact vs manifest mismatch:** reports/model_evaluation.json says `selected_model.name = "random_forest"`, but models/triagegeist/triage_model.manifest.json says `model_name = "logistic_regression"`. Does the joblib artifact match the manifest? | Affects §6.4, §7.3 — must verify the served model before claiming production inference works | Run `backend/api/config.py` load check or inspect the joblib artifact estimator type. Update the report once verified. |
| U3 | **No test.csv metrics:** test.csv labels are withheld; no competition test-set metrics exist. | Affects §7 — cannot claim test-set performance | Explicitly state this limitation; report holdout and CV only. |
| U4 | **No clinical validation:** model never validated on real ED data or against clinician-assigned acuity. | Affects entire report — must disclaim in Abstract, §1, §7.10, §8 | Include research-disclaimer language throughout; never describe as clinically validated. |
| U5 | **Dataset license unverified:** no license text embedded in local Triagegeist files; non-commercial research use assumed but not verified. | Affects §3.3, §5.1, References | State assumption; recommend verifying Kaggle competition terms before redistribution. |
| U6 | **No screenshots exist:** no .png/.jpg files in repository. | Affects §6 — figures F7–F15 and screenshots S1–S16 cannot be included until captured | Schedule screenshot capture from local running instance. |
| U7 | **comorbidity history (25 hx_* flags) joined but not served:** pipeline joins patient_history.csv but the API cannot supply hx_* features for new presentations. | Affects §5.3, §5.8 — feature gap must be disclosed | Document explicitly in report; list as known limitation. |
| U8 | **Duplicate docs references:** README.md references DUAL_MODE_UI_IMPLEMENTATION_REPORT.md and TRIAGEGEIST_MIGRATION_REPORT.md, but neither file exists in docs/. | Affects documentation completeness | Note as missing; either create or remove references. |
| U9 | **RENDER_DEPLOYMENT_FIX.md referenced but not found:** render.yaml references it. | Minor — deployment documentation gap | Note as missing deployment runbook. |
| U10 | **production readiness unverified:** model fetched from Supabase Storage at startup; no evidence the production deployment has been successfully verified end-to-end. | Affects §5.11 — cannot claim production readiness without evidence | Mark as "deployed to Render (free tier), startup-time artifact fetch configured; end-to-end production verification pending." |

---

## 8. Recommended Word/PDF Layout (Matching Reference Academic Style)

| Element | Specification |
|---------|--------------|
| **Page size** | A4, portrait |
| **Margins** | 2.54 cm (1 in) all sides |
| **Font (body)** | Times New Roman or equivalent serif, 12 pt |
| **Font (headings)** | Times New Roman bold; section headings 14 pt, subsections 12 pt |
| **Line spacing** | 1.5 for body text; single for tables, captions, references |
| **Text alignment** | Justified |
| **Section numbering** | Decimal (1, 1.1, 1.1.1) |
| **Table captions** | Above table, "Table N. Caption", 10 pt, bold label |
| **Figure captions** | Below figure, "Figure N. Caption", 10 pt, bold label |
| **Page numbers** | Bottom center, Arabic numerals starting from Abstract page = 1 |
| **Headers/footers** | No running header; footer with page number only |
| **TOC** | Automatic field, dot leaders, page numbers right-aligned |
| **References** | Numbered [1], [2], … in order of citation; primary sources for ESI triage (ACEP/ENA), scikit-learn, SHAP, Triagegeist dataset |
| **Code snippets** | Consolas/Courier New, 9 pt, shaded background, in §6 only |
| **Disclaimer banner** | Prominent on title page and §1: "Not clinically validated; research prototype only; synthetic data" |

---

## 9. Primary References to Assemble (Not Yet Cited)

| Ref | Proposed Citation | Purpose |
|-----|------------------|---------|
| R1 | Gilboy, N., Tanabe, P., Travers, D., & Rosenau, A.M. (2020). *Emergency Severity Index (ESI): A Triage Tool for Emergency Department Care, Version 4*. AHRQ. | ESI triage theoretical background |
| R2 | Pedregosa, F., et al. (2011). Scikit-learn: Machine Learning in Python. *JMLR*, 12, 2825–2830. | ML algorithms, RandomForest, LogisticRegression |
| R3 | Lundberg, S.M., & Lee, S.-I. (2017). A Unified Approach to Interpreting Model Predictions. *NeurIPS*. | SHAP explainability |
| R4 | Triagegeist dataset (synthetic, Kaggle competition). | Dataset provenance |
| R5 | FastAPI documentation (https://fastapi.tiangolo.com). | Backend API framework |
| R6 | React documentation (https://react.dev). | Frontend framework |

---

**End of outline. Ready for review.**
