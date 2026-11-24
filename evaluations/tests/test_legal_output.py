import json

import pytest

from shaleyeah_evaluations import EvaluationError
from shaleyeah_evaluations.employee_output import parse_employee_response


def test_actual_legal_output_and_explicit_deferral_have_one_unambiguous_shape():
    value = {
        "work": {"artifact": {"id": "work.legal", "revision": "r1"}},
        "legal": {"legalClearance": False},
    }
    text = json.dumps(value)
    assert (
        parse_employee_response(
            {
                "parts": [
                    {"thought": True, "text": "private"},
                    {"text": text[:20]},
                    {"text": text[20:]},
                ]
            },
            "legal",
        )
        == value
    )
    assert parse_employee_response(
        {"parts": [{"text": '{"deferred":"Missing source revision"}'}]}, "legal"
    ) == {"deferred": "Missing source revision"}


@pytest.mark.parametrize(
    "text",
    [
        '{"work":{},"legal":{},"approved":true}',
        '{"work":{},"legal":{},"legal":{}}',
        '{"work":{"value":NaN},"legal":{}}',
        '{"work":{"value":1e309},"legal":{}}',
        '{"work":{},"risk":{}}',
        '```json\n{"work":{},"legal":{}}\n```',
        '{"work":[],"legal":{}}',
    ],
)
def test_ambiguous_nonfinite_or_wrong_role_output_is_rejected(text):
    with pytest.raises(EvaluationError, match="invalid_employee_output"):
        parse_employee_response({"parts": [{"text": text}]}, "legal")


def test_a_mixed_tool_call_cannot_be_misread_as_final_legal_output():
    with pytest.raises(EvaluationError, match="invalid_employee_output"):
        parse_employee_response(
            {
                "parts": [
                    {
                        "text": '{"work":{},"legal":{}}',
                        "function_call": {"name": "record_legal_memo"},
                    }
                ]
            },
            "legal",
        )
