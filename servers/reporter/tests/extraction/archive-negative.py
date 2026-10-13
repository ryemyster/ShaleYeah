"""Actual modified distributions must fail their allowlist and scorecard hashes."""

import importlib.util
import json
import shutil
import sys
import tarfile
import zipfile
from pathlib import Path
from tempfile import TemporaryDirectory

spec = importlib.util.spec_from_file_location(
    "archive_control", Path(__file__).with_name("archive-control.py")
)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
check = module.check


def main(root):
    for mutation in ("private-file", "symlink", "dataset-drift", "absolute-helper-path"):
        with TemporaryDirectory(prefix="reporter-archive-negative-") as temporary:
            changed = Path(temporary)
            shutil.copytree(root / "npm", changed / "npm")
            shutil.copytree(root / "wheels", changed / "wheels")
            (changed / "tool").mkdir()
            for file in ("package.json", "package-lock.json"):
                shutil.copyfile(root / "tool" / file, changed / "tool" / file)
            if mutation == "absolute-helper-path":
                file = changed / "tool/package.json"
                manifest = json.loads(file.read_text())
                manifest["dependencies"]["@shaleyeah/sdk"] = "file:/private/authoring/sdk.tgz"
                file.write_text(json.dumps(manifest))
            elif mutation in {"private-file", "symlink"}:
                archive = next((changed / "npm").glob("shaleyeah-server-reporter-*.tgz"))
                scratch = archive.with_suffix(".copy")
                archive.rename(scratch)
                with tarfile.open(scratch) as original, tarfile.open(archive, "w:gz") as target:
                    for member in original.getmembers():
                        target.addfile(
                            member, original.extractfile(member) if member.isfile() else None
                        )
                    malicious = tarfile.TarInfo("package/.env")
                    if mutation == "symlink":
                        malicious.type = tarfile.SYMTYPE
                        malicious.linkname = "/private/operator-key"
                    target.addfile(malicious)
                scratch.unlink()
            else:
                archive = next((changed / "wheels").glob("shaleyeah_reporter_adk-*.whl"))
                scratch = archive.with_suffix(".copy")
                archive.rename(scratch)
                with zipfile.ZipFile(scratch) as original, zipfile.ZipFile(archive, "w") as target:
                    for member in original.infolist():
                        data = original.read(member.filename)
                        if member.filename == "app/reference/reporter.json":
                            data += b" "
                        target.writestr(member, data)
                scratch.unlink()
            try:
                check(changed)
            except (AssertionError, ValueError):
                pass
            else:
                raise AssertionError("Modified distribution was accepted: " + mutation)


if __name__ == "__main__":
    main(Path(sys.argv[1]))
