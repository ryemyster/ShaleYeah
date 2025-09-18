# Development Guide

This guide covers everything contributors need to know about developing SHALE YEAH.

## Development Environment Setup

### Prerequisites
- **Node.js 18+** with npm
- **Git** for version control
- **VS Code** (recommended) with TypeScript extension
- **Basic understanding** of TypeScript and async programming

### Initial Setup
```bash
git clone https://github.com/your-org/ShaleYeah.git
cd ShaleYeah
npm install
npm run build      # Verify everything compiles
npm run demo       # Verify demo works
```

## Development Workflow

### 1. Understanding the Codebase

**Start here for new contributors:**

1. **Run the demo**: `npm run demo` - See the system in action
2. **Read the demo code**: `src/demo-runner.ts` - Understand the flow
3. **Explore an agent**: `src/servers/geowiz.ts` - See how agents work
4. **Check the base class**: `src/shared/mcp-server.ts` - Understand the foundation

### 2. Code Organization

```
src/
├── servers/           # 🤖 14 AI Expert Agents
│   ├── geowiz.ts     # Geological analysis expert
│   ├── econobot.ts   # Economic analysis expert
│   └── ...           # 12 more domain experts
├── shared/           # 🔧 Common utilities
│   ├── mcp-server.ts # Base class for all agents
│   ├── file-integration.ts # File processing manager
│   └── parsers/      # Industry format parsers
├── demo-runner.ts    # 🎬 Demo orchestration
└── main.ts          # 🚀 Production entry point
```

### 3. Development Commands

```bash
# Development
npm run dev          # Development mode with hot reload
npm run build        # Compile TypeScript
npm run type-check   # Type checking only
npm run lint         # Code quality checks

# Testing
npm run demo         # Run complete demo
npm run test         # Run test suite
npm run server:geowiz # Test individual agent

# Cleanup
npm run clean        # Clean build artifacts
npm run clean:all    # Nuclear option - clean everything
```

## Common Development Tasks

### Adding a New Analysis Tool to an Existing Agent

**Example: Adding a new geological analysis feature**

1. **Find the relevant agent**: `src/servers/geowiz.ts`

2. **Add the tool in `setupCapabilities()`**:
```typescript
this.registerTool({
  name: 'analyze_porosity',
  description: 'Analyze porosity from well log data',
  inputSchema: z.object({
    filePath: z.string().describe('Path to LAS file'),
    depthRange: z.object({
      top: z.number(),
      bottom: z.number()
    }).optional()
  }),
  handler: async (args) => this.analyzePorosityData(args)
});
```

3. **Implement the analysis method**:
```typescript
private async analyzePorosityData(args: any): Promise<any> {
  console.log(`🔍 Analyzing porosity for ${args.filePath}`);

  // Parse input file
  const parseResult = await this.fileManager.parseFile(args.filePath);
  if (!parseResult.success) {
    throw new Error(`Failed to parse file: ${parseResult.errors?.join(', ')}`);
  }

  // Perform porosity analysis
  const analysis = {
    averagePorosity: 0.12,  // 12%
    porosityRange: { min: 0.08, max: 0.18 },
    qualityGrade: 'Good',
    confidence: 0.85
  };

  // Save results
  const analysisId = `porosity_${Date.now()}`;
  await this.saveResult(`analyses/${analysisId}.json`, analysis);

  return analysis;
}
```

4. **Test your new tool**:
```bash
npm run build
npm run server:geowiz  # Start the agent
# Then connect via MCP client to test the new tool
```

### Creating a New Agent

**Example: Creating a "environmental" analysis agent**

1. **Create the agent file**: `src/servers/environmental.ts`

```typescript
#!/usr/bin/env node
/**
 * Environmental MCP Server - Environmental Analysis Expert
 *
 * Natura Environmentalis - Master Environmental Strategist
 * Provides environmental impact assessment, regulatory compliance,
 * and sustainability analysis for oil & gas projects.
 */

import { MCPServer, runMCPServer, MCPTool, MCPResource } from '../shared/mcp-server.js';
import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';

export class EnvironmentalServer extends MCPServer {
  constructor() {
    super({
      name: 'environmental',
      version: '1.0.0',
      description: 'Environmental Analysis MCP Server',
      persona: {
        name: 'Natura Environmentalis',
        role: 'Master Environmental Strategist',
        expertise: [
          'Environmental impact assessment',
          'Regulatory compliance analysis',
          'Sustainability planning',
          'Carbon footprint calculation',
          'Biodiversity impact evaluation'
        ]
      }
    });
  }

  protected async setupDataDirectories(): Promise<void> {
    const dirs = ['assessments', 'compliance', 'carbon', 'biodiversity', 'reports'];
    for (const dir of dirs) {
      await fs.mkdir(path.join(this.dataPath, dir), { recursive: true });
    }
  }

  protected setupCapabilities(): void {
    this.registerTool({
      name: 'assess_environmental_impact',
      description: 'Conduct environmental impact assessment',
      inputSchema: z.object({
        projectLocation: z.string(),
        projectType: z.enum(['drilling', 'pipeline', 'facility']),
        assessmentScope: z.enum(['basic', 'comprehensive']).default('basic')
      }),
      handler: async (args) => this.assessEnvironmentalImpact(args)
    });

    this.registerResource({
      name: 'environmental_assessment',
      uri: 'environmental://assessments/{id}',
      description: 'Environmental assessment results',
      handler: async (uri) => this.getEnvironmentalAssessment(uri)
    });
  }

  private async assessEnvironmentalImpact(args: any): Promise<any> {
    console.log(`🌱 Assessing environmental impact for ${args.projectType} at ${args.projectLocation}`);

    // Environmental analysis logic here
    const assessment = {
      impactLevel: 'Moderate',
      mitigationRequired: true,
      estimatedCost: 150000,
      timelineMonths: 6,
      keyRisks: ['Water usage', 'Air quality', 'Wildlife habitat']
    };

    const assessmentId = `env_${Date.now()}`;
    await this.saveResult(`assessments/${assessmentId}.json`, assessment);
    return assessment;
  }

  private async getEnvironmentalAssessment(uri: URL): Promise<any> {
    const assessmentId = uri.pathname.split('/').pop();
    return await this.loadResult(`assessments/${assessmentId}.json`);
  }
}

// Main entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new EnvironmentalServer();
  runMCPServer(server).catch(console.error);
}
```

2. **Add to package.json**:
```json
{
  "scripts": {
    "server:environmental": "npx tsx src/servers/environmental.ts"
  }
}
```

3. **Update the demo** (optional):
Add to the agents list in `src/demo-runner.ts`:
```typescript
{ name: 'environmental', persona: 'Natura Environmentalis', domain: 'Environmental Analysis' }
```

4. **Test the new agent**:
```bash
npm run build
npm run server:environmental
```

### Adding Support for New File Formats

**Example: Adding support for PDF reports**

1. **Create a parser**: `src/shared/parsers/pdf-parser.ts`

```typescript
export class PDFParser {
  async parse(filePath: string): Promise<ParseResult> {
    try {
      // PDF parsing logic (you might use a library like pdf-parse)
      const text = await this.extractTextFromPDF(filePath);

      return {
        success: true,
        data: {
          text,
          pageCount: 10,
          extractedTables: []
        },
        metadata: {
          format: 'PDF',
          size: await this.getFileSize(filePath),
          processingTime: Date.now()
        }
      };
    } catch (error) {
      return {
        success: false,
        errors: [`PDF parsing failed: ${error}`]
      };
    }
  }

  private async extractTextFromPDF(filePath: string): Promise<string> {
    // Implementation depends on chosen PDF library
    return "Extracted text content...";
  }

  private async getFileSize(filePath: string): Promise<number> {
    const stats = await fs.stat(filePath);
    return stats.size;
  }
}
```

2. **Register in FileIntegrationManager**: `src/shared/file-integration.ts`

```typescript
import { PDFParser } from './parsers/pdf-parser.js';

export class FileIntegrationManager {
  private parsers = {
    '.las': new LASParser(),
    '.xlsx': new ExcelParser(),
    '.pdf': new PDFParser(),  // Add this line
    // ... other parsers
  };
}
```

3. **Update relevant agents** to use PDF data:
```typescript
// In any agent that needs PDF support
const parseResult = await this.fileManager.parseFile(args.pdfPath);
// Now handles PDF files automatically
```

### Modifying Report Generation

**Reports are generated by the `reporter` agent**: `src/servers/reporter.ts`

**Example: Adding a new report format**

```typescript
// In ReporterServer class
this.registerTool({
  name: 'generate_compliance_report',
  description: 'Generate regulatory compliance report',
  inputSchema: z.object({
    analysisResults: z.any(),
    jurisdiction: z.string(),
    format: z.enum(['pdf', 'word', 'html']).default('pdf')
  }),
  handler: async (args) => this.generateComplianceReport(args)
});

private async generateComplianceReport(args: any): Promise<string> {
  console.log(`📋 Generating compliance report for ${args.jurisdiction}`);

  const report = `# Regulatory Compliance Report

## Jurisdiction: ${args.jurisdiction}

## Compliance Status
✅ Environmental permits: Complete
⚠️  Safety certifications: In progress
✅ Financial bonding: Complete

## Next Steps
1. Complete safety certification process
2. Submit final documentation
3. Schedule regulatory inspection
`;

  const reportId = `compliance_${Date.now()}`;
  await this.saveResult(`reports/${reportId}.md`, report);
  return report;
}
```

## Code Style and Standards

### TypeScript Guidelines

1. **Use strict mode**: Always enabled in tsconfig.json
2. **No `any` types**: Use explicit typing or generics
3. **Async/await**: Preferred over Promises and callbacks
4. **Error handling**: Always handle errors gracefully

**Good:**
```typescript
interface GeologicalAnalysis {
  netPay: number;
  porosity: number;
  confidence: number;
}

async function analyzeFormation(data: WellLogData): Promise<GeologicalAnalysis> {
  try {
    const analysis = await performAnalysis(data);
    return analysis;
  } catch (error) {
    throw new Error(`Formation analysis failed: ${error}`);
  }
}
```

**Bad:**
```typescript
function analyzeFormation(data: any): any {
  // No error handling
  const analysis = performAnalysis(data);
  return analysis;
}
```

### Agent Development Patterns

1. **Always inherit from MCPServer**
2. **Implement both abstract methods**
3. **Use descriptive tool names**
4. **Include comprehensive error handling**
5. **Save results with timestamps**

**Template for new agents:**
```typescript
export class YourServer extends MCPServer {
  constructor() {
    super({
      name: 'your-server',
      version: '1.0.0',
      description: 'Your Server Description',
      persona: {
        name: 'Roman Persona Name',
        role: 'Roman Role Title',
        expertise: ['Area 1', 'Area 2', 'Area 3']
      }
    });
  }

  protected async setupDataDirectories(): Promise<void> {
    const dirs = ['category1', 'category2', 'reports'];
    for (const dir of dirs) {
      await fs.mkdir(path.join(this.dataPath, dir), { recursive: true });
    }
  }

  protected setupCapabilities(): void {
    // Register your tools and resources here
  }
}
```

### File Naming Conventions

- **Agents**: `kebab-case.ts` (e.g., `risk-analysis.ts`)
- **Utilities**: `kebab-case.ts` (e.g., `file-integration.ts`)
- **Interfaces**: `PascalCase` (e.g., `GeologicalAnalysis`)
- **Methods**: `camelCase` (e.g., `analyzeFormation`)
- **Constants**: `SCREAMING_SNAKE_CASE` (e.g., `DEFAULT_CONFIDENCE`)

## Testing

### Running Tests

```bash
npm run test           # Run all tests
npm run demo           # Integration test via demo
npm run server:geowiz  # Manual testing of individual agents
```

### Writing Tests

**Unit Test Example:**
```typescript
// tests/servers/geowiz.test.ts
import { GeowizServer } from '../../src/servers/geowiz.js';

describe('GeowizServer', () => {
  let server: GeowizServer;

  beforeEach(() => {
    server = new GeowizServer();
  });

  it('should initialize with correct persona', () => {
    expect(server.config.persona.name).toBe('Marcus Aurelius Geologicus');
    expect(server.config.persona.role).toBe('Master Geological Analyst');
  });

  it('should analyze formation data', async () => {
    const mockArgs = {
      filePath: 'test-data/sample.las',
      analysisType: 'standard'
    };

    // Mock file manager
    server.fileManager.parseFile = jest.fn().mockResolvedValue({
      success: true,
      data: { curves: ['GR', 'NPHI', 'RHOB'] }
    });

    const result = await server.analyzeFormation(mockArgs);

    expect(result.confidence).toBeGreaterThan(0);
    expect(result.formations).toBeInstanceOf(Array);
  });
});
```

### Integration Testing

**Test the demo end-to-end:**
```typescript
// tests/integration/demo.test.ts
import { ShaleYeahDemo } from '../../src/demo-runner.js';

describe('Demo Integration', () => {
  it('should complete full analysis workflow', async () => {
    const config = {
      runId: 'test-run',
      outDir: './test-output',
      tractName: 'Test Tract',
      mode: 'demo' as const
    };

    const demo = new ShaleYeahDemo(config);

    // Should complete without errors
    await expect(demo.runCompleteDemo()).resolves.not.toThrow();

    // Should generate expected files
    const files = await fs.readdir('./test-output');
    expect(files).toContain('INVESTMENT_DECISION.md');
    expect(files).toContain('DETAILED_ANALYSIS.md');
    expect(files).toContain('FINANCIAL_MODEL.json');
  });
});
```

## Debugging

### Development Tools

1. **VS Code Debugger**: Set breakpoints in TypeScript
2. **Console Logging**: Each agent logs progress extensively
3. **File Output**: All results saved to `data/` directories
4. **Error Tracking**: Structured error responses with context

### Common Issues

**Problem**: "Cannot find module" errors
```bash
# Solution: Ensure proper TypeScript compilation
npm run build
```

**Problem**: "Port already in use" for MCP servers
```bash
# Solution: Kill existing server processes
ps aux | grep tsx
kill [process-id]
```

**Problem**: File parsing failures
```bash
# Solution: Check file format and path
console.log(`Parsing file: ${filePath}`);
console.log(`File exists: ${await fs.access(filePath)}`);
```

### Debug Configuration

**VS Code launch.json:**
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Demo",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/src/demo-runner.ts",
      "runtimeArgs": ["-r", "tsx/cjs"],
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen",
      "skipFiles": ["<node_internals>/**"]
    },
    {
      "name": "Debug Geowiz Server",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/src/servers/geowiz.ts",
      "runtimeArgs": ["-r", "tsx/cjs"],
      "console": "integratedTerminal"
    }
  ]
}
```

## Contributing Guidelines

### Before Submitting a PR

1. **Run all checks**:
```bash
npm run build      # Must pass
npm run type-check # Must pass
npm run lint       # Must pass
npm run demo       # Must complete successfully
```

2. **Test your changes**:
- Add unit tests for new functionality
- Test with the demo if relevant
- Verify individual agents work if modified

3. **Documentation**:
- Update relevant docs in `/docs`
- Add code comments for complex logic
- Update README if adding new features

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] All existing tests pass
- [ ] New tests added for new functionality
- [ ] Demo runs successfully
- [ ] Manual testing completed

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No secrets or sensitive data added
```

### Code Review Process

1. **Automated Checks**: TypeScript, linting, tests must pass
2. **Peer Review**: At least one maintainer review required
3. **Demo Verification**: Reviewer runs demo to verify changes
4. **Documentation Review**: Ensure docs are updated appropriately

## Release Process

### Version Management

SHALE YEAH follows semantic versioning:
- **Major** (1.0.0): Breaking changes
- **Minor** (0.1.0): New features, backward compatible
- **Patch** (0.0.1): Bug fixes, backward compatible

### Release Checklist

1. **Update version** in `package.json`
2. **Update CHANGELOG.md** with release notes
3. **Run full test suite**: `npm run test`
4. **Verify demo works**: `npm run demo`
5. **Create release tag**: `git tag v1.0.0`
6. **Publish to npm**: `npm publish`

---

## Getting Help

- **Documentation**: Check `/docs` first
- **Issues**: Report bugs on GitHub Issues
- **Discussions**: Ask questions in GitHub Discussions
- **Discord**: Join our developer community [link]

**Happy coding!** 🛢️🚀