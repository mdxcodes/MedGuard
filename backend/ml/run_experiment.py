"""MedGuard Phase 2 — Model Training, Evaluation, and Serialization Runner.

Executes:
1. Baseline evaluation (DummyClassifier most_frequent, stratified).
2. Candidate model evaluation via patient-grouped 5-fold cross-validation
   (Logistic Regression, Random Forest).
3. Candidate model evaluation on held-out test split for identical comparisons.
4. Explainability verification with SHAP.
5. Selected model artifact serialization with metadata manifest.
6. Generation of reports and comparison tables.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from backend.ml import config, evaluate, explain, features, splitting, train
from backend.ml.data_loading import load_joined_dataset

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s: %(message)s")
log = logging.getLogger("medguard.phase2")


def run_phase2_experiment(
    reports_dir: Path | None = None,
    models_dir: Path | None = None,
    seed: int = config.RANDOM_SEED,
) -> dict[str, Any]:
    reports_dir = reports_dir or config.REPORTS_DIR
    models_dir = models_dir or (config.PROJECT_ROOT / "models")
    reports_dir.mkdir(parents=True, exist_ok=True)
    models_dir.mkdir(parents=True, exist_ok=True)

    log.info("Loading joined dataset...")
    joined = load_joined_dataset(verify_checksum=True)
    df = features.build_feature_frame(joined)
    features.assert_no_leakage_columns(df)

    log.info("Cleaned feature frame has %d rows, %d patients.", len(df), df[config.SUBJECT_ID_COLUMN].nunique())
    class_counts = df[config.TARGET_COLUMN].value_counts().sort_index().to_dict()
    log.info("Acuity distribution: %s", {f"ESI {int(k)}": v for k, v in class_counts.items()})

    # 1. Stratification feasibility audit
    feasibility = splitting.report_stratification_feasibility(df, n_splits=config.N_SPLITS)
    log.info("Stratification feasibility: %s (Reason: %s)", feasibility["feasible"], feasibility["reason"])

    # 2. Holdout split for baseline & model test comparison
    train_df, test_df = splitting.patient_grouped_split(df, test_size=config.TEST_SIZE, seed=seed)
    splitting.assert_no_patient_overlap(train_df[config.SUBJECT_ID_COLUMN], test_df[config.SUBJECT_ID_COLUMN])
    log.info("Holdout split: %d train rows (%d pts), %d test rows (%d pts).",
             len(train_df), train_df[config.SUBJECT_ID_COLUMN].nunique(),
             len(test_df), test_df[config.SUBJECT_ID_COLUMN].nunique())

    # 3. Baselines evaluation on holdout
    baselines = ["dummy_most_frequent", "dummy_stratified"]
    baseline_eval = {}
    for b_name in baselines:
        pipe = train.build_estimator_pipeline(b_name)
        m = evaluate.evaluate_pipeline_on_split(pipe, train_df, test_df)
        baseline_eval[b_name] = m
        log.info("Baseline %s on holdout: Macro-F1=%.4f, Balanced Acc=%.4f",
                 b_name, m["macro_f1"], m["balanced_accuracy"])

    # 4. Candidate Cross-Validation
    candidates = ["logistic_regression", "random_forest"]
    candidate_cv = {}
    fold_metrics_rows = []

    for c_name in candidates:
        log.info("Running 5-fold patient-grouped CV for %s...", c_name)
        cv_res = evaluate.run_grouped_cv_evaluation(
            lambda name=c_name: train.build_estimator_pipeline(name),
            df,
            n_splits=config.N_SPLITS,
        )
        candidate_cv[c_name] = cv_res
        summ = cv_res["summary"]
        log.info("Candidate %s CV: Mean Macro-F1=%.4f +/- %.4f, Mean Balanced Acc=%.4f +/- %.4f, Mean QWK=%.4f",
                 c_name,
                 summ.get("mean_macro_f1", 0.0), summ.get("std_macro_f1", 0.0),
                 summ.get("mean_balanced_accuracy", 0.0), summ.get("std_balanced_accuracy", 0.0),
                 summ.get("mean_quadratic_weighted_kappa", 0.0) or 0.0)

        for fm in cv_res["fold_metrics"]:
            fold_metrics_rows.append({
                "model": c_name,
                "fold": fm["fold"],
                "macro_f1": fm["macro_f1"],
                "balanced_accuracy": fm["balanced_accuracy"],
                "quadratic_weighted_kappa": fm["quadratic_weighted_kappa"],
                "f1_esi_1": fm["per_class"]["ESI 1"]["f1"],
                "f1_esi_2": fm["per_class"]["ESI 2"]["f1"],
                "f1_esi_3": fm["per_class"]["ESI 3"]["f1"],
                "f1_esi_4": fm["per_class"]["ESI 4"]["f1"],
                "f1_esi_5": fm["per_class"]["ESI 5"]["f1"],
                "rec_esi_1": fm["per_class"]["ESI 1"]["recall"],
                "rec_esi_2": fm["per_class"]["ESI 2"]["recall"],
                "rec_esi_3": fm["per_class"]["ESI 3"]["recall"],
                "rec_esi_4": fm["per_class"]["ESI 4"]["recall"],
                "rec_esi_5": fm["per_class"]["ESI 5"]["recall"],
            })

    # 5. Candidate evaluation on holdout for direct comparison with baselines
    candidate_holdout = {}
    for c_name in candidates:
        pipe = train.build_estimator_pipeline(c_name)
        m = evaluate.evaluate_pipeline_on_split(pipe, train_df, test_df)
        candidate_holdout[c_name] = m
        log.info("Candidate %s on holdout: Macro-F1=%.4f, Balanced Acc=%.4f, QWK=%.4f",
                 c_name, m["macro_f1"], m["balanced_accuracy"], m["quadratic_weighted_kappa"] or 0.0)

    # 6. Fit selected candidate on train_df and explain sample using SHAP
    selected_model_name = "random_forest"
    log.info("Fitting selected candidate (%s) on train_df...", selected_model_name)
    selected_pipeline = train.build_estimator_pipeline(selected_model_name)
    selected_pipeline.fit(train_df, train_df[config.TARGET_COLUMN].values.astype(int))

    shap_explanation = explain.explain_prediction(
        selected_pipeline,
        test_df,
        row_index=0,
    )
    log.info("SHAP explanation verified for test row 0: pred=ESI %d, top feature=%s",
             shap_explanation["predicted_class"],
             shap_explanation["top_features"][0]["feature"] if shap_explanation["top_features"] else "none")

    # 7. Persist model and manifest
    model_artifact_path = models_dir / "triage_model.joblib"
    train.persist_pipeline(
        selected_pipeline,
        model_artifact_path,
        model_name=selected_model_name,
        training_rows=len(train_df),
        training_patients=train_df[config.SUBJECT_ID_COLUMN].nunique(),
    )
    log.info("Persisted model to %s", model_artifact_path)

    # 8. Generate reports
    # A. model_comparison.csv
    comp_rows = []
    for b_name in baselines:
        m = baseline_eval[b_name]
        comp_rows.append({
            "model": b_name,
            "type": "baseline",
            "eval_strategy": "holdout",
            "macro_f1": m["macro_f1"],
            "balanced_accuracy": m["balanced_accuracy"],
            "quadratic_weighted_kappa": m["quadratic_weighted_kappa"],
            "mean_cv_macro_f1": None,
            "std_cv_macro_f1": None,
            "mean_cv_balanced_acc": None,
            "std_cv_balanced_acc": None,
        })

    for c_name in candidates:
        m_h = candidate_holdout[c_name]
        cv_s = candidate_cv[c_name]["summary"]
        comp_rows.append({
            "model": c_name,
            "type": "candidate",
            "eval_strategy": "holdout_and_5fold_cv",
            "macro_f1": m_h["macro_f1"],
            "balanced_accuracy": m_h["balanced_accuracy"],
            "quadratic_weighted_kappa": m_h["quadratic_weighted_kappa"],
            "mean_cv_macro_f1": cv_s["mean_macro_f1"],
            "std_cv_macro_f1": cv_s["std_macro_f1"],
            "mean_cv_balanced_acc": cv_s["mean_balanced_accuracy"],
            "std_cv_balanced_acc": cv_s["std_balanced_accuracy"],
        })

    comp_df = pd.DataFrame(comp_rows)
    comp_df.to_csv(reports_dir / "model_comparison.csv", index=False)

    # B. fold_metrics.csv
    fold_df = pd.DataFrame(fold_metrics_rows)
    fold_df.to_csv(reports_dir / "fold_metrics.csv", index=False)

    # C. confusion_matrix.csv (CV aggregate for the selected model)
    rf_cm = candidate_cv[selected_model_name]["aggregate_confusion_matrix"]
    cm_df = pd.DataFrame(rf_cm, index=evaluate.LABEL_NAMES, columns=evaluate.LABEL_NAMES)
    cm_df.to_csv(reports_dir / "confusion_matrix.csv")

    # D. drift / shift analysis on the held-out split
    drift_payload = evaluate.build_drift_payload(train_df, test_df)
    (reports_dir / "drift_analysis.json").write_text(
        json.dumps(drift_payload, indent=2, default=str), encoding="utf-8"
    )
    log.info("Wrote drift_analysis.json")

    # D. model_evaluation.json
    full_eval_payload = {
        "dataset": "MIMIC-IV-ED v2.2 demo subset",
        "random_seed": seed,
        "n_rows": len(df),
        "n_patients": int(df[config.SUBJECT_ID_COLUMN].nunique()),
        "class_distribution": {f"ESI {int(k)}": v for k, v in class_counts.items()},
        "stratification_feasibility": feasibility,
        "baselines_holdout": baseline_eval,
        "candidates_holdout": candidate_holdout,
        "candidates_5fold_cv": {
            c: {
                "summary": candidate_cv[c]["summary"],
                "aggregate_confusion_matrix": candidate_cv[c]["aggregate_confusion_matrix"],
                "fold_diagnostics": candidate_cv[c]["fold_diagnostics"],
            }
            for c in candidates
        },                "selected_model": {
                    "name": selected_model_name,
                    "artifact": str(model_artifact_path),
                    "holdout_metrics": candidate_holdout[selected_model_name],
                    "cv_summary": candidate_cv[selected_model_name]["summary"],
                    "sample_shap_explanation": shap_explanation,
                },
                "drift_analysis": drift_payload,
            }


    with open(reports_dir / "model_evaluation.json", "w", encoding="utf-8") as f:
        json.dump(full_eval_payload, f, indent=2, default=str)

    # E. reports/model_card.md
    model_card_text = f"""# MedGuard Model Card — Demo Acuity Classifier

## Model Details
- **Architecture**: RandomForestClassifier (80 estimators, max_depth=6, class_weight='balanced_subsample')
- **Pipeline**: MedGuard Leakage-Safe ColumnTransformer (median vitals imputation, standard scaling, categorical encoding, sublinear TF-IDF chief complaint, binary missingness indicators)
- **Dataset**: MIMIC-IV-ED v2.2 Demo Subset (207 labeled visits, 56 unique patients)
- **Target**: Emergency Severity Index (ESI) Acuity levels 1–5 (original 5-level scale)
- **Evaluation**: Patient-grouped 5-fold cross-validation + patient-grouped held-out split (seed: {seed})

## Performance Summary (CV & Holdout)
- **CV Macro-F1**: {candidate_cv['random_forest']['summary'].get('mean_macro_f1', 0.0):.4f} ± {candidate_cv['random_forest']['summary'].get('std_macro_f1', 0.0):.4f}
- **CV Balanced Accuracy**: {candidate_cv['random_forest']['summary'].get('mean_balanced_accuracy', 0.0):.4f} ± {candidate_cv['random_forest']['summary'].get('std_balanced_accuracy', 0.0):.4f}
- **Holdout Macro-F1**: {candidate_holdout['random_forest']['macro_f1']:.4f} (vs Dummy Most Frequent: {baseline_eval['dummy_most_frequent']['macro_f1']:.4f})
- **Holdout Quadratic Weighted Kappa**: {candidate_holdout['random_forest']['quadratic_weighted_kappa'] or 0.0:.4f}

## Critical Limitations
1. **Demo subset only**: Trained and evaluated on only 207 stays.
2. **Missing ESI 5**: Level 5 has 0 occurrences in the demo data; the model cannot learn or predict ESI 5.
3. **Sparse ESI 4**: Level 4 has only 2 examples in the dataset, precluding reliable evaluation.
4. **Research demonstration only**: Not clinically validated; strictly prohibited for live triage decisions.
"""
    (reports_dir / "model_card.md").write_text(model_card_text, encoding="utf-8")

    log.info("Experiment run complete. All reports written to %s.", reports_dir)
    return full_eval_payload


if __name__ == "__main__":
    run_phase2_experiment()
