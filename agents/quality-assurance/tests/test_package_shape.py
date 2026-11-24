from pathlib import Path


def test_qa_uses_one_native_employee_surface_with_own_configurable_job_evals():
    root = Path(__file__).parents[1]
    for name in ("package.json", "tsconfig.json", "biome.json", "src/agent", "dist/agent"):
        assert not (root / name).exists(), f"Displaced employee surface remains: {name}"
    assert (root / "app/agent.py").exists()
    assert (root / "tests/eval/performance_profile.json").exists()
    assert (root / "agents-cli-manifest.yaml").exists()
