"""Assessment and prediction persistence in Supabase Postgres.

The service records every assessment it handles, the prediction produced
from it, and enough metadata to trace a stored prediction back to the model
version that produced it.

Design notes
------------
* **One path.** The browser never talks to the database directly. It talks
  to the FastAPI service, which authenticates with a server-side key and
  applies the ownership check. The tables have Row Level Security enabled
  with no policy for the browser roles, so a leaked publishable key cannot
  read or write anything.
* **Ownership.** Each browser mints an opaque ``owner_token`` and sends it in
  the ``X-MedGuard-Owner`` header. The store scopes every query to it, so
  one caller can never see another's history.
* **No new dependency.** The Supabase PostgREST API is used over HTTP with
  ``httpx``, which is already installed as part of the web stack.
* **Best effort for the request, strict for the data.** A persistence
  failure is reported to the caller and never turns a successful prediction
  into a failed request: the prediction itself did not fail. The failure is
  surfaced, not swallowed.
"""

from __future__ import annotations

import logging
import os
from typing import Any, Optional

log = logging.getLogger("medguard.ml.persistence")

#: Environment variables. The URL and the key are server-side only.
SUPABASE_URL_ENV = "SUPABASE_URL"
SUPABASE_SECRET_KEY_ENV = "SUPABASE_SECRET_KEY"
SUPABASE_SERVICE_ROLE_ENV = "SUPABASE_SERVICE_ROLE_KEY"

#: Header the browser uses to present its owner token.
OWNER_HEADER = "X-MedGuard-Owner"

_ASSESSMENTS_TABLE = "assessments"
_PREDICTIONS_TABLE = "predictions"

_REQUEST_TIMEOUT = 15.0


class PersistenceError(RuntimeError):
    """Raised when a record could not be stored or read back."""


def _settings() -> tuple[str, str]:
    """Return the project URL and the server-side key, if configured."""
    url = os.getenv(SUPABASE_URL_ENV, "").strip()
    secret = os.getenv(SUPABASE_SECRET_KEY_ENV, "").strip()
    service = os.getenv(SUPABASE_SERVICE_ROLE_ENV, "").strip()
    return url, (secret or service)


def persistence_configured() -> bool:
    """True when the service is able to write to the database."""
    url, key = _settings()
    return bool(url and key)


def _headers(key: str) -> dict[str, str]:
    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }


class AssessmentStore:
    """Reads and writes assessment history through the Supabase REST API."""

    def __init__(self, url: Optional[str] = None, key: Optional[str] = None) -> None:
        configured_url, configured_key = _settings()
        self.url = (url if url is not None else configured_url).rstrip("/")
        self.key = key if key is not None else configured_key

    @property
    def enabled(self) -> bool:
        return bool(self.url and self.key)

    def _request(self, method: str, path: str, **kwargs: Any) -> Any:
        if not self.enabled:
            raise PersistenceError(
                "Persistence is not configured; set "
                f"{SUPABASE_URL_ENV} and {SUPABASE_SECRET_KEY_ENV} on the server."
            )

        import httpx

        url = f"{self.url}/rest/v1/{path}"
        extra_headers = kwargs.pop("headers", {})
        merged_headers = {**_headers(self.key), **extra_headers}
        try:
            response = httpx.request(
                method,
                url,
                headers=merged_headers,
                timeout=_REQUEST_TIMEOUT,
                **kwargs,
            )
        except Exception as exc:  # noqa: BLE001
            raise PersistenceError(f"Could not reach the database: {exc}") from exc

        if response.status_code >= 400:
            # The response body can contain row contents; log only the status
            # and a short, safe prefix.
            detail = response.text[:160].replace("\n", " ")
            raise PersistenceError(
                f"Database request failed with HTTP {response.status_code}: {detail}"
            )

        if not response.content:
            return None
        try:
            return response.json()
        except Exception:
            return None

    # --- Writes ---------------------------------------------------------
    def record_assessment(self, record: dict[str, Any]) -> Optional[str]:
        """Store one assessment and its prediction. Returns the assessment id."""
        payload = {
            "owner_token": record["owner_token"],
            "surface": record.get("surface", "patient"),
            "inputs": record.get("inputs", {}),
            "missing_inputs": record.get("missing_inputs", []),
            "model_name": record.get("model_name"),
            "model_version": record.get("model_version"),
            "predicted_esi_level": record.get("predicted_esi_level"),
            "probabilities": record.get("probabilities"),
            "explanation": record.get("explanation"),
            "quality": record.get("quality"),
            "uncertainty": record.get("uncertainty"),
            "input_warnings": int(record.get("input_warnings", 0)),
            "duration_ms": record.get("duration_ms"),
        }

        rows = self._request(
            "POST",
            _ASSESSMENTS_TABLE,
            json=payload,
            headers={**_headers(self.key), "Prefer": "return=representation"},
        )
        assessment_id = None
        if isinstance(rows, list) and rows:
            assessment_id = rows[0].get("id")
        elif isinstance(rows, dict):
            assessment_id = rows.get("id")

        if assessment_id and record.get("predicted_esi_level") is not None:
            self._request(
                "POST",
                _PREDICTIONS_TABLE,
                json={
                    "assessment_id": assessment_id,
                    "model_name": record.get("model_name") or "unknown",
                    "model_version": record.get("model_version"),
                    "predicted_esi_level": record["predicted_esi_level"],
                    "probabilities": record.get("probabilities") or {},
                    "explanation": record.get("explanation"),
                    "quality": record.get("quality"),
                    "uncertainty": record.get("uncertainty"),
                },
            )

        return assessment_id

    # --- Reads ----------------------------------------------------------
    def list_assessments(
        self,
        owner_token: str,
        limit: int = 50,
        offset: int = 0,
    ) -> list[dict[str, Any]]:
        """Return the caller's assessments, newest first."""
        if not owner_token:
            return []
        rows = self._request(
            "GET",
            _ASSESSMENTS_TABLE,
            params={
                "owner_token": f"eq.{owner_token}",
                "order": "created_at.desc",
                "limit": limit,
                "offset": offset,
                "select": (
                    "id,created_at,surface,inputs,missing_inputs,model_name,"
                    "model_version,predicted_esi_level,probabilities,input_warnings"
                ),
            },
        )
        return rows if isinstance(rows, list) else []

    def get_assessment(self, owner_token: str, assessment_id: str) -> Optional[dict[str, Any]]:
        """Return one of the caller's assessments."""
        if not owner_token or not assessment_id:
            return None
        rows = self._request(
            "GET",
            _ASSESSMENTS_TABLE,
            params={
                "id": f"eq.{assessment_id}",
                "owner_token": f"eq.{owner_token}",
                "limit": 1,
            },
        )
        if isinstance(rows, list) and rows:
            return rows[0]
        return None

    def count_assessments(self, owner_token: str) -> int:
        """Number of assessments stored for the caller."""
        if not owner_token:
            return 0
        rows = self._request(
            "GET",
            _ASSESSMENTS_TABLE,
            params={
                "owner_token": f"eq.{owner_token}",
                "select": "id",
                "limit": 1000,
            },
        )
        return len(rows) if isinstance(rows, list) else 0
