"""MedGuard Triagegeist Model Training, Evaluation, and Serialization Runner.

Executes:
1. Baseline evaluation (DummyClassifier most_frequent).
2. Candidate model evaluation via patient-grouped cross-validation
   (Logistic Regression, Random Forest).
3. Candidate model evaluation on held-out test split for identical comparisons.
4. Explainability verification with SHAP.
5. Selected model artifact serialization with metadata manifest.
6. Generation of reports and comparison tables.

All metrics are computed on real Triagegeist data - no hardcoded values.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from backend.ml import config, evaluate, triagegeist_training

log = logging.getLogger("medguard.triagegeist_training")


def run_phase2_experiment(
    reports_dir: Path | None = None,
    models_dir: Path | None = None,
    seed: int = config.RANDOM_SEED,
) -> dict[str, Any]:
    """Run the full Triagegeist training and evaluation pipeline.

    Parameters
    ----------
    reports_dir : Path | None
        Directory for evaluation reports. Defaults to config.REPORTS_DIR.
    models_dir : Path | None
        Directory for model artifacts. Defaults to
        config.PROJECT_ROOT / "models" / "triagegeist".
    seed : int
        Random seed for reproducibility.

    Returns
    -------
    dict[str, Any]
        Full evaluation payload with all metrics, configuration, and provenance.
    """
    return triagegeist_training.run_training(
        reports_dir=reports_dir,
        models_dir=models_dir,
        seed=seed,
    )


if __name__ == "__main__":
    run_phase2_experiment()
