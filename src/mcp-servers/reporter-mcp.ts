/**
 * Reporter MCP Coordination Server - Standards-Compliant Implementation
 * Orchestrates reporting workflows and document generation
 * Persona: Scriptus Coordinatus - Master Reporting Orchestrator
 */

import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';
import { FileIntegrationManager } from '../shared/file-integration.js';

export class ReporterMCPServer {
  private server: McpServer;
  private resourceRoot: string;
  private dataPath: string;
  private initialized = false;
  private name: string;
  private version: string;
  private activeWorkflows: Map<string, any> = new Map();
  private fileManager: FileIntegrationManager;

  constructor(config: { name: string; version: string; resourceRoot: string; dataPath?: string }) {
    this.name = config.name;
    this.version = config.version;
    this.resourceRoot = path.resolve(config.resourceRoot);
    this.dataPath = config.dataPath || path.join(this.resourceRoot, 'reporter-coordination');

    this.fileManager = new FileIntegrationManager();

    this.server = new McpServer({
      name: config.name,
      version: config.version
    });

    this.setupReportingCoordinationTools();
    this.setupDocumentProcessingTools();
    this.setupReportingCoordinationResources();
  }

  async initialize(): Promise<void> {
    await fs.mkdir(this.resourceRoot, { recursive: true });
    await fs.mkdir(this.dataPath, { recursive: true });
    await fs.mkdir(path.join(this.dataPath, 'workflows'), { recursive: true });
    this.initialized = true;
  }

  private setupReportingCoordinationTools(): void {
    this.server.tool(
      'orchestrate_workflow',
      'Orchestrate report generation workflow',
      {
        type: 'object',
        properties: {
          workflowId: { type: 'string' },
          reportType: { type: 'string', enum: ['executive_summary', 'technical_report', 'investment_thesis', 'full_analysis'] },
          sections: { type: 'array', items: { type: 'string' }, optional: true },
          data: { type: 'object', optional: true }
        },
        required: ['workflowId', 'reportType']
      },
      async (args, extra) => {
        const workflow = await this.orchestrateReportingWorkflow(args);
        const workflowPath = path.join(this.dataPath, 'workflows', `${args.workflowId}.json`);
        await fs.writeFile(workflowPath, JSON.stringify(workflow, null, 2));
        return { content: [{ type: "text", text: JSON.stringify(workflow) }] };
      }
    );

    this.server.tool(
      'coordinate_dependencies',
      'Coordinate reporting dependencies',
      {
        type: 'object',
        properties: {
          workflowId: { type: 'string' },
          requiredData: { type: 'array', items: { type: 'string' } }
        },
        required: ['workflowId', 'requiredData']
      },
      async (args, extra) => {
        const result = await this.coordinateReportingDependencies(args);
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      }
    );

    this.server.tool(
      'manage_state',
      'Manage reporting workflow state',
      {
        type: 'object',
        properties: {
          workflowId: { type: 'string' },
          action: { type: 'string', enum: ['start', 'pause', 'resume', 'complete', 'fail'] }
        },
        required: ['workflowId', 'action']
      },
      async (args, extra) => {
        const result = await this.manageReportingState(args);
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      }
    );

    this.server.tool(
      'handle_errors',
      'Handle reporting errors',
      {
        type: 'object',
        properties: {
          workflowId: { type: 'string' },
          error: { type: 'string' },
          errorType: { type: 'string', enum: ['data_missing', 'template_error', 'generation_failed'] }
        },
        required: ['workflowId', 'error', 'errorType']
      },
      async (args, extra) => {
        const result = await this.handleReportingErrors(args);
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      }
    );
  }

  private setupDocumentProcessingTools(): void {
    this.server.tool(
      'parse_document',
      'Parse and extract text from PDF or Word documents for report generation',
      {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'Path to PDF or Word document' },
          extractMetadata: { type: 'boolean', optional: true, description: 'Extract document metadata' },
          parseStructure: { type: 'boolean', optional: true, description: 'Parse document structure and headings' },
          outputFormat: { type: 'string', enum: ['text', 'markdown', 'json'], optional: true, description: 'Output format for extracted content' }
        },
        required: ['filePath']
      },
      async (args: any, extra: any) => {
        try {
          const result = await this.fileManager.parseFile(args.filePath);
          
          if (!result.success) {
            return { 
              content: [{ 
                type: "text", 
                text: JSON.stringify({ 
                  error: 'Failed to parse document', 
                  details: result.errors 
                }) 
              }] 
            };
          }

          const processed = {
            fileName: result.metadata.metadata?.fileName || 'unknown',
            fileSize: result.metadata.size,
            format: result.format,
            extractedContent: result.data,
            metadata: args.extractMetadata ? result.metadata : undefined,
            processedAt: new Date().toISOString()
          };

          if (args.parseStructure && result.format === 'pdf') {
            processed.extractedContent = { message: 'PDF structure parsing will be implemented when PDF parser is available' };
          }

          return { 
            content: [{ 
              type: "text", 
              text: JSON.stringify(processed, null, 2) 
            }] 
          };
          
        } catch (error) {
          return { 
            content: [{ 
              type: "text", 
              text: JSON.stringify({ 
                error: 'Document parsing failed', 
                message: String(error) 
              }) 
            }] 
          };
        }
      }
    );

    this.server.tool(
      'extract_report_data',
      'Extract structured data from existing reports for analysis and synthesis',
      {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'Path to report document (PDF, Word, etc.)' },
          dataTypes: { type: 'array', items: { type: 'string' }, description: 'Types of data to extract (tables, charts, sections)' },
          keywords: { type: 'array', items: { type: 'string' }, optional: true, description: 'Keywords to focus extraction on' }
        },
        required: ['filePath', 'dataTypes']
      },
      async (args: any, extra: any) => {
        try {
          const result = await this.fileManager.parseFile(args.filePath);
          
          if (!result.success) {
            return { 
              content: [{ 
                type: "text", 
                text: JSON.stringify({ 
                  error: 'Failed to extract report data', 
                  details: result.errors 
                }) 
              }] 
            };
          }

          const extractedData = {
            fileName: result.metadata.metadata?.fileName || 'unknown',
            extractedSections: {} as Record<string, any>,
            summary: {
              tablesFound: 0,
              chartsFound: 0,
              sectionsFound: 0,
              keywordMatches: 0
            }
          };

          if (result.format === 'pdf' && args.dataTypes.includes('tables')) {
            extractedData.extractedSections.tables = [{ message: 'PDF table extraction will be implemented when PDF parser is available' }];
            extractedData.summary.tablesFound = 0;
          }

          if (args.keywords && args.keywords.length > 0) {
            const keywordData = this.extractKeywordContent(result.data, args.keywords);
            extractedData.extractedSections.keywordMatches = keywordData;
            extractedData.summary.keywordMatches = keywordData.length;
          }

          return { 
            content: [{ 
              type: "text", 
              text: JSON.stringify(extractedData, null, 2) 
            }] 
          };
          
        } catch (error) {
          return { 
            content: [{ 
              type: "text", 
              text: JSON.stringify({ 
                error: 'Report data extraction failed', 
                message: String(error) 
              }) 
            }] 
          };
        }
      }
    );

    this.server.tool(
      'generate_template',
      'Generate report templates based on existing documents or requirements',
      {
        type: 'object',
        properties: {
          templateType: { type: 'string', enum: ['executive_summary', 'technical_report', 'investment_thesis', 'custom'], description: 'Type of template to generate' },
          sampleDocPath: { type: 'string', optional: true, description: 'Path to sample document to base template on' },
          sections: { type: 'array', items: { type: 'string' }, optional: true, description: 'Custom sections for the template' },
          outputPath: { type: 'string', optional: true, description: 'Output path for generated template' }
        },
        required: ['templateType']
      },
      async (args: any, extra: any) => {
        try {
          let template: any = {};

          if (args.sampleDocPath) {
            const result = await this.fileManager.parseFile(args.sampleDocPath);
            if (result.success && result.format === 'pdf') {
              template = { message: 'PDF template extraction will be implemented when PDF parser is available' };
            }
          }

          const generatedTemplate = this.generateReportTemplate(args.templateType, args.sections, template);
          
          if (args.outputPath) {
            await fs.writeFile(args.outputPath, JSON.stringify(generatedTemplate, null, 2));
          }

          return { 
            content: [{ 
              type: "text", 
              text: JSON.stringify(generatedTemplate, null, 2) 
            }] 
          };
          
        } catch (error) {
          return { 
            content: [{ 
              type: "text", 
              text: JSON.stringify({ 
                error: 'Template generation failed', 
                message: String(error) 
              }) 
            }] 
          };
        }
      }
    );
  }

  private extractKeywordContent(content: any, keywords: string[]): any[] {
    const matches: any[] = [];
    const text = typeof content === 'string' ? content : JSON.stringify(content);
    
    keywords.forEach((keyword: string) => {
      const regex = new RegExp(`\\b${keyword}\\b.*?(?=\\n|$)`, 'gi');
      const keywordMatches = text.match(regex) || [];
      keywordMatches.forEach((match: string) => {
        matches.push({
          keyword,
          context: match.trim(),
          position: text.indexOf(match)
        });
      });
    });
    
    return matches.sort((a: any, b: any) => a.position - b.position);
  }

  private generateReportTemplate(templateType: string, customSections?: string[], sampleTemplate?: any): any {
    const baseTemplate = {
      type: templateType,
      metadata: {
        title: '',
        author: '',
        date: '',
        version: '1.0'
      },
      sections: [] as any[]
    };

    const sectionTemplates = {
      executive_summary: [
        { name: 'Executive Summary', required: true },
        { name: 'Key Findings', required: true },
        { name: 'Recommendations', required: true }
      ],
      technical_report: [
        { name: 'Introduction', required: true },
        { name: 'Methodology', required: true },
        { name: 'Results', required: true },
        { name: 'Discussion', required: true },
        { name: 'Conclusions', required: true }
      ],
      investment_thesis: [
        { name: 'Investment Overview', required: true },
        { name: 'Market Analysis', required: true },
        { name: 'Financial Projections', required: true },
        { name: 'Risk Assessment', required: true },
        { name: 'Recommendation', required: true }
      ]
    };

    if (customSections) {
      baseTemplate.sections = customSections.map((section: string) => ({ name: section, required: false }));
    } else {
      baseTemplate.sections = sectionTemplates[templateType as keyof typeof sectionTemplates] || sectionTemplates.technical_report;
    }

    return baseTemplate;
  }

  private setupReportingCoordinationResources(): void {
    this.server.resource(
      'coord://state/{workflow_id}',
      'coord://state/*',
      async (uri) => {
        const workflowId = uri.pathname.split('/').pop()?.replace('.json', '');
        const workflowPath = path.join(this.dataPath, 'workflows', `${workflowId}.json`);
        try {
          const data = await fs.readFile(workflowPath, 'utf-8');
          return {
            contents: [{ uri: uri.toString(), mimeType: 'application/json', text: data }]
          };
        } catch {
          return {
            contents: [{ uri: uri.toString(), mimeType: 'application/json', text: JSON.stringify({ error: 'Workflow not found' }) }]
          };
        }
      }
    );
  }

  private async orchestrateReportingWorkflow(args: any) {
    return {
      workflowId: args.workflowId,
      status: 'completed',
      reportType: args.reportType,
      sections: args.sections || ['summary', 'analysis', 'conclusions'],
      results: { generated: true, timestamp: new Date().toISOString() }
    };
  }

  private async coordinateReportingDependencies(args: any) {
    return {
      workflowId: args.workflowId,
      requiredData: args.requiredData,
      dependencyStatus: 'satisfied'
    };
  }

  private async manageReportingState(args: any) {
    return { workflowId: args.workflowId, action: args.action, timestamp: new Date().toISOString() };
  }

  private async handleReportingErrors(args: any) {
    return {
      workflowId: args.workflowId,
      error: args.error,
      errorType: args.errorType,
      resolved: true
    };
  }

  async start(): Promise<void> {
    if (!this.initialized) await this.initialize();
    console.log(`📝 Scriptus Coordinatus (Reporter MCP) Server v${this.version} initialized`);
  }

  async stop(): Promise<void> {
    console.log('📝 Scriptus Coordinatus MCP Server shutdown complete');
  }

  getServer(): McpServer { return this.server; }

  async getStatus() {
    return {
      name: this.name,
      version: this.version,
      initialized: this.initialized,
      persona: 'Scriptus Coordinatus - Master Reporting Orchestrator',
      capabilities: { 
        tools: ['orchestrate_workflow', 'coordinate_dependencies', 'manage_state', 'handle_errors', 'parse_document', 'extract_report_data', 'generate_template'],
        resources: ['coord://state/{workflow_id}']
      }
    };
  }
}

export default ReporterMCPServer;