"""Licensed-research-data loading for MIMIC-IV-ED.

Responsibilities
----------------
1. Verify SHA-256 checksums before reading anything.
2. Read gzip-compressed CSV files.
3. Validate required columns and dtypes.
4. Join ``triage`` and ``edstays`` strictly one-to-one on ``stay_id``.

Deliberate restrictions
-----------------------
* ``diagnosis``, ``pyxis`` and ``medrecon`` are post-triage tables and are
  never loaded as features.
* ``vitalsign`` is loaded only for reporting / auditing, never as a feature
  source (see ``config.VITALSIGN_EXCLUDED_REASON``).
* No one-to-many join is performed without an explicit aggregation step.

Patient privacy
---------------
This module never logs column values that identify a patient. Error messages
reference column names and counts only.
"""

from __future__ import annotations

import hashlib
import logging
from dataclasses import dataclass, field
from pathlib import Path

import pandas as pd

from . import config

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Custom exceptions
# ---------------------------------------------------------------------------


class DataLoadingError(RuntimeError):
    """Base class for all dataset loading failures."""


class ChecksumMismatchError(DataLoadingError):
    """A file's SHA-256 digest does not match the supplied checksum file."""


class MissingChecksumError(DataLoadingError):
    """No checksum entry exists for a required file."""


class SchemaError(DataLoadingError):
    """A required column is missing, unexpected, or has the wrong dtype."""


class DuplicateKeyError(DataLoadingError):
    """A join would not be one-to-one (duplicate keys found)."""


class JoinError(DataLoadingError):
    """The 1:1 join lost or duplicated rows."""


class EmptyDatasetError(DataLoadingError):
    """A required table read back as empty."""


# ---------------------------------------------------------------------------
# Checksum verification
# ---------------------------------------------------------------------------


def read_checksum_file(path: Path | None = None) -> dict[str, str]:
    """Parse ``SHA256SUMS.txt`` into a ``{relative_path: hex_digest}`` map.

    The MIMIC checksum file uses the standard ``sha256sum`` format:
    ``<64 hex chars><two spaces><path>``.
    """
    path = Path(path) if path is not None else config.CHECKSUM_FILE
    if not path.exists():
        raise MissingChecksumError(f"Checksum file not found: {path}")

    digests: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        # Split on the first run of whitespace: "digest  path"
        parts = line.split(None, 1)
        if len(parts) != 2:
            raise ChecksumMismatchError(f"Malformed checksum line: {line!r}")
        digest, rel_path = parts[0].strip(), parts[1].strip()
        # sha256sum may prefix the digest with a binary-mode marker.
        if digest.startswith("*"):
            digest = digest[1:]
        digests[rel_path] = digest.lower()
    return digests


def sha256_of_file(path: Path, chunk_size: int = 1 << 20) -> str:
    """Stream a file through SHA-256 without loading it into memory."""
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(chunk_size), b""):
            digest.update(chunk)
    return digest.hexdigest()


def verify_checksums(
    paths: list[Path] | None = None,
    checksum_file: Path | None = None,
) -> dict[str, bool]:
    """Verify one or more dataset files against the checksum manifest.

    Parameters
    ----------
    paths:
        Files to verify. Defaults to every ``ed/*.csv.gz`` plus ``LICENSE.txt``.
    checksum_file:
        Manifest to verify against. Defaults to the dataset ``SHA256SUMS.txt``.

    Returns
    -------
    ``{filename: True}`` for every verified file.

    Raises
    ------
    MissingChecksumError
        A file has no entry in the manifest.
    ChecksumMismatchError
        A digest does not match. The message reports the filename only.
    """
    if paths is None:
        paths = sorted(config.DATASET_ED_DIR.glob("*.csv.gz"))
        paths = paths + [config.DATASET_DIR / "LICENSE.txt"]

    digests = read_checksum_file(checksum_file)
    results: dict[str, bool] = {}
    failed: list[str] = []

    for path in paths:
        path = Path(path)
        rel = path.relative_to(config.DATASET_DIR).as_posix()
        expected = digests.get(rel)
        if expected is None:
            raise MissingChecksumError(
                f"No checksum entry for {rel!r} in the manifest. Refusing to "
                "read an unverified licensed file."
            )
        actual = sha256_of_file(path)
        if actual != expected:
            failed.append(rel)
            logger.error("Checksum mismatch for %s", rel)
            continue
        results[rel] = True
        logger.debug("Checksum OK for %s", rel)

    if failed:
        raise ChecksumMismatchError(
            f"SHA-256 verification failed for {len(failed)} file(s): "
            f"{', '.join(failed)}. The dataset is corrupted or was modified."
        )
    return results


# ---------------------------------------------------------------------------
# Schema validation
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class TableSchema:
    """Expected column set and dtype constraints for one table."""

    name: str
    required_columns: tuple[str, ...]
    dtypes: dict[str, str] = field(default_factory=dict)

    def validate(self, frame: pd.DataFrame) -> None:
        """Raise :class:`SchemaError` if a table does not match this schema."""
        present = set(frame.columns)

        missing = [c for c in self.required_columns if c not in present]
        if missing:
            raise SchemaError(
                f"Table {self.name!r} is missing required column(s): "
                f"{sorted(missing)}. Present columns: {sorted(present)}."
            )

        unexpected = sorted(present - set(self.required_columns))
        if unexpected:
            raise SchemaError(
                f"Table {self.name!r} has unexpected column(s): {unexpected}. "
                "The dataset version may differ from the audited one; review "
                "before proceeding."
            )

        for column, expected in self.dtypes.items():
            if column not in frame.columns:
                continue  # already reported as missing above
            actual = str(frame[column].dtype)
            if actual != expected:
                raise SchemaError(
                    f"Table {self.name!r} column {column!r} has dtype {actual!r}, "
                    f"expected {expected!r}."
                )


TRIAGE_SCHEMA = TableSchema(
    name="triage",
    required_columns=config.TRIAGE_REQUIRED_COLUMNS,
    dtypes={"subject_id": "int64", "stay_id": "int64"},
)

EDSTAYS_SCHEMA = TableSchema(
    name="edstays",
    required_columns=config.EDSTAYS_REQUIRED_COLUMNS,
    dtypes={"subject_id": "int64", "stay_id": "int64"},
)

#: Audit-only schema (loaded for reporting, never used as features).
VITALSIGN_SCHEMA = TableSchema(
    name="vitalsign",
    required_columns=(
        "subject_id",
        "stay_id",
        "charttime",
        "temperature",
        "heartrate",
        "resprate",
        "o2sat",
        "sbp",
        "dbp",
        "rhythm",
        "pain",
    ),
    dtypes={"subject_id": "int64", "stay_id": "int64"},
)


# ---------------------------------------------------------------------------
# Reading
# ---------------------------------------------------------------------------


def read_gzip_csv(path: Path, **kwargs) -> pd.DataFrame:
    """Read a gzip-compressed CSV file.

    ``pandas.read_csv`` transparently decompresses ``.gz`` input. The file is
    never fully materialised in memory outside the DataFrame.
    """
    path = Path(path)
    if not path.exists():
        raise DataLoadingError(f"Dataset file not found: {path}")
    frame = pd.read_csv(path, **kwargs)
    if frame.empty:
        raise EmptyDatasetError(f"Table at {path} contains no data rows.")
    return frame


# ---------------------------------------------------------------------------
# Loading the audited tables
# ---------------------------------------------------------------------------


def load_triage(
    path: Path | None = None, verify: bool = True
) -> pd.DataFrame:
    """Load ``triage`` with schema validation.

    ``pain`` is intentionally read as ``str`` (``dtype=str``) because the demo
    package stores numeric scores mixed with sentinel tokens such as ``UA``.
    Parsing happens in :mod:`backend.ml.validation`.
    """
    path = Path(path) if path is not None else config.DATASET_ED_DIR / "triage.csv.gz"
    if verify:
        verify_checksums([path])
    frame = read_gzip_csv(path, dtype={"pain": "str"})
    TRIAGE_SCHEMA.validate(frame)
    _assert_no_duplicate_keys(frame, config.STAY_ID_COLUMN, "triage")
    return frame


def load_edstays(
    path: Path | None = None, verify: bool = True
) -> pd.DataFrame:
    """Load ``edstays`` with schema validation."""
    path = Path(path) if path is not None else config.DATASET_ED_DIR / "edstays.csv.gz"
    if verify:
        verify_checksums([path])
    frame = read_gzip_csv(path)
    EDSTAYS_SCHEMA.validate(frame)
    _assert_no_duplicate_keys(frame, config.STAY_ID_COLUMN, "edstays")
    return frame


def load_vitalsign_for_audit(
    path: Path | None = None, verify: bool = True
) -> pd.DataFrame:
    """Load ``vitalsign`` for reporting only.

    This table is NOT used to build features (see
    ``config.VITALSIGN_EXCLUDED_REASON``).
    """
    path = (
        Path(path)
        if path is not None
        else config.DATASET_ED_DIR / "vitalsign.csv.gz"
    )
    if verify:
        verify_checksums([path])
    frame = read_gzip_csv(path, dtype={"pain": "str"})
    VITALSIGN_SCHEMA.validate(frame)
    return frame


def _assert_no_duplicate_keys(
    frame: pd.DataFrame, column: str, table_name: str
) -> None:
    """Reject duplicate keys, which would break the intended 1:1 join."""
    duplicated = int(frame[column].duplicated().sum())
    if duplicated:
        raise DuplicateKeyError(
            f"Table {table_name!r} contains {duplicated} duplicate "
            f"{column!r} value(s). The join would no longer be one-to-one."
        )


def join_triage_edstays(
    triage: pd.DataFrame, edstays: pd.DataFrame, validate: bool = True
) -> pd.DataFrame:
    """Strict one-to-one inner join of ``triage`` and ``edstays`` on ``stay_id``.

    Guards
    ------
    * ``stay_id`` must be unique on both sides before the merge, so the join
      cannot fan out.
    * Every row on both sides must find a partner; an inner join that drops
      or adds rows raises :class:`JoinError`.
    * ``subject_id`` is checked for consistency across the two tables, since
      it is the grouping key for the patient-level split.

    ``subject_id`` is preserved in the result *solely* for grouped splitting
    and auditing. It is never used as a model feature.
    """
    if validate:
        _assert_no_duplicate_keys(
            triage, config.STAY_ID_COLUMN, "triage (left side of join)"
        )
        _assert_no_duplicate_keys(
            edstays, config.STAY_ID_COLUMN, "edstays (right side of join)"
        )

    merged = triage.merge(
        edstays, on=config.STAY_ID_COLUMN, how="inner", validate="one_to_one"
    )

    if validate:
        n_triage, n_edstays = len(triage), len(edstays)
        if len(merged) != n_triage:
            raise JoinError(
                f"1:1 join retained {len(merged)} of {n_triage} triage row(s): "
                f"{n_triage - len(merged)} triage stay(s) have no matching "
                "edstays row (orphan stays or duplicate keys on one side)."
            )
        if len(merged) != n_edstays:
            raise JoinError(
                f"1:1 join retained {len(merged)} of {n_edstays} edstays "
                f"row(s): {n_edstays - len(merged)} edstays stay(s) have no "
                "matching triage row. Every ED stay is expected to have a "
                "triage record; investigate before proceeding."
            )

        # subject_id is the patient key and must agree across tables.
        if "subject_id_x" in merged.columns:
            disagree = int((merged["subject_id_x"] != merged["subject_id_y"]).sum())
            if disagree:
                raise JoinError(
                    f"{disagree} row(s) have a subject_id disagreement between "
                    "triage and edstays; the patient key is unreliable for "
                    "grouped splitting."
                )
            merged = merged.rename(columns={"subject_id_x": "subject_id"}).drop(
                columns=["subject_id_y"]
            )
    return merged


def load_joined_dataset(verify_checksum: bool = True) -> pd.DataFrame:
    """Load, checksum-verify, schema-validate and 1:1 join the audited tables.

    This is the single entry point used by the pipeline and by the tests.
    Post-triage tables are never loaded here.
    """
    if verify_checksum:
        verify_checksums()
    triage = load_triage(verify=False)
    edstays = load_edstays(verify=False)
    return join_triage_edstays(triage, edstays)
