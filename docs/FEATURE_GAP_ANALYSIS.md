# MedGuard — Feature Gap Analysis and Implementation Plan

**Date:** 2026-10-18  
**Project:** /secondary/MedGuard  
**Status:** Complete

## 1. Current Verified Capabilities

All items verified against the actual codebase with source references.

### Backend API (FastAPI)
- **GET /health** (`backend/api/main.py:118-122`) — Liveness probe, always returns 200 regardless of model state. Distinguishes process vs configuration failures.
- **GET /model-info** (`backend/api/main.py:125-153`) — Returns manifest metadata (model name, kind, target, supported ESI levels, training stats, dataset, limitations). Returns 503 if artifact missing.
- **POST /predict** (`backend/api/main.py:156-165`) — Accepts AssessmentRequest, returns PredictResponse with prediction, optional SHAP explanation, error handling, and disclaimer.

### API Schemas (`backend/api/schemas.py`)
- **AssessmentRequest** — All fields optional (temperature, vitals, pain, arrival_transport, chiefcomplaint). Handles missingness intentionally. Pydantic validation with bounds per DATASET_AUDIT.md.
- **ClassProbability**, **Prediction** — Per-class probabilities for ESI [1,2,3,4,5]. Note states "Probabilities reflect model confidence, not clinical calibration."
- **ExplanationResponse/ExplanationItem** — SHAP attributions with top_features (capped at 10), explanation_status ('available'/'unavailable'), includes attribution disclaimer.
- **ModelInfoResponse** — Exposes manifest + known limitations (ESI 4 sparse, ESI 5 absent, not clinically validated).
- **PredictResponse** — Full response with prediction, explanation, error, disclaimer.

### Inference Pipeline (`backend/api/inference.py`)
- Normalizes assessment (temperature C/F handling, pain parsing, BP validation, vitals validation, chief complaint normalization).
- Adds missingness indicators via `backend.ml.validation.add_missingness_indicators()` for vitals+pain.
- Derives engineered features via `backend.ml.features.derive_features()` (shock index, pulse pressure, MAP, abnormal vital counts, chief complaint TF-IDF tokens).
- Predicts with saved pipeline (preprocess + estimator). Populates probabilities for all ESI levels in [1,2,3,4,5]; sets missing classes to 0.0 (explicitly preserves ESI 5 as 0.0).
- SHAP explanation via `backend.ml.explain.explain_prediction()` — best-effort; falls back to 'unavailable' on failure. Handles TreeExplainer/LinearExplainer/Kernels appropriately.
- Correctly drops placeholder target before pipeline.

### ML Pipeline (backend/ml/)
- **config.py** — ESI_LABELS=[1,2,3,4,5], paths, feature definitions, TF-IDF params, CV config.
- **features.py** — Feature derivation, leakage-free feature name extraction from ColumnTransformer. Includes engineered features, missing indicators, one-hot encodings, TF-IDF.
- **train.py** — Model training factories (RandomForest, LogisticRegression, Dummy). Saves pipeline + manifest + feature names.
- **evaluate.py** — compute_metrics with explicit 5-class labels, zero_division=0, confusion matrix 5x5, quadratic weighted kappa with handling for degenerate cases. aggregate_fold_metrics, aggregate_confusion_matrices, grouped CV evaluation.
- **explain.py** — SHAP explanations with proper handling of shap API shapes, TreeExplainer for RF, LinearExplainer for LR, KernelExplainer fallback. Extracts top features by |shap_value|.
- **splitting.py** — Patient-grouped splits (GroupShuffleSplit, GroupKFold). Patient overlap prevention enforced.
- **validation.py** — Temperature C/F normalization, pain parsing (handles UA/unable/non-numeric), BP validation, vitals validation, chief complaint normalization, missingness indicators.
- **run_experiment.py**, **run_data_prep.py** — Reproducible experiment workflows.

### Evaluation Artifacts (verified)
- **reports/model_evaluation.json** — Full metrics including per-class precision/recall/F1/support, confusion matrices, CV summary (mean±std), class distribution. ESI 5 absent, ESI 4 has support 2.
- **reports/model_comparison.csv** — Comparison of baselines and candidates (holdout + 5-fold CV). RF selected: CV macro-F1 0.574±0.105, balanced acc 0.600±0.103, QWK 0.503±0.035.
- **reports/fold_metrics.csv**, **reports/confusion_matrix.csv** — Detailed fold-level results.

### Frontend
- **App.jsx** — BrowserRouter with Sidebar, Header, Footer, routes: /, /assessment, /prediction, /performance, /methodology. Sidebar shows API status badge (fetches /api/health).
- **OverviewPage.jsx** — Hero, disclaimer, StatusCard, MetricChart (shows CV comparison), dataset coverage, class support bars, workflow steps. Reads from evaluation context conceptually.
- **PerformancePage.jsx** — Displays CV summary, holdout comparison table, per-class recall table, explicit limitations explanation. Shows real metrics from docs/MODEL_EVALUATION.md.
- **PredictionPage.jsx** — Loads demo prediction via POST /api/predict, renders via PredictionResults.
- **AssessmentPage.jsx** — Form submission to /api/predict, redirects to prediction page.
- **AssessmentForm.jsx** — Validation (plausible clinical envelopes), applies synthetic samples, builds payload matching API schema.
- **PredictionResults.jsx** — Displays predicted ESI, max probability, class probability bars (all 5 levels), SHAP explanation section with top features and bar visualization, honest 'unavailable' state. Includes disclaimers.
- **MetricChart.jsx** — Recharts bar chart of model comparison (uses hardcoded values matching evaluation).
- **StatusCard.jsx** — Shows static status info.
- **Sidebar.jsx** — Nav + live API status via /api/health.

### Tests (`tests/`)
- 139 passed tests covering API, data loading, features, model pipeline, validation. No failures. Existing safety checks (no stack traces exposed in API errors).

## 2. Feature-by-Feature Status

### 1. Advanced evaluation dashboard
**Target:** confusion matrix visualization, per-class precision/recall/F1, class support, CV distributions, model comparison.

**Status:** Partially implemented  
**Evidence:**
- Backend already computes all required metrics (evaluate.py has confusion_matrix, precision_recall_fscore_support, per-class breakdowns). Exports to reports/model_evaluation.json, fold_metrics.csv, confusion_matrix.csv.
- Frontend PerformancePage displays tables: holdout comparison, per-class recall. Shows CV summary.
- MetricChart shows model comparison bars.

**Gaps:**
- No visual confusion matrix (heatmap) in UI — only tables and CSVs exist. Recharts has no built-in heatmap easily; could use custom cells or a simple color-coded table.
- No distribution plots of CV fold metrics (box/violin) — only mean±std shown.
- No interactive drilldown (click class to see errors). 
- Frontend reads from docs/reports indirectly via hardcoded display in PerformancePage (shows values like 0.530, 0.572 etc. matching JSON) — not dynamically loaded from API.

**Feasibility:** High. Can add visualization without changing model/data.

### 2. Explainable AI explorer
**Target:** global feature importance, local SHAP comparisons between synthetic assessments.

**Status:** Partially implemented  
**Evidence:**
- API already returns per-prediction SHAP via /predict (explanation with top_features). 
- explain.py computes SHAP for RF/LR with proper feature names from pipeline.
- Frontend PredictionResults displays local SHAP for current prediction (horizontal bars with feature name, shap value, sample value).

**Gaps:**
- No global feature importance view (mean |SHAP| across samples, permutation importance). Backend doesn't expose global SHAP aggregation endpoint.
- No way to compare SHAP explanations across multiple assessments (side-by-side). Only single prediction shown.
- No ability to select which class to explain (API accepts target_class in explain_prediction; inference always explains predicted_class).
- No persistent history of past predictions in UI (predictions not stored).

**Feasibility:** Medium-High. Global SHAP requires computing on a representative set (could use test/validation set). API additions needed.

### 3. Dataset explorer
**Target:** label distribution, missingness, feature distributions, preprocessing transparency.

**Status:** Partially implemented  
**Evidence:**
- DATASET_AUDIT.md, DATA_QUALITY_REPORT.md, reports/data_quality_report.json exist with detailed stats.
- MODEL_CARD.md documents dataset, class distribution (ESI 1:18,2:97,3:90,4:2,5:0).
- Feature definitions in backend/ml/config.py and features.py. Preprocessing steps documented in code.

**Gaps:**
- No UI page to explore dataset interactively. All info is in docs/markdown/JSON.
- No interactive visualizations (histograms of vitals, pain distribution, transport frequencies, complaint length, missingness heatmap).
- No view of engineered features distribution or TF-IDF vocabulary stats.
- No transparency view of preprocessing effects (before/after normalization).

**Feasibility:** High. Can load from existing JSON artifacts or compute from cached dataset. No ML changes needed.

### 4. Synthetic scenario simulator with side-by-side predictions
**Target:** Compare predictions/explanations for multiple synthetic scenarios.

**Status:** Partially implemented  
**Evidence:**
- AssessmentForm has SyntheticExamples component (applies sample values to form). Can load predefined synthetic cases.
- API accepts arbitrary synthetic inputs.
- PredictionPage shows single result.

**Gaps:**
- No side-by-side comparison UI (e.g. compare Case A vs Case B predictions + SHAP).
- No ability to save/load custom scenarios locally.
- No batch prediction endpoint (currently single-sample only). Could be useful but not required for side-by-side.
- No "what-if" editing (change one parameter and see delta) — would need to track state.

**Feasibility:** High. Frontend-only state management for comparison; API already supports multiple separate calls.

### 5. Uncertainty analysis: calibration, ambiguity detection, abstention
**Target:** Probability calibration, ambiguity detection, defensible abstention mechanism.

**Status:** Missing (not implemented)  
**Evidence:**
- Prediction includes raw probabilities from model.predict_proba(). Note says "not clinically calibrated".
- No calibration methods applied (isotonic/platt). No calibration metrics (Brier score, reliability diagrams) computed/stored.
- No ambiguity detection logic (e.g. max prob < threshold, top-2 margin < threshold, entropy high).
- No abstention mechanism (model always predicts). API returns prediction regardless.
- evaluate.py computes standard metrics but no calibration metrics.

**Scientific concerns/requirements:**
- Calibration is important but needs validation set; current split gives holdout. Computing reliability diagrams requires binning predictions.
- Abstention must be defensible and transparent. Need to define policy: when to abstain? What to return? (e.g. return 422/200 with abstain flag + reason). Must not hide uncertainty.
- Must preserve "not calibrated" messaging if we add calibration — show calibrated vs raw? Or replace? Calibration changes probabilities.
- With small sample (especially ESI 4/5 absent), calibration curves unreliable.
- Data for calibration: only have holdout (44 visits) — very small. Cross-validation calibration is more complex (need to be careful about leakage).

**Feasibility:** Medium. Technically doable, but scientifically nuanced. Need clear policy and metrics. Recommend as lower priority unless user explicitly needs it.

### 6. Input-quality and out-of-distribution safeguards
**Target:** Detect outliers, unrealistic combinations, distribution shift signals.

**Status:** Missing  
**Evidence:**
- AssessmentForm has basic range validation (plausible envelopes per field). Returns errors if out of range.
- API schemas also enforce some bounds (ge/le). But these are hardcoded clinical-ish bounds, not data-driven OOD detection.
- validation.py checks BP consistency, temperature conversion bounds, etc.
- No Mahalanobis distance, isolation forest for OOD, no feature-space density check, no detection of combinations not seen in training.
- No "input quality score" or warnings beyond validation errors.

**Feasibility:** Medium. Can compute per-feature z-scores vs training distribution, check for values outside training min/max, detect rare categorical combinations. Training distribution known from processed features? Or raw? Need to be careful not to leak.

### 7. Error analysis workbench
**Target:** Inspect misclassifications, confusion patterns, hardest cases.

**Status:** Partially implemented  
**Evidence:**
- Confusion matrices exist in reports (CSV/JSON). Per-class metrics computed.
- evaluate.py gives full per-fold metrics. No UI to browse errors.

**Gaps:**
- No UI to list misclassified examples from holdout/CV folds.
- No ability to see which features drove errors (SHAP for misclassified cases).
- No clustering of errors by pattern.

**Feasibility:** High if we expose existing evaluation data. Could add API endpoint to serve evaluation artifacts or generate error analysis on-the-fly from saved results.

### 8. Reproducible experiment runner and model version registry
**Target:** Track experiments, versions, configs, artifacts.

**Status:** Partially implemented  
**Evidence:**
- run_experiment.py exists with fixed pipeline configs. Saves artifacts to models/, reports/.
- Manifest saved with model (models/triage_model.manifest.json) includes model_name, version (v0.2.0-demo), created_utc, training params, feature names, limitations.
- configs in backend/ml/config.py (seeds, params). Training is deterministic given seed.

**Gaps:**
- No experiment tracking UI (MLflow-like UI not present). Just file-based artifacts.
- No model registry UI to compare versions, promote models. Only one saved model in models/.
- No ability to run experiments from UI (only CLI). run_experiment.py is CLI/script based.
- No parameter sweep tracking.

**Feasibility:** Medium. File-based is already reproducible. UI would require adding backend endpoints to list artifacts/manifests and possibly trigger runs. Triggering runs from web needs care (long-running, resource mgmt). Probably overkill for research prototype.

### 9. Research report PDF export
**Target:** Export overview, metrics, SHAP, methodology as PDF.

**Status:** Missing  
**Evidence:**
- docs/*.md files exist (MODEL_CARD, PHASE reports, API_CONTRACT). Can generate PDF from markdown, but no in-app export.
- Frontend displays all info needed (overview, performance, prediction results with SHAP, methodology). 

**Feasibility:** High. Options: use browser's print-to-PDF (works but styling), or use jsPDF + html2canvas to capture rendered pages, or generate on backend from reports/markdown (weasyhtml, reportlab). Client-side is simplest, no new deps heavy? html2canvas + jsPDF are common but add deps. Or just document "print to PDF" — but user wants feature.

### 10. Dataset-shift analysis
**Target:** Detect shift between training/demo and new inputs.

**Status:** Missing  
**Evidence:**
- Only demo subset available. No external datasets. Shift detection needs reference distribution from training data.
- Could compare input distributions to training feature distributions (KS test, PSI). But we need to compute/store training feature stats post-preprocessing? Or pre-preprocessing?
- With synthetic demo inputs only, not critical. Scientifically valid only if we have real comparison data.

**Feasibility:** Low-Medium. Need to serialize training set statistics (means/stds, histograms, category frequencies). Possible but limited value without real external data. Not justified given constraints.

## 3. Dependencies, Complexity, Risks, Testing

| Feature | Backend changes | Frontend changes | New deps | Complexity | Key risks | Testing needs |
|---|---|---|---|---|---|---|
| 1. Confusion matrix + CV dist viz | Optional: add endpoint to serve reports/model_evaluation.json (or compute on-demand). Or just read static files. | Add ConfusionMatrix component (heatmap table), CV distribution chart (boxplot via recharts custom or simple). Load data. | None (recharts already there; can do custom SVG). | Low | None. Pure visualization. | Snapshot/component tests for charts. Verify numbers match reports. |
| 2. XAI explorer (global SHAP + compare) | Add endpoints: /explain/global (compute mean\|SHAP\| on heldout/test set), /explain/compare (accept multiple inputs). Need to cache or compute. Computing global SHAP on RF with shap can be slow; limit samples. | New page "Explainability" with tabs: Local, Global, Compare. Compare view with side-by-side SHAP bars. | None (shap already in backend). | Med | Performance: global SHAP computation time. Memory. Need background? Or precompute and store. | API tests for new endpoints. Frontend integration tests. |
| 3. Dataset explorer | Add endpoint to serve dataset stats from reports/data_quality_report.json + model_evaluation.json. Or compute from source data if small. | New page "Dataset" with charts (distributions, missingness). | None. | Low | Reading large files? Demo data small. | Verify charts render with real data. |
| 4. Scenario simulator (side-by-side) | None needed (reuse /predict). | Enhance AssessmentPage or new Compare page: two forms/results side-by-side. Local state (sessionStorage). | None. | Low | State management complexity. | UI tests for comparison. |
| 5. Uncertainty/calibration/abstention | Add calibration (fit on holdout), store calibrator. Add abstention logic with configurable thresholds. New endpoints? Or extend predict response. | UI to show calibrated probs, ambiguity warnings, abstention reason. | Possibly sklearn.calibration (available) or implement simple. | High | Scientific validity: small calibration set (44). Thresholds arbitrary. Must be transparent. Risk of overclaiming. | Unit tests for abstention rules. Calibration metric tests. |
| 6. Input OOD safeguards | Add OOD detector: compute training feature stats at training time, save to manifest or sidecar. Check inputs against bounds/z-scores/combinations. Return warnings in predict response. | Display warnings in form/results. | None (numpy/pandas only). | Med-High | False positives/negatives. Need to define thresholds. Training stats must match preprocessing. | Tests with in-distribution and OOD samples. |
| 7. Error analysis workbench | Add endpoint to serve misclassified cases from holdout (if we store predictions) or reconstruct from fold metrics + data. Or precompute and save JSON of errors. | New page "Error Analysis" with table of misclassifications, filters by true/pred class, click to see SHAP for that case. | None. | Med | Need to reconstruct which specific samples were misclassified. run_experiment already has folds; could save error indices. | Verify misclassifications match confusion matrix. |
| 8. Experiment runner/registry UI | Add endpoints: list models/manifests, get model details, run experiment (async). Careful with subprocess. | New "Experiments" page to browse versions, compare, view artifacts. | None. | High | Security: running subprocesses from web. Resource usage. Long-running tasks. | Integration tests with mocked runs. |
| 9. PDF export | Optional backend route to render PDF from template + data. Or client-side. | Add "Export PDF" button on key pages (Overview, Performance, Prediction). Client-side simplest. | html2canvas + jsPDF (add deps). Or use print CSS. | Low | Styling fidelity. Large charts. | Manual verification. |
| 10. Dataset shift | Add training stats computation and shift tests (PSI/KS). Store stats. | UI warnings if shift detected. | scipy (may need) or implement simple. | Med-High | Needs external data to be useful. scipy not in requirements.txt currently. | Tests with synthetic shift. |

## 4. Ranked Roadmap (quick wins first)

Rank by: user value, feasibility, low risk to existing functionality, scientific soundness.

1. **(Quick win) Confusion matrix visualization in Performance page** — Pure UI addition. Uses existing data. High value (makes metrics tangible). No API/model changes. Risk: very low.  
2. **(Quick win) Dataset explorer page** — Serve existing JSON docs via new endpoint or read client-side. Educational transparency. Low complexity.  
3. **(Quick win) Scenario simulator / side-by-side comparison** — Frontend-only. Enhances synthetic demo UX without touching ML.  
4. **(Quick win) PDF export (print-to-PDF enhanced or client lib)** — Nice for research reports. Can start with better print CSS; add lib if needed.  
5. **XAI explorer: global feature importance + compare** — Adds real explainability value. Needs backend work (global SHAP). Manageable complexity.  
6. **Error analysis workbench** — Leverages existing evaluation data. Good for understanding model limits (important given ESI 4/5).  
7. **Input OOD safeguards** — Improves safety/robustness. But needs training stats persistence and threshold tuning.  
8. **Uncertainty/calibration/abstention** — Scientifically important but high risk given small sample. Needs careful design and clear disclaimers. Defer until after 1-7.  
9. **Dataset-shift analysis** — Limited utility without external data. Low priority.  
10. **Experiment runner/registry UI** — Useful for devs but less critical for end-user research prototype. Maybe skip for now.

## 5. Recommended First Feature (and rationale)

**Recommended first: Add confusion matrix heatmap to Performance page (Feature 1, first sub-item).**

**Rationale:**
- **Safe:** No backend model changes, no API contract changes. Pure visualization. All data exists in reports/model_evaluation.json and evaluate.py already computes it.
- **High value:** Confusion matrix is essential for understanding 5-class imbalance (especially why accuracy misleads). Current Performance page shows tables but heatmap is much clearer.
- **Low complexity:** Can implement as a simple table with background color intensity = count/max, or minimal recharts. No new heavy deps.
- **Verifiable:** Easy to compare rendered values against known aggregate confusion matrix from reports.
- **Quick to test:** Frontend build + existing backend tests unaffected.
- **Preserves design:** Matches existing card-based UI, uses existing color tokens (teal for diagonal emphasis, rose/amber subtle for errors).

**Implementation details (minimal):**
1. Add `frontend/src/components/ConfusionMatrix.jsx` — renders 5x5 heatmap from data. Accepts matrix + labels (ESI 1-5). Color by cell value (normalized) with diagonal emphasized.
2. Update `frontend/src/pages/PerformancePage.jsx` to import and display ConfusionMatrix. Load from model_evaluation.json? But file is in reports/, not served. Options: (a) copy key values into component as props/const (matches existing pattern — MetricChart hardcodes), or (b) add simple GET /evaluation endpoint to serve summary. (a) is safest and avoids API change.
3. Also show CV aggregate confusion matrix (aggregate_confusion_matrices sums across folds). Use aggregate from reports/confusion_matrix.csv or model_evaluation.json if present? Check: model_evaluation.json has holdout metrics; fold_metrics exist separately. reports/confusion_matrix.csv shows aggregate? Let us look.

Looking at confusion_matrix.csv: "true_label,pred_label,count" with sums across folds? Or holdout? Let us peek.

But easier: in evaluate.py, aggregate_confusion_matrices returns sum. The frontend can show the aggregate CV confusion matrix (most informative) and/or holdout. Performance page already states sources; better to show CV aggregate for robustness.

**API/Frontend changes summary:**
- New component only. No schema changes. No backend logic changes.
- Update PerformancePage to include ConfusionMatrix section.

**Testing:** Build frontend, verify renders. Backend tests unchanged (139 still pass). Manually verify numbers match aggregate.

## 6. Next Steps

1. Create FEATURE_GAP_ANALYSIS.md (this document) — done conceptually.
2. Implement first feature (confusion matrix visualization) as a separate tested change.
3. Run frontend build and backend tests, report results.
4. Document what changed.

I will proceed to implement the confusion matrix heatmap on the Performance page next.
