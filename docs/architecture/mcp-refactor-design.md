# MCP Architecture Refactor Design

## 🚨 Current Problem

The existing MCP implementation violates proper MCP patterns by **pushing data to agents** in a linear orchestration style:

```typescript
// ❌ WRONG: MCP Controller pushes data
mcp.executeAgent(agent1, data);  // Sequential push
mcp.executeAgent(agent2, data);  // Sequential push
```

## ✅ Correct MCP Architecture

MCP (Model Context Protocol) should expose **resources** that agents **pull** from on-demand:

```typescript
// ✅ RIGHT: Agents pull from MCP resources
agent1.pullResource('mcp://shale-data/las-files');
agent2.pullResource('mcp://shale-data/geology-summary');
```

## 🏗️ New Resource-Based Design

### 1. MCP Resource Server

```typescript
interface MCPResourceServer {
  // Resource discovery
  listResources(): Promise<MCPResource[]>;
  
  // Resource access
  getResource(uri: string): Promise<any>;
  putResource(uri: string, data: any): Promise<void>;
  watchResource(uri: string): AsyncIterator<any>;
  
  // Resource metadata
  getResourceMeta(uri: string): Promise<MCPResourceMeta>;
}
```

### 2. Resource URIs

```
mcp://shale-data/inputs/las-files/**
mcp://shale-data/inputs/access-db/**
mcp://shale-data/outputs/geology-summary
mcp://shale-data/outputs/zones.geojson
mcp://shale-data/outputs/curves/**
mcp://shale-data/outputs/report.md
mcp://shale-data/state/pipeline-status
mcp://shale-data/config/run-settings
```

### 3. Agent Resource Dependencies

```yaml
# .claude/agents/geowiz.yaml
name: geowiz
persona:
  name: "Dr. Sarah Chen"
  role: "Senior Petroleum Geologist"
  
resources:
  inputs:
    - uri: "mcp://shale-data/inputs/las-files/**"
      required: true
    - uri: "mcp://shale-data/inputs/access-db/**" 
      required: false
      
  outputs:
    - uri: "mcp://shale-data/outputs/geology-summary"
      format: "markdown"
    - uri: "mcp://shale-data/outputs/zones.geojson"
      format: "geojson"
      
dependencies:
  - resource: "mcp://shale-data/inputs/las-files/**"
    condition: "exists"
```

### 4. Pipeline State Machine

```typescript
enum PipelineState {
  WAITING_FOR_INPUTS = "waiting_for_inputs",
  AGENTS_READY = "agents_ready", 
  PROCESSING = "processing",
  OUTPUTS_AVAILABLE = "outputs_available",
  COMPLETED = "completed",
  FAILED = "failed"
}

interface PipelineStateManager {
  getCurrentState(): PipelineState;
  getReadyAgents(): Promise<string[]>;
  markResourceReady(uri: string): Promise<void>;
  waitForResource(uri: string): Promise<any>;
}
```

## 🔄 Resource-Based Workflow

### Phase 1: Resource Discovery
```typescript
// Agent checks what resources are available
const availableResources = await mcp.listResources();
const myInputs = availableResources.filter(r => 
  agent.resourceDependencies.includes(r.uri)
);
```

### Phase 2: Dependency Resolution  
```typescript
// Agent waits for required resources
for (const dep of agent.dependencies) {
  if (dep.condition === "exists") {
    await mcp.waitForResource(dep.resource);
  }
}
```

### Phase 3: Resource Processing
```typescript
// Agent pulls data when ready
const lasFiles = await mcp.getResource('mcp://shale-data/inputs/las-files/**');
const analysis = await agent.analyze(lasFiles);
```

### Phase 4: Output Publishing
```typescript
// Agent publishes results as new resources
await mcp.putResource('mcp://shale-data/outputs/geology-summary', analysis);
await mcp.markResourceReady('mcp://shale-data/outputs/geology-summary');
```

## 🚀 Implementation Plan

### Step 1: MCP Resource Server
- Create `MCPResourceServer` class
- Implement file-based resource backend
- Add resource URI routing
- Resource watching/notifications

### Step 2: Agent Resource Interface
- Add `MCPResourceClient` to `BaseAgent`
- Replace direct file I/O with resource calls
- Add dependency checking logic
- Resource-based initialization

### Step 3: Pipeline State Manager
- Track resource availability
- Agent readiness detection
- Event-driven orchestration
- Deadlock detection

### Step 4: Agent YAML Updates
- Add `resources` section to agent configs
- Define input/output resource URIs
- Specify dependency conditions
- Resource format metadata

## 🎯 Benefits

1. **True MCP Compliance**: Follows Model Context Protocol patterns
2. **Loose Coupling**: Agents don't know about each other directly
3. **Parallel Execution**: Multiple agents can work simultaneously
4. **Resource Caching**: Expensive operations cached by URI
5. **Dynamic Discovery**: Agents discover available resources at runtime
6. **Event-Driven**: State changes trigger agent activation
7. **Failure Isolation**: One agent failure doesn't block others

## 📋 Migration Path

1. Keep existing orchestration as fallback
2. Add MCP resource layer alongside
3. Migrate agents one by one to resources
4. Remove old orchestration when complete
5. Add advanced MCP features (subscriptions, etc.)

## 🧪 Testing Strategy

- Unit tests for resource server
- Integration tests for agent resource access
- End-to-end pipeline tests
- Performance comparison with old system
- Resource dependency edge cases

---

This design transforms the ShaleYeah system from a **sequential orchestration** into a proper **resource-based MCP architecture** that scales horizontally and follows protocol standards.