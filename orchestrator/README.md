# @shaleyeah/orchestrator

> **Status: Planned — #362**

Temporal workflow engine for the ShaleYeah agent fleet. When implemented, the orchestrator will coordinate multi-agent deal workflows — scatter-gathering across all 14 domain agents, managing retries and timeouts, and assembling final reports.

## Current state

This package is a stub. The only export is:

```typescript
export const ORCHESTRATOR_VERSION = "0.1.0";
```

No business logic. See issue #362.

## When implemented

The orchestrator will replace the ad-hoc scatter-gather patterns that currently require manual agent chaining. A single workflow call will:

1. Fan out to all 14 Tier 1 domain servers in parallel
2. Collect structured results with automatic retry on `error_type: "retryable"` errors
3. Pass assembled results to the reporter server
4. Return a complete deal package

## Architecture

See `docs/ARCHITECTURE.md`.

## Related

- `ARCHITECTURE.md` — fleet topology
- Issue #362 — Temporal workflow implementation
