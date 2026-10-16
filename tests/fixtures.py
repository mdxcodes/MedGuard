"""Synthetic test fixtures for MedGuard.

**These fixtures are synthetic and are NOT research data.** They are generated
from fixed seeds with deliberately planted data-quality defects so that every
validation rule can be tested with a known expected outcome. They must never
be presented as real MIMIC-IV-ED records, and they must never be replaced by
real patient data.
"""

from __future__ import annotations

import hashlib
import gzip
from pathlib import Path

import numpy as np
import pandas as pd

TRIAGE_COLUMNS = (
    "subject_id",
    "stay_id",
    "temperature",
    "heartrate",
    "resprate",
    "o2sat",
    "sbp",
    "dbp",
    "pain",
    "acuity",
    "chiefcomplaint",
)

EDSTAYS_COLUMNS = (
    "subject_id",
    "hadm_id",
    "stay_id",
    "intime",
    "outtime",
    "gender",
    "race",
    "arrival_transport",
    "disposition",
)


def synthetic_triage_frame() -> pd.DataFrame:
    """A small triage frame with every planted defect the rules must catch.

    Planted cases (row order is deliberate so tests can assert on them):

    ==== ================================ =====================================
    Row  Planted input                    Expected after cleaning
    ==== ================================ =====================================
    0    temperature 98.6 F               -> 37.0 C (converted)
    1    temperature 37.0 (already C)     -> 37.0 C (detected, not converted)
    2    temperature 150.0 F              -> NaN (outside clinical envelope)
    3    dbp 879 mmHg                     -> NaN (out of range)
    4    pain 'UA'                        -> NaN (unassessable sentinel)
    5    pain 13                          -> NaN (out of 0-10 range)
    6    pain 'Critical'                  -> NaN (unparseable token)
    7    pain 5                           -> 5.0 (kept)
    8    acuity missing                   -> row dropped from supervised set
    9    chiefcomplaint 'UNKNOWN-CC'      -> 'unknown'
    10   duplicate of stay_id 0           -> DuplicateKeyError
    ==== ================================ =====================================
    """
    rows = [
        # subject, stay, temp,   hr,  rr, o2,  sbp, dbp, pain,      acuity, complaint
        (9001, 700001, 98.6,     90, 18, 98, 120, 80, "3", 2.0, "CHEST PAIN"),
        (9001, 700002, 37.0,     90, 18, 98, 120, 80, "4", 3.0, "CHEST PAIN"),
        (9002, 700003, 150.0,    90, 18, 98, 120, 80, "0", 2.0, "HEADACHE"),
        (9002, 700004, 98.6,     90, 18, 98, 120, 879, "2", 2.0, "HEADACHE"),
        (9003, 700005, 98.6,     90, 18, 98, 120, 80, "UA", 1.0, "SOB"),
        (9003, 700006, 98.6,     90, 18, 98, 120, 80, "13", 1.0, "SOB"),
        (9004, 700007, 98.6,     90, 18, 98, 120, 80, "Critical", 2.0, "FALL"),
        (9004, 700008, 98.6,     90, 18, 98, 120, 80, "5", 3.0, "FALL"),
        (9005, 700009, 98.6,     90, 18, 98, 120, 80, "1", None, "SEIZURE"),
        (9005, 700010, 98.6,     90, 18, 98, 120, 80, "7", 2.0, "UNKNOWN-CC"),
        # Missing vital block + repeated patient with multiple visits.
        (9006, 700011, None, None, None, None, None, None, None, 2.0, "WOUND"),
        (9006, 700012, 97.0, 70, 16, 99, 110, 70, "0", 3.0, "WOUND"),
        (9007, 700013, 99.1, 110, 22, 91, 85, 50, "8", 1.0, "DIABETES"),
        (9007, 700014, 99.1, 110, 22, 91, 85, 50, "9", 1.0, "DIABETES"),
        (9008, 700015, 98.2, 88, 18, 97, 130, 75, "2", 2.0, "ABDOMINAL PAIN"),
    ]
    return pd.DataFrame(rows, columns=TRIAGE_COLUMNS)


def synthetic_edstays_frame() -> pd.DataFrame:
    """`edstays` rows matching the synthetic triage stays, 1:1 on stay_id."""
    rows = [
        # subject, hadm, stay,    intime,                outtime,               gender, race,      transport,   disposition
        (9001, 810001, 700001, "2125-01-01 10:00:00", "2125-01-01 12:00:00", "F", "WHITE", "AMBULANCE", "ADMITTED"),
        (9001, 810002, 700002, "2125-02-01 10:00:00", "2125-02-01 12:00:00", "F", "WHITE", "AMBULANCE", "HOME"),
        (9002, 810003, 700003, "2125-03-01 10:00:00", "2125-03-01 12:00:00", "M", "BLACK/AFRICAN AMERICAN", "WALK IN", "ADMITTED"),
        (9002, 810004, 700004, "2125-04-01 10:00:00", "2125-04-01 12:00:00", "M", "BLACK/AFRICAN AMERICAN", "WALK IN", "ADMITTED"),
        (9003, 810005, 700005, "2125-05-01 10:00:00", "2125-05-01 12:00:00", "F", "WHITE", "AMBULANCE", "ADMITTED"),
        (9003, 810006, 700006, "2125-06-01 10:00:00", "2125-06-01 12:00:00", "F", "WHITE", "AMBULANCE", "ADMITTED"),
        (9004, 810007, 700007, "2125-07-01 10:00:00", "2125-07-01 12:00:00", "M", "HISPANIC/LATINO", "WALK IN", "HOME"),
        (9004, 810008, 700008, "2125-08-01 10:00:00", "2125-08-01 12:00:00", "M", "HISPANIC/LATINO", "WALK IN", "HOME"),
        (9005, 810009, 700009, "2125-09-01 10:00:00", "2125-09-01 12:00:00", "F", "WHITE", "AMBULANCE", "ADMITTED"),
        (9005, 810010, 700010, "2125-10-01 10:00:00", "2125-10-01 12:00:00", "F", "WHITE", "AMBULANCE", "ADMITTED"),
        (9006, 810011, 700011, "2125-11-01 10:00:00", "2125-11-01 12:00:00", "M", "WHITE", "WALK IN", "HOME"),
        (9006, 810012, 700012, "2125-12-01 10:00:00", "2125-12-01 12:00:00", "M", "WHITE", "WALK IN", "HOME"),
        (9007, 810013, 700013, "2126-01-01 10:00:00", "2126-01-01 12:00:00", "F", "ASIAN", "AMBULANCE", "ADMITTED"),
        (9007, 810014, 700014, "2126-02-01 10:00:00", "2126-02-01 12:00:00", "F", "ASIAN", "AMBULANCE", "ADMITTED"),
        (9008, 810015, 700015, "2126-03-01 10:00:00", "2126-03-01 12:00:00", "M", "WHITE", "WALK IN", "ADMITTED"),
    ]
    return pd.DataFrame(rows, columns=EDSTAYS_COLUMNS)


def write_synthetic_dataset(directory: Path) -> Path:
    """Write synthetic ``triage.csv.gz`` / ``edstays.csv.gz`` + checksums.

    Returns the directory containing the synthetic dataset. Callers must point
    ``backend.ml.config`` at this directory.
    """
    directory.mkdir(parents=True, exist_ok=True)
    ed_dir = directory / "ed"
    ed_dir.mkdir(parents=True, exist_ok=True)

    triage_path = ed_dir / "triage.csv.gz"
    edstays_path = ed_dir / "edstays.csv.gz"
    _write_gzip_csv(triage_path, synthetic_triage_frame())
    _write_gzip_csv(edstays_path, synthetic_edstays_frame())

    lines = []
    for path in sorted([directory / "LICENSE.txt", triage_path, edstays_path]):
        (directory / "LICENSE.txt").write_text("SYNTHETIC TEST LICENSE\n", encoding="utf-8")
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        rel = path.relative_to(directory).as_posix()
        lines.append(f"{digest}  {rel}")
    (directory / "SHA256SUMS.txt").write_text(
        "SYNTHETIC CHECKSUMS - NOT RESEARCH DATA\n" + "\n".join(sorted(lines)) + "\n",
        encoding="utf-8",
    )
    return directory


def _write_gzip_csv(path: Path, frame: pd.DataFrame) -> None:
    with gzip.open(path, "wt", encoding="utf-8") as handle:
        frame.to_csv(handle, index=False)


def synthetic_joined_frame() -> pd.DataFrame:
    """The synthetic triage+edstays frames joined 1:1 on stay_id."""
    import sys
    from pathlib import Path as _Path

    root = _Path(__file__).resolve().parents[1]
    if str(root) not in sys.path:
        sys.path.insert(0, str(root))
    from backend.ml.data_loading import join_triage_edstays

    return join_triage_edstays(synthetic_triage_frame(), synthetic_edstays_frame())


#: Backwards-compatible alias.
synthetic_joined = synthetic_joined_frame


def synthetic_labelled_frame(n_patients: int = 20, seed: int = 0) -> pd.DataFrame:
    """A larger synthetic feature frame with many repeat patients.

    Used to exercise grouped splitting, where the same patient must not land
    in both train and test. Acuity is drawn from {1, 2, 3} only, mirroring the
    real cohort's usable classes, and each patient keeps a fixed acuity so a
    leak would be trivially detectable by an over-optimistic model.
    """
    rng = np.random.default_rng(seed)
    subject_ids = np.repeat(
        np.arange(n_patients), rng.integers(1, 6, size=n_patients)
    )
    stay_ids = 800000 + np.arange(1, len(subject_ids) + 1)
    acuity = rng.choice([1.0, 2.0, 3.0], size=len(subject_ids), p=[0.2, 0.5, 0.3])

    frame = pd.DataFrame(
        {
            "subject_id": subject_ids,
            "stay_id": stay_ids,
            "temperature": rng.uniform(36.0, 39.0, len(subject_ids)),
            "heartrate": rng.integers(60, 130, len(subject_ids)).astype(float),
            "resprate": rng.integers(12, 24, len(subject_ids)).astype(float),
            "o2sat": rng.integers(92, 100, len(subject_ids)).astype(float),
            "sbp": rng.integers(100, 170, len(subject_ids)).astype(float),
            "dbp": rng.integers(60, 100, len(subject_ids)).astype(float),
            "pain": rng.integers(0, 10, len(subject_ids)).astype(float),
            "acuity": acuity,
            "chiefcomplaint": rng.choice(
                ["CHEST PAIN", "SOB", "FALL", "ABDOMINAL PAIN", "UNKNOWN-CC"],
                size=len(subject_ids),
            ),
            "arrival_transport": rng.choice(
                ["AMBULANCE", "WALK IN"], size=len(subject_ids)
            ),
        }
    )
    # Introduce known missingness.
    for column in ("temperature", "heartrate", "pain"):
        frame.loc[rng.random(len(frame)) < 0.1, column] = np.nan
    return frame
