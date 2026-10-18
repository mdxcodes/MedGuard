"""Lightweight experiment runner using existing pipeline."""
from __future__ import annotations

import json
import uuid
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List

from backend.ml import config, features, evaluate, train
from backend.ml.data_loading import load_joined_dataset


EXPERIMENTS_DIR = config.PROJECT_ROOT / "experiments"
EXPERIMENTS_DIR.mkdir(parents=True, exist_ok=True)


@dataclass
class ExperimentConfig:
    model_name: str = "random_forest"
    random_seed: int = config.RANDOM_SEED
    test_size: float = config.TEST_SIZE
    n_splits: int = config.N_SPLITS
    name: str = "experiment"


def run_experiment(config_obj: ExperimentConfig) -> Dict[str, Any]:
    exp_id = str(uuid.uuid4())[:8]
    started = datetime.now(timezone.utc).isoformat()
    exp_path = EXPERIMENTS_DIR / f"exp_{exp_id}.json"

    try:
        joined = load_joined_dataset(verify_checksum=True)
        df = features.build_feature_frame(joined)
        train_df, test_df = features.train_test_split_patient_grouped(df, test_size=config_obj.test_size, seed=config_obj.random_seed) if hasattr(features, 'train_test_split_patient_grouped') else None
        # fallback
        if train_df is None:
            from backend.ml import splitting
            train_df, test_df = splitting.patient_grouped_split(df, test_size=config_obj.test_size, seed=config_obj.random_seed)

        pipe = train.build_estimator_pipeline(config_obj.model_name)
        m = evaluate.evaluate_pipeline_on_split(pipe, train_df, test_df)
        finished = datetime.now(timezone.utc).isoformat()
        res = {
            "id": exp_id,
            "name": config_obj.name,
            "status": "completed",
            "started_at": started,
            "finished_at": finished,
            "config": asdict(config_obj),
            "results": {"holdout": m},
            "provenance": {"dataset": "MIMIC-IV-ED v2.2 demo subset", "protocol": "patient_grouped_split"},
        }
        exp_path.write_text(json.dumps(res, indent=2, default=str))
        return res
    except Exception as e:
        finished = datetime.now(timezone.utc).isoformat()
        res = {"id": exp_id, "name": config_obj.name, "status": "failed", "started_at": started, "finished_at": finished, "config": asdict(config_obj), "error": str(e)}
        exp_path.write_text(json.dumps(res, indent=2, default=str))
        return res


def list_experiments() -> List[Dict[str, Any]]:
    items = []
    for p in sorted(EXPERIMENTS_DIR.glob("exp_*.json")):
        with open(p) as f:
            items.append(json.load(f))
    return items


def get_experiment(exp_id: str) -> Dict[str, Any] | None:
    p = EXPERIMENTS_DIR / f"exp_{exp_id}.json"
    if not p.exists(): return None
    with open(p) as f:
        return json.load(f)
