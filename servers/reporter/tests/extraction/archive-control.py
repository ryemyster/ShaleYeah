"""Allowlist runtime distributions and verify role scorecard/dataset byte bindings."""

import json
import stat
import sys
import tarfile
import zipfile
from pathlib import Path

from shaleyeah_evaluations import TrustedEvalPolicy, load_profile


def check(root):
    manifest = json.loads((root / "tool/package.json").read_text())
    for name in ("@shaleyeah/contracts", "@shaleyeah/sdk", "@shaleyeah/server-reporter"):
        assert manifest["dependencies"][name].startswith("file:../npm/")
    lock = json.loads((root / "tool/package-lock.json").read_text())
    for name in ("@shaleyeah/contracts", "@shaleyeah/sdk", "@shaleyeah/server-reporter"):
        assert lock["packages"]["node_modules/" + name]["resolved"].startswith("file:../npm/")
    for archive in (root / "npm").glob("*.tgz"):
        with tarfile.open(archive) as package:
            for member in package.getmembers():
                name = Path(member.name)
                assert not member.issym() and not member.islnk()
                assert not name.is_absolute() and ".." not in name.parts
                assert name.parts[0] == "package"
                assert name.parts[1] in {
                    "dist",
                    "examples",
                    "LICENSE",
                    "README.md",
                    "package.json",
                    "shaleyeah_contracts",
                }
                assert not any(
                    part in {".env", "data", "tests", "node_modules", ".agents"}
                    for part in name.parts
                )
    for archive in (root / "wheels").glob("*.whl"):
        with zipfile.ZipFile(archive) as wheel:
            for name in wheel.namelist():
                assert not Path(name).is_absolute() and ".." not in Path(name).parts
                assert not name.endswith((".sqlite", ".db", ".env", ".pyc"))
                assert not stat.S_ISLNK(wheel.getinfo(name).external_attr >> 16)
            if archive.name.startswith("shaleyeah_reporter_adk-"):
                assert all(
                    name.startswith("app/") or ".dist-info/" in name for name in wheel.namelist()
                )
                assert all(
                    name.endswith(".py")
                    or name
                    in {"app/reference/performance_profile.json", "app/reference/reporter.json"}
                    for name in wheel.namelist()
                    if name.startswith("app/")
                )
                profile = load_profile(
                    wheel.read("app/reference/performance_profile.json"),
                    datasets={"reporter.reference": wheel.read("app/reference/reporter.json")},
                    policy=TrustedEvalPolicy("reporter"),
                )
                assert len(profile.case_ids) == 6


if __name__ == "__main__":
    check(Path(sys.argv[1]))
    print("Allowlisted Reporter distributions and configured case byte bindings pass")
