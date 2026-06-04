# Changelog — @shaleyeah/sdk

All notable changes to this package.

## [Unreleased]

## [0.1.0] — 2026-06-04

### Added
- Initial package extraction from monorepo conversion (#385)
- `MCPServer` base class (from `src/shared/mcp-server.ts`)
- `LLMClient` shared Anthropic SDK wrapper (from `src/shared/llm-client.ts`)
- `ServerFactory` bootstrap helper (from `src/shared/server-factory.ts`)
- `AgentManifest`, `AgentRuntime`, `AgentService` contracts (from `src/agents/`)
- `FileIntegrationManager`, `FileFormatDetector`, `FileUtils` (from `src/shared/`)
- Parser suite: LAS, Excel, GIS, SEGY (from `src/shared/parsers/`)
- Domain types: geological, economic, risk, market, investment (from `src/shared/types.ts`)
