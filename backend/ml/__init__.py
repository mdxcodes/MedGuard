"""Machine-learning data-preparation package for MedGuard (Triage One).

Modules
-------
config        Paths, constants, clinical plausibility thresholds, allow-lists.
data_loading  Gzip-CSV reading, SHA-256 verification, schema checks, 1:1 join.
validation    Data-quality rules (temperature units, blood pressure, pain, etc.).
features      Leakage-safe feature specification and scikit-learn pipeline.
splitting     Patient-grouped train/test splitting with overlap assertions.
"""
