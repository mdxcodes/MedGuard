"""Report export endpoint helpers."""
from __future__ import annotations

from pathlib import Path
from fastapi import HTTPException
from fastapi.responses import FileResponse

from backend.ml.report_export import generate_pdf, ARTIFACTS


def export_research_report():
    # Check required artifacts exist
    missing = []
    for name, p in ARTIFACTS.items():
        if not p.exists():
            missing.append(str(p.name))
    if missing:
        raise HTTPException(status_code=500, detail=f"Missing artifacts: {', '.join(missing)}")

    out = Path("/tmp/medguard_research_report.pdf")
    try:
        generate_pdf(out)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Report generation failed: {e}") from e

    return FileResponse(
        path=str(out),
        filename="medguard_research_report.pdf",
        media_type="application/pdf",
    )
