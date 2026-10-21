# Curve-smith architecture

Curve-smith is a Tier 1 MCP calculation server. The selected operating mode for
the versioned numerical slice is shared contract/process only: deterministic
queries with optional unreviewed interpretation. It does not run employee
reasoning, delegation, a business approval graph or background triggers.

| Boundary | Owner |
| --- | --- |
| Strict units/time/source/assumption contract and finite Arps integral | `src/arps.ts` |
| Per-well fixed-b fitting, diagnostics and explicit scenario/equal-well mean | `src/type-curve.ts` |
| `generate_type_curve`, `calculate_eur`, optional host-configured `callLLM` | `src/type-curve-tools.ts` |
| Existing file-fitting/quality tools and server construction | `src/index.ts`, `src/tools/decline-curve-analysis.ts` |
| MCP transport, structured success/error metadata and existing access policy | `@shaleyeah/sdk` |

The actual server template registers the versioned tools. Tool validation rejects
legacy identifier/tier inputs, mixed or implicit units and caller-supplied model
credentials/approval fields. Numeric functions parse independently as well;
callers cannot bypass the contract by importing them.

The new tools do no source retrieval, file writes or persistent memory promotion.
Source references identify supplied data; they do not authenticate its claims.
Routine calculations may execute, while source applicability, assumptions,
reserves and consequential decisions require human review. This slice records
that deferral boundary in code and output. Executing employee source/context/
review gates remain part of Reservoir Engineer adoption (#681).

Optional model interpretation is configured by host code. It is separate from
the numeric result, receives only a numerical summary and cannot approve or
change anything. No provider is enabled by default for the versioned tools.
The older file-analysis path retains its existing `callLLM` behavior; its wider
fit and quality assumptions are not qualified by these tests.

Tests exercise independent volume oracles, actual template handlers and a native
stdio client. Coverage is scoped explicitly to the three repaired modules;
professional validation and clean source/archive/container qualification for the
whole employee/tool pair remain later acceptance work. See the
[method](HOW_IT_WORKS.md), [requests](INTEGRATION.md) and
[deployment instructions](DEPLOYMENT.md).
