from pathlib import Path


def test_employee_has_one_python_authoring_surface_and_no_displaced_agent_loop():
    root = Path(__file__).parents[1]
    for name in ("package.json", "tsconfig.json", "biome.json", "src/agent", "dist/agent"):
        assert not (root / name).exists(), f"Displaced authoring surface remains: {name}"
    assert (root / "pyproject.toml").exists()
    assert (root / "app/agent.py").exists()
