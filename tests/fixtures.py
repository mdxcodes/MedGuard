"""Synthetic test fixtures for MedGuard.

These fixtures are synthetic and are NOT research data. They are generated
from fixed seeds with deliberately planted data-quality defects so that every
validation rule can be tested with a known expected outcome. They must never
be presented as real patient data, and they must never be replaced by
real patient data.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from backend.ml import config, features, triagegeist_schema


TRIAGE_COLUMNS = [
    "patient_id",
    "heart_rate",
    "respiratory_rate",
    "temperature_c",
    "spo2",
    "systolic_bp",
    "diastolic_bp",
    "pain_score",
    "triage_acuity",
    "chief_complaint_system",
    "age",
    "sex",
    "insurance_type",
    "arrival_mode",
    "arrival_hour",
    "shock_index",
    "num_prior_ed_visits_12m",
    "num_active_medications",
]


def synthetic_triage_frame() -> pd.DataFrame:
    """A small triage frame with every planted defect the rules must catch.

    Planted cases (row order is deliberate so tests can assert on them):

    Row  True values                                Expected after cleaning
    ==== ================================ =====================================
    Row 0  temperature 37.0 C               -> 37.0 C (kept)
    Row 1  temperature 150.0 C              -> NaN (outside clinical envelope)
    Row 2  pain 'UA'                        -> NaN (unassessable sentinel)
    Row 3  pain 13                           -> NaN (out of 0-10 range)
    Row 4  acuity missing                  -> row dropped from supervised set
    Row 5  duplicate patient_id            -> DuplicateKeyError
    """
    rng = np.random.default_rng(42)
    n = 15
    patient_ids = np.repeat(np.arange(9001, 9001 + n // 2), 2)[:n]

    rows = [
        (9001, 90, 18, 37.0, 98, 120, 80, 3, 2, "Respiratory", 45, "F", "Medicare", "AMBULANCE", 14, 0.8, 1, 2),
        (9001, 90, 18, 150.0, 98, 120, 80, 4, 2, "Respiratory", 45, "F", "Medicare", "AMBULANCE", 10, 0.8, 1, 2),
        (9002, 90, 18, 98.6, 98, 120, 80, "UA", 1, "Neurological", 50, "M", "Private", "WALK IN", 2, 0.9, 2, 1),
        (9002, 90, 18, 98.6, 98, 120, 879, 2, 1, "Cardiovascular", 55, "M", "Private", "WALK IN", 8, 0.9, 2, 1),
        (9003, 90, 18, 98.6, 98, 120, 80, "Critical", 1, "Trauma", 40, "F", "Other", "AMBULANCE", 16, 0.8, 3, 4),
        (9003, 90, 18, 98.6, 98, 120, 80, 5, 2, "Cardiovascular", 40, "F", "Other", "AMBULANCE", 20, 0.8, 3, 4),
        (9004, 90, 18, 98.6, 98, 120, 80, None, None, "Abdominal", 60, "F", "Medicaid", "WALK IN", 6, 0.7, 0, 0),
        (9005, 90, 18, 98.6, 98, 120, 80, 1, 1, "Respiratory", 30, "F", "Private", "AMBULANCE", 4, 0.75, 2, 1),
        (9005, 90, 18, 98.6, 98, 120, 80, 7, 2, "Trauma", 30, "F", "Private", "AMBULANCE", 12, 0.75, 2, 1),
        (9006, None, None, None, None, None, None, None, None, None, None, None, None, None, None, None, None, None),
        (9006, 70, 16, 97.0, 99, 110, 70, 0, 3, "Abdominal", 25, "F", "Self-pay", "WALK IN", 12, 0.6, 1, 0),
        (9007, 110, 22, 99.1, 91, 85, 50, 8, 1, "Neurological", 55, "M", "Other", "AMBULANCE", 3, 1.3, 0, 0),
        (9007, 110, 22, 99.1, 91, 85, 50, 9, 1, "Neurological", 55, "M", "Other", "AMBULANCE", 2, 1.3, 0, 0),
        (9008, 88, 18, 98.2, 97, 130, 75, 2, 2, "Abdominal", 42, "M", "Private", "WALK IN", 14, 0.68, 2, 2),
    ]
    return pd.DataFrame(rows, columns=TRIAGE_COLUMNS)


def synthetic_joined_frame() -> pd.DataFrame:
    """A synthetic feature frame joined from triage and history data."""
    return synthetic_triage_frame()


def synthetic_labelled_frame(n_patients: int = 20, seed: int = 0) -> pd.DataFrame:
    """A larger synthetic feature frame with many repeat patients.

    Used to exercise grouped splitting, where the same patient must not land
    in both train and test. Acuity is drawn from {1, 2, 3} only, mirroring the
    real cohort's usable classes, and each patient keeps a fixed acuity so a
    leak would be trivially detectable by an over-optimistic model.
    """
    rng = np.random.default_rng(seed)
    subject_ids = np.repeat(
        np.arange(9001, 9001 + n_patients), rng.integers(1, 6, size=n_patients)
    )
    acuity = rng.choice([1.0, 2.0, 3.0], size=len(subject_ids), p=[0.2, 0.5, 0.3])

    n = len(subject_ids)
    heart_rate = rng.integers(60, 130, n).astype(float)
    systolic_bp = rng.integers(100, 170, n).astype(float)
    diastolic_bp = rng.integers(60, 100, n).astype(float)
    weight_kg = rng.uniform(45.0, 110.0, n)
    height_cm = rng.uniform(150.0, 195.0, n)
    temperature_c = rng.uniform(36.0, 39.0, n)

    frame = pd.DataFrame(
        {
            "patient_id": subject_ids,
            "triage_acuity": acuity,
            "heart_rate": heart_rate,
            "respiratory_rate": rng.integers(12, 24, n).astype(float),
            "temperature_c": temperature_c,
            "spo2": rng.integers(92, 100, n).astype(float),
            "systolic_bp": systolic_bp,
            "diastolic_bp": diastolic_bp,
            "pain_score": rng.integers(0, 10, n).astype(float),
            "arrival_mode": rng.choice(["AMBULANCE", "WALK IN"], size=n),
            "chief_complaint_system": rng.choice(
                ["Cardiovascular", "Respiratory", "Neurological", "Abdominal", "Trauma"],
                size=n,
            ),
            "age": rng.integers(18, 90, n).astype(float),
            "sex": rng.choice(["M", "F", "Other"], size=n),
            "language": rng.choice(["English", "Finnish", "Russian"], size=n),
            "insurance_type": rng.choice(["Private", "Medicare", "Medicaid"], size=n),
            "transport_origin": rng.choice(["home", "public_space", "nursing_home"], size=n),
            "arrival_hour": rng.integers(0, 24, n).astype(float),
            "arrival_day": rng.choice(
                [
                    "Monday", "Tuesday", "Wednesday",
                    "Thursday", "Friday", "Saturday", "Sunday",
                ],
                size=n,
            ),
            "arrival_month": rng.integers(1, 13, n).astype(float),
            "arrival_season": rng.choice(
                ["spring", "summer", "autumn", "winter"], size=n
            ),
            "shift": rng.choice(["morning", "afternoon", "night"], size=n),
            "shock_index": heart_rate / systolic_bp,
            "pulse_pressure": systolic_bp - diastolic_bp,
            "mean_arterial_pressure": (systolic_bp + 2 * diastolic_bp) / 3,
            "gcs_total": rng.integers(3, 16, n).astype(float),
            "weight_kg": weight_kg,
            "height_cm": height_cm,
            "bmi": weight_kg / (height_cm / 100.0) ** 2,
            "news2_score": rng.integers(0, 15, n).astype(float),
            "num_prior_ed_visits_12m": rng.integers(0, 10, n).astype(float),
            "num_prior_admissions_12m": rng.integers(0, 5, n).astype(float),
            "num_active_medications": rng.integers(0, 10, n).astype(float),
            "num_comorbidities": rng.integers(0, 10, n).astype(float),
        }
    )
    for column in triagegeist_schema.BOOLEAN_FEATURE_COLUMNS:
        frame[column] = rng.choice([True, False], size=n)
    # Introduce known missingness.
    for column in ("temperature_c", "heart_rate", "pain_score"):
        frame.loc[rng.random(len(frame)) < 0.1, column] = np.nan
    return frame
