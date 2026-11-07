"""Public distributions contain runtime code and reviewed assets, never customer state."""

import hashlib
import json
import sys
import tarfile
import zipfile
from pathlib import Path

from shaleyeah_evaluations import TrustedEvalPolicy, load_profile
from shaleyeah_evaluations.qualification import load_qualification_policy

root = Path(sys.argv[1])
for archive in (root / "npm").glob("*.tgz"):
    with tarfile.open(archive) as package:
        for member in package.getmembers():
            name = Path(member.name)
            assert not member.issym() and not member.islnk()
            assert ".." not in name.parts and not name.is_absolute()
            assert name.parts[0] == "package"
            assert name.parts[1] in {
                "dist",
                "examples",
                "LICENSE",
                "README.md",
                "package.json",
                "shaleyeah_contracts",
            }, member.name
            if name.parts[1] == "shaleyeah_contracts":
                assert name.parts[2] == "schemas"
            assert not any(
                part in {".env", ".agents", "tests", "data", "node_modules"} for part in name.parts
            )
with zipfile.ZipFile(next((root / "wheels").glob("shaleyeah_geologist_adk-*.whl"))) as wheel:
    assert all(name.startswith("app/") or ".dist-info/" in name for name in wheel.namelist())
    for name in wheel.namelist():
        if name.startswith("app/"):
            assert name.endswith(".py") or name in {
                "app/reference/performance_profile.json", "app/reference/geologist-performance.json",
                "app/reference/qualification_policy.json", "app/reference/baseline-reports.json"}, name
    assert not any(name.endswith((".sqlite", ".db", ".env", ".pyc")) for name in wheel.namelist())
    profile = load_profile(
        wheel.read("app/reference/performance_profile.json"),
        datasets={"geologist.performance": wheel.read("app/reference/geologist-performance.json")},
        policy=TrustedEvalPolicy("geologist"),
    )
    policy = load_qualification_policy(
        json.loads(wheel.read("app/reference/qualification_policy.json"))
    ).data()
    assert policy["profile"]["sha256"] == profile.config_hash
    baseline = json.loads(wheel.read("app/reference/baseline-reports.json"))
    assert len(baseline) == 7 and all(
        report["configHash"] == profile.config_hash for report in baseline
    )
assert hashlib.sha256((root / "tool/checks/sample.las").read_bytes()).hexdigest()
print("Allowlisted distributions and packaged scorecard/baseline bindings pass")
