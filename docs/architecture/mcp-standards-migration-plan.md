# MCP Standards Migration Plan

> **STATUS**: IN PROGRESS - Phase 2 Active  
> **Started**: August 20, 2025  
> **Current Task**: Installing official MCP TypeScript SDK  

## 🎯 Mission

Migrate SHALE YEAH from custom "MCP-like" implementation to standards-compliant Model Context Protocol (MCP) using official Anthropic SDKs, while simultaneously simplifying the architecture.

## 📋 Phase 1: Research & Analysis ✅ COMPLETED

### Key Findings:
- ❌ **We're not using real MCP** - We created a custom protocol we named "MCP"
- ❌ **No JSON-RPC 2.0 compliance** - Breaking core MCP requirement
- ❌ **Missing official SDKs** - Using custom implementation instead
- ❌ **No interoperability** - Can't connect to Claude Desktop or other MCP clients
- ❌ **Missing standard primitives** - Only have resources, missing tools/prompts
- ❌ **No protocol versioning** - Missing required `2025-06-18` version negotiation

### Current Architecture Issues:
```
❌ CURRENT: YAML Configs → Custom MCP Controller → Custom Resource Server → Agents
✅ SHOULD BE: MCP Client (Host) ↔ JSON-RPC 2.0 ↔ MCP Server(s) → Tools/Resources/Prompts
```

## 📋 Phase 2: Fix MCP Implementation to Standards 🔄 IN PROGRESS

### Task Checklist:

#### 2.1 Install & Setup Official MCP SDK ✅ COMPLETED
- [x] Install `@modelcontextprotocol/sdk@1.17.3` 
- [x] Verify Server/Client imports working
- [x] Test basic SDK functionality

#### 2.2 Replace Custom MCP Implementation 🔄 CURRENT TASK
- [ ] Replace `src/shared/mcp-types.ts` with official types
- [ ] Replace `src/shared/mcp-resource-server.ts` with official Server
- [ ] Update `src/mcp-controller-v2.ts` to use official Client
- [ ] Implement JSON-RPC 2.0 compliance
- [ ] Add protocol version negotiation (`2025-06-18`)

#### 2.3 Implement Proper MCP Servers
- [ ] Create geology MCP server (`src/mcp-servers/geology.ts`)
- [ ] Create economics MCP server (`src/mcp-servers/economics.ts`) 
- [ ] Create reporting MCP server (`src/mcp-servers/reporting.ts`)
- [ ] Implement all 3 MCP primitives: Tools, Resources, Prompts
- [ ] Add proper error handling and logging

#### 2.4 Update Agent Architecture
- [ ] Convert agents to MCP clients connecting to domain servers
- [ ] Replace custom resource URIs with standard MCP patterns
- [ ] Implement proper tool calling and prompt templates
- [ ] Update YAML configs to reference MCP servers

## 📋 Phase 3: Architecture Simplification

### Task Checklist:

#### 3.1 Eliminate `src/agents/` Directory
- [ ] Convert `src/agents/geowiz.ts` logic to MCP geology server tools
- [ ] Convert `src/agents/reporter.ts` logic to MCP reporting server tools
- [ ] Move LLM instructions to MCP prompt templates
- [ ] Remove TypeScript agent files entirely

#### 3.2 Consolidate Directory Structure
- [ ] Remove development-only files from `scripts/`
- [ ] Move essential scripts to npm scripts in `package.json`
- [ ] Eliminate `pipelines/` directory
- [ ] Use pure MCP event coordination instead of explicit pipelines

#### 3.3 Unified YAML → MCP Architecture
- [ ] Update YAML configs to define MCP server connections
- [ ] Create generic MCP client orchestrator
- [ ] Remove custom execution engines
- [ ] Use standard MCP patterns throughout

## 📋 Phase 4: Documentation & Testing

### Task Checklist:

#### 4.1 Update Documentation
- [ ] Update README with standards-compliant MCP architecture
- [ ] Remove references to custom "MCP" implementation
- [ ] Add interoperability section (Claude Desktop compatibility)
- [ ] Document MCP server creation guide

#### 4.2 Testing & Validation
- [ ] Test MCP servers with official MCP clients
- [ ] Validate JSON-RPC 2.0 compliance
- [ ] Test Claude Desktop integration
- [ ] Performance benchmarking vs old system

#### 4.3 Final Architecture Validation
- [ ] Confirm all 20 YAML configs work with new system
- [ ] Validate Roman persona consistency
- [ ] Test end-to-end pipeline execution
- [ ] Document migration benefits

## 🎯 Target Architecture

### Final State:
```
📁 STANDARDS-COMPLIANT SHALE YEAH
├── .claude/agents/*.yaml          # Agent configs pointing to MCP servers
├── src/
│   ├── mcp-servers/               # Domain-specific MCP servers
│   │   ├── geology.ts             # Tools: parse-las, analyze-formations
│   │   ├── economics.ts           # Tools: dcf-analysis, risk-modeling  
│   │   └── reporting.ts           # Tools: generate-reports, synthesis
│   ├── mcp-client.ts              # Main orchestrator using official Client
│   └── shared/                    # DRY utilities (keep existing)
├── tools/                         # Generic tools called by MCP servers
└── data/                          # Input/output data
```

### Benefits of Final Architecture:
- ✅ **Standards Compliant**: Real MCP with JSON-RPC 2.0
- ✅ **Interoperable**: Works with Claude Desktop and other MCP clients
- ✅ **Simplified**: Single-layer architecture via MCP servers
- ✅ **Maintainable**: All logic in MCP tools/resources/prompts
- ✅ **Scalable**: Add agents by creating MCP servers

## 🔍 Current Status Details

### ✅ Completed:
1. MCP best practices research and gap analysis
2. Official MCP TypeScript SDK installation (`@modelcontextprotocol/sdk@1.17.3`)
3. SDK import verification - Server/Client classes accessible
4. Identified specific files needing replacement

### 🔄 Currently Working On:
- **Task**: Replace custom MCP types and resource server with official SDK
- **Files**: `src/shared/mcp-types.ts`, `src/shared/mcp-resource-server.ts`
- **Next**: Update `src/mcp-controller-v2.ts` to use official Client

### 📦 Key Dependencies Installed:
- `@modelcontextprotocol/sdk@1.17.3` - Official MCP SDK
- Verified imports: `Server`, `Client` classes available
- Package exports: server, client, shared types

## ⚠️ Important Notes

1. **Breaking Changes**: This migration will require updating all MCP-related code
2. **Testing Required**: Need to validate with real MCP clients after migration
3. **Rollback Plan**: Keep current implementation in separate branch until validated
4. **Documentation**: Update all references from "custom MCP" to "standards MCP"

## 🔗 References

- [Official MCP Specification](https://modelcontextprotocol.io/specification)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [Anthropic MCP Announcement](https://www.anthropic.com/news/model-context-protocol)
- [Current Protocol Version: 2025-06-18](https://spec.modelcontextprotocol.io/)

---

**Last Updated**: August 20, 2025  
**Next Checkpoint**: After completing Phase 2.2 (Replace Custom MCP Implementation)