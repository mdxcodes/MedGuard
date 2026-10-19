# Model Version Registry

**Status:** Complete

## Overview

Lightweight registry for model versions with integrity checks (SHA-256) and basic provenance metadata. No runtime model switching.

## Manifest

Extended manifest includes manifest_version, schema_version, artifact_filenames, artifact_checksums.

## API

- GET /api/models/versions
- GET /api/models/active (includes integrity status)

## Verification

Backend: 139 tests pass. Frontend: 7 test files, 22 tests pass. Build succeeds.
