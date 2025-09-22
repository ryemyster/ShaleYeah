# Development Guide

**Contributing to SHALE YEAH - Workflow, Standards, and Best Practices**

This guide covers everything you need to know to contribute effectively to SHALE YEAH, from setting up your development environment to submitting high-quality pull requests.

---

## 🚀 Quick Start for Contributors

### Prerequisites
- **Node.js 18+** with npm ([download here](https://nodejs.org/))
- **Git** for version control
- **VS Code** (recommended) with TypeScript extension
- **Basic understanding** of TypeScript and async programming

### Initial Setup

```bash
# 1. Fork and clone
git fork https://github.com/rmcdonald/ShaleYeah.git  # Fork on GitHub first
git clone https://github.com/YOUR_USERNAME/ShaleYeah.git
cd ShaleYeah

# 2. Install dependencies
npm install

# 3. Verify everything works
npm run build      # TypeScript compilation
npm run type-check # Type checking
npm run lint       # Code quality
npm run demo       # End-to-end demo test
```

### Development Commands

```bash
# Development workflow
npm run dev          # Development mode with hot reload
npm run build        # Compile TypeScript
npm run type-check   # Type checking only
npm run lint         # ESLint + Prettier
npm run lint:fix     # Auto-fix lint issues

# Testing
npm run test         # Run test suite
npm run test:watch   # Test with file watching
npm run demo         # Integration test via demo

# Individual server testing
npm run server:geowiz      # Test geology server
npm run server:econobot    # Test economics server
npm run server:decision    # Test decision server

# Cleanup
npm run clean              # Clean build artifacts and old demos
npm run clean:workspace    # Intelligent workspace cleanup
npm run clean:all          # Nuclear option (requires npm install)
```

---

## 🎯 Contribution Workflow

### 1. Choose Your Contribution Type

**🐛 Bug Fixes**
- Browse [open issues](https://github.com/rmcdonald/ShaleYeah/issues?q=is%3Aissue+is%3Aopen+label%3Abug)
- Look for `good-first-issue` or `help-wanted` labels
- Comment on issue before starting work

**✨ New Features**
- Check the [project roadmap](https://github.com/rmcdonald/ShaleYeah/projects)
- Open an issue to discuss the feature first
- Get maintainer approval before implementation

**📚 Documentation**
- Improve existing guides
- Add code examples
- Fix typos and formatting
- Update outdated information

**🧪 Testing**
- Add test coverage for existing functionality
- Write integration tests
- Improve test documentation

### 2. Create Your Development Branch

```bash
# Create and switch to feature branch
git checkout -b feature/your-feature-name

# For bug fixes
git checkout -b fix/issue-number-description

# For documentation
git checkout -b docs/section-you-are-updating
```

### 3. Development Process

**Make Your Changes**
- Follow [coding standards](#-coding-standards)
- Write/update tests as needed
- Update documentation
- Keep commits focused and atomic

**Test Your Changes**
```bash
# Run comprehensive tests
npm run build && npm run type-check && npm run lint && npm run demo

# Test specific components if relevant
npm run server:geowiz  # For geology-related changes
npm run test          # For logic changes
```

**Commit Your Work**
```bash
# Use conventional commits
git add .
git commit -m "feat: add porosity analysis tool to geowiz server

- Add analyze_porosity tool with depth range filtering
- Include confidence scoring based on data quality
- Add comprehensive error handling for invalid inputs
- Update documentation with usage examples

Closes #123"
```

### 4. Submit Your Pull Request

**Push Your Changes**
```bash
git push origin feature/your-feature-name
```

**Create Pull Request**
1. Go to GitHub and create PR from your branch
2. Use the [PR template](#pr-template)
3. Link relevant issues
4. Request review from maintainers

### 5. PR Review Process

**What Reviewers Look For:**
- ✅ Code follows standards and patterns
- ✅ Tests pass and new tests added where appropriate
- ✅ Documentation updated
- ✅ No breaking changes (unless discussed)
- ✅ Demo still works correctly

**Responding to Feedback:**
```bash
# Make requested changes
git add .
git commit -m "fix: address review feedback on error handling"
git push origin feature/your-feature-name
# PR updates automatically
```

---

## 📋 Coding Standards

### TypeScript Guidelines

**✅ DO:**
```typescript
// Use explicit typing
interface GeologicalAnalysis {
  netPay: number;
  porosity: number;
  confidence: number;
}

// Use async/await
async function analyzeFormation(data: WellLogData): Promise<GeologicalAnalysis> {
  try {
    const analysis = await performAnalysis(data);
    return analysis;
  } catch (error) {
    throw new Error(`Formation analysis failed: ${error}`);
  }
}

// Use proper error handling
if (!parseResult.success) {
  throw new Error(`Failed to parse file: ${parseResult.errors?.join(', ')}`);
}
```

**❌ DON'T:**
```typescript
// Don't use 'any' type
function analyzeFormation(data: any): any { /* ... */ }

// Don't ignore errors
const analysis = await performAnalysis(data); // What if this fails?

// Don't use callbacks when async/await works
performAnalysis(data, (error, result) => { /* ... */ });
```

### File Naming Conventions

| **Component** | **Convention** | **Example** |
|---------------|----------------|-------------|
| **MCP Servers** | kebab-case.ts | `risk-analysis.ts` |
| **Utilities** | kebab-case.ts | `file-integration.ts` |
| **Classes** | PascalCase | `GeowizServer` |
| **Interfaces** | PascalCase | `AnalysisResult` |
| **Methods** | camelCase | `analyzeFormation` |
| **Constants** | SCREAMING_SNAKE_CASE | `DEFAULT_CONFIDENCE` |

### MCP Server Development Patterns

**Standard Server Template:**
```typescript
#!/usr/bin/env node
/**
 * [Domain] MCP Server - [Domain] Analysis Expert
 *
 * [Roman Persona Name] - [Professional Title]
 * [Brief description of what this server does]
 */

import { MCPServer, runMCPServer } from '../shared/mcp-server.js';
import { z } from 'zod';

export class MyDomainServer extends MCPServer {
  constructor() {
    super({
      name: 'my-domain',
      version: '1.0.0',
      description: '[Domain] Analysis MCP Server',
      persona: {
        name: '[Roman Persona Name]',
        role: '[Professional Title]',
        expertise: [
          '[Expertise Area 1]',
          '[Expertise Area 2]',
          '[Expertise Area 3]'
        ]
      }
    });
  }

  protected async setupDataDirectories(): Promise<void> {
    const dirs = ['analyses', 'reports', 'temp'];
    for (const dir of dirs) {
      await fs.mkdir(path.join(this.dataPath, dir), { recursive: true });
    }
  }

  protected setupCapabilities(): void {
    this.registerTool({
      name: 'primary_analysis_tool',
      description: 'Main analysis function for this domain',
      inputSchema: z.object({
        filePath: z.string().describe('Path to input file'),
        analysisType: z.enum(['basic', 'standard', 'comprehensive']).default('standard')
      }),
      handler: async (args) => this.performPrimaryAnalysis(args)
    });

    this.registerResource({
      name: 'analysis_result',
      uri: `${this.config.name}://analyses/{id}`,
      description: '[Domain] analysis results',
      handler: async (uri) => this.getAnalysisResult(uri)
    });
  }

  private async performPrimaryAnalysis(args: any): Promise<any> {
    console.log(`🔍 [Roman Persona] analyzing ${args.filePath}`);

    // 1. Parse input file
    const parseResult = await this.fileManager.parseFile(args.filePath);
    if (!parseResult.success) {
      throw new Error(`Failed to parse file: ${parseResult.errors?.join(', ')}`);
    }

    // 2. Perform domain-specific analysis
    const analysis = {
      // Your analysis results here
      summary: 'Analysis complete',
      metrics: { /* domain-specific metrics */ },
      insights: ['Key finding 1', 'Key finding 2']
    };

    // 3. Calculate confidence score
    const confidence = this.calculateConfidence(analysis, parseResult.data);

    // 4. Save results
    const analysisId = `${this.config.name}_${Date.now()}`;
    await this.saveResult(`analyses/${analysisId}.json`, analysis);

    // 5. Return structured response
    return {
      analysis,
      confidence,
      quality: confidence > 0.8 ? 'Excellent' : confidence > 0.6 ? 'Good' : 'Fair',
      recommendations: this.generateRecommendations(analysis),
      persona: this.config.persona.name,
      timestamp: new Date().toISOString()
    };
  }

  private calculateConfidence(analysis: any, rawData: any): number {
    // Implement confidence scoring logic
    // Consider data completeness, quality indicators, etc.
    return 0.85; // Placeholder
  }

  private generateRecommendations(analysis: any): string[] {
    // Generate actionable recommendations based on analysis
    return ['Recommendation 1', 'Recommendation 2'];
  }
}

// Entry point for standalone execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new MyDomainServer();
  runMCPServer(server).catch(console.error);
}
```

### Error Handling Standards

**Structured Error Responses:**
```typescript
// Use this pattern for all error responses
protected formatError(operation: string, error: any): any {
  return {
    success: false,
    error: {
      operation,
      message: String(error),
      server: this.config.name,
      persona: this.config.persona.name,
      timestamp: new Date().toISOString(),
      // Optional: include context for debugging
      context: {
        filePath: args?.filePath,
        analysisType: args?.analysisType
      }
    }
  };
}

// Throw errors with clear, actionable messages
throw new Error(`Formation analysis failed: insufficient data quality (${dataQualityScore}/100). Minimum required: 60/100.`);
```

---

## 🧪 Testing Strategy

### Test Categories

**1. Unit Tests** - Individual functions and methods
```typescript
// tests/servers/geowiz.test.ts
import { GeowizServer } from '../../src/servers/geowiz.js';

describe('GeowizServer', () => {
  let server: GeowizServer;

  beforeEach(() => {
    server = new GeowizServer();
  });

  it('should calculate porosity correctly', async () => {
    const mockData = { curves: { NPHI: [0.1, 0.12, 0.09] } };
    const result = await server.calculatePorosity(mockData);
    expect(result.averagePorosity).toBeCloseTo(0.103);
  });
});
```

**2. Integration Tests** - Component interactions
```typescript
// tests/integration/file-processing.test.ts
import { FileIntegrationManager } from '../../src/shared/file-integration.js';

describe('File Integration', () => {
  it('should handle LAS files end-to-end', async () => {
    const manager = new FileIntegrationManager();
    const result = await manager.parseFile('./tests/fixtures/sample.las');

    expect(result.success).toBe(true);
    expect(result.data.curves).toContain('GR');
    expect(result.metadata.format).toBe('LAS');
  });
});
```

**3. End-to-End Tests** - Complete workflow
```typescript
// tests/e2e/demo.test.ts
import { ShaleYeahDemo } from '../../src/demo-runner.js';

describe('Demo End-to-End', () => {
  it('should complete full analysis workflow', async () => {
    const demo = new ShaleYeahDemo();
    await demo.runCompleteDemo();

    // Check outputs exist
    const files = await fs.readdir(demo.outputDir);
    expect(files).toContain('INVESTMENT_DECISION.md');
    expect(files).toContain('DETAILED_ANALYSIS.md');
    expect(files).toContain('FINANCIAL_MODEL.json');
  });
});
```

### Writing Good Tests

**✅ DO:**
- Test edge cases and error conditions
- Use descriptive test names
- Mock external dependencies
- Test both success and failure paths
- Include integration tests for new features

**❌ DON'T:**
- Test implementation details
- Write tests that depend on external APIs
- Ignore failing tests
- Skip testing error handling

### Running Tests

```bash
# Run all tests
npm run test

# Run specific test file
npm run test -- geowiz.test.ts

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage
```

---

## 🔧 Advanced Development Topics

### Adding Support for New File Formats

**1. Create Parser Implementation**
```typescript
// src/shared/parsers/my-format-parser.ts
export class MyFormatParser implements FileParser {
  async parse(filePath: string): Promise<ParseResult> {
    try {
      const rawData = await fs.readFile(filePath, 'utf8');
      const parsedData = this.parseMyFormat(rawData);

      return {
        success: true,
        data: parsedData,
        metadata: {
          format: 'MY_FORMAT',
          size: (await fs.stat(filePath)).size,
          processingTime: Date.now()
        }
      };
    } catch (error) {
      return {
        success: false,
        errors: [`MyFormat parsing failed: ${error}`]
      };
    }
  }
}
```

**2. Register in FileIntegrationManager**
```typescript
// src/shared/file-integration.ts
import { MyFormatParser } from './parsers/my-format-parser.js';

export class FileIntegrationManager {
  private parsers = {
    '.las': new LASParser(),
    '.xlsx': new ExcelParser(),
    '.myformat': new MyFormatParser(),  // Add this
    // ... other parsers
  };
}
```

### Integrating External APIs

**Environment Configuration:**
```typescript
// src/shared/config.ts
export interface APIConfig {
  anthropicApiKey?: string;
  externalServiceUrl?: string;
  timeout: number;
}

export function loadAPIConfig(): APIConfig {
  return {
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    externalServiceUrl: process.env.EXTERNAL_SERVICE_URL,
    timeout: parseInt(process.env.API_TIMEOUT || '30000')
  };
}
```

**API Client Pattern:**
```typescript
// src/shared/api-client.ts
export class APIClient {
  constructor(private config: APIConfig) {}

  async callExternalAPI(data: any): Promise<any> {
    try {
      const response = await fetch(this.config.externalServiceUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.anthropicApiKey}`
        },
        body: JSON.stringify(data),
        signal: AbortSignal.timeout(this.config.timeout)
      });

      if (!response.ok) {
        throw new Error(`API call failed: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      // Handle timeouts, network errors, etc.
      throw new Error(`External API integration failed: ${error}`);
    }
  }
}
```

### Performance Optimization

**File Processing Optimization:**
```typescript
// Use streaming for large files
import { createReadStream } from 'fs';
import { pipeline } from 'stream/promises';

async parseStreamingFile(filePath: string): Promise<ParseResult> {
  const stream = createReadStream(filePath);
  const parser = new StreamingParser();

  await pipeline(stream, parser);
  return parser.getResult();
}
```

**Caching Strategy:**
```typescript
// Simple in-memory cache for analysis results
export class AnalysisCache {
  private cache = new Map<string, { result: any; timestamp: number }>();
  private ttl = 5 * 60 * 1000; // 5 minutes

  async get(key: string): Promise<any | null> {
    const cached = this.cache.get(key);
    if (cached && (Date.now() - cached.timestamp) < this.ttl) {
      return cached.result;
    }
    this.cache.delete(key);
    return null;
  }

  async set(key: string, result: any): Promise<void> {
    this.cache.set(key, { result, timestamp: Date.now() });
  }
}
```

---

## 📋 Pull Request Template

When creating a PR, use this template:

```markdown
## Description
Brief description of the changes and why they were made.

Fixes #(issue number)

## Type of Change
- [ ] 🐛 Bug fix (non-breaking change which fixes an issue)
- [ ] ✨ New feature (non-breaking change which adds functionality)
- [ ] 💥 Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] 📚 Documentation update
- [ ] 🧪 Test improvements
- [ ] 🔧 Code refactoring (no functional changes)

## Changes Made
- [ ] Change 1
- [ ] Change 2
- [ ] Change 3

## Testing
- [ ] All existing tests pass (`npm run test`)
- [ ] New tests added for new functionality
- [ ] Demo runs successfully (`npm run demo`)
- [ ] Manual testing completed
- [ ] Integration testing done (if applicable)

## Code Quality
- [ ] Code follows project style guidelines (`npm run lint`)
- [ ] TypeScript compiles without errors (`npm run build`)
- [ ] Self-review completed
- [ ] Code is well-commented
- [ ] Error handling implemented

## Documentation
- [ ] Documentation updated (if applicable)
- [ ] API documentation updated (if applicable)
- [ ] README updated (if applicable)
- [ ] Code examples added/updated

## Breaking Changes
<!-- If this introduces breaking changes, describe them here -->

## Screenshots/Demos
<!-- Include screenshots or demo output if relevant -->

## Additional Context
<!-- Add any other context about the PR here -->
```

---

## 🚢 Release Process

### Version Management

SHALE YEAH follows **semantic versioning** (semver):
- **Major (1.0.0)**: Breaking changes to public API
- **Minor (0.1.0)**: New features, backward compatible
- **Patch (0.0.1)**: Bug fixes, backward compatible

### Release Checklist

**Pre-Release Testing:**
```bash
# 1. Run comprehensive tests
npm run build && npm run type-check && npm run lint && npm run test

# 2. Test demo works
npm run demo

# 3. Test individual servers
npm run server:geowiz
npm run server:econobot
# ... test key servers

# 4. Clean build test
npm run clean && npm install && npm run build && npm run demo
```

**Release Steps:**
1. **Update version** in `package.json`
2. **Update CHANGELOG.md** with release notes
3. **Create release branch**: `git checkout -b release/v1.0.0`
4. **Final testing**: Run all tests one more time
5. **Create release tag**: `git tag v1.0.0`
6. **Push changes**: `git push origin release/v1.0.0 --tags`
7. **Create GitHub release** with release notes
8. **Merge to main** and deploy

---

## 🛠️ Development Environment

### Recommended VS Code Extensions

```json
// .vscode/extensions.json
{
  "recommendations": [
    "ms-vscode.vscode-typescript-next",
    "esbenp.prettier-vscode",
    "ms-vscode.vscode-eslint",
    "ms-vscode.vscode-jest",
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-json"
  ]
}
```

### VS Code Settings

```json
// .vscode/settings.json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "typescript.preferences.importModuleSpecifier": "relative",
  "typescript.suggest.autoImports": true,
  "files.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/data/temp": true
  }
}
```

### Debug Configuration

```json
// .vscode/launch.json
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
    },
    {
      "name": "Debug Tests",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/node_modules/.bin/jest",
      "args": ["--runInBand"],
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen",
      "skipFiles": ["<node_internals>/**"]
    }
  ]
}
```

---

## 🤝 Community Guidelines

### Code of Conduct

- **Be respectful** - Treat all contributors with respect
- **Be inclusive** - Welcome developers of all skill levels
- **Be helpful** - Provide constructive feedback
- **Be patient** - Remember everyone is learning

### Communication Channels

- **GitHub Issues** - Bug reports and feature requests
- **GitHub Discussions** - Questions and general discussion
- **Pull Requests** - Code review and collaboration
- **Discord** - Real-time chat (link in main README)

### Getting Help

**Before Asking:**
1. Check existing documentation
2. Search GitHub issues
3. Try the troubleshooting steps
4. Create a minimal reproduction

**When Asking:**
- Provide clear problem description
- Include relevant code snippets
- Share error messages in full
- Mention your environment (OS, Node version, etc.)

---

## 🎯 Contribution Areas

### High-Impact Areas

**🔥 Most Needed:**
- Integration tests for MCP servers
- File format parsers (PDF, Word, more GIS formats)
- Real AI analysis integration (Anthropic API)
- Performance optimization for large files

**⭐ Good for Beginners:**
- Documentation improvements
- Code examples and tutorials
- Test coverage improvements
- Bug fixes with clear reproduction steps

**🚀 Advanced Contributors:**
- Web dashboard/UI development
- Authentication and user management
- External API integrations
- Cloud deployment and scaling

### Feature Roadmap

**Phase 1: Core Stability** ✅
- [x] Demo mode working
- [x] All MCP servers implemented
- [x] File processing foundation
- [x] Documentation framework

**Phase 2: AI Integration** 🚧
- [ ] Anthropic API integration
- [ ] Real-time analysis workflows
- [ ] External data source integration
- [ ] Performance optimization

**Phase 3: Enterprise Features** 📅
- [ ] Multi-user support
- [ ] Custom analysis workflows
- [ ] Advanced visualization
- [ ] Enterprise integrations

---

**Ready to contribute?** Pick an area that interests you and dive in! The codebase is well-structured and documented to help you get started quickly.

**Questions?** Open a [GitHub Discussion](https://github.com/rmcdonald/ShaleYeah/discussions) or create an issue. We're here to help! 🚀