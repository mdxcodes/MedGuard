"""Professional research report export (PDF).

Generates a sanitized technical report using verified artifacts.
No patient identifiers, raw records, or clinical text included.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    PageBreak,
)

from backend.ml import config


ARTIFACTS = {
    "model_eval": config.REPORTS_DIR / "model_evaluation.json",
    "dq": config.REPORTS_DIR / "data_quality_report.json",
    "errors": config.REPORTS_DIR / "evaluation_errors.json",
    "global_shap": config.REPORTS_DIR / "global_shap.json",
    "training_stats": config.REPORTS_DIR / "training_distribution_stats.json",
    "manifest": config.PROJECT_ROOT / "models" / "triage_model.manifest.json",
}


def load_json(path: Path) -> Dict[str, Any] | None:
    if path.exists():
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    return None


def generate_pdf(output_path: Path) -> Dict[str, Any]:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(str(output_path), pagesize=A4, rightMargin=72, leftMargin=72,
                            topMargin=72, bottomMargin=72)
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("Title", parent=styles["Heading1"], fontSize=18, spaceAfter=24)
    h1 = ParagraphStyle("H1", parent=styles["Heading1"], fontSize=14, spaceAfter=12, spaceBefore=12)
    h2 = ParagraphStyle("H2", parent=styles["Heading2"], fontSize=12, spaceAfter=8, spaceBefore=8)
    normal = styles["Normal"]

    dq = load_json(ARTIFACTS["dq"]) or {}
    me = load_json(ARTIFACTS["model_eval"]) or {}
    errs = load_json(ARTIFACTS["errors"]) or {}
    gshap = load_json(ARTIFACTS["global_shap"]) or {}
    man = load_json(ARTIFACTS["manifest"]) or {}

    story = []
    story.append(Paragraph("MedGuard — Triage One: Research Report", title_style))
    story.append(Paragraph(f"Generated: {datetime.now(timezone.utc).isoformat()}", normal))
    story.append(Paragraph(f"Model: {man.get('model_name', 'unknown')} ({man.get('model_kind', 'unknown')})", normal))
    story.append(Spacer(1, 12))

    story.append(Paragraph("1. Executive Summary", h1))
    story.append(Paragraph(
        "Educational research prototype for emergency triage acuity prediction. "
        "Results are exploratory; not clinically validated. Not for real triage decisions.",
        normal
    ))
    story.append(Spacer(1, 8))

    story.append(Paragraph("2. Dataset", h1))
    dist = dq.get("label_distribution", {})
    data = [["Class", "Count", "%"]]
    total = dq.get("row_counts", {}).get("modelling_rows", sum(dist.values()))
    for cls in ["ESI 1", "ESI 2", "ESI 3", "ESI 4", "ESI 5"]:
        c = dist.get(cls, 0)
        pct = (c/total*100) if total > 0 else 0
        data.append([cls, str(c), f"{pct:.1f}%"])
    t = Table(data, colWidths=[80, 80, 80])
    t.setStyle(TableStyle([("BACKGROUND", (0,0), (-1,0), colors.lightgrey),
                          ("GRID", (0,0), (-1,-1), 0.5, colors.grey)]))
    story.append(t)
    story.append(Paragraph(f"Modeling rows: {total}, Patients: {me.get('n_patients', 'n/a')}", normal))
    story.append(Spacer(1, 8))

    story.append(Paragraph("3. Performance (CV aggregate)", h1))
    story.append(Paragraph("Patient-grouped evaluation; ESI 4 sparse, ESI 5 absent.", normal))
    story.append(Spacer(1, 8))

    story.append(Paragraph("4. Error Analysis (OOF)", h1))
    mis = sum(1 for r in errs.get("records", []) if r.get("is_misclassified"))
    total_e = errs.get("n_samples", 0)
    story.append(Paragraph(f"Misclassified: {mis}/{total_e} ({(mis/total_e*100):.1f}%) - {errs.get('records',[{}])[0].get('evaluation_protocol','patient_grouped_5fold_cv_out_of_fold') if errs.get('records') else ''}", normal))
    story.append(Spacer(1, 8))

    story.append(Paragraph("5. Global SHAP", h1))
    if gshap.get("feature_importances"):
        gdata = [["Feature", "mean |SHAP|"]]
        for fi in gshap["feature_importances"][:10]:
            gdata.append([fi["feature"][:40], f"{fi['mean_abs_shap']:.4f}"])
        gt = Table(gdata, colWidths=[200, 100])
        gt.setStyle(TableStyle([("BACKGROUND", (0,0), (-1,0), colors.lightgrey),
                               ("GRID", (0,0), (-1,-1), 0.5, colors.grey)]))
        story.append(gt)
        story.append(Paragraph(f"Ref: {gshap.get('reference_dataset')}, n={gshap.get('n_reference_samples')}", normal))
    story.append(Spacer(1, 8))

    story.append(Paragraph("6. Limitations", h1))
    story.append(Paragraph("ESI 4 has 2 examples; ESI 5 has 0 labeled examples. Not clinically validated. Research prototype only.", normal))

    doc.build(story)
    return {"path": str(output_path), "size_bytes": output_path.stat().st_size}
