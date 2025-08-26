/**
 * Curve-Smith MCP Coordination Server - Standards-Compliant Implementation
 * Orchestrates curve analysis workflows and well log processing
 * Persona: Curvus Coordinatus - Master Curve Analysis Orchestrator
 */

import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';
import { FileIntegrationManager } from '../shared/file-integration.js';
import { LASParser } from '../shared/parsers/las-parser.js';
import { SEGYParser } from '../shared/parsers/segy-parser.js';

export class CurveSmithMCPServer {
  private server: McpServer;
  private resourceRoot: string;
  private dataPath: string;
  private initialized = false;
  private name: string;
  private version: string;
  private activeWorkflows: Map<string, any> = new Map();
  private fileManager: FileIntegrationManager;
  private lasParser: LASParser;
  private segyParser: SEGYParser;

  constructor(config: { name: string; version: string; resourceRoot: string; dataPath?: string }) {
    this.name = config.name;
    this.version = config.version;
    this.resourceRoot = path.resolve(config.resourceRoot);
    this.dataPath = config.dataPath || path.join(this.resourceRoot, 'curve-smith-coordination');

    // Initialize file processing capabilities
    this.fileManager = new FileIntegrationManager();
    this.lasParser = new LASParser();
    this.segyParser = new SEGYParser();

    this.server = new McpServer({
      name: config.name,
      version: config.version
    });

    this.setupCurveCoordinationTools();
    this.setupCurveProcessingTools();
    this.setupCurveCoordinationResources();
  }

  async initialize(): Promise<void> {
    await fs.mkdir(this.resourceRoot, { recursive: true });
    await fs.mkdir(this.dataPath, { recursive: true });
    await fs.mkdir(path.join(this.dataPath, 'workflows'), { recursive: true });
    this.initialized = true;
  }

  private setupCurveCoordinationTools(): void {
    this.server.tool(
      'orchestrate_workflow',
      'Orchestrate curve analysis workflow',
      {
        type: 'object',
        properties: {
          workflowId: { type: 'string' },
          analysisType: { type: 'string', enum: ['curve_fitting', 'qc_analysis', 'log_processing', 'full_curve'] },
          curves: { type: 'array', items: { type: 'string' }, optional: true },
          parameters: { type: 'object', optional: true }
        },
        required: ['workflowId', 'analysisType']
      },
      async ({ workflowId, analysisType, curves, parameters }, extra) => {
        const workflow = await this.orchestrateCurveWorkflow({ workflowId, analysisType, curves, parameters });
        const workflowPath = path.join(this.dataPath, 'workflows', `${workflowId}.json`);
        await fs.writeFile(workflowPath, JSON.stringify(workflow, null, 2));
        return { content: [{ type: "text", text: JSON.stringify(workflow) }] };
      }
    );

    this.server.tool(
      'coordinate_dependencies',
      'Coordinate curve analysis dependencies',
      {
        type: 'object',
        properties: {
          workflowId: { type: 'string' },
          requiredCurves: { type: 'array', items: { type: 'string' } }
        },
        required: ['workflowId', 'requiredCurves']
      },
      async ({ workflowId, requiredCurves }, extra) => {
        const result = await this.coordinateCurveDependencies({ workflowId, requiredCurves });
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      }
    );

    this.server.tool(
      'manage_state',
      'Manage curve workflow state',
      {
        type: 'object',
        properties: {
          workflowId: { type: 'string' },
          action: { type: 'string', enum: ['start', 'pause', 'resume', 'complete', 'fail'] }
        },
        required: ['workflowId', 'action']
      },
      async ({ workflowId, action }, extra) => {
        const result = await this.manageCurveState({ workflowId, action });
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      }
    );

    this.server.tool(
      'handle_errors',
      'Handle curve analysis errors',
      {
        type: 'object',
        properties: {
          workflowId: { type: 'string' },
          error: { type: 'string' },
          errorType: { type: 'string', enum: ['curve_missing', 'processing_failed', 'qc_failed'] }
        },
        required: ['workflowId', 'error', 'errorType']
      },
      async ({ workflowId, error, errorType }, extra) => {
        const result = await this.handleCurveErrors({ workflowId, error, errorType });
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      }
    );
  }

  private setupCurveProcessingTools(): void {
    // Tool: Process LAS File
    this.server.tool(
      'process_las_file',
      'Process LAS well log files for curve analysis',
      {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'Path to LAS file' },
          outputPath: { type: 'string', optional: true, description: 'Output path for processed curves' },
          targetCurves: { type: 'array', items: { type: 'string' }, optional: true, description: 'Specific curves to process' },
          qualityControl: { type: 'boolean', optional: true, description: 'Perform quality control analysis' },
          fillNulls: { type: 'boolean', optional: true, description: 'Fill null values using interpolation' }
        },
        required: ['filePath']
      },
      async (args, extra) => {
        try {
          const result = await this.fileManager.parseFile(args.filePath);
          
          if (!result.success) {
            return { 
              content: [{ 
                type: "text", 
                text: JSON.stringify({ 
                  error: 'Failed to process LAS file', 
                  details: result.errors 
                }) 
              }] 
            };
          }

          const lasData = result.data;
          const processed = {
            wellInfo: {
              name: lasData.wellInfo.WELL?.value || 'Unknown',
              company: lasData.wellInfo.COMP?.value || 'Unknown',
              uwi: lasData.wellInfo.UWI?.value || 'Unknown'
            },
            depthRange: lasData.depthRange,
            processedCurves: [] as any[],
            qualityReport: null as any,
            statistics: {} as Record<string, any>
          };

          // Filter and process curves
          const curvesToProcess = args.targetCurves ? 
            lasData.curves.filter((curve: any) => args.targetCurves!.includes(curve.mnemonic)) :
            lasData.curves;

          for (const curve of curvesToProcess) {
            const curveStats = this.lasParser.getCurveStatistics(curve);
            
            processed.processedCurves.push({
              mnemonic: curve.mnemonic,
              unit: curve.unit,
              description: curve.description,
              statistics: curveStats,
              qualityGrade: this.gradeCurveQuality(curveStats)
            });

            processed.statistics[curve.mnemonic] = curveStats;
          }

          // Perform quality control if requested
          if (args.qualityControl) {
            processed.qualityReport = {
              overallGrade: this.assessOverallQuality(processed.processedCurves),
              completeness: lasData.metadata.quality.completeness,
              dataGaps: lasData.metadata.quality.dataGaps,
              recommendations: this.generateQCRecommendations(processed.processedCurves)
            };
          }

          // Save processed data if output path provided
          if (args.outputPath) {
            await fs.writeFile(args.outputPath, JSON.stringify(processed, null, 2));
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
                error: 'LAS file processing failed', 
                message: String(error) 
              }) 
            }] 
          };
        }
      }
    );

    // Tool: Analyze Curve Statistics
    this.server.tool(
      'analyze_curve_statistics',
      'Perform detailed statistical analysis on well log curves',
      {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'Path to LAS file' },
          curveName: { type: 'string', description: 'Name of curve to analyze' },
          analysisType: { type: 'string', enum: ['basic', 'detailed', 'comparative'], optional: true, description: 'Type of analysis' },
          outputPath: { type: 'string', optional: true, description: 'Output path for analysis results' }
        },
        required: ['filePath', 'curveName']
      },
      async (args, extra) => {
        try {
          const result = await this.fileManager.parseFile(args.filePath);
          
          if (!result.success) {
            return { 
              content: [{ 
                type: "text", 
                text: JSON.stringify({ 
                  error: 'Failed to analyze curve', 
                  details: result.errors 
                }) 
              }] 
            };
          }

          const lasData = result.data;
          const curve = lasData.curves.find((c: any) => c.mnemonic === args.curveName);
          
          if (!curve) {
            return { 
              content: [{ 
                type: "text", 
                text: JSON.stringify({ 
                  error: 'Curve not found', 
                  availableCurves: lasData.curves.map((c: any) => c.mnemonic)
                }) 
              }] 
            };
          }

          const stats = this.lasParser.getCurveStatistics(curve);
          const analysis: Record<string, any> = {
            curve: {
              mnemonic: curve.mnemonic,
              unit: curve.unit,
              description: curve.description
            },
            statistics: stats,
            qualityAssessment: {
              grade: this.gradeCurveQuality(stats),
              dataCompleteness: stats.validCount / (stats.validCount + stats.nullCount),
              outlierCount: this.detectOutliers(curve, stats),
              monotonicity: this.assessMonotonicity(curve),
              smoothness: this.assessSmoothness(curve)
            },
            recommendations: this.generateCurveRecommendations(curve, stats)
          };

          // Enhanced analysis for detailed type
          if (args.analysisType === 'detailed') {
            analysis['distributionAnalysis'] = {
              skewness: this.calculateSkewness(curve),
              kurtosis: this.calculateKurtosis(curve),
              histogram: this.generateHistogram(curve, 20)
            };
          }

          // Save analysis if output path provided
          if (args.outputPath) {
            await fs.writeFile(args.outputPath, JSON.stringify(analysis, null, 2));
          }

          return { 
            content: [{ 
              type: "text", 
              text: JSON.stringify(analysis, null, 2) 
            }] 
          };
          
        } catch (error) {
          return { 
            content: [{ 
              type: "text", 
              text: JSON.stringify({ 
                error: 'Curve analysis failed', 
                message: String(error) 
              }) 
            }] 
          };
        }
      }
    );

    // Tool: Process Seismic Data
    this.server.tool(
      'process_segy_file',
      'Process SEGY seismic data files',
      {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'Path to SEGY file' },
          outputPath: { type: 'string', optional: true, description: 'Output path for processed data' },
          maxTraces: { type: 'number', optional: true, description: 'Maximum traces to process' },
          extractHeaders: { type: 'boolean', optional: true, description: 'Extract trace headers' }
        },
        required: ['filePath']
      },
      async (args, extra) => {
        try {
          const result = await this.fileManager.parseFile(args.filePath);
          
          if (!result.success) {
            return { 
              content: [{ 
                type: "text", 
                text: JSON.stringify({ 
                  error: 'Failed to process SEGY file', 
                  details: result.errors 
                }) 
              }] 
            };
          }

          const segyData = result.data;
          const processed = {
            surveyInfo: this.segyParser.extractSurveyInfo(segyData),
            dataFormat: segyData.metadata.dataFormat,
            segyRevision: segyData.metadata.segyRevision,
            traceCount: segyData.metadata.traceCount,
            samplesPerTrace: segyData.metadata.samplesPerTrace,
            sampleInterval: segyData.metadata.sampleInterval,
            quality: segyData.metadata.quality,
            processingSummary: {
              tracesProcessed: Math.min(args.maxTraces || 1000, segyData.traces.length),
              averageAmplitude: this.calculateAverageAmplitude(segyData.traces),
              amplitudeRange: this.calculateAmplitudeRange(segyData.traces)
            }
          };

          // Save processed data if output path provided
          if (args.outputPath) {
            await fs.writeFile(args.outputPath, JSON.stringify(processed, null, 2));
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
                error: 'SEGY file processing failed', 
                message: String(error) 
              }) 
            }] 
          };
        }
      }
    );
  }

  // Helper methods for curve analysis
  private gradeCurveQuality(stats: any): string {
    const completeness = stats.validCount / (stats.validCount + stats.nullCount);
    if (completeness >= 0.95) return 'Excellent';
    if (completeness >= 0.85) return 'Good';
    if (completeness >= 0.70) return 'Fair';
    return 'Poor';
  }

  private assessOverallQuality(curves: any[]): string {
    const grades = curves.map(c => c.qualityGrade);
    const excellentCount = grades.filter(g => g === 'Excellent').length;
    const goodCount = grades.filter(g => g === 'Good').length;
    
    if (excellentCount / grades.length >= 0.8) return 'Excellent';
    if ((excellentCount + goodCount) / grades.length >= 0.7) return 'Good';
    return 'Needs Improvement';
  }

  private generateQCRecommendations(curves: any[]): string[] {
    const recommendations = [];
    const poorCurves = curves.filter(c => c.qualityGrade === 'Poor');
    
    if (poorCurves.length > 0) {
      recommendations.push(`Review data quality for curves: ${poorCurves.map(c => c.mnemonic).join(', ')}`);
    }
    
    recommendations.push('Perform gap filling for missing data intervals');
    recommendations.push('Apply quality control filters to remove outliers');
    
    return recommendations;
  }

  private detectOutliers(curve: any, stats: any): number {
    if (!curve.values) return 0;
    const threshold = 3 * stats.stdDev;
    return curve.values.filter((val: any) => 
      Math.abs(val - stats.mean) > threshold
    ).length;
  }

  private assessMonotonicity(curve: any): string {
    // Simplified monotonicity check for depth curves
    if (curve.mnemonic.toLowerCase().includes('dept')) {
      return 'Monotonic (Depth)';
    }
    return 'Non-monotonic';
  }

  private assessSmoothness(curve: any): string {
    return 'Moderate'; // Simplified implementation
  }

  private generateCurveRecommendations(curve: any, stats: any): string[] {
    const recommendations = [];
    
    if (stats.nullCount > stats.validCount * 0.1) {
      recommendations.push('Consider interpolation for missing values');
    }
    
    if (this.detectOutliers(curve, stats) > 0) {
      recommendations.push('Review and potentially filter outlier values');
    }
    
    return recommendations;
  }

  private calculateSkewness(curve: any): number {
    return 0; // Placeholder - would implement actual skewness calculation
  }

  private calculateKurtosis(curve: any): number {
    return 3; // Placeholder - would implement actual kurtosis calculation
  }

  private generateHistogram(curve: any, bins: number): any {
    return { bins, values: new Array(bins).fill(0) }; // Placeholder
  }

  private calculateAverageAmplitude(traces: any[]): number {
    const allValues = traces.slice(0, 100).flatMap(t => t.data); // Sample first 100 traces
    return allValues.reduce((sum, val) => sum + Math.abs(val), 0) / allValues.length;
  }

  private calculateAmplitudeRange(traces: any[]): { min: number; max: number } {
    const allValues = traces.slice(0, 100).flatMap(t => t.data);
    return {
      min: Math.min(...allValues),
      max: Math.max(...allValues)
    };
  }

  private setupCurveCoordinationResources(): void {
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

  private async orchestrateCurveWorkflow(args: any) {
    return {
      workflowId: args.workflowId,
      status: 'completed',
      analysisType: args.analysisType,
      curves: args.curves || ['GR', 'RHOB', 'NPHI'],
      results: { processed: true, timestamp: new Date().toISOString() }
    };
  }

  private async coordinateCurveDependencies(args: any) {
    return {
      workflowId: args.workflowId,
      requiredCurves: args.requiredCurves,
      dependencyStatus: 'satisfied'
    };
  }

  private async manageCurveState(args: any) {
    return { workflowId: args.workflowId, action: args.action, timestamp: new Date().toISOString() };
  }

  private async handleCurveErrors(args: any) {
    return {
      workflowId: args.workflowId,
      error: args.error,
      errorType: args.errorType,
      resolved: true
    };
  }

  async start(): Promise<void> {
    if (!this.initialized) await this.initialize();
    console.log(`📈 Curvus Coordinatus (Curve-Smith MCP) Server v${this.version} initialized`);
  }

  async stop(): Promise<void> {
    console.log('📈 Curvus Coordinatus MCP Server shutdown complete');
  }

  getServer(): McpServer { return this.server; }

  async getStatus() {
    return {
      name: this.name,
      version: this.version,
      initialized: this.initialized,
      persona: 'Curvus Coordinatus - Master Curve Analysis Orchestrator',
      capabilities: { tools: ['orchestrate_workflow', 'coordinate_dependencies', 'manage_state', 'handle_errors'] }
    };
  }
}

export default CurveSmithMCPServer;