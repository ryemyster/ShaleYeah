import tomllib
from pathlib import Path


def test_economist_has_one_native_surface_and_own_configurable_job_evals():
    root = Path(__file__).parents[1]
    for name in ("package.json", "tsconfig.json", "biome.json", "src/agent", "dist/agent"):
        assert not (root / name).exists(), f"Displaced employee surface remains: {name}"
    for name in (
        "app/agent.py",
        "app/context_runtime.py",
        "app/review_supervision.py",
        "pyproject.toml",
        "uv.lock",
        "agents-cli-manifest.yaml",
        "tests/eval/performance_profile.json",
        "tests/eval/datasets/economist-performance.json",
    ):
        assert (root / name).is_file(), f"Required employee surface is missing: {name}"


def test_direct_imports_have_declared_installable_dependencies():
    root = Path(__file__).parents[1]
    config = tomllib.loads((root / "pyproject.toml").read_text())
    assert set(config["project"]["dependencies"]) >= {
        "shaleyeah-contracts==0.3.0",
        "shaleyeah-evaluations==0.3.0",
        "shaleyeah-mcp-client==0.3.0",
        "shaleyeah-employee-runtime[adk]==0.1.0",
    }
