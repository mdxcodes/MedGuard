"""Tests for the model registry and the artifact contract.

The registry describes the model the application actually serves. If it ever
resolves a *different* artifact than the API loads, the registry page reports
metadata for a model that is not in use — which is exactly the defect this
suite guards against.
"""

from __future__ import annotations

import json

import pytest

from backend.api import config as api_config
from backend.ml import config as ml_config
from backend.ml import registry


class TestRegistryResolvesTheActiveArtifact:
    def test_registry_uses_the_same_manifest_as_the_api(self):
        assert registry.MANIFEST_PATH == api_config.MANIFEST_PATH
        assert registry.MODEL_PATH == api_config.MODEL_PATH

    def test_registry_paths_live_under_the_triagegeist_model_dir(self):
        # A MIMIC-era `models/triage_model.*` artifact must never be picked up.
        assert registry.MANIFEST_PATH.parent == ml_config.MODELS_DIR
        assert registry.MANIFEST_PATH.name == "triage_model.manifest.json"

    def test_manifest_declares_the_active_dataset(self):
        if not registry.MANIFEST_PATH.exists():
            pytest.skip("model manifest not present")
        manifest = json.loads(registry.MANIFEST_PATH.read_text(encoding="utf-8"))
        assert manifest.get("dataset") == "Triagegeist"
        assert manifest.get("target") == "triage_acuity"


class TestRegistryContents:
    def test_list_versions_describes_the_served_model(self):
        versions = registry.list_versions()
        assert isinstance(versions, list)
        assert versions, "registry returned no versions"
        entry = versions[0]
        assert entry["model_name"]
        assert entry["active"] is True
        assert entry["manifest_path"] == str(registry.MANIFEST_PATH)
        assert entry["model_path"] == str(registry.MODEL_PATH)

    def test_active_version_reports_training_metadata(self):
        if not registry.MANIFEST_PATH.exists():
            pytest.skip("model manifest not present")
        active = registry.get_active_version()
        assert active["model_name"]
        assert active["integrity"]["ok"] is True
        metadata = active["metadata"]
        assert metadata["dataset"] == "Triagegeist"
        assert metadata["target"] == "triage_acuity"
        assert metadata["training_rows"] > 0
        assert metadata["esi_labels"] == [1, 2, 3, 4, 5]

    def test_active_version_reports_the_class_distribution(self):
        if not registry.MANIFEST_PATH.exists():
            pytest.skip("model manifest not present")
        distribution = registry.get_active_version()["metadata"]["class_distribution"]
        assert set(distribution) == {"ESI 1", "ESI 2", "ESI 3", "ESI 4", "ESI 5"}
        assert all(count > 0 for count in distribution.values())

    def test_active_version_reports_artifact_existence(self):
        artifact = registry.get_active_version()["artifact"]
        assert artifact["model_path"] == str(registry.MODEL_PATH)
        assert artifact["model_exists"] == registry.MODEL_PATH.exists()
        assert artifact["manifest_exists"] == registry.MANIFEST_PATH.exists()


@pytest.fixture(scope="module")
def payload():
    from backend.api.triagegeist_endpoint import triagegeist_status

    return triagegeist_status()


class TestTriagegeistStatusContract:
    """The `/triagegeist/status` payload is a published contract.

    The "Model & dataset status" page reads these fields directly; a missing
    key renders as an em dash rather than an error, so the breakage is silent.
    """

    def test_status_is_available(self, payload):
        assert payload["available"] is True

    def test_profile_exposes_the_released_file_counts(self, payload):
        profile = payload["profile"]
        assert profile["train_rows"] == 80_000
        assert profile["train_patients"] == 80_000
        assert profile["test_rows"] == 20_000
        assert profile["test_patients"] == 20_000

    def test_profile_reports_no_patient_overlap(self, payload):
        assert payload["profile"]["patient_overlap_train_test"] == 0

    def test_profile_exposes_the_split_protocol(self, payload):
        profile = payload["profile"]
        assert profile["reference_dataset"]
        assert profile["split_protocol"]
        assert profile["target_distribution_train"]

    def test_benchmark_results_name_known_models(self, payload):
        results = payload["benchmark_results"]
        assert set(results["model_results"]) == {
            "dummy",
            "logistic_regression",
            "random_forest",
        }
        for metrics in results["model_results"].values():
            assert 0.0 <= metrics["macro_f1"] <= 1.0
            assert 0.0 <= metrics["balanced_accuracy"] <= 1.0

    def test_manifest_carries_the_reproducibility_fields(self, payload):
        manifest = payload["manifest"]
        assert manifest["random_seed"]
        assert manifest["target"]
        assert manifest["esi_labels"] == [1, 2, 3, 4, 5]
