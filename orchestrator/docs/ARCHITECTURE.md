# Optional coordinator architecture

Current implementation: a version constant in `src/index.ts`, with a workspace
SDK dependency. No workflow engine or coordinator service is implemented.

[ADR 0001](../../docs/adr/0001-durable-employee-contracts.md) defines the target.
Chief of Staff uses Hierarchical (Orchestrator-Worker) for the bounded #676
delegation pilot. The [#675 charter](../../docs/chief-of-staff-role.md) specifies
decision rights and keeps Investment Chair separate for advisory analysis.
It receives permitted tasks and work products through versioned contracts.
Employees retain private context and their own human review.

The coordinator depends on small contract bindings and installed task/protocol
adapters. It does not import employee source or grant itself all tool scopes.
Failed or unreviewed outputs cannot authorize consequential actions. A workflow
engine may implement explicit transitions later, with conformance evidence;
Temporal and fleet-wide parallel execution are not requirements.

The charter selects this unit and ADK/Python as the preferred authoring adapter;
#676 replaces the stub and qualifies runtime/review/recovery behavior. The
[MVP ledger](../../docs/mvp-release-plan.md) gates coordination on standalone
Geologist and Research Analyst acceptance.
