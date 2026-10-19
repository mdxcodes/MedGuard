# Experiment Runner

Lightweight experiment runner using existing ML pipeline. Supports patient-grouped splits, preserves ESI ordering. Experiments persisted to experiments/*.json. Local-only execution via API/UI. No overwriting of canonical model artifacts.

- POST /api/experiments/run
- GET /api/experiments
- GET /api/experiments/{id}

Tests: 22 frontend tests (7 files), 139 backend tests pass.
