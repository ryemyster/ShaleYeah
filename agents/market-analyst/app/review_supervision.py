"""Market operation names around the shared backend-enforced review supervisor."""

from shaleyeah_employee.review import EmployeeReviewSupervisor
from shaleyeah_mcp import call_tool


class ReviewSupervisor(EmployeeReviewSupervisor):
    def __init__(self, backend, *, client=call_tool):
        async def role_client(config, name, arguments):
            operation = {
                "prepare_review": "prepare_market_review",
                "get_review_status": "market_review_status",
            }.get(name, name)
            return await client(config, operation, arguments)

        super().__init__(backend, execution_tool="record_market_scenarios", client=role_client)
