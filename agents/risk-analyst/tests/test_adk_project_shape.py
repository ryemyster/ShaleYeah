from pathlib import Path


PACKAGE_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = PACKAGE_ROOT.parents[1]


def test_adk_manifest_exists_inside_risk_analyst_package() -> None:
    manifest = (PACKAGE_ROOT / "agents-cli-manifest.yaml").read_text()

    assert 'name: "risk-analyst"' in manifest
    assert 'agent_directory: "app"' in manifest
    assert 'deployment_target: "none"' in manifest


def test_adk_python_entrypoint_exists_inside_risk_analyst_package() -> None:
    agent = (PACKAGE_ROOT / "app" / "agent.py").read_text()

    assert "root_agent = Agent(" in agent
    assert 'app = App(root_agent=root_agent, name="app")' in agent
    assert "RISK_ANALYSIS_MCP_URL" in agent
    assert "servers/risk-analysis remains independently runnable" in agent


def test_repo_root_does_not_become_an_adk_project() -> None:
    for file_name in ("agents-cli-manifest.yaml", "pyproject.toml", ".agents-cli-spec.md"):
        assert not (REPO_ROOT / file_name).exists(), f"{file_name} must not be added at repo root"

    assert not (REPO_ROOT / "app" / "agent.py").exists()


def test_risk_analyst_agent_has_no_dangling_npm_surface() -> None:
    for file_name in ("package.json", "tsconfig.json", "biome.json"):
        assert not (PACKAGE_ROOT / file_name).exists(), f"{file_name} is dangling agent npm debt"

    assert not (PACKAGE_ROOT / "src" / "agent").exists()
    assert not list((PACKAGE_ROOT / "tests").glob("*.test.ts"))
