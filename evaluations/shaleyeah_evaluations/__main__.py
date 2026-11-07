"""Validate an operator-selected profile/dataset without running an agent or judge."""

import argparse
import json
from pathlib import Path

from . import EvaluationError, TrustedEvalPolicy, load_profile


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("profile")
    parser.add_argument("--role", required=True)
    parser.add_argument("--dataset", action="append", required=True, metavar="ID=PATH")
    args = parser.parse_args(argv)
    try:
        datasets = {}
        for item in args.dataset:
            identity, separator, path = item.partition("=")
            if not separator or not identity or not path or identity in datasets:
                raise EvaluationError("invalid_dataset")
            with Path(path).open("rb") as file:
                datasets[identity] = file.read(8388609)
        with Path(args.profile).open("rb") as file:
            loaded = load_profile(
                file.read(65537), datasets=datasets, policy=TrustedEvalPolicy(args.role)
            )
        config = loaded.configuration()
        print(
            json.dumps(
                {
                    "profileRef": config["profileRef"],
                    "configHash": loaded.config_hash,
                    "schemaVersion": config["schemaVersion"],
                    "registryVersion": config["registryVersion"],
                    "datasetHashes": dict(loaded.dataset_hashes),
                },
                sort_keys=True,
            )
        )
        return 0
    except (OSError, EvaluationError) as error:
        print(
            json.dumps(
                {
                    "errorCode": error.code
                    if isinstance(error, EvaluationError)
                    else "input_unavailable"
                }
            )
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
