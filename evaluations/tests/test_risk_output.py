import json

import pytest

from shaleyeah_evaluations import EvaluationError
from shaleyeah_evaluations.employee_output import parse_employee_response


def test_risk_output_parses_only_the_actual_canonical_role_payload_or_explicit_deferral():
    value = {"work": {"artifact": {"id": "work.risk", "revision": "r1"}}, "risk": {"riskAccepted": False}}
    text = json.dumps(value)
    assert parse_employee_response({"parts": [{"thought": True, "text": "private"}, {"text": text[:20]}, {"text": text[20:]}]}, "risk") == value
    assert parse_employee_response({"parts": [{"text": '{"deferred":"Missing joint scenarios"}'}]}, "risk") == {"deferred": "Missing joint scenarios"}


@pytest.mark.parametrize("text", [
    '{"work":{},"risk":{},"approved":true}',
    '{"work":{},"risk":{},"risk":{}}',
    '{"work":{"value":NaN},"risk":{}}',
    '{"work":{"value":1e309},"risk":{}}',
    '{"work":{},"forecast":{}}',
    '```json\n{"work":{},"risk":{}}\n```',
    '{"work":[],"risk":{}}',
])
def test_ambiguous_nonfinite_or_wrong_role_output_is_rejected(text):
    with pytest.raises(EvaluationError, match="invalid_employee_output"):
        parse_employee_response({"parts": [{"text": text}]}, "risk")
