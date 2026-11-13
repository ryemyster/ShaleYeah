# Changelog — Reporter employee

## [Unreleased]

- #722: pin the shared MCP 2026-07-28 profile and maintained client dependencies; preserve existing role/source/review behavior and migrate direct protocol fixtures and standalone checks.

### Changed

- #541: native ADK/Python Reporter uses installable employee context/provider/MCP/review helpers, explicit BYO profiles and independently configurable role evaluations. Its own source-backed context survives restart; exact human review and current source rights govern private publication.
- #541: clean source, wheel and npm exports with locked dependencies, external compatible MCP peer, separate container recipes and required CI controls. Initial judgments are research fixtures; live/domain quality and final human acceptance remain separate.

### Removed

- #541: displaced TypeScript loop, private MCP client, npm/config surfaces and their tests from #441. Native ADK and the shared protocol client now own those paths.
