# SHALE YEAH - Claude Code Development Instructions

Claude Code is the dev/QA organization for SHALE YEAH's MCP-powered oil & gas investment platform.

## Architecture

**14 active MCP servers** with Roman personas in dual modes:
- **Demo** (`npm run demo`) - Mock data, $0 cost, ~6s execution
- **Production** (`npm run prod`) - Real data + Anthropic API

**Core Servers:** `geowiz`, `econobot`, `curve-smith`, `decision`, `reporter`, `risk-analysis`, `research`
**Support:** `legal`, `market`, `title`, `development`, `drilling`, `infrastructure`, `test`

All inherit `MCPServer` (`src/shared/mcp-server.ts`) with file processing, personas, tools, validation.

## Development

**Setup:** `npm install --legacy-peer-deps && npm run build && npm run demo`

**Key Commands:**
- `npm run demo` - 6s full system test
- `npm run server:geowiz` - Test individual server (all 14 available)
- `npm run prod -- --files="*.las,*.xlsx"` - Production analysis
- `npm run test` - Complete test suite

**File Processing:** LAS, Excel/CSV, GIS, SEGY via `FileIntegrationManager` with quality scoring.

## Standards

**TypeScript:** Strict mode, no `any`, explicit interfaces, async/await, Zod validation
**MCP Pattern:** Inherit `MCPServer`, Roman persona, `registerTool()`, standardized errors
**Files:** `src/servers/` (14 MCP), `src/shared/` (base classes), `docs/` (maintained)

## Quality Assurance

**Pre-commit:** `npm run build && npm run type-check && npm run lint && npm run test && npm run demo`
**Tests:** Demo integration, file processing, MCP infrastructure, domain servers, cross-server coordination

## Modes

**Demo:** Mock data, no API keys, 6s execution, perfect for dev/presentations (`ShaleYeahMCPDemo`)
**Production:** Real files + `ANTHROPIC_API_KEY`, variable time, investment decisions (`ShaleYeahMCPClient`)

## Key Files

- `src/main.ts` - Production CLI
- `src/demo-runner.ts` - Demo orchestration
- `src/mcp-client.ts` - Server coordination
- `src/shared/mcp-server.ts` - Base class
- `docs/` - Documentation

---

**Focus:** Prioritize demo mode, use comprehensive tests, leverage MCP architecture for new capabilities.

*Generated with SHALE YEAH 2025 Ryan McDonald / Ascendvent LLC - Apache-2.0*