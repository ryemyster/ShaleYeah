# API Reference

**SHALE YEAH MCP Server APIs and Integration Guide**

This reference provides comprehensive documentation for integrating with SHALE YEAH's MCP servers, including all available tools, resources, and integration patterns.

---

## 🔌 Integration Overview

SHALE YEAH exposes its functionality through **14 active MCP servers**, each implementing the Model Context Protocol standard. You can integrate with individual servers or use the orchestrating MCP client.

### Connection Methods

**1. Individual MCP Servers**
```bash
# Start specific servers
npm run server:geowiz      # Geology analysis
npm run server:econobot    # Economic analysis
npm run server:decision    # Investment decisions
```

**2. Orchestrated Analysis**
```typescript
import { ShaleYeahMCPClient } from './src/mcp-client.js';

const client = new ShaleYeahMCPClient();
const result = await client.executeAnalysis({
  runId: 'analysis-001',
  tractName: 'West Texas Prospect',
  mode: 'production',
  inputFiles: ['well.las', 'economics.xlsx'],
  outputDir: './results'
});
```

**3. Kernel Discovery API**
```typescript
import { Kernel } from './src/kernel/index.js';
import { ShaleYeahMCPClient } from './src/mcp-client.js';

const client = new ShaleYeahMCPClient();
const kernel = new Kernel();
kernel.initialize(client.serverConfigs);

// Discover available servers
const servers = kernel.listServers();
const geologyOnly = kernel.listServers({ domain: 'geology' });
const commandOnly = kernel.listServers({ type: 'command' });

// Describe tools on a specific server
const tools = kernel.describeTools('geowiz');

// Find tools by capability
const matches = kernel.findCapability('formation_analysis');

// Resolve which server owns a tool
const server = kernel.resolveServer('geowiz.analyze'); // → 'geowiz'
```

---

## 🧠 Kernel Discovery API

The kernel provides discovery tools that allow agents to dynamically explore available capabilities before taking action. Based on the [Arcade.dev Discovery Tool pattern](https://www.arcade.dev/patterns/discovery-tool).

### `kernel.list_servers`

List all available MCP servers with optional filtering by domain, tool type, or capability.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `domain` | string | No | Filter by domain (e.g., "geology", "economics", "risk") |
| `type` | string | No | Filter by tool type: "query", "command", or "discovery" |
| `capability` | string | No | Filter by capability keyword (case-insensitive) |

**Response:**
```json
[
  {
    "name": "geowiz",
    "description": "Geological Analysis Server",
    "domain": "geology",
    "persona": "Marcus Aurelius Geologicus",
    "toolCount": 1,
    "capabilities": ["formation_analysis", "gis_processing", "well_log_analysis"],
    "status": "connected"
  }
]
```

### `kernel.describe_tools`

Get detailed tool descriptors for a specific server or all servers.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `serverName` | string | No | Server name to scope results. Omit for all tools. |

**Response:**
```json
[
  {
    "name": "geowiz.analyze",
    "server": "geowiz",
    "type": "query",
    "description": "Geological Analysis Server — powered by Marcus Aurelius Geologicus",
    "capabilities": ["formation_analysis", "gis_processing", "well_log_analysis"],
    "readOnly": true,
    "destructive": false,
    "requiresConfirmation": false,
    "detailLevels": ["summary", "standard", "full"]
  }
]
```

### `kernel.find_capability`

Find tools that match a capability string. Case-insensitive substring matching.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `capability` | string | Yes | Capability to search for (e.g., "formation_analysis", "monte_carlo") |

**Response:** Array of matching `ToolDescriptor` objects (same shape as `describe_tools`).

### Session & Context Tools

Sessions provide identity anchoring and context injection. Based on the [Arcade.dev Identity Anchor](https://www.arcade.dev/patterns/identity-anchor) and [Context Injection](https://www.arcade.dev/patterns/context-injection) patterns.

#### `kernel.create_session`

Create a new session with optional identity and preferences. Defaults to demo identity (`analyst` role, `read:analysis` permission).

```typescript
// Default demo session
const session = kernel.createSession();

// Custom identity
const session = kernel.createSession(
  { userId: "eng-456", role: "engineer", permissions: ["read:analysis", "write:reports"] },
  { defaultBasin: "Permian", riskTolerance: "moderate" }
);
```

**Returns:** `Session` object with UUID `id`, `identity`, `preferences`, and methods for storing/retrieving analysis results.

#### `kernel.who_am_i`

Return the identity and injected context for a session. The context includes user preferences, timezone, and a list of previously stored analysis results.

```typescript
const info = kernel.whoAmI(sessionId);
// info.identity → { userId, role, permissions, ... }
// info.context  → { userId, role, sessionId, timestamp, timezone, defaultBasin, riskTolerance, availableResults }
```

#### `kernel.get_session`

Get session metadata including creation time, last activity, and available result keys.

```typescript
const info = kernel.getSession(sessionId);
// info → { id, identity, createdAt, lastActivity, availableResults: ["geo", "econ"] }
```

#### Session Lifecycle

1. **Create** — `kernel.createSession(identity?, preferences?)`
2. **Use** — execute tools; store results via `session.storeResult(key, response)`
3. **Query** — `kernel.whoAmI(id)` for context, `session.getResult(key)` for prior results
4. **Destroy** — `kernel.destroySession(id)` releases all session resources

Sessions are isolated — results stored in one session are not visible to others. Context is automatically injected into tool calls when a `sessionId` is provided in `ToolRequest`.

### Error Intelligence & Resilience

All tool errors are classified with type, recovery guidance, and alternative tool suggestions. Based on [Arcade.dev Error Classification](https://www.arcade.dev/patterns/error-classification) and [Recovery Guide](https://www.arcade.dev/patterns/recovery-guide) patterns.

#### Error Classification Table

| Error Type | Trigger Patterns | Agent Strategy |
|---|---|---|
| `retryable` | timeout, rate limit, 429, 503, ECONNREFUSED, network | Wait and retry (with `retryAfterMs`) |
| `permanent` | invalid, validation, schema, zod, malformed, 400 | Fix request parameters |
| `auth_required` | unauthorized, 401, 403, api key, token expired | Re-authenticate or check permissions |
| `user_action` | file not found, ENOENT, missing data, no data | Prompt user for required input |

Priority order: auth > user_action > retryable > permanent. Unknown errors default to `retryable` (optimistic).

#### Error Response Format

```typescript
// Failed tool response includes:
{
  success: false,
  error: {
    type: "retryable",              // ErrorType classification
    message: "Connection timeout",   // Original error message
    reason: "Transient failure...",   // Human-readable explanation
    recoverySteps: [                 // Actionable steps
      "Wait briefly and retry the request.",
      "Check network connectivity and server status.",
      "If geowiz remains unavailable, consider alternative tools."
    ],
    alternativeTools: ["research.analyze"],  // Fallback suggestions
    retryAfterMs: 2000              // Suggested retry delay (retryable only)
  }
}
```

#### Graceful Degradation

When executing parallel tool bundles, partial failures produce useful degraded results instead of total failure:

```typescript
const degraded = resilience.handleDegradation(results, expectedTools);
// degraded → {
//   completeness: 86,        // 12/14 succeeded
//   missingAnalyses: ["reporter.analyze", "decision.analyze"],
//   suggestions: ["Partial results are available and may be sufficient..."],
//   degradationReason: "2 of 14 analyses failed or were unavailable."
// }
```

- **>=50% completeness**: Results are useful for initial assessment
- **<50% completeness**: Insufficient data, suggests retrying failed servers
- Missing tools include alternative suggestions based on capability overlap

#### Retry Delay Recommendations

| Error Pattern | Suggested Delay |
|---|---|
| Rate limit (429) | 5000ms |
| Timeout | 2000ms |
| Connection error | 1000ms |

### Composition — High-Level Composite Tools

Pre-built multi-server workflows based on [Arcade.dev Abstraction Ladder](https://www.arcade.dev/patterns/abstraction-ladder) and [Task Bundle](https://www.arcade.dev/patterns/task-bundle) patterns. Each composite tool orchestrates multiple servers into a single call.

#### Available Composite Tools

| Tool | Servers | Phases | Description |
|---|---|---|---|
| `kernel.quickScreen()` | 4 (geowiz, econobot, curve-smith, risk-analysis) | 1 parallel | Fast go/no-go screening |
| `kernel.fullAnalysis()` | 14 | 4+ dependency-ordered | Comprehensive due diligence |
| `kernel.geologicalDeepDive()` | 3 (geowiz, curve-smith, research) | 1 parallel | Focused geological assessment |
| `kernel.financialReview()` | 3 (econobot, risk-analysis, market) | 1 parallel | Focused financial assessment |
| `kernel.shouldWeInvest()` | 14 + confirmation gate | 4+ phases + gate | Full analysis ending with gated investment decision |

#### Quick Screen

```typescript
const result = await kernel.quickScreen({ basin: "Permian", county: "Midland" });
// result → BundleResponse with 4 parallel results, ~100% completeness
// result.results.get("geowiz.analyze")   → geological assessment
// result.results.get("econobot.analyze")  → economic assessment
```

#### Should We Invest (Confirmation Gate)

```typescript
const result = await kernel.shouldWeInvest({ basin: "Permian" });
// Full 14-server analysis, then decision requires confirmation:
const decision = result.results.get("decision.analyze");
// decision.data.requires_confirmation → true
// decision.data.pending_action.actionId → "abc-123"

// Agent must explicitly confirm or cancel:
const confirmed = await kernel.confirmAction("abc-123");
// OR
kernel.cancelAction("abc-123");
```

The confirmation gate implements the [Arcade.dev Confirmation Request](https://www.arcade.dev/patterns/confirmation-request) pattern — high-impact actions (investment decisions) require explicit agent confirmation before execution.

#### Listing All Bundles

```typescript
const bundles = kernel.listBundles();
// → { quick_screen: { name, description, stepCount: 4 },
//     full_due_diligence: { name, description, stepCount: 14 },
//     geological_deep_dive: { name, description, stepCount: 3 },
//     financial_review: { name, description, stepCount: 3 } }
```

### Security — Permission Gates & Audit Trail

#### Permission Model

Tool access is controlled by role-based permissions. When `KERNEL_AUTH_ENABLED=true`, the kernel checks each `callTool()` invocation against the session identity's role.

| Role | Permissions | Tool Access |
|---|---|---|
| `analyst` | `read:analysis` | All 12 query servers |
| `engineer` | + `write:reports` | + reporter tools |
| `executive` | + `execute:decisions` | + decision tools |
| `admin` | + `admin:servers`, `admin:users` | Everything |

**Tool → Permission Mapping:**
- Query tools (geowiz, econobot, etc.) → `read:analysis`
- `reporter.*` → `write:reports`
- `decision.*` → `execute:decisions`
- `admin.*` → `admin:servers`

```typescript
// Pre-flight check (no execution)
const result = kernel.authCheck("decision.make_recommendation", sessionId);
// result → { allowed: false, reason: "...", requiredRole: "executive", requiredPermissions: ["execute:decisions"] }

// Full pipeline: auth → audit → execute → audit
const response = await kernel.callTool(
  { toolName: "geowiz.analyze", args: { basin: "Permian" } },
  sessionId,
);
```

#### Audit Trail

All `callTool()` invocations produce structured JSONL audit entries at `data/audit/YYYY-MM-DD.jsonl`:

```json
{"tool":"geowiz.analyze","action":"request","parameters":{"basin":"Permian","apiKey":"[REDACTED]"},"userId":"demo","sessionId":"abc-123","role":"analyst","timestamp":"2026-02-13T..."}
{"tool":"geowiz.analyze","action":"response","parameters":{"basin":"Permian","apiKey":"[REDACTED]"},"userId":"demo","sessionId":"abc-123","role":"analyst","timestamp":"2026-02-13T...","success":true,"durationMs":42}
```

Sensitive values (keys matching `/key|token|secret|password|credential|auth|bearer/`) are automatically redacted. Denial entries use `action: "denied"`.

### Progressive Detail Levels

All tool responses support three detail levels via the `detail_level` parameter, based on the [Arcade.dev Token-Efficient Response pattern](https://www.arcade.dev/patterns/token-efficient-response). Use lower levels to save tokens when only key metrics are needed.

**Parameter:** `detail_level` — `"summary"` | `"standard"` (default) | `"full"`

| Level | Description | Use Case |
|-------|-------------|----------|
| **summary** | Key metrics only (3-6 fields per domain) | Quick screening, dashboards, multi-tool orchestration |
| **standard** | All fields except verbose arrays/raw data | Normal analysis, reports |
| **full** | Complete data including sensitivity analysis, Monte Carlo, raw curves | Deep dives, audits, data export |

**Example — Economic analysis at each level:**

```jsonc
// summary: 4 fields
{
  "economic": { "npv": 3500000, "irr": 28.5, "paybackMonths": 10, "confidence": 82 }
}

// standard: all fields except sensitivityAnalysis, monteCarloResults
{
  "economic": { "npv": 3500000, "irr": 28.5, "roi": 1.8, "paybackMonths": 10,
    "assumptions": { "oilPrice": 78, "gasPrice": 3.5, "drillingCost": 9000000, "completionCost": 4500000 },
    "confidence": 82 }
}

// full: everything
{
  "economic": { "npv": 3500000, "irr": 28.5, "roi": 1.8, "paybackMonths": 10,
    "assumptions": { ... },
    "sensitivityAnalysis": [ { "variable": "oil_price", "scenarios": { "low": 1500000, "base": 3500000, "high": 5000000 } } ],
    "confidence": 82 }
}
```

**Summary fields per domain:**

| Domain | Summary Fields |
|--------|---------------|
| geological | reservoirQuality, hydrocarbonPotential, recommendedAction, geologicalConfidence, professionalSummary |
| economic | npv, irr, paybackMonths, confidence |
| curve | eur, initialRate, qualityGrade, confidence |
| risk | overallRiskScore, overallRisk, confidence |

**Natural language summary** — Every `AgentOSResponse` includes a human-readable `summary` string:
- Geological: `"Good reservoir quality. Recommended action: drill. Confidence: 87%."`
- Economic: `"NPV: $3.5M, IRR: 28.5%. Confidence: 82%."`
- Curve: `"EUR: 520K BOE, grade: Good. Confidence: 90%."`
- Risk: `"Overall risk score: 45/100. Confidence: 78%."`

### Tool Type Classification

All tools are classified into three types that determine execution semantics:

| Type | Behavior | Servers |
|------|----------|---------|
| **query** | Read-only, cacheable, safe to parallelize | geowiz, econobot, curve-smith, risk-analysis, market, research, legal, title, drilling, infrastructure, development, test |
| **command** | Side effects (file writes, decisions), may require confirmation | reporter, decision |
| **discovery** | Meta-tools for exploring capabilities (kernel-provided) | kernel |

### Composite Execution Tools

High-level tools that orchestrate multiple servers in a single call. Based on the [Arcade.dev Task Bundle](https://www.arcade.dev/patterns/task-bundle) and [Scatter-Gather](https://www.arcade.dev/patterns/scatter-gather) patterns.

#### `kernel.quick_screen`

Fast parallel screening of a tract using 4 core servers (geology, economics, engineering, risk). All run in parallel via `Promise.allSettled`.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `tractArgs` | object | No | Arguments merged into every server call (e.g., tract name, location) |

**Response:** `BundleResponse` with results from all 4 servers, completeness %, and phase timing.

```typescript
const result = await kernel.quickScreen({ tract: "Permian-123" });
// result.completeness → 100 (all 4 succeeded)
// result.results.get("geowiz.analyze") → geological analysis
```

#### `kernel.full_due_diligence`

Comprehensive 14-server analysis in 4+ phases with dependency ordering:
1. Core analysis (5 servers, parallel)
2. Extended analysis (6 servers, parallel, depends on phase 1)
3. QA validation (depends on phase 2)
4. Reporting + decision (sequential, depends on all)

**Input Parameters:** Same as `quick_screen`.

**Response:** `BundleResponse` with per-phase results, overall completeness, and success evaluation using `majority` strategy.

#### `kernel.generateIdempotencyKey`

Generate a deterministic SHA-256 hash from tool name, args, and session ID. Use for deduplication and caching.

```typescript
const key = kernel.generateIdempotencyKey("geowiz.analyze", { tract: "P-123" }, "session-1");
// key → "a3f2b1c9d4e5f678" (16 hex chars, deterministic)
```

---

## 🏛️ Expert Server APIs

### Geowiz Server - Geological Analysis

**Roman Persona:** Marcus Aurelius Geologicus
**Expertise:** Formation analysis, well log interpretation, reservoir characterization

#### Tools

##### `analyze_formation`
Analyze geological formations from well log data.

```typescript
// Input Schema
{
  filePath: string;           // Path to LAS well log file
  formations?: string[];      // Optional formation names to focus on
  analysisType?: 'basic' | 'standard' | 'comprehensive'; // Default: 'standard'
  depthRange?: {              // Optional depth filtering
    top: number;
    bottom: number;
  };
}

// Response
{
  analysis: {
    formations: Array<{
      name: string;
      topDepth: number;
      bottomDepth: number;
      netPay: number;
      porosity: number;
      permeability: number;
    }>;
    reservoirQuality: 'Excellent' | 'Good' | 'Fair' | 'Poor';
    drillingTargets: Array<{
      depth: number;
      confidence: number;
      description: string;
    }>;
  };
  confidence: number;          // 0.0 - 1.0
  quality: 'Excellent' | 'Good' | 'Fair' | 'Poor';
  recommendations: string[];
  persona: 'Marcus Aurelius Geologicus';
  timestamp: string;
}
```

##### `parse_well_log`
Parse and validate LAS well log files.

```typescript
// Input Schema
{
  filePath: string;           // Path to LAS file
  validateCurves?: boolean;   // Validate curve data quality (default: true)
  extractMetadata?: boolean;  // Extract well metadata (default: true)
}

// Response
{
  analysis: {
    wellInfo: {
      wellName: string;
      location: { latitude?: number; longitude?: number };
      totalDepth: number;
      drilledDate?: string;
    };
    curves: Array<{
      name: string;
      description: string;
      unit: string;
      depthRange: { min: number; max: number };
      dataPoints: number;
      quality: 'Excellent' | 'Good' | 'Fair' | 'Poor';
    }>;
    dataQuality: {
      completeness: number;     // Percentage of non-null values
      consistency: number;      // Data consistency score
      issues: string[];         // Any quality issues found
    };
  };
  confidence: number;
  recommendations: string[];
}
```

##### `assess_drilling_risk`
Evaluate drilling risks based on geological data.

```typescript
// Input Schema
{
  formationData: any;         // Geological formation data
  drillingType: 'vertical' | 'horizontal' | 'directional';
  targetDepth: number;
}

// Response
{
  analysis: {
    overallRisk: 'Low' | 'Medium' | 'High';
    riskFactors: Array<{
      factor: string;
      severity: 'Low' | 'Medium' | 'High';
      mitigation: string;
    }>;
    recommendedMudWeight: number;
    casingProgram: Array<{
      depth: number;
      casingSize: string;
      reason: string;
    }>;
  };
  confidence: number;
  recommendations: string[];
}
```

#### Resources

##### `formation_analysis`
Access stored formation analysis results.

```
URI: geowiz://analyses/{analysisId}
```

---

### Econobot Server - Economic Analysis

**Roman Persona:** Caesar Augustus Economicus
**Expertise:** DCF modeling, NPV/IRR calculations, financial forecasting

#### Tools

##### `analyze_economics`
Perform comprehensive economic analysis.

```typescript
// Input Schema
{
  productionForecast: {
    initialRate: number;      // bbl/day or mcf/day
  déclineRate: number;    // Annual decline rate
    eur: number;              // Estimated Ultimate Recovery
  };
  costs: {
    drilling: number;         // Drilling cost
    completion: number;       // Completion cost
    facilities: number;       // Facility costs
    operating: number;        // Annual operating cost per well
  };
  prices: {
    oil?: number;             // $/bbl
    gas?: number;             // $/mcf
  };
  assumptions: {
    discountRate?: number;    // Default: 0.10 (10%)
    taxRate?: number;         // Default: 0.35 (35%)
    royaltyRate?: number;     // Default: 0.125 (12.5%)
  };
}

// Response
{
  analysis: {
    npv: number;              // Net Present Value
    irr: number;              // Internal Rate of Return
    paybackMonths: number;    // Months to payback
    breakeven: number;        // Breakeven oil/gas price
    roiMultiple: number;      // Return on investment multiple
    cashFlow: Array<{
      year: number;
      grossRevenue: number;
      netRevenue: number;
      cashFlow: number;
      cumulativeCashFlow: number;
    }>;
    sensitivity: {
      oil: Array<{ price: number; npv: number }>;
      gas: Array<{ price: number; npv: number }>;
      decline: Array<{ rate: number; npv: number }>;
    };
  };
  confidence: number;
  quality: string;
  recommendations: string[];
}
```

##### `dcf_analysis`
Perform detailed discounted cash flow analysis.

```typescript
// Input Schema
{
  cashFlows: Array<{
    year: number;
    cashFlow: number;
  }>;
  discountRate: number;
  terminalValue?: number;
}

// Response
{
  analysis: {
    npv: number;
    presentValueCashFlows: Array<{
      year: number;
      cashFlow: number;
      presentValue: number;
      cumulativePV: number;
    }>;
    terminalValuePV?: number;
  };
  confidence: number;
  recommendations: string[];
}
```

#### Resources

##### `economic_analysis`
Access stored economic analysis results.

```
URI: econobot://analyses/{analysisId}
```

##### `dcf_model`
Access DCF model results and assumptions.

```
URI: econobot://models/{modelId}
```

---

### Curve-Smith Server - Reservoir Engineering

**Roman Persona:** Lucius Technicus Engineer
**Expertise:** Decline curve analysis, production forecasting, EUR estimation

#### Tools

##### `analyze_decline_curve`
Analyze production decline curves and forecast future production.

```typescript
// Input Schema
{
  productionData: Array<{
    date: string;
    oilRate?: number;         // bbl/day
    gasRate?: number;         // mcf/day
    waterRate?: number;       // bbl/day
  }>;
  analysisType: 'arps' | 'duong' | 'stretched-exponential' | 'all';
  forecastMonths?: number;    // Default: 60 months
}

// Response
{
  analysis: {
    bestFitModel: 'arps' | 'duong' | 'stretched-exponential';
    parameters: {
      initialRate: number;
      declineRate: number;
      bFactor?: number;        // For Arps hyperbolic
      m?: number;              // For Duong model
      n?: number;              // For stretched exponential
    };
    eur: {
      oil?: number;           // bbls
      gas?: number;           // mcf
    };
    forecast: Array<{
      month: number;
      oilRate?: number;
      gasRate?: number;
      cumulativeOil?: number;
      cumulativeGas?: number;
    }>;
    qualityMetrics: {
      rSquared: number;
      rmse: number;
      confidenceInterval: number;
    };
  };
  confidence: number;
  quality: 'Excellent' | 'Good' | 'Fair' | 'Poor';
  recommendations: string[];
}
```

##### `process_las_file`
Process LAS files for reservoir engineering analysis.

```typescript
// Input Schema
{
  filePath: string;
  extractCurves?: string[];   // Specific curves to extract
  depthRange?: {
    top: number;
    bottom: number;
  };
}

// Response
{
  analysis: {
    wellInfo: {
      name: string;
      location?: { latitude: number; longitude: number };
      totalDepth: number;
    };
    curves: Record<string, {
      values: number[];
      depths: number[];
      unit: string;
      quality: number;        // 0-1 quality score
    }>;
    reservoirProperties: {
      netPay?: number;
      avgPorosity?: number;
      avgPermeability?: number;
    };
  };
  confidence: number;
  recommendations: string[];
}
```

---

### Decision Server - Investment Strategy

**Roman Persona:** Augustus Decidius Maximus
**Expertise:** Investment recommendations, portfolio optimization, bid strategy

#### Tools

##### `make_investment_decision`
Generate final investment recommendation based on all analyses.

```typescript
// Input Schema
{
  analyses: {
    geological?: any;         // From geowiz server
    economic?: any;          // From econobot server
    engineering?: any;       // From curve-smith server
    risk?: any;             // From risk-analysis server
    legal?: any;            // From legal server
  };
  investmentCriteria: {
    minimumIRR?: number;     // Minimum acceptable IRR
    maximumPayback?: number; // Maximum payback months
    riskTolerance: 'low' | 'medium' | 'high';
  };
}

// Response
{
  analysis: {
    recommendation: 'PROCEED' | 'PROCEED_WITH_CONDITIONS' | 'REJECT';
    confidence: number;
    reasoning: {
      strengths: string[];
      concerns: string[];
      criticalFactors: string[];
    };
    conditions?: string[];    // If PROCEED_WITH_CONDITIONS
    bidStrategy?: {
      recommendedBid: number;
      bidRange: { min: number; max: number };
      strategicNotes: string[];
    };
  };
  confidence: number;
  quality: 'High' | 'Medium' | 'Low';
  recommendations: string[];
}
```

---

### Risk-Analysis Server

**Roman Persona:** Gaius Probabilis Assessor
**Expertise:** Monte Carlo simulation, uncertainty quantification, risk assessment

#### Tools

##### `assess_investment_risk`
Comprehensive investment risk assessment.

```typescript
// Input Schema
{
  analysisData: any;          // Combined analysis data
  uncertaintyFactors: Array<{
    parameter: string;
    distribution: 'normal' | 'uniform' | 'triangular';
    min: number;
    max: number;
    most_likely?: number;     // For triangular distribution
  }>;
  iterations?: number;        // Monte Carlo iterations (default: 1000)
}

// Response
{
  analysis: {
    overallRisk: 'Low' | 'Medium' | 'High';
    riskScore: number;        // 0-100 scale
    riskFactors: Array<{
      category: string;
      impact: 'Low' | 'Medium' | 'High';
      probability: number;
      mitigation: string;
    }>;
    monteCarlo: {
      npvDistribution: {
        p10: number;
        p50: number;
        p90: number;
        mean: number;
        stdDev: number;
      };
      successProbability: number; // Probability of positive NPV
    };
  };
  confidence: number;
  recommendations: string[];
}
```

---

### Reporter Server - Executive Reporting

**Roman Persona:** Scriptor Reporticus Maximus
**Expertise:** Executive reporting, decision synthesis, presentation materials

#### Tools

##### `generate_investment_decision`
Generate executive investment decision report.

```typescript
// Input Schema
{
  analysisResults: Record<string, any>; // All server results
  tractName: string;
  reportFormat?: 'markdown' | 'json' | 'both'; // Default: 'both'
  includeDetails?: boolean;   // Include technical details
}

// Response
{
  analysis: {
    executiveSummary: string;
    recommendation: 'PROCEED' | 'PROCEED_WITH_CONDITIONS' | 'REJECT';
    keyMetrics: {
      npv: number;
      irr: number;
      paybackMonths: number;
      riskScore: number;
    };
    reportFiles: Array<{
      filename: string;
      path: string;
      format: string;
    }>;
  };
  confidence: number;
  recommendations: string[];
}
```

---

## 📁 File Processing APIs

All MCP servers inherit file processing capabilities through the `FileIntegrationManager`.

### Supported Formats

| **Format** | **Extension** | **Parser Class** | **Status** |
|------------|---------------|------------------|------------|
| **LAS Well Logs** | `.las` | `LASParser` | ✅ Implemented |
| **Excel Spreadsheets** | `.xlsx`, `.xlsm` | `ExcelParser` | ✅ Implemented |
| **CSV Files** | `.csv` | `CSVParser` | ✅ Implemented |
| **GIS Shapefiles** | `.shp` | `GISParser` | ✅ Implemented |
| **GeoJSON** | `.geojson` | `GISParser` | ✅ Implemented |
| **KML Files** | `.kml` | `GISParser` | ✅ Implemented |
| **SEGY Seismic** | `.segy`, `.sgy` | `SEGYParser` | 🚧 Architectural |
| **PDF Documents** | `.pdf` | `PDFParser` | 🚧 Architectural |
| **Word Documents** | `.docx` | `WordParser` | 🚧 Architectural |
| **Access Databases** | `.mdb`, `.accdb` | `AccessParser` | 🚧 Architectural |

### File Processing Response Format

```typescript
interface ParseResult {
  success: boolean;
  data?: any;                 // Parsed file contents
  errors?: string[];          // Any parsing errors
  warnings?: string[];        // Non-critical issues
  metadata: {
    format: string;           // Detected file format
    size: number;             // File size in bytes
    processingTime: number;   // Processing time in ms
    confidence: number;       // Format detection confidence
  };
}
```

### Example File Processing

```typescript
// Any MCP server can process files
const result = await server.fileManager.parseFile('./data/well.las');

if (result.success) {
  console.log('Parsed data:', result.data);
  console.log('Format detected:', result.metadata.format);
} else {
  console.error('Parsing failed:', result.errors);
}
```

---

## 🔧 Integration Patterns

### Pattern 1: Individual Server Integration

Connect to specific servers for focused analysis:

```typescript
// Connect to geology server only
import { GeowizServer } from './src/servers/geowiz.js';

const geowiz = new GeowizServer();
await geowiz.initialize();

const result = await geowiz.callTool('analyze_formation', {
  filePath: './data/well.las',
  analysisType: 'comprehensive'
});

console.log('Geological analysis:', result);
```

### Pattern 2: Multi-Server Orchestration

Use the MCP client for comprehensive analysis:

```typescript
import { ShaleYeahMCPClient } from './src/mcp-client.js';

const client = new ShaleYeahMCPClient();

// Execute full analysis pipeline
const result = await client.executeAnalysis({
  runId: 'comprehensive-001',
  tractName: 'Permian Basin Prospect',
  mode: 'production',
  inputFiles: [
    './data/well-logs/main.las',
    './data/economics/assumptions.xlsx',
    './data/gis/boundaries.shp'
  ],
  outputDir: './results',
  workflow: 'full-analysis'
});

if (result.success) {
  console.log(`Analysis complete: ${result.confidence}% confidence`);
  console.log(`Reports available in: ${result.outputDir}`);

  // Access individual server results
  result.serverResults.forEach(serverResult => {
    console.log(`${serverResult.persona}: ${serverResult.confidence}% confidence`);
  });
}
```

### Pattern 3: Claude Desktop Integration

Connect individual servers to Claude Desktop as MCP servers:

```json
// Claude Desktop configuration
{
  "mcpServers": {
    "shale-yeah-geology": {
      "command": "npx",
      "args": ["tsx", "/path/to/ShaleYeah/src/servers/geowiz.ts"],
      "description": "SHALE YEAH Geological Analysis Expert"
    },
    "shale-yeah-economics": {
      "command": "npx",
      "args": ["tsx", "/path/to/ShaleYeah/src/servers/econobot.ts"],
      "description": "SHALE YEAH Economic Analysis Expert"
    }
  }
}
```

### Pattern 4: API Client Integration

Build custom applications on top of SHALE YEAH:

```typescript
class ShaleYeahAPIClient {
  private client: ShaleYeahMCPClient;

  constructor() {
    this.client = new ShaleYeahMCPClient();
  }

  async analyzeProspect(prospectData: ProspectData): Promise<AnalysisResult> {
    // Custom business logic
    const analysisRequest = this.buildAnalysisRequest(prospectData);

    // Execute analysis
    const result = await this.client.executeAnalysis(analysisRequest);

    // Post-process results for your application
    return this.formatResults(result);
  }

  async getAnalysisHistory(prospectId: string): Promise<AnalysisHistory[]> {
    // Query analysis history
    return await this.loadAnalysisHistory(prospectId);
  }

  async generateCustomReport(analysisId: string, template: string): Promise<string> {
    // Generate custom report format
    return await this.generateReport(analysisId, template);
  }
}
```

---

## 🔐 Authentication and Security

### Environment Variables

```bash
# Required for production AI analysis
ANTHROPIC_API_KEY=sk-ant-your-api-key-here

# Optional external integrations
EIA_API_KEY=your-eia-api-key
BLOOMBERG_API_KEY=your-bloomberg-key

# Server configuration
MCP_SERVER_PORT=3000
LOG_LEVEL=info
```

### Security Best Practices

**1. API Key Management**
- Never commit API keys to source control
- Use environment variables or secure key management
- Rotate keys regularly

**2. File Processing Security**
- Validate file types before processing
- Implement file size limits
- Scan for malicious content

**3. Data Privacy**
- No sensitive data in logs
- Automatic cleanup of temporary files
- Optional encryption at rest

---

## 🚨 Error Handling

### Standard Error Response Format

All SHALE YEAH MCP servers return standardized error responses:

```typescript
interface ErrorResponse {
  success: false;
  error: {
    operation: string;          // What operation failed
    message: string;            // Human-readable error message
    server: string;             // Which server generated the error
    persona: string;            // Roman persona name
    timestamp: string;          // ISO timestamp
    code?: string;              // Optional error code
    context?: any;              // Additional error context
  };
}
```

### Common Error Scenarios

**File Processing Errors**
```typescript
// File not found
{
  success: false,
  error: {
    operation: "parse_file",
    message: "File not found: ./data/missing.las",
    server: "geowiz",
    persona: "Marcus Aurelius Geologicus",
    code: "FILE_NOT_FOUND"
  }
}

// Invalid file format
{
  success: false,
  error: {
    operation: "parse_file",
    message: "Unsupported file format: .xyz",
    server: "geowiz",
    persona: "Marcus Aurelius Geologicus",
    code: "UNSUPPORTED_FORMAT"
  }
}
```

**Analysis Errors**
```typescript
// Insufficient data quality
{
  success: false,
  error: {
    operation: "analyze_formation",
    message: "Insufficient data quality (45/100). Minimum required: 60/100",
    server: "geowiz",
    persona: "Marcus Aurelius Geologicus",
    code: "INSUFFICIENT_DATA_QUALITY",
    context: {
      dataQuality: 45,
      minimumRequired: 60
    }
  }
}
```

### Error Handling Best Practices

**1. Client-Side Error Handling**
```typescript
try {
  const result = await server.callTool('analyze_formation', args);
  if (!result.success) {
    console.error(`${result.error.persona} says: ${result.error.message}`);
    // Handle specific error codes
    switch (result.error.code) {
      case 'FILE_NOT_FOUND':
        // Prompt user to check file path
        break;
      case 'INSUFFICIENT_DATA_QUALITY':
        // Suggest data improvement steps
        break;
      default:
        // Generic error handling
    }
  }
} catch (error) {
  console.error('Unexpected error:', error);
}
```

**2. Graceful Degradation**
```typescript
async function robustAnalysis(filePath: string) {
  const results = [];

  // Try comprehensive analysis first
  try {
    const result = await geowiz.callTool('analyze_formation', {
      filePath,
      analysisType: 'comprehensive'
    });
    results.push(result);
  } catch (error) {
    console.warn('Comprehensive analysis failed, trying standard...');

    // Fall back to standard analysis
    try {
      const result = await geowiz.callTool('analyze_formation', {
        filePath,
        analysisType: 'standard'
      });
      results.push(result);
    } catch (error) {
      console.warn('Standard analysis failed, trying basic...');

      // Final fallback to basic analysis
      const result = await geowiz.callTool('analyze_formation', {
        filePath,
        analysisType: 'basic'
      });
      results.push(result);
    }
  }

  return results;
}
```

---

## 📊 Performance Considerations

### Optimization Strategies

**1. File Processing**
- Use streaming for large files (>100MB)
- Implement caching for frequently accessed files
- Parallel processing for multiple files

**2. Analysis Performance**
- Cache analysis results by input hash
- Use appropriate analysis depth for use case
- Implement timeout handling for long operations

**3. Memory Management**
- Clean up temporary files automatically
- Limit concurrent analysis operations
- Monitor memory usage for large datasets

### Performance Monitoring

```typescript
// Built-in performance tracking
interface PerformanceMetrics {
  analysisId: string;
  server: string;
  operation: string;
  executionTime: number;      // milliseconds
  memoryUsage: number;        // bytes
  fileSize?: number;          // input file size
  timestamp: string;
}
```

---

## 🧪 Testing APIs

### Mock Data for Testing

SHALE YEAH provides comprehensive mock data for testing integrations:

```bash
# Available test files
data/samples/
├── demo.las          # Sample LAS well log
├── economics.xlsx    # Sample economic assumptions
├── boundaries.shp    # Sample GIS boundaries
├── production.csv    # Sample production data
└── seismic.segy     # Sample seismic data
```

### Testing Individual Servers

```typescript
// Example server test
import { GeowizServer } from '../src/servers/geowiz.js';

describe('Geowiz Server Integration', () => {
  let server: GeowizServer;

  beforeEach(async () => {
    server = new GeowizServer();
    await server.initialize();
  });

  afterEach(async () => {
    await server.cleanup();
  });

  test('should analyze formation from LAS file', async () => {
    const result = await server.callTool('analyze_formation', {
      filePath: './data/samples/demo.las',
      analysisType: 'standard'
    });

    expect(result.success).toBe(true);
    expect(result.confidence).toBeGreaterThan(0.7);
    expect(result.analysis.formations).toHaveLength.greaterThan(0);
  });
});
```

### End-to-End Testing

```typescript
// Example E2E test
import { ShaleYeahMCPClient } from '../src/mcp-client.js';

describe('Full Analysis Pipeline', () => {
  test('should complete comprehensive analysis', async () => {
    const client = new ShaleYeahMCPClient();

    const result = await client.executeAnalysis({
      runId: 'test-run',
      tractName: 'Test Tract',
      mode: 'demo',
      outputDir: './test-output'
    });

    expect(result.success).toBe(true);
    expect(result.confidence).toBeGreaterThan(0.8);
    expect(result.serverResults).toHaveLength(6);

    // Verify outputs exist
    const files = await fs.readdir('./test-output');
    expect(files).toContain('INVESTMENT_DECISION.md');
    expect(files).toContain('DETAILED_ANALYSIS.md');
    expect(files).toContain('FINANCIAL_MODEL.json');
  });
});
```

---

## 📝 TypeScript Definitions

### Core Interfaces

```typescript
// Main analysis request interface
export interface AnalysisRequest {
  runId: string;
  tractName: string;
  mode: 'demo' | 'production';
  inputFiles?: string[];
  outputDir: string;
  workflow?: string;
}

// Standard analysis result interface
export interface AnalysisResult {
  analysis: any;              // Domain-specific analysis data
  confidence: number;         // Confidence score (0.0 - 1.0)
  quality: 'Excellent' | 'Good' | 'Fair' | 'Poor';
  recommendations: string[];   // Actionable recommendations
  persona: string;            // Roman persona name
  timestamp: string;          // ISO timestamp
  executionTime: number;      // Analysis time in milliseconds
}

// Workflow result interface
export interface WorkflowResult {
  runId: string;
  success: boolean;
  confidence: number;         // Overall confidence score
  totalTime: number;          // Total execution time
  outputDir: string;
  serverResults: AnalysisResult[];
  reports: Array<{
    filename: string;
    path: string;
    type: 'executive' | 'detailed' | 'financial';
  }>;
  error?: string;
}

// MCP Server configuration
export interface MCPServerConfig {
  name: string;
  version: string;
  description: string;
  persona: {
    name: string;             // Roman persona name
    role: string;             // Professional role
    expertise: string[];      // Areas of expertise
  };
  dataPath?: string;          // Optional custom data directory
}
```

---

## 📚 Additional Resources

### Example Projects

**1. Claude Desktop Integration**
- Connect individual servers to Claude Desktop
- Interactive analysis through chat interface
- Real-time expert consultation

**2. Web Dashboard**
- React/Next.js frontend for SHALE YEAH
- Upload files and trigger analysis
- Visualize results and generate reports

**3. Batch Processing Pipeline**
- Process multiple prospects automatically
- Generate portfolio-level reports
- Email/Slack notifications on completion

---

**Need help?** Open a [GitHub Issue](https://github.com/rmcdonald/ShaleYeah/issues) or see the [Getting Started guide](./GETTING_STARTED.md).