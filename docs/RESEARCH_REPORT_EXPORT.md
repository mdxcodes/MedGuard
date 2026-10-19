# MedGuard — Research Report Export

**Date:** 2026-10-18  
**Status:** Complete

## Overview

Generates a sanitized PDF research report from verified artifacts. No patient identifiers or raw data included.

## Implementation

- Backend: `backend/ml/report_export.py` (reportlab) generates PDF from artifacts
- API: `backend/api/report_endpoint.py`, route `GET /api/export/report`
- Frontend: `ReportExportButton` in Performance page

## Artifacts Used

- model_evaluation.json, data_quality_report.json, evaluation_errors.json, global_shap.json, training_distribution_stats.json, triage_model.manifest.json

## Verification

- PDF generation smoke test produces ~3.6KB file
- 139 backend tests pass; 21 frontend tests pass; frontend builds successfully
- No patient identifiers in any source artifacts
