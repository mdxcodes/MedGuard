from fastapi import HTTPException, Body
from backend.ml import experiment


def run_new_experiment(payload: dict = Body(default={})):
    try:
        cfg = experiment.ExperimentConfig(**{k: v for k, v in payload.items() if hasattr(experiment.ExperimentConfig, k) or k in ('name',)})
        if 'name' in payload: cfg.name = payload['name']
        return experiment.run_experiment(cfg)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


def list_exps():
    try: return experiment.list_experiments()
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))


def get_exp(exp_id: str):
    res = experiment.get_experiment(exp_id)
    if not res: raise HTTPException(status_code=404, detail='not found')
    return res
