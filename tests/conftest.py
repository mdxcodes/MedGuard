"""Shared pytest configuration for the MedGuard test suite.

Makes the project root importable so tests can ``import backend.ml.*``
regardless of the directory pytest is invoked from.
"""

from __future__ import annotations

import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

import pytest


@pytest.fixture()
def synthetic_dataset(tmp_path, monkeypatch):
    """A synthetic (non-research) dataset directory wired into the config.

    Reproduces the layout of the real demo package so the loading code paths
    are exercised without touching licensed data.
    """
    from backend.ml import config

    dataset_dir = __import__("tests.fixtures", fromlist=["write_synthetic_dataset"]
                            ).write_synthetic_dataset(tmp_path / "synthetic-dataset")

    monkeypatch.setattr(config, "DATASET_DIR", dataset_dir)
    monkeypatch.setattr(config, "DATASET_ED_DIR", dataset_dir / "ed")
    monkeypatch.setattr(config, "CHECKSUM_FILE", dataset_dir / "SHA256SUMS.txt")
    return dataset_dir


@pytest.fixture()
def synthetic_joined():
    """A synthetic joined triage+edstays frame (no file I/O)."""
    from tests.fixtures import synthetic_edstays_frame, synthetic_triage_frame
    from backend.ml.data_loading import join_triage_edstays

    return join_triage_edstays(
        synthetic_triage_frame(), synthetic_edstays_frame()
    )
