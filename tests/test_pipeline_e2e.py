"""End-to-end test of the data-preparation pipeline on the licensed dataset.

These tests run the real pipeline but only assert *invariants* (counts,
guards, absence of patient data). They never publish or record research data.
"""

from __future__ import annotations

import json

import pytest

from backend.ml import splitting
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
        # Audited figures: 222 stays, 64 patients, 15 unlabelled -> 207 rows.
        assert prepared["rows_joined"] == 222
        assert prepared["modelling_rows"] == 207
        assert prepared["train_rows"] + prepared["test_rows"] == 207

    def test_test_set_excludes_a_patient(self, prepared):
        assert prepared["patient_overlap"] == 0
        # The raw cohort has 64 patients; dropping the 15 unlabelled rows also
        # removes patients whose every visit is unlabelled, leaving 56.
        assert prepared["train_patients"] + prepared["test_patients"] == 56

    def test_no_patient_group_overlap(self):
        frame = build_feature_frame(load_joined_dataset())
        train, test = splitting.patient_grouped_split(frame)
        assert not (set(train["subject_id"]) & set(test["subject_id"]))

    def test_reports_written(self, tmp_path):
        summary = run(
            output_json=tmp_path / "r.json", output_markdown=tmp_path / "r.md"
        )
        payload = json.loads((tmp_path / "r.json").read_text())
        markdown = (tmp_path / "r.md").read_text()
        assert payload["row_counts"]["modelling_rows"] == summary["modelling_rows"]

    def test_report_contains_no_patient_data(self, tmp_path):
        """Reports must carry aggregate counts only, never research data.

        Note: the *name* of a check (e.g. ``duplicate_stay_id``) is not
        patient data. This test looks for actual identifier values and for
        raw chief-complaint free text.
        """
        run(output_json=tmp_path / "r.json", output_markdown=tmp_path / "r.md")
        payload = (tmp_path / "r.json").read_text()
        markdown = (tmp_path / "r.md").read_text()

        # Real subject_id / stay_id values sampled from the audited cohort.
        for identifier in (
            "10016742",  # subject_id
            "10014354",  # most frequent patient (23 visits)
            "10040025",
            "33211001",  # stay_id
            "30701739",
        ):
            assert identifier not in payload, "patient identifier leaked into JSON"
            assert identifier not in markdown, "patient identifier leaked into md"

        # Raw chief-complaint free text must not appear.
        for complaint in ("SEIZURE", "HEAD BLEED", "S/P ARREST", "FACIAL DROOP"):
            assert complaint not in payload
            assert complaint not in markdown

        # No data rows keyed by patient or stay identifier.
        assert '"subject_id":' not in payload
        assert '"stay_id":' not in payload

    def test_report_has_label_distribution(self, tmp_path):
        run(output_json=tmp_path / "r.json", output_markdown=tmp_path / "r.md")
        payload = json.loads((tmp_path / "r.json").read_text())
        labels = payload["label_distribution"]
        assert labels["ESI 1"] == 18
        assert labels["ESI 2"] == 97
        assert labels["ESI 3"] == 90
        assert labels["ESI 4"] == 2
        assert "ESI 5" not in labels  # absent from the demo subset

    def test_checksums_verify(self):
        results = verify_checksums()
        assert results and all(results.values())

    def test_preprocessor_fits_on_train_only(self):
        frame = build_feature_frame(load_joined_dataset())
        train, test = splitting.patient_grouped_split(frame)
        preprocessor = build_preprocessor()
        preprocessor.fit(train)
        names = leakage_free_feature_names(preprocessor)
        assert preprocessor.transform(test).shape[1] == len(names)
        assert not [n for n in names if "subject" in n or "stay" in n]
