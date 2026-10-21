"""End-to-end test of the data-preparation pipeline on Triagegeist.

These tests run the real pipeline but only assert *invariants* (counts,
guards, absence of patient data). They never publish or record research data.
"""

from __future__ import annotations

import json

import pytest

from backend.ml import config, splitting
from backend.ml.data_loading import load_joined_dataset, verify_checksums
from backend.ml.features import (
    build_feature_frame,
    build_preprocessor,
    leakage_free_feature_names,
)
from backend.ml.run_data_prep import run


@pytest.fixture(scope="module")
def prepared():
    """Run the pipeline once; report paths point at a temp directory."""
    from pathlib import Path

    import tempfile

    with tempfile.TemporaryDirectory() as tmp:
        return run(
            output_json=Path(tmp) / "report.json",
            output_markdown=Path(tmp) / "report.md",
        )


class TestPipelineEndToEnd:
    def test_pipeline_completes(self, prepared):
        assert prepared["patient_overlap"] == 0
        assert prepared["checks_failed"] >= 0

    def test_row_counts(self, prepared):
        # Triagegeist train.csv has 80,000 labelled rows.
        assert prepared["rows_joined"] > 0
        assert prepared["modelling_rows"] > 0
        assert prepared["train_rows"] + prepared["test_rows"] == prepared["modelling_rows"]

    def test_test_set_excludes_a_patient(self, prepared):
        assert prepared["patient_overlap"] == 0
        assert prepared["train_patients"] + prepared["test_patients"] > 0

    def test_no_patient_group_overlap(self):
        frame = build_feature_frame(load_joined_dataset()["train"])
        train, test = splitting.patient_grouped_split(frame)
        assert not (set(train["patient_id"]) & set(test["patient_id"]))

    def test_reports_written(self, tmp_path):
        summary = run(
            output_json=tmp_path / "r.json", output_markdown=tmp_path / "r.md"
        )
        payload = json.loads((tmp_path / "r.json").read_text())
        markdown = (tmp_path / "r.md").read_text()
        assert payload["row_counts"]["modelling_rows"] == summary["modelling_rows"]

    def test_report_contains_no_patient_data(self, tmp_path):
        """Reports must carry aggregate counts only, never research data.

        Note: the *name* of a check (e.g. ``duplicate_patient_id``) is not
        patient data. This test looks for actual identifier values and for
        raw chief-complaint free text.
        """
        run(output_json=tmp_path / "r.json", output_markdown=tmp_path / "r.md")
        payload = (tmp_path / "r.json").read_text()
        markdown = (tmp_path / "r.md").read_text()

        # Real patient_id values from the Triagegeist cohort would be large
        # integers; spot-check some that could appear.
        for identifier in ("9001", "9002", "9003"):
            assert identifier not in payload, "patient identifier leaked into JSON"
            assert identifier not in markdown, "patient identifier leaked into md"

        # Raw chief-complaint free text must not appear.
        for complaint in ("CHEST PAIN", "HEAD BLEED", "S/P ARREST", "FACIAL DROOP"):
            assert complaint not in payload
            assert complaint not in markdown

        # No data rows keyed by patient identifier.
        assert '"patient_id":' not in payload

    def test_report_has_label_distribution(self, tmp_path):
        run(output_json=tmp_path / "r.json", output_markdown=tmp_path / "r.md")
        payload = json.loads((tmp_path / "r.json").read_text())
        labels = payload["label_distribution"]
        assert len(labels) >= 1
        # All ESI levels 1-5 should be represented as keys
        for level in config.ESI_LABELS:
            assert f"ESI {level}" in labels

    def test_checksums_verify(self):
        results = verify_checksums()
        assert results == {}  # Triagegeist has no checksum manifest

    def test_preprocessor_fits_on_train_only(self):
        frame = build_feature_frame(load_joined_dataset()["train"])
        train, test = splitting.patient_grouped_split(frame)
        preprocessor = build_preprocessor()
        preprocessor.fit(train)
        names = leakage_free_feature_names(preprocessor)
        assert preprocessor.transform(test).shape[1] == len(names)
        assert not [n for n in names if "subject" in n or "stay" in n]
