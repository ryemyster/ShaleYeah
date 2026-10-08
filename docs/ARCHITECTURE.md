# SHALE YEAH architecture

SHALE YEAH augments an oil-and-gas evaluation team with 14 specialist employees.
Each agent has a job and human owner; it prepares evidence and work products for
review. A tool server supplies bounded domain tools and data hooks. Either unit
can be used independently through its supported interface.

[ADR 0001](adr/0001-durable-employee-contracts.md) defines target boundaries and
migration rules. [topology.md](topology.md) describes the target topology;
[mvp-release-plan.md](mvp-release-plan.md) gives issue order and acceptance gates.
This page describes current implementation and gaps.

## Current building block

The Geologist is an ADK (Agent Development Kit) Python package. Its configured
MCP (Model Context Protocol) wrapper calls independently runnable Geowiz over
HTTP. Geowiz processes domain inputs; the agent selects tools and prepares work.

```mermaid
flowchart LR
    Human[Human operator] --> Agent[Geologist: ADK / Python]
    Agent --> Client[Package-local Python MCP wrapper]
    Client --> Server[Geowiz: MCP / TypeScript]
    Server --> Logic[Domain tools / parsers / configured sources]
```

Geologist does not import Geowiz TypeScript source. Its wrapper initializes a
client session and calls named tools at the configured URL. Lifecycle/results/
client consolidation are #668/#677/#679; HTTP access enforcement is #678.

The agent requests ADK confirmation for `save_geowiz_finding`. That flag does
not prove authenticated revision-bound professional review or restart recovery.
Its manifest declares in-memory sessions. Durable context and review/revision/
resume are #672/#673; full-path provider replacement is #669. Server synthesis
still uses the SDK's Anthropic-specific client.

## Packages and dependency boundaries

| Area | Current responsibility | Target boundary |
| --- | --- | --- |
| `contracts/` | Canonical JSON Schema 0.1.0, generated TypeScript types and Python/TypeScript validators for employee records | Extractable business contracts independent of agent, tool, model and storage adapters |
| `agents/<role>/` | Specialist tools/reasoning, ADK assets or remaining TypeScript implementation | Independent employee with versioned job/task/product/context/review/eval contracts |
| `servers/<name>/` | 14 TypeScript MCP servers with domain handlers and data hooks | Independent permitted-client interface, its own adapters and access enforcement |
| `sdk/` | TypeScript contracts, models/parsers, server helpers, model client and legacy runtime | Small contract artifacts/bindings separated from installed utilities/adapters |
| `orchestrator/` | Version-constant stub with a workspace SDK dependency | Optional coordinator; charter #675 and bounded pilot #676 determine implementation |

Ten agents have ADK manifests: Geologist, Risk Analyst, Legal Analyst, Market
Analyst, Title Analyst, Drilling Engineer, Development Planner, Research Analyst,
Infrastructure Planner and Investment Chair. Economist, Reservoir Engineer,
Reporter and Quality Assurance retain TypeScript implementations.
See the [complete role/server map](mvp-release-plan.md#complete-employee-coverage).

Those TypeScript agents use `LocalAgentRuntime` and copied task loops.
`sdk/src/service.ts` supplies an endpoint facade, not an implemented universal
HTTP employee service. `sdk/src/agent-loop.ts` exports a shared loop with tests
but no internal production caller. #576 verifies caller/public API implications;
migrations and #692 remove displaced runtime after replacement acceptance.
Preserve useful trust behavior and regression cases at the replacement boundary.

Every unit needs install/run/check docs and declared dependencies. #674 and role
PRs verify extraction; moving a folder alone does not prove independent operation.

## Context, evaluations and trust

[`contracts/`](../contracts/README.md) defines employee charters, task assignments,
work products with evidence/assumptions, bounded context manifests, review requests
and review decisions. Both language bindings validate the same fixtures; exact
version checks reject unsupported records. Expected scope/revision comparisons
and a separately supplied policy check support callers without granting authority.
Roman display names are separate from employee, role and capability IDs.

These records are ready for adoption; current employees do not yet emit them.
The package verifies structure and declared references, not reviewer identity,
real source content/rights or execution permission. #573/#672/#673 supply those
trusted runtime boundaries. Eval profiles/results are #666/#667.

Legacy `ContextStore` is a process-local map, not durable isolated storage. ADK
sessions are distinct from retained employee context and reviewed shared
knowledge. Policy/storage are #571/#672. Warehouses, vectors and hosted memory
are optional adapters.

Existing shape tests/eval assets are foundational. Configurable job scorecards,
portable results and promotion gates are #666/#667/#577/#691. Each role needs
professional cases and human acceptance; importing an agent is not job-quality
evidence.

Trusted code enforces identity, scopes, revision-bound human review, audit and
redaction under #573/#678/#673/#574. Namespace strings, prompts and transport
session IDs cannot grant authority. Legacy runtime checks do not establish
protection on every current ADK-to-MCP path.

## Optional coordination

`orchestrator/src/index.ts` has no Temporal workflow or fleet-wide deal pipeline.
Employees run without it. Chief of Staff initially coordinates Geologist and
Research Analyst within declared authority. Investment Chair provisionally stays
a separate investment-synthesis role; #675 settles the split before #676's pilot.

Framework/model/protocol upgrades are reviewed adapter changes. Business contracts
stay language-neutral and versioned; accepted releases pin tested dependencies
and model/profile versions. ADR 0001 defines compatibility, deprecation and
upgrade checks. Automatic latest-model promotion and mandatory provider/cloud
dependencies are outside the target architecture.
