# Configure model providers for Geologist and Geowiz

A model provider supplies the AI that reasons or writes an analysis. Its key
does not grant permission to read a source, save a finding or approve geology.
Geologist uses Google's Agent Development Kit (ADK). Geowiz remains a separate
Model Context Protocol (MCP) tool server. The production bindings must select
the same provider; they can use different fixed models and dedicated keys.
An optional evaluation judge has a separate profile and credential reference.

## Supported capabilities

| Binding | Gemini | Anthropic |
| --- | --- | --- |
| ADK reasoning and function calls | Native ADK Gemini | Native ADK AnthropicLlm, direct API |
| ADK response schema | Supported when declared | Rejected by this pinned ADK adapter |
| Geowiz structured synthesis | Native JSON schema | Forced `submit_result` tool with schema, validated locally |
| Default, failover or ambient credential | None | None |

Approved endpoints are `https://generativelanguage.googleapis.com` and
`https://api.anthropic.com`. Custom proxies, Vertex credentials and other vendors
need a separately tested adapter. Unsupported configuration fails explicitly.
Moving `latest` aliases are rejected. Receipts include configured model ID,
declared revision, profile revision, adapter version and provider-reported model
version. An unavailable reported version stays unavailable. A declared revision
does not prove that a provider's alias is immutable.

Locked Python adapters: ADK 2.4.0, google-genai 2.11.0 and anthropic 1.13.0.
Node adapters: @google/genai 2.28.0 and @anthropic-ai/sdk 0.104.1.
Provider or adapter changes require conformance and role regressions before
promotion; real model and domain quality require separate evaluations.

## Create a private configuration

1. Create an agent key file, synthesis key file and `models.json` outside the
   repository. Make them owned private regular files with permissions `0600`;
   protect the parent directory too. Symlinks and shared files are rejected.
2. Start with the following structure. Replace model/revision placeholders with
   your approved IDs and qualification revisions. References name files and
   never contain key values. Agent and synthesis use dedicated references.
3. Retain the same customer, employee and provider for production. Set `judge`
   to `null` until a separately owned judge profile is configured.

```json
{
  "version": "0.1.0",
  "agent": {
    "version": "0.1.0", "id": "geologist-agent", "revision": "qualified-r1",
    "purpose": "agent",
    "owner": { "customerId": "your-customer", "employeeId": "geologist" },
    "provider": "gemini", "model": "your-pinned-model-id",
    "modelRevision": "your-approved-model-revision",
    "endpoint": "https://generativelanguage.googleapis.com",
    "credentialRef": "file:/absolute/private/agent-key",
    "capabilities": { "toolUse": true, "structuredOutput": true },
    "limits": { "timeoutMs": 30000, "maxAttempts": 1, "maxOutputTokens": 2048, "maxRequests": 8, "maxInputChars": 65536 }
  },
  "synthesis": {
    "version": "0.1.0", "id": "geologist-synthesis", "revision": "qualified-r1",
    "purpose": "synthesis",
    "owner": { "customerId": "your-customer", "employeeId": "geologist" },
    "provider": "gemini", "model": "your-pinned-model-id",
    "modelRevision": "your-approved-model-revision",
    "endpoint": "https://generativelanguage.googleapis.com",
    "credentialRef": "file:/absolute/private/synthesis-key",
    "capabilities": { "toolUse": true, "structuredOutput": true },
    "limits": { "timeoutMs": 30000, "maxAttempts": 1, "maxOutputTokens": 2048, "maxRequests": 2, "maxInputChars": 65536 }
  },
  "judge": null
}
```

For Anthropic, use its endpoint and approved model ID. Set the agent's
`structuredOutput` to `false` and synthesis's to `true`. A judge cannot reuse
either production credential reference. Bundled local resolvers accept `file:`;
`secret:` requires an injected owner-scoped secret-manager resolver.
The bundled file resolvers require POSIX ownership and permission checks. Other
hosts need a separately qualified secret-manager resolver.

Limits are mandatory: timeout 1–120000 ms, attempts 1–3, output tokens 1–16384,
requests 1–100 and input characters 1–262144. Native retries stay inside the
attempt limit and outer deadline. Agent counts reset per ADK invocation.
Geowiz starts a fresh synthesis budget per tool operation. These bounds do not
implement monetary quotas or token billing. Streaming output is buffered until
validation. Scoped logging suppresses native debug payloads and redacts resolved
credentials/references before emission.

## Start the two processes

Complete [MCP access setup](../servers/geowiz/docs/HTTP_ACCESS.md) first. For
formation synthesis, the operator must add `get_model_profile` and
`analyze_formation` to the tool policy and grant their explicit scopes. Match
the policy customer/employee with the synthesis profile. The sample quality
policy grants neither operation. Model setup does not grant save permission.

Add `modelConfigFile` with the absolute `models.json` path to Geowiz's private
HTTP access JSON, then use its `pnpm start:http` launcher. For a stdio child,
set `GEOWIZ_MODEL_CONFIG_FILE` to that file and use `pnpm start`. Startup and
deterministic tools work without a model key; synthesis requires one.

From `agents/geologist`:

```bash
GEOLOGIST_MODEL_CONFIG_FILE=/absolute/private/models.json \
GEOWIZ_MCP_URL=http://127.0.0.1:3001/mcp \
GEOWIZ_MCP_ACCESS_TOKEN_FILE=/absolute/private/mcp-token \
agents-cli run "Analyze the approved LAS artifact without saving the result"
```

The agent discovers Geowiz's public effective profile before synthesis and
checks it against its expected binding. A mismatch stops dispatch. This check
cannot choose another key or grant scopes. Geowiz checks authenticated ownership
and keeps the injected runtime private to its server instance.

`GEOLOGIST_ADK_MODEL`, `GOOGLE_API_KEY`, `GEMINI_API_KEY` and
`ANTHROPIC_API_KEY` do not configure this reference. Missing configuration/key,
invalid output and provider failures return explicit errors. Geowiz no longer
invents replacement TOC or drilling recommendations on these failures. Other
parser estimates and source limitations still need #671.

## Verify without paid requests

Build SDK and Geowiz, then run from `agents/geologist`:

```bash
GEOLOGIST_PROVIDER_TRACE_DIR=/tmp/geologist-provider-traces \
uv run --locked pytest -q --cov=app --cov-fail-under=90
agents-cli eval grade --traces /tmp/geologist-provider-traces \
  --output /tmp/geologist-provider-grades --config tests/eval/eval_config.yaml \
  --metrics geologist_tool_boundary,geologist_architecture_boundary,geologist_no_unapproved_persistence
```

Native SDK/ADK calls run against explicit offline transports. Formation controls
use actual protected Geowiz. Other role controls use a fixture MCP client to
check mappings and save confirmation. Traces contain generated runtime events;
grading checks plumbing and policy, including a proposed save paused before
dispatch. These fixtures do not qualify real model choices, geological accuracy,
source rights, durable review or investment decisions. The LLM final-response
judge is excluded from this offline command. Its configured live runner and
promotion rules are #666/#667/#577; live runs require explicit opt-in.
