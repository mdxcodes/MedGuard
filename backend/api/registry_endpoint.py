from fastapi import HTTPException

from backend.ml import registry


def list_model_versions():
    try:
        return registry.list_versions()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def get_model_version(version: str | None = None):
    try:
        # only one version for now
        return registry.get_active_version()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
