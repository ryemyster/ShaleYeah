"""Explicit offline input declarations for the real protected Geowiz test launcher."""

import hashlib
import json
from datetime import UTC, datetime, timedelta
from pathlib import Path


def source_config(file, principal):
    config = json.loads((Path(__file__).with_name("data-connectors.json")).read_text())["configuration"]
    now = datetime.now(UTC)
    config["workspaceRoot"] = str(file.parent.resolve())
    config["scope"].update(customerId=principal["customerId"], employeeId=principal["employeeId"])
    config["manifest"]["owner"] = {key: principal[key] for key in ("customerId", "employeeId")}
    config["grant"].update(subjectId=principal["subjectId"], scope=dict(config["scope"]), expiresAt=(now + timedelta(days=1)).isoformat(timespec="milliseconds").replace("+00:00", "Z"))
    config["sources"][0]["locator"] = file.name
    config["sources"][0]["evidence"]["hash"]["value"] = hashlib.sha256(file.read_bytes()).hexdigest()
    config["sources"][0]["evidence"]["asOf"] = now.isoformat(timespec="milliseconds").replace("+00:00", "Z")
    return config
