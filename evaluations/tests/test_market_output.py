"""Market output uses the shared actual-response parser, without caller substitution."""

import json
from pathlib import Path

import pytest

from shaleyeah_evaluations import EvaluationError
from shaleyeah_evaluations.employee_output import parse_employee_response

OBSERVED = json.loads(
    (Path(__file__).parents[1] / "fixtures/market/observed-scenario.json").read_text()
)
VALUE = {key: OBSERVED[key] for key in ("work", "market")}


def response(text):
    return {"role": "model", "parts": [{"text": text}]}


def test_actual_market_json_and_explicit_deferral_are_supported():
    assert parse_employee_response(response(json.dumps(VALUE)), "market") == VALUE
    assert parse_employee_response(
        response('{"deferred":"Current source access is required"}'), "market"
    ) == {"deferred": "Current source access is required"}


@pytest.mark.parametrize(
    "text",
    [
        '{"work":{},"market":{},"market":{}}',
        '{"work":{},"market":{},"approved":true}',
        '{"work":{},"market":{"price":NaN}}',
        "[]",
        "```json\n{}\n```",
        '{"deferred":""}',
        '{"work":{},"market":true}',
    ],
    ids=["duplicate", "extra", "nan", "array", "fence", "empty-deferral", "boolean"],
)
def test_ambiguous_or_noncanonical_market_output_is_rejected(text):
    assert parse_employee_response(response(json.dumps(VALUE)), "market") == VALUE
    with pytest.raises(EvaluationError, match="invalid_employee_output"):
        parse_employee_response(response(text), "market")
