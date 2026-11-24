---
name: Bug Report
about: Report a bug in SHALE YEAH
title: "[Bug] "
labels: bug
assignees: ""
---

## Description

A clear description of the bug.

## Steps to Reproduce

1. Run `npm run demo` (or relevant command)
2. ...
3. See error

## Expected Behavior

What you expected to happen.

## Actual Behavior

What actually happened. Include error messages or logs.

## Role / Input / Contract Checklist

- **Persona / role**: Which organizational role owns this? (e.g., geologist, economist, title analyst)
- **Area of concern**: Which agent, MCP server, or orchestrator workflow is affected?
- **Required inputs**: Documents, datasets, assumptions, deal metadata, files, user context.
- **Optional inputs**: APIs, proprietary databases, market data, maps, benchmarks, public datasets.
- **Input formats**: LAS, GIS, Excel, PDF, Access, ARIES, WITSML, JSON, API payloads, etc.
- **Data quality**: Required fields, freshness, provenance/source, confidence, limitations.
- **Secrets/auth**: API keys, file access, database credentials, MCP auth, vendor access.
- **Boundary**: What belongs in MCP tools vs ADK agent reasoning/context?
- **Memory/vector use**: Prior runs, reviewed knowledge, embedded docs, operator feedback.
- **HITL/security**: Approvals, missing-data waivers, assumptions, write/destructive actions, memory promotion.
- **Evals/guardrails**: Build-time evals, runtime checks, pass/warn/block/escalate behavior.
- **Downstream consumers**: Which agents, reports, or orchestrator workflows consume this output?
- **Scope class**: v1 required / v1 optional / later-enterprise.

## Environment

- **Node.js version**: (e.g., 18.17.0)
- **OS**: (e.g., macOS 14, Ubuntu 22.04)
- **SHALE YEAH version**: (from `package.json`)
- **Mode**: Demo / Production

## Additional Context

Any other relevant information (screenshots, log snippets, etc.).
