# ---------------------------------------------------------------------------
# MedGuard (Triage One) — backend image
#
# Build from the REPOSITORY ROOT so that the canonical dependency file is
# present:
#
#     docker build -f backend/Dockerfile -t medguard-api .
#     docker run --rm -p 8000:8000 \
#         -e MEDGUARD_MODEL_PATH=/app/models/triagegeist/triage_model.joblib \
#         medguard-api
#
# The trained artifact is ~250 MB and is NOT committed (GitHub's limit is
# 100 MB per file), so it is not baked into the image. Mount it, or set
# MEDGUARD_MODEL_URL so the service fetches and verifies it at startup.
#
# The Python version matches .python-version and the pins in
# backend/requirements.txt.
# ---------------------------------------------------------------------------
FROM python:3.14.8-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

# Dependencies first so the layer is cached across code changes.
COPY requirements.txt ./
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

# Application code. The model artifact and the reports are supplied at
# runtime, not baked in.
COPY backend/ ./backend/

# Default artifact location; override with the environment variables below.
RUN mkdir -p /app/models/triagegeist

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=4).status == 200 else 1)"

CMD ["uvicorn", "backend.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
