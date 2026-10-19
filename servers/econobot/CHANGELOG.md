# Changelog — @shaleyeah/server-econobot

## [Unreleased]

- #711: one explicit versioned currency/period/source-linked cash-flow contract for all tools; residual-verified bounded IRR, honest no-solution/ambiguity/convergence/range states, literal zeros and period-end payback. Test published NPV/IRR examples and actual generic MCP responses without paid keys.
- Preserve host-configured shared `callLLM` only as separate unreviewed interpretation; provider failure cannot change numbers or authorize investment. Default CLI uses no model.
- Remove guessed prices/costs/production/investment/decline, increment-search and clipped IRR, fabricated fallback/confidence/breakeven, inferred Excel/CSV and synthetic price sensitivity. Remove the unused Excel dependency and old prompt-only anti-stub tests. Legacy tool input/output shapes are replaced; Economist adoption remains #680.

## [0.1.0] — 2026-06-04

### Added
- Initial package extraction from monorepo conversion (#385)
- Migrated from `src/servers/econobot.ts`
