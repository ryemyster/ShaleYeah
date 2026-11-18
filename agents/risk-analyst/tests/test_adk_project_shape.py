"""Project/extraction guards; these do not stand in for job-quality evaluation."""

import tomllib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_native_project_exposes_the_employee_app():
    assert (ROOT / "app" / "agent.py").is_file(), "native Risk Analyst app is required"
    assert (ROOT / "agents-cli-manifest.yaml").is_file(), "scaffold provenance is required"
    assert (ROOT / ".agents-cli-spec.md").is_file()


def test_python_unit_has_declared_installable_shared_dependencies():
    project = ROOT / "pyproject.toml"
    assert project.is_file(), "the employee needs its own install/build contract"
    config = tomllib.loads(project.read_text())
    assert config["project"]["name"] == "shaleyeah-risk-analyst-adk"
    dependencies = config["project"]["dependencies"]
    for dependency in [
        "shaleyeah-contracts==0.3.0",
        "shaleyeah-evaluations==0.3.0",
        "shaleyeah-mcp-client==0.3.0",
        "shaleyeah-employee-runtime[adk]==0.1.0",
    ]:
        assert dependency in dependencies
    assert config["tool"]["hatch"]["build"]["targets"]["wheel"]["packages"] == ["app"]


def test_displaced_typescript_employee_surfaces_are_deleted():
    for name in ["package.json", "tsconfig.json", "biome.json", "src/agent", "dist/agent"]:
        assert not (ROOT / name).exists(), f"displaced employee surface remains: {name}"
    assert not list((ROOT / "tests").glob("*.test.ts"))


def test_job_evaluation_assets_are_separate_from_import_shape_checks():
    for name in [
        "tests/eval/eval_config.json",
        "tests/eval/performance_profile.json",
        "tests/eval/datasets/risk-performance.json",
        "tests/eval/run_fixture_evals.py",
    ]:
        assert (ROOT / name).is_file(), f"role evaluation asset is required: {name}"
