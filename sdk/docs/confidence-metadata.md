# Analysis confidence metadata

`ServerFactory.createAnalysisTool` preserves the handler's analysis and adds
metadata about its top-level `confidence`. It no longer invents `0.85` for zero,
missing or invalid input. This is a score representation contract, not evidence
of calibrated probability, professional acceptance or permission to act.

## Fields and compatibility

| Input | `metadata.confidence` | `confidenceStatus` |
| --- | --- | --- |
| Finite number within a declared scale, including zero | Exact input number | `available` |
| Missing, `undefined` or `null` | `null` | `unavailable` |
| Non-number, non-finite, negative, or above the supported maximum | `null` | `invalid` |
| Finite number from 0 through 100 with no declared scale | Exact input number | `unscaled` |

`metadata.confidenceScale` is `unit_interval` (0–1), `percentage` (0–100), or
`null` when undeclared. Endpoints are inclusive. There is no magnitude-based
inference, division by 100, coercion of strings, nested-field extraction or
default score. Without a declaration, values outside both supported scales are
invalid. A result's own `confidenceScale` prose cannot supply the declaration.

The existing four-argument call remains supported. Its numeric results now have
`unscaled` status and a null scale. Existing consumers must accept nullable
confidence and inspect status/scale before comparing scores or retaining them as
usable confidence evidence. No in-repository consumer reads
`metadata.confidence` for a decision; external SDK consumers still need this
migration. Availability alone does not qualify a score or approve work.

The optional fifth argument is trusted tool configuration:

```typescript
ServerFactory.createAnalysisTool(
  "analyze", "Analyze permitted input", inputSchema, analyzeFunction,
  { confidenceScale: "unit_interval" },
);
```

Unsupported declarations fail when constructing the tool, before executing the
handler. Role owners should declare a scale only after testing every successful
path, including fallback paths. Missing/invalid confidence does not rewrite the
domain analysis or make the MCP invocation an error; consumers can still use
appropriately reviewed calculations independently. Returned native tool failures
pass through unchanged. `NaN` becomes null inside JSON analysis as usual, while
the separately computed `invalid` metadata survives transport serialization.

## Caller inventory and remaining qualification

The shared wrapper has 47 calls across 14 MCP entrypoints. They currently use
the four-argument interface. Their calculations are retained; assigning one
scale to a mixed handler would conceal a defect. This inventory checks current
source conventions, not scoring accuracy or expert acceptance.

| MCP entrypoint | Calls | Current source evidence and owner |
| --- | ---: | --- |
| [geowiz](../../servers/geowiz/src/index.ts) | 9 | Formation summary rounds percentage QC; fallback uses unit-interval `calculateConfidence`; other outputs have nested/absent scores. #671 must resolve each advertised path before #674 |
| [curve-smith](../../servers/curve-smith/src/index.ts) | 4 | Decline-fit confidence is percentage; fallback is unit interval, with separate zero/50 paths. #712/#681 own numerical and scale qualification |
| [econobot](../../servers/econobot/src/index.ts) | 3 | Data quality is rendered as percentage; fallback uses unit interval. #711/#680 own economic evidence and scale |
| [research](../../servers/research/src/index.ts) | 2 | Market-research findings derive percentage scores; fallback uses unit interval. #709/#688 own cited evidence and scale |
| [reporter](../../servers/reporter/src/index.ts) | 3 | Percentage labels and fixed scores coexist with forwarded upstream fields and truthy defaults. #541 owns field/score mapping before reporting acceptance |
| [decision](../../servers/decision/src/index.ts) | 3 | Output score uses percentage; upstream geology is multiplied by 100 in a prompt but compared against 85 elsewhere. #690 owns advice/input-scale qualification |
| [development](../../servers/development/src/index.ts) | 3 | Fixed/unit-interval helper scores and tool-specific output shapes; #687 owns measured meaning and declaration |
| [drilling](../../servers/drilling/src/index.ts) | 3 | Fixed/unit-interval helper scores and tool-specific output shapes; #686 owns measured meaning and declaration |
| [infrastructure](../../servers/infrastructure/src/index.ts) | 4 | Fixed/unit-interval helper scores and tool-specific output shapes; #689 owns measured meaning and declaration |
| [legal](../../servers/legal/src/index.ts) | 3 | Fixed/unit-interval helper scores and tool-specific output shapes; #683 owns measured meaning and declaration |
| [market](../../servers/market/src/index.ts) | 2 | Fixed/unit-interval helper scores and tool-specific output shapes; #708/#684 own supported source observations and declaration |
| [qa-server](../../servers/qa-server/src/index.ts) | 2 | Fixed/unit-interval helper scores do not prove observed checks; #716/#542 own actual denominators and declaration |
| [risk-analysis](../../servers/risk-analysis/src/index.ts) | 2 | Fixed/unit-interval helper scores and tool-specific output shapes; #682 owns risk assumptions and declaration |
| [title](../../servers/title/src/index.ts) | 4 | Fixed/unit-interval helper scores and tool-specific output shapes; #685 owns source/expert limits and declaration |

The [migration ledger](../../docs/legacy-migration-ledger.md) tracks these owners.
The shared canonical model's 0–100 confidence and runtime configuration's 0–1
threshold are separate contracts; this helper does not map between them. Fleet
qualification #691 and release qualification #693 must reject undeclared or
unqualified scores as acceptance evidence rather than infer a conversion.

## Verification

`tests/confidence-metadata.test.ts` covers zero, declared positive scores, null/
missing input, non-finite/type/range errors, mismatched units, legacy callers,
untrusted declarations, unchanged calculations and native failures.
`tests/mcp-tool-contract.test.ts` checks the same metadata across a real HTTP
MCP client and matching structured/JSON results. These controls qualify the
shared wrapper and serialization; role calculations and professional calibration
remain with the owners above.
