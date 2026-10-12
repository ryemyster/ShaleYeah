# Changelog — @shaleyeah/server-geowiz

## [Unreleased]

- #574: the protected local launcher's fixture gets a separate ten-second cold-start budget within a twenty-second test deadline. CI exceeded its old five-second startup limit under parallel workspace load; access/secret assertions and runtime request/audit policy are preserved.

- #574: forwards trusted event bindings and loads optional private eventConfigFile in the HTTP launcher. Actual native two-provider tests join client/backend event IDs and verified source hashes. Access/source audit remains separate; reference MCP operational stdout/raw exception logging is displaced by shared SDK behavior.


- #667: split shared-file and symlink credential-refusal launcher controls into independent cases, preserving each ten-second startup deadline and every exit/redaction/no-listener assertion. This prevents a combined cold-start fixture budget from canceling successful security controls under workspace CI load; runtime access policy is unchanged.

- #670: routed file-based MCP calls through installed source adapters, server-owned current grants, durable audit and private exact-byte snapshots. Emit canonical sourceArtifact provenance; remove displaced MCP outputPath writes/ad hoc file metadata. Add source fetch/health, private bootstrap, revocation and actual protected-consumer controls. Non-LAS handlers now explicitly decline unsupported formats; domain helper repairs remain #671.

### Changed
- #669: explicit Gemini/Anthropic profiles across Geologist reasoning and Geowiz formation synthesis, private credentials, capability/limit checks, provider receipts and independent judge configuration. Remove reference vendor defaults and fabricated synthesis fallback; offline native ADK/MCP conformance preserves role tools and save confirmation.

### Documentation

- #679: linked the installed credential-aware Python employee client and actual protected-Geowiz controls. Transport success does not qualify fixed quality metrics, source rights or backend review.

### Added

- **Configured HTTP access reference** (#678) — added the private credential/policy/audit local launcher, restricted sample read scopes and real external-client backend checks. Factory injection uses the shared SDK ingress boundary; removed anonymous HTTP and retired TypeScript employee connection instructions. Actual data-quality metrics, source rights, protected review and live employee/issuer/TLS qualification remain with their owners.

### Changed

- **Deployment documentation** (#578) — replaced unbuilt Docker/Compose/Kong production examples with current workspace build/start/health commands, actual config/storage and planned extraction/identity/state gates. Corrected the retired employee command, health server version and stateless/256MB/unsupported environment claims. No tool runtime change.

## [0.1.0] — 2026-06-04

### Added
- Initial package extraction from monorepo conversion (#385)
- Migrated from `src/servers/geowiz.ts`
