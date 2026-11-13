"""Financial output compatibility entrypoint for installed graders."""

from .employee_output import parse_employee_response


def parse_response(response):
    return parse_employee_response(response, "scenario")
