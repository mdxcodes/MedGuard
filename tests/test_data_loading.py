"""Tests for data loading: checksums, schemas, duplicates, and the 1:1 join."""

from __future__ import annotations

import hashlib

import pandas as pd
import pytest

from backend.ml import config, data_loading
from backend.ml.data_loading import (
    ChecksumMismatchError,
    DuplicateKeyError,
    EmptyDatasetError,
    JoinError,
    MissingChecksumError,
    SchemaError,
)
from tests.fixtures import (
    EDSTAYS_COLUMNS,
    TRIAGE_COLUMNS,
    synthetic_edstays_frame,
    synthetic_triage_frame,
)


# ---------------------------------------------------------------------------
# Checksum verification
# ---------------------------------------------------------------------------


class TestChecksumVerification:
    def test_real_dataset_checksums_verify(self):
        """The licensed demo package must still match its own manifest."""
        results = data_loading.verify_checksums()
        assert results, "no files were verified"
        assert all(results.values())

    def test_synthetic_dataset_checksums_verify(self, synthetic_dataset):
        results = data_loading.verify_checksums()
        assert all(results.values())
        assert "ed/triage.csv.gz" in results

    def test_mismatched_file_raises(self, synthetic_dataset, monkeypatch):
        # Corrupt one file in place after checksums were written.
        target = synthetic_dataset / "ed" / "triage.csv.gz"
        target.write_bytes(b"corrupted content that changes the digest")
        with pytest.raises(ChecksumMismatchError, match="SHA-256 verification failed"):
            data_loading.verify_checksums()

    def test_missing_manifest_entry_raises(self, synthetic_dataset, monkeypatch):
        # Point the manifest at an empty file so nothing can be verified.
        (synthetic_dataset / "SHA256SUMS.txt").write_text("", encoding="utf-8")
        with pytest.raises(MissingChecksumError, match="No checksum entry"):
            data_loading.verify_checksums()

    def test_checksum_helper_matches_hashlib(self, synthetic_dataset):
        digest = data_loading.sha256_of_file(synthetic_dataset / "ed" / "triage.csv.gz")
        expected = hashlib.sha256(
            (synthetic_dataset / "ed" / "triage.csv.gz").read_bytes()
        ).hexdigest()
        assert digest == expected


# ---------------------------------------------------------------------------
# Schema validation
# ---------------------------------------------------------------------------


class TestSchemaValidation:
    def test_missing_required_column_raises(self):
        frame = synthetic_triage_frame().drop(columns=["acuity"])
        with pytest.raises(SchemaError, match="missing required column"):
            data_loading.TRIAGE_SCHEMA.validate(frame)

    def test_unexpected_column_raises(self):
        frame = synthetic_triage_frame().assign(surprise_column=1)
        with pytest.raises(SchemaError, match="unexpected column"):
            data_loading.TRIAGE_SCHEMA.validate(frame)

    def test_wrong_dtype_raises(self):
        frame = synthetic_triage_frame()
        frame["stay_id"] = frame["stay_id"].astype(str)
        with pytest.raises(SchemaError, match="dtype"):
            data_loading.TRIAGE_SCHEMA.validate(frame)

    def test_valid_frame_passes(self):
        data_loading.TRIAGE_SCHEMA.validate(synthetic_triage_frame())
        data_loading.EDSTAYS_SCHEMA.validate(synthetic_edstays_frame())


# ---------------------------------------------------------------------------
# Duplicates
# ---------------------------------------------------------------------------


class TestDuplicateKeys:
    def test_duplicate_stay_id_in_triage_raises(self):
        frame = pd.concat(
            [synthetic_triage_frame(), synthetic_triage_frame().iloc[[0]]],
            ignore_index=True,
        )
        with pytest.raises(DuplicateKeyError, match="duplicate"):
            data_loading._assert_no_duplicate_keys(frame, "stay_id", "triage")

    def test_duplicate_stay_id_in_edstays_raises(self):
        frame = pd.concat(
            [synthetic_edstays_frame(), synthetic_edstays_frame().iloc[[0]]],
            ignore_index=True,
        )
        with pytest.raises(DuplicateKeyError, match="duplicate"):
            data_loading._assert_no_duplicate_keys(frame, "stay_id", "edstays")

    def test_clean_frame_passes(self):
        data_loading._assert_no_duplicate_keys(
            synthetic_triage_frame(), "stay_id", "triage"
        )

    def test_load_triage_rejects_duplicates(self, synthetic_dataset, tmp_path):
        # Write a triage file with a duplicated stay_id.
        frame = pd.concat(
            [synthetic_triage_frame(), synthetic_triage_frame().iloc[[4]]],
            ignore_index=True,
        )
        path = tmp_path / "dup.csv.gz"
        path.write_bytes(b"")
        frame.to_csv(path, index=False, compression="gzip")
        with pytest.raises(DuplicateKeyError):
            data_loading.load_triage(path, verify=False)


# ---------------------------------------------------------------------------
# One-to-one join
# ---------------------------------------------------------------------------


class TestOneToOneJoin:
    def test_join_preserves_row_count(self):
        joined = data_loading.join_triage_edstays(
            synthetic_triage_frame(), synthetic_edstays_frame()
        )
        assert len(joined) == len(synthetic_triage_frame())
        assert joined["stay_id"].is_unique
        assert "subject_id" in joined.columns  # kept for grouping, not features
        assert "subject_id_x" not in joined.columns

    def test_join_rejects_duplicate_left_keys(self):
        triage = pd.concat(
            [synthetic_triage_frame(), synthetic_triage_frame().iloc[[2]]],
            ignore_index=True,
        )
        with pytest.raises(DuplicateKeyError):
            data_loading.join_triage_edstays(triage, synthetic_edstays_frame())

    def test_join_rejects_duplicate_right_keys(self):
        edstays = pd.concat(
            [synthetic_edstays_frame(), synthetic_edstays_frame().iloc[[2]]],
            ignore_index=True,
        )
        with pytest.raises(DuplicateKeyError):
            data_loading.join_triage_edstays(
                synthetic_triage_frame(), edstays
            )

    def test_join_detects_orphan_stays(self):
        # Remove one edstays row: the inner join silently drops a triage row,
        # which must raise rather than quietly shrink the cohort.
        edstays = synthetic_edstays_frame().iloc[:-1].reset_index(drop=True)
        with pytest.raises(JoinError, match="orphan stays or duplicate keys"):
            data_loading.join_triage_edstays(synthetic_triage_frame(), edstays)

    def test_join_detects_subject_disagreement(self):
        edstays = synthetic_edstays_frame()
        edstays.loc[0, "subject_id"] = 999999
        with pytest.raises(JoinError, match="subject_id disagreement"):
            data_loading.join_triage_edstays(synthetic_triage_frame(), edstays)

    def test_empty_table_raises(self, tmp_path):
        path = tmp_path / "empty.csv.gz"
        pd.DataFrame(columns=list(TRIAGE_COLUMNS)).to_csv(
            path, index=False, compression="gzip"
        )
        with pytest.raises(EmptyDatasetError):
            data_loading.read_gzip_csv(path)

    def test_config_column_sets_match_fixtures(self):
        assert set(TRIAGE_COLUMNS) == set(config.TRIAGE_REQUIRED_COLUMNS)
        assert set(EDSTAYS_COLUMNS) == set(config.EDSTAYS_REQUIRED_COLUMNS)
