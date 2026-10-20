"""Turn an agents-cli summary into a strict two-provider fixture CI decision."""

import argparse
import json
from pathlib import Path


def verify(directory):
    try:
        files = list(Path(directory).glob("results_*.json"))
        if len(files) != 1:
            return False
        summaries = json.loads(files[0].read_text())["summary_metrics"]
        return len(summaries) == 1 and summaries[0] == {
            **summaries[0], "metric_name": "native_contract_fidelity", "num_cases_total": 2,
            "num_cases_valid": 2, "num_cases_error": 0, "mean_score": 1.0,
        }
    except (OSError, KeyError, TypeError, ValueError):
        return False


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", help="One fresh agents-cli grading output directory")
    args = parser.parse_args()
    raise SystemExit(0 if verify(args.directory) else 1)
