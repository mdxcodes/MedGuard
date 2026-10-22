# MedGuard — Evidence Inventory

**Project:** MedGuard / Triage One — Emergency-Department Triage Acuity Prediction (ESI 1–5)  
**Scope:** Repository artifacts only (no content copied from reference PDFs). All claims must trace to files in `/secondary/MedGuard/`.  
**Status:** Draft (to support report writing)  
**Date:** 2026-10-22  

This inventory catalogs factual claims, their sources, classification (verified/historical/inference/unknown), and notes unresolved discrepancies.

---

## 1. Dataset Provenance

| Claim | Source(s) | Classification | Notes |
|---|---|---|---|
| Dataset name: Triagegeist (synthetic) | `reports/model_evaluation.json:3`, `reports/triagegeist/benchmark_results.json:2`, `README.md`, `MODEL_CARD.md` | Verified | Consistent across artifacts. |
| Source: Kaggle competition/hackathon-provided | `reports/model_evaluation.json:336-337`, `MODEL_CARD.md` | Verified | Stated as source. |
| Files present: train.csv (80,000 rows), test.csv (20,000 rows, labels withheld), chief_complaints.csv (100,000), patient_history.csv (100,000), sample_submission.csv (20,000) | `reports/model_evaluation.json:339-345`, `reports/triagegeist/dataset_profile.json`, filesystem inspection | Verified | File counts/roles match. |
| train.csv has triage_acuity labels; test.csv labels withheld | `reports/model_evaluation.json:341`, `README.md` | Verified | Explains lack of test-set metrics. |
| Patient-grouped split (GroupShuffleSplit/GroupKFold), no patient overlap, seed 20260915 | `backend/ml/splitting.py`, `reports/model_evaluation.json:7`, `DATA_QUALITY_REPORT.md` | Verified | Patient-level grouping implemented. |
| Class distribution (train): ESI 1:3222, ESI 2:13439, ESI 3:28921, ESI 4:23020, ESI 5:11398 (n=80,000) | `reports/model_evaluation.json:9-15` | Verified | Matches across artifacts. |
| License not embedded locally; non-commercial research assumed | `reports/model_evaluation.json:337`, inspection of dataset files | Unknown/Assumed | Must verify Kaggle terms before redistribution. |

---

## 2. Model Selection and Artifacts

| Claim | Source(s) | Classification | Notes |
|---|---|---|---|
| Reported in README/MODEL_CARD: RF Macro-F1 0.8421 ± 0.0019 (CV), 0.8418 (holdout) | `README.md`, `MODEL_CARD.md` | Historical/Stale (discrepant) | **Discrepancy vs generated reports.** See §5. |
| Generated reports show RF Macro-F1 0.782191 ± 0.007229 (5-fold CV) and 0.772723 (holdout) | `reports/model_evaluation.json:130-132,199`, `reports/triagegeist/benchmark_results.json:95,140` | Verified (generated) | These match across both report files. |
| Benchmark shows LR Macro-F1 0.807558 (holdout) vs RF 0.772723 (holdout) | `reports/triagegeist/benchmark_results.json:53,95` | Verified | LR performs better on holdout in benchmark; RF selected despite lower holdout in benchmark? Or selection logic differs. |
| `selected_model.name` = "random_forest" in model_evaluation.json | `reports/model_evaluation.json:195` | Verified | Report states RF selected. |
| `models/triagegeist/triage_model.manifest.json` says `model_name: "logistic_regression"` with LogisticRegression params | `models/triagegeist/triage_model.manifest.json:2-38` | Verified (manifest) | **Mismatch with selected_model in reports.** |
| Actual loaded artifact is a scikit-learn Pipeline with `('estimator', LogisticRegression(...))` | Joblib inspection (see above) | Verified | The joblib is LR inside a ColumnTransformer pipeline. |
| Artifact path: `models/triagegeist/triage_model.joblib` | `reports/model_evaluation.json:196`, filesystem | Verified | Exists. |

**Resolution needed (U1, U2):** Treat `reports/model_evaluation.json` and `reports/triagegeist/benchmark_results.json` as generated outputs (from build_reports/eval) as source of truth for reported metrics. The manifest says LR but reports say RF selected — actual artifact is LR. This must be reconciled in the report; do not claim RF is served if artifact is LR. 

---

## 3. Preprocessing and Features

| Claim | Source(s) | Classification | Notes |
|---|---|---|---|
| Numeric features imputed with median, scaled with StandardScaler | `backend/ml/features.py`, pipeline inspection | Verified | Seen in ColumnTransformer. |
| Categorical features imputed with most_frequent, OneHotEncoder(drop='first', handle_unknown='ignore') | `backend/ml/features.py`, pipeline inspection | Verified | Seen in ColumnTransformer. |
| Feature allow-list defined in config | `backend/ml/config.py`, `docs/FEATURE_SPECIFICATION.md` | Verified | Documented. |
| Comorbidities from patient_history.csv joined (25 hx_* flags) but not served by API for new predictions | `backend/ml/features.py`, `backend/api/*`, `docs/EVIDENCE_INVENTORY` note (U7) | Verified | Known gap. |
| Chief complaints joined from chief_complaints.csv | `backend/ml/features.py` | Verified | Implemented. |

---

## 4. API, Frontend, Deployment

| Claim | Source(s) | Classification | Notes |
|---|---|---|---|
| FastAPI backend with routes /health, /model-info, /predict, /metrics, /triagegeist/status | `backend/api/main.py`, `docs/API_CONTRACT.md` | Verified | Routes exist. |
| React 18 + Vite + Tailwind frontend | `frontend/package.json`, `README.md` | Verified | Stack confirmed. |
| Dual mode: Patient Mode (wizard) and Research Lab (13 pages) sharing backend/model | `frontend/src/lib/modeRoutes.js`, `frontend/src/pages/`, `README.md` | Verified | Routes/pages exist. |
| Deployed to Render (backend) and Vercel (frontend) | `render.yaml`, `frontend/vercel.json`, `README.md` | Verified (config) | Configs present; end-to-end verification pending (U10). |
| Model fetched from Supabase Storage at startup | `backend/api/main.py`, README references | Verified (code) | Implementation present. |
| CORS configured | `backend/api/main.py` | Verified | Present. |

---

## 5. Evaluation Metrics (Source of Truth)

| Metric | Value (holdout) | Value (5-fold CV, mean±std) | Source |
|---|---|---|---|
| Balanced Accuracy (RF) | 0.8114146244130211 | 0.8224620052278055 ± 0.004041515496481467 | `reports/model_evaluation.json:19-20,128-129` |
| Macro-F1 (RF) | 0.7727227847069239 | 0.7821911037334749 ± 0.007229481709692283 | `reports/model_evaluation.json:20,130-131` |
| Quadratic Weighted Kappa (RF) | 0.877003881707772 | 0.8838288918878631 ± 0.0033070413205999326 | `reports/model_evaluation.json:21,132-133` |
| Undertriage count (holdout) | 2750 | 2080.8 ± 48.55 (mean across folds) | `reports/model_evaluation.json:117,134` |
| Overtriage count (holdout) | 1266 | 990.2 ± 28.07 (mean across folds) | `reports/model_evaluation.json:118,136` |

Per-class (RF, holdout): see `reports/model_evaluation.json:22-58`. Confusion matrices present in both holdout and aggregate CV form.

**Note on LR:** Benchmark shows LR better on holdout (Macro-F1 0.807558) than RF (0.772723); actual served artifact is LR (per joblib). Reports say RF selected — this is contradictory. The report must state the artifact/model actually served and not just what reports claim.

---

## 6. Testing and Quality

| Claim | Source(s) | Classification | Notes |
|---|---|---|---|
| Tests exist (pytest) | `tests/` directory (multiple test files) | Verified | Present. |
| API contract documented | `docs/API_CONTRACT.md` | Verified | Present. |
| Data quality report exists | `reports/data_quality_report.json`, `docs/DATA_QUALITY_REPORT.md` | Verified | Present. |

---

## 7. Missing/Unresolved Items (Cross-ref to U1–U10)

| ID | Issue | Evidence | Status |
|---|---|---|---|
| U1 | Metric discrepancy between README/MODEL_CARD vs reports | README/MODEL_CARD vs `reports/model_evaluation.json`, `reports/triagegeist/benchmark_results.json` | Open — use reports as source of truth; document discrepancy |
| U2 | Model artifact vs manifest mismatch; served model is LR not RF | `models/triagegeist/triage_model.manifest.json` says LR; joblib is LR pipeline; reports say RF selected | Open — verify and report actual served model |
| U3 | No test.csv metrics (labels withheld) | `reports/model_evaluation.json:341` | Open — state limitation |
| U4 | No clinical validation | No clinician validation artifacts found | Open — research-only disclaimer required |
| U5 | Dataset license unverified | No license file in repo; stated as Kaggle/hackathon | Open — assume non-commercial research, verify terms |
| U6 | No screenshots in repo | No .png/.jpg files found | Open — capture from running app |
| U7 | hx_* comorbidities joined but not served by API | `backend/ml/features.py`, API schemas/routes | Open — document limitation |
| U8 | Referenced docs missing: DUAL_MODE_UI_IMPLEMENTATION_REPORT.md, TRIAGEGEIST_MIGRATION_REPORT.md | Referenced in README but not present in docs/ | Open — note missing |
| U9 | RENDER_DEPLOYMENT_FIX.md referenced but not found | render.yaml references it | Open — note missing |
| U10 | Production readiness unverified end-to-end | Deployed per configs but no verification artifacts | Open — state pending verification |

---

## 8. Evidence Traceability Rules (For Report Writing)

1. **Prefer generated reports:** For numeric results, use `reports/model_evaluation.json` and `reports/triagegeist/benchmark_results.json`. Treat README/MODEL_CARD as historical unless reconciled.
2. **Verify served model:** The actual loaded model is LR (from joblib). If the report claims RF is served, it must be corrected or justified with evidence. State what is actually deployed/loaded.
3. **Distinguish synthetic/demo:** Always label Triagegeist as synthetic, research prototype only, not clinically validated.
4. **No test-set claims:** Since test.csv labels are withheld, only report holdout/CV from available data.
5. **Disclose gaps:** Explicitly mention U1–U10 where relevant (especially U2, U4, U7).
6. **Cite repo paths:** Every figure/table in the report must map back to a specific repo artifact or code file listed here. 

---

**End of Evidence Inventory**
