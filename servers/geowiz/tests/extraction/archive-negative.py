"""Fault controls run against copies, preserving approved distribution bytes."""

import io
import shutil
import subprocess
import sys
import tarfile
import zipfile
from pathlib import Path
from tempfile import TemporaryDirectory

original = Path(sys.argv[1])
control = original / "tool/checks/archive-control.py"
with TemporaryDirectory(prefix="shale-archive-fault-") as directory:
    root = Path(directory)
    for fault in ("customer-file", "symlink", "dataset-drift"):
        target = root / fault
        shutil.copytree(original / "npm", target / "npm")
        shutil.copytree(original / "wheels", target / "wheels")
        (target / "tool/checks").mkdir(parents=True)
        shutil.copyfile(original / "tool/checks/sample.las", target / "tool/checks/sample.las")
        if fault == "dataset-drift":
            wheel = next((target / "wheels").glob("shaleyeah_geologist_adk-*.whl"))
            with zipfile.ZipFile(wheel) as source:
                entries = {name: source.read(name) for name in source.namelist()}
            entries["app/reference/geologist-performance.json"] += b" "
            with zipfile.ZipFile(wheel, "w") as destination:
                for name, data in entries.items():
                    destination.writestr(name, data)
        else:
            archive = next((target / "npm").glob("shaleyeah-server-geowiz-*.tgz"))
            replacement = archive.with_suffix(".replacement")
            with tarfile.open(archive) as source, tarfile.open(replacement, "w:gz") as destination:
                for member in source.getmembers():
                    destination.addfile(
                        member, source.extractfile(member) if member.isfile() else None
                    )
                member = tarfile.TarInfo(
                    "package/.env" if fault == "customer-file" else "package/dist/escape"
                )
                if fault == "symlink":
                    member.type = tarfile.SYMTYPE
                    member.linkname = "/outside-customer-state"
                    destination.addfile(member)
                else:
                    member.size = 2
                    destination.addfile(member, io.BytesIO(b"{}"))
            replacement.replace(archive)
        result = subprocess.run(
            [sys.executable, "-I", str(control), str(target)], capture_output=True, check=False
        )
        assert result.returncode != 0, fault
print("Customer data, archive links and exact dataset-byte drift block extraction")
