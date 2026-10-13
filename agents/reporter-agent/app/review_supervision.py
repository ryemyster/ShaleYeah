from shaleyeah_employee.review import EmployeeReviewSupervisor
from shaleyeah_mcp import call_tool


class ReviewSupervisor(EmployeeReviewSupervisor):
    def __init__(self, backend, *, client=call_tool):
        super().__init__(backend, execution_tool="release_report", client=client)
