# SHALE YEAH - Claude Code Development Instructions

Claude Code serves as the complete development and QA organization for SHALE YEAH, an MCP-powered oil & gas investment analysis platform.

## Architecture Overview

SHALE YEAH implements **14 active MCP servers** with Roman Imperial personas, operating in two modes:

- **Demo Mode** (`npm run demo`) - Realistic mock data, no API costs, ~6 seconds execution
- **Production Mode** (`npm run prod`) - Real data processing, live AI analysis via Anthropic API

### MCP Server Architecture

**Core MCP Servers:**
- `geowiz` (Marcus Aurelius Geologicus) - Geological analysis, LAS parsing, GIS processing
- `econobot` (Caesar Augustus Economicus) - Economic modeling, Excel/CSV processing, NPV/IRR
- `curve-smith` (Lucius Technicus Engineer) - Decline curves, SEGY processing, EUR estimates
- `decision` (Augustus Decidius Maximus) - Investment decisions, bid strategy
- `reporter` (Scriptor Reporticus Maximus) - Executive reports, data synthesis
- `risk-analysis` (Gaius Probabilis Assessor) - Risk assessment, Monte Carlo simulation
- `research` (Scientius Researchicus) - Market intelligence, competitive analysis

**Supporting Servers:**
- `legal`, `market`, `title`, `development`, `drilling`, `infrastructure`, `test`

All servers inherit from `MCPServer` base class in `src/shared/mcp-server.ts` with standardized:
- File processing via `FileIntegrationManager`
- Roman Imperial personas with domain expertise
- Tool and resource registration
- Error handling and validation

## Development Workflow

### Quick Start
```bash
npm install --legacy-peer-deps
npm run build && npm run type-check && npm run lint
npm run demo  # Verify complete system works
```

### Development Commands
```bash
# Core development
npm run build        # TypeScript compilation
npm run type-check   # Type checking only
npm run lint         # Biome linting
npm run demo         # Full demo in ~6 seconds

# Individual server testing
npm run server:geowiz      # Test geology server
npm run server:econobot    # Test economics server
npm run server:decision    # Test decision server
# ... all 14 servers available

# Analysis modes
npm run demo               # Demo with mock data
npm run prod              # Production with real data
npm run start -- --mode=batch     # Batch processing
npm run start -- --mode=research  # Research mode
```

### File Processing Capabilities

**Production-Ready Formats:**
- **LAS Files** - Well log parsing with quality control (`LASParser`)
- **Excel/CSV** - Economic data extraction (`ExcelParser`)
- **GIS Data** - Shapefiles, GeoJSON, KML processing (`GISParser`)
- **SEGY Seismic** - Seismic data processing (`SEGYParser`)

All parsers return standardized `ParseResult` with success/error states, confidence scoring, and metadata.

## Code Standards

### TypeScript Requirements
- Strict mode enabled, no `any` types
- Explicit interfaces for all data structures
- Async/await for all operations
- Zod schemas for validation

### MCP Server Pattern
```typescript
export class ExampleServer extends MCPServer {
  constructor() {
    super({
      name: 'example',
      version: '1.0.0',
      description: 'Example MCP Server',
      persona: {
        name: 'Roman Name',
        role: 'Professional Role',
        expertise: ['Domain1', 'Domain2']
      }
    });
  }

  protected setupCapabilities(): void {
    this.registerTool({
      name: 'analyze_data',
      description: 'Analyze input data',
      inputSchema: z.object({
        filePath: z.string(),
        analysisType: z.enum(['basic', 'standard', 'comprehensive'])
      }),
      handler: async (args) => this.performAnalysis(args)
    });
  }
}
```

### Error Handling
All servers use standardized error responses:
```typescript
protected formatError(operation: string, error: any): any {
  return {
    success: false,
    error: {
      operation,
      message: String(error),
      server: this.config.name,
      persona: this.config.persona.name,
      timestamp: new Date().toISOString()
    }
  };
}
```

## Testing Strategy

### Comprehensive Test Suite
```bash
npm run test  # Runs all tests sequentially:
# - Demo integration test
# - File format processing tests
# - MCP server infrastructure tests
# - Domain server functionality tests
# - Final integration validation
```

### Individual Test Categories
- **Demo Test** - Verifies complete workflow end-to-end
- **File Processing** - Tests all parsers with real sample files
- **MCP Infrastructure** - Validates server lifecycle and communication
- **Domain Servers** - Tests individual server capabilities
- **Integration** - Cross-server coordination validation

## Quality Assurance

### Pre-Commit Requirements
```bash
npm run build      # Must compile without errors
npm run type-check # Must pass strict TypeScript checking
npm run lint       # Must pass Biome linting
npm run test       # All tests must pass
npm run demo       # Demo must complete successfully
```

### File Structure Validation
- `src/servers/` - All 14 MCP servers with consistent patterns
- `src/shared/` - Common utilities, base classes, parsers
- `docs/` - Comprehensive documentation maintained
- `outputs/` - Auto-generated analysis results (gitignored)

## Demo vs Production

### Demo Mode (Default Development)
- Uses `ShaleYeahMCPDemo` class with mock data
- No API keys required, $0 cost
- Complete analysis in ~6 seconds
- Professional reports generated
- Perfect for development and presentations

### Production Mode
- Uses `ShaleYeahMCPClient` with real data processing
- Requires `ANTHROPIC_API_KEY` environment variable
- Processes real LAS, Excel, GIS, SEGY files
- Variable execution time based on data complexity
- Used for actual investment decisions

## Key Files & Locations

- `src/main.ts` - Production entry point with CLI
- `src/demo-runner.ts` - Demo mode orchestration
- `src/mcp-client.ts` - MCP client for server coordination
- `src/shared/mcp-server.ts` - Base class for all servers
- `src/shared/file-integration.ts` - File processing manager
- `package.json` - All npm scripts and dependencies
- `docs/` - Complete documentation suite

## Deployment Commands

```bash
# Development workflow
npm run demo                    # Quick validation
npm run server:geowiz          # Test individual server

# Production deployment
npm run prod -- --files="data/wells/*.las,data/economics/*.xlsx" --tract="Prospect Name"

# Batch processing
npm run start -- --mode=batch --workflow="workflows/portfolio.yaml"
```

## Workspace Management

```bash
npm run clean              # Standard cleanup
npm run clean:outputs     # Remove generated outputs
npm run clean:workspace   # Intelligent workspace cleanup
npm run clean:all         # Nuclear option (requires reinstall)
```

---

**Development Focus:** Claude Code should prioritize demo mode for rapid development, use the comprehensive test suite for quality assurance, and leverage the MCP architecture for adding new analysis capabilities. All servers follow consistent patterns and provide production-ready file processing.

*Generated with SHALE YEAH 2025 Ryan McDonald / Ascendvent LLC - Apache-2.0*