# Coordinator integration boundary

The stub exports a version constant. There is no `DealWorkflowClient` or execution
API to call today.

#572 specifies employee composition profiles; the [#675 charter](../../docs/chief-of-staff-role.md)
defines authority and permitted handoffs; #676
implements the bounded pilot. Operators may use employees directly or supply a
compatible external coordinator. Compatible task clients exchange versioned
tasks, permitted work products, review references and structured failures.

The coordinator's own identity and delegated scope must be verified. A transport
session, credential reference or model message cannot grant employee/tool access.
Raw agent/provider credentials are not passed through workflow work products.
Adapters enforce access at the executing boundary and redact before audit export.

See [ADR 0001](../../docs/adr/0001-durable-employee-contracts.md) for dependency
directions and separate BYO-model, BYO-agent, BYO-data and BYO-coordinator checks.
