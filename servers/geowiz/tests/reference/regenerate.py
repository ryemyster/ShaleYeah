"""Regenerate the independently parsed sample oracle; never run during normal tests.

Install lasio==0.32 and numpy in a disposable development environment. Review
the diff before accepting any new oracle. Production Geowiz has no Python dependency.
"""

import hashlib
import json
from pathlib import Path

import lasio
import numpy

ROOT = Path(__file__).parent
REVISION = "aef25d50b9b36c08a9bde8c53181ed244ee2a035"
cases = []
for name, diagnostic in (
    ("sample_2.0.las", None),
    ("sample_2.0-small-neg-values.las", "invalid_depth"),
    ("sample_2.0_wrapped.las", "unsupported_layout"),
    ("sample_2.0_wrong_stop_value.las", "invalid_depth"),
):
    file = ROOT / "lasio-0.32" / name
    log = lasio.read(file, read_policy=(), null_policy="strict")
    cases.append({
        "file": "lasio-0.32/" + name,
        "source": f"https://github.com/kinverarity1/lasio/blob/{REVISION}/tests/examples/2.0/{name}",
        "sha256": hashlib.sha256(file.read_bytes()).hexdigest(),
        "reference": {
            "version": str(log.version.VERS.value),
            "start": float(log.well.STRT.value), "stop": float(log.well.STOP.value),
            "step": float(log.well.STEP.value), "null": float(log.well.NULL.value),
            "curves": [{"name": c.mnemonic, "unit": c.unit} for c in log.curves],
            "data": [[None if numpy.isnan(x) else float(x) for x in row] for row in log.data],
        },
        "geowizDiagnostic": diagnostic,
    })
output = {
    "referenceTool": "lasio", "referenceTag": "v0.32", "sourceRevision": REVISION,
    "runtimeVersion": lasio.__version__, "numpyVersion": numpy.__version__,
    "readPolicy": [], "nullPolicy": "strict",
    "readerSha256": hashlib.sha256(Path(lasio.reader.__file__).read_bytes()).hexdigest(),
    "license": "MIT; see lasio-0.32/LICENSE",
    "qualification": "format/reference controls only; no petrophysical or field accuracy score",
    "cases": cases,
}
(ROOT / "oracle.json").write_text(json.dumps(output, indent=2, allow_nan=False) + "\n")
