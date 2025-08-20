#!/usr/bin/env node
/**
 * GeoWiz Agent - AI-Powered Senior Geologist Persona (TypeScript)
 * 
 * **PERSONA:** Dr. Sarah Mitchell - Senior Petroleum Geologist with 15+ years unconventional experience
 * - Expert in subsurface analysis and well log interpretation
 * - Specializes in shale plays and horizontal drilling optimization
 * - Makes data-driven geological recommendations with confidence scoring
 * 
 * This agent THINKS and REASONS like a human geologist, using LLM intelligence
 * to analyze geological data and make professional investment recommendations.
 */

import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import type {
  AgentResult,
  Formation,
  GeologicalAnalysis,
  LASData,
  AgentPersona
} from '../shared/types.js';
import { BaseAgent } from '../shared/base-agent.js';
import { createShaleYeahFooter } from '../shared/config.js';

// Dr. Sarah Mitchell's geological expertise persona
const GEOWIZ_PERSONA: AgentPersona = {
  name: "Dr. Sarah Mitchell",
  role: "Senior Petroleum Geologist",
  experience: "15+ years unconventional reservoirs, 200+ wells analyzed",
  personality: "Detail-oriented, risk-aware, data-driven, scientifically rigorous",
  llmInstructions: `
    You are Dr. Sarah Mitchell, a senior petroleum geologist with deep expertise in shale plays.
    You've analyzed 200+ unconventional wells and made geological recommendations for $2B+ in investments.
    
    Analyze geological data like you're making a $50M recommendation to the investment committee.
    Always provide confidence scores and highlight geological risks.
    Use scientific rigor and industry best practices.
    
    Your geological assessment directly impacts drilling decisions and investor returns.
    Be thorough but concise. Flag uncertainties that require additional data.
  `,
  decisionAuthority: "geological_assessment",
  confidenceThreshold: 0.75,
  escalationCriteria: [
    "geological_confidence < 0.6",
    "high_drilling_risk",
    "insufficient_data_quality"
  ]
};

interface GeowizInputs {
  shapefile: string;
  region: string;
  lasFiles?: string;
}

interface GeowizOutputs {
  geologySummary: string;
  zonesGeojson: any;
  confidence: number;
  geologicalAnalysis: GeologicalAnalysis;
}

export class GeoWizAgent extends BaseAgent {
  private expectedOutputs = [
    'geology_summary.md',
    'zones.geojson'
  ];

  constructor(runId: string, outputDir: string, modeOverride?: string) {
    super(runId, outputDir, 'geowiz', GEOWIZ_PERSONA, modeOverride);
  }

  async analyze(inputData: GeowizInputs): Promise<AgentResult> {
    this.logger.info(`🪨 ${this.persona.name} starting geological analysis for ${inputData.region}`);

    try {
      // Step 1: Parse raw geological data
      const rawData = await this.parseRawGeologicalData(inputData);
      
      // Step 2: Perform intelligent geological analysis
      const geologicalAnalysis = await this.performIntelligentGeologicalAnalysis(rawData, inputData.region);
      
      // Step 3: Generate professional geological assessment
      const assessment = await this.generateGeologicalAssessment(rawData, geologicalAnalysis, inputData.region);
      
      // Step 4: Create output files
      const outputs = await this.generateOutputFiles(assessment, inputData.region);
      
      // Step 5: Check if escalation is needed
      const escalationCheck = this.shouldEscalateToHuman(geologicalAnalysis.confidenceLevel, {
        geologicalConfidence: geologicalAnalysis.confidenceLevel,
        region: inputData.region,
        dataQuality: rawData.dataQuality
      });
      
      if (escalationCheck.escalate) {
        await this.createEscalationReport(escalationCheck.reason!, {
          geologicalAnalysis,
          rawData,
          region: inputData.region
        });
        
        return {
          success: true,
          confidence: geologicalAnalysis.confidenceLevel,
          outputs: outputs,
          escalationRequired: true,
          escalationReason: escalationCheck.reason
        };
      }
      
      // Step 6: Validate outputs
      const outputsValid = await this.validateOutputs(this.expectedOutputs);
      
      this.logger.info(`✅ ${this.persona.name} geological analysis completed`);
      this.logger.info(`📊 Confidence: ${(geologicalAnalysis.confidenceLevel * 100).toFixed(1)}%`);
      
      return {
        success: outputsValid,
        confidence: geologicalAnalysis.confidenceLevel,
        outputs: outputs
      };
      
    } catch (error) {
      this.logger.error(`❌ ${this.persona.name} analysis failed:`, error);
      return {
        success: false,
        confidence: 0,
        outputs: {},
        errors: [String(error)]
      };
    }
  }

  private async parseRawGeologicalData(inputs: GeowizInputs): Promise<any> {
    const rawData: any = {
      region: inputs.region,
      shapefile: inputs.shapefile,
      lasData: {},
      dataQuality: 'demo',
      analysisTimestamp: new Date().toISOString()
    };

    // Parse LAS files if available
    if (inputs.lasFiles && await this.fileExists(inputs.lasFiles)) {
      try {
        const lasData = await this.parseLASFile(inputs.lasFiles);
        rawData.lasData = lasData;
        rawData.dataQuality = 'real';
        this.logger.info(`📊 Parsed LAS file: ${path.basename(inputs.lasFiles)}`);
      } catch (error) {
        this.logger.warn(`⚠️  LAS parsing failed: ${error}`);
      }
    }

    // Use demo data if no real data available
    if (!rawData.lasData || Object.keys(rawData.lasData).length === 0) {
      rawData.lasData = this.createDemoLASData();
      rawData.dataQuality = 'demo';
      this.logger.info(`📊 ${this.persona.name} using demo geological data`);
    }

    return rawData;
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private async parseLASFile(filePath: string): Promise<LASData | null> {
    try {
      // Use the existing las-parse.ts tool
      const result = await this.runCommand(['tsx', 'tools/las-parse.ts', filePath, '--json']);
      if (result.success) {
        return JSON.parse(result.stdout);
      }
    } catch (error) {
      this.logger.error(`LAS parsing error: ${error}`);
    }
    return null;
  }

  private async runCommand(command: string[]): Promise<{ success: boolean; stdout: string; stderr: string }> {
    return new Promise((resolve) => {
      const [cmd, ...args] = command;
      const child = spawn(cmd, args, { stdio: ['pipe', 'pipe', 'pipe'] });
      
      let stdout = '';
      let stderr = '';
      
      child.stdout?.on('data', (data) => stdout += data.toString());
      child.stderr?.on('data', (data) => stderr += data.toString());
      
      child.on('close', (code) => {
        resolve({
          success: code === 0,
          stdout,
          stderr
        });
      });
    });
  }

  private createDemoLASData(): LASData {
    return {
      version: '2.0',
      wellName: 'DEMO_WELL_001',
      depthUnit: 'ft',
      depthStart: 8000,
      depthStop: 8500,
      depthStep: 0.5,
      nullValue: -999.25,
      curves: [
        {
          name: 'DEPT',
          unit: 'ft',
          description: 'Depth',
          data: Array.from({ length: 1000 }, (_, i) => 8000 + i * 0.5)
        },
        {
          name: 'GR',
          unit: 'API',
          description: 'Gamma Ray',
          data: Array.from({ length: 1000 }, () => 80 + Math.random() * 40)
        },
        {
          name: 'RHOB',
          unit: 'g/cm3',
          description: 'Bulk Density',
          data: Array.from({ length: 1000 }, () => 2.45 + Math.random() * 0.2)
        },
        {
          name: 'NPHI',
          unit: 'frac',
          description: 'Neutron Porosity',
          data: Array.from({ length: 1000 }, () => 0.05 + Math.random() * 0.1)
        }
      ],
      depthData: Array.from({ length: 1000 }, (_, i) => 8000 + i * 0.5),
      rows: 1000,
      company: 'Demo Company',
      field: 'Demo Field',
      location: 'Permian Basin, TX'
    };
  }

  private async performIntelligentGeologicalAnalysis(rawData: any, region: string): Promise<GeologicalAnalysis> {
    if (this.llmClient) {
      return this.performLLMGeologicalAnalysis(rawData, region);
    } else {
      return this.performDeterministicGeologicalAnalysis(rawData, region);
    }
  }

  private async performLLMGeologicalAnalysis(rawData: any, region: string): Promise<GeologicalAnalysis> {
    const geologicalPrompt = `
      You are ${this.persona.name}, ${this.persona.role}.
      
      Analyze this geological data from the ${region} Basin and provide your professional assessment:
      
      Raw Data Summary:
      - Well: ${rawData.lasData.wellName || 'Unknown'}
      - Depth Range: ${rawData.lasData.depthStart}-${rawData.lasData.depthStop} ${rawData.lasData.depthUnit}
      - Available Curves: ${rawData.lasData.curves?.map((c: any) => c.name).join(', ') || 'None'}
      - Data Quality: ${rawData.dataQuality}
      
      As an expert geologist with 15+ years experience, provide your analysis in JSON format exactly as shown:
      {
        "formationQuality": {
          "reservoirQuality": "excellent|good|fair|poor",
          "porosityAssessment": "your analysis of porosity data",
          "permeabilityAssessment": "your analysis of permeability indicators",
          "hydrocarbonPotential": "high|medium|low",
          "completionEffectiveness": "your assessment of completability"
        },
        "drillingRecommendations": {
          "optimalLandingZones": ["zone1", "zone2"],
          "lateralLengthRecommendation": "feet and reasoning",
          "completionStrategy": "your recommended completion approach",
          "drillingRisks": ["risk1", "risk2"]
        },
        "investmentPerspective": {
          "geologicalConfidence": 0.85,
          "developmentPotential": "your assessment of development upside",
          "keyRisks": ["geological risk factors"],
          "comparableAnalogues": ["similar successful projects"],
          "recommendedAction": "drill|pass|more_data_needed"
        },
        "professionalSummary": "Your executive summary as a senior geologist",
        "confidenceLevel": 0.85
      }
      
      Think like an experienced geologist making a multi-million dollar recommendation.
    `;

    try {
      const llmResponse = await this.generatePersonaResponse(geologicalPrompt, {
        region,
        rawData
      });

      const analysis = JSON.parse(llmResponse);
      return {
        ...analysis,
        llmEnhanced: true,
        geologistPersona: this.persona.name
      };
    } catch (error) {
      this.logger.error(`LLM geological analysis failed: ${error}`);
      return this.performDeterministicGeologicalAnalysis(rawData, region);
    }
  }

  private performDeterministicGeologicalAnalysis(rawData: any, region: string): GeologicalAnalysis {
    // Fallback deterministic analysis
    const formations = this.analyzeFormations(rawData.lasData, region);
    
    return {
      formationQuality: {
        reservoirQuality: "good",
        porosityAssessment: "Moderate porosity observed in target intervals based on regional analogs",
        permeabilityAssessment: "Typical unconventional permeability expected",
        hydrocarbonPotential: "medium",
        completionEffectiveness: "Standard multi-stage completion expected to be effective"
      },
      drillingRecommendations: {
        optimalLandingZones: formations.map(f => f.name).slice(0, 2),
        lateralLengthRecommendation: "10000 ft for optimal drainage and economics",
        completionStrategy: "Multi-stage hydraulic fracturing with optimized cluster spacing",
        drillingRisks: ["Formation heterogeneity", "Pressure variations"]
      },
      investmentPerspective: {
        geologicalConfidence: 0.75,
        developmentPotential: "Standard unconventional development potential",
        keyRisks: ["Geological uncertainty", "Completion optimization needs"],
        comparableAnalogues: ["Regional offset wells"],
        recommendedAction: "drill"
      },
      professionalSummary: "Deterministic geological analysis indicates viable development opportunity with typical unconventional characteristics",
      confidenceLevel: 0.75,
      llmEnhanced: false
    };
  }

  private analyzeFormations(lasData: LASData, region: string): Formation[] {
    const regionalFormations = this.getRegionalFormations(region);
    const formations: Formation[] = [];
    
    let currentDepth = lasData.depthStart || 8000;
    
    for (let i = 0; i < Math.min(regionalFormations.length, 3); i++) {
      const formation = regionalFormations[i];
      const thickness = formation.typicalThickness || 200;
      
      formations.push({
        name: formation.name,
        lithology: formation.lithology,
        topDepth: currentDepth,
        bottomDepth: currentDepth + thickness,
        thickness,
        depthUnit: lasData.depthUnit || 'ft',
        confidence: this.calculateFormationConfidence(lasData.curves || []),
        properties: formation.properties || {}
      });
      
      currentDepth += thickness;
    }
    
    return formations;
  }

  private getRegionalFormations(region: string): Array<{
    name: string;
    lithology: string;
    typicalThickness: number;
    properties: Record<string, number>;
  }> {
    const formationsDB: Record<string, any[]> = {
      Permian: [
        {
          name: "Wolfcamp A",
          lithology: "Shale/Limestone",
          typicalThickness: 200,
          properties: { porosity: 0.08, permeability: 0.0001 }
        },
        {
          name: "Wolfcamp B",
          lithology: "Shale/Limestone",
          typicalThickness: 200,
          properties: { porosity: 0.09, permeability: 0.00015 }
        },
        {
          name: "Bone Spring",
          lithology: "Limestone/Sandstone",
          typicalThickness: 300,
          properties: { porosity: 0.12, permeability: 0.0005 }
        }
      ],
      Bakken: [
        {
          name: "Three Forks",
          lithology: "Dolomite",
          typicalThickness: 100,
          properties: { porosity: 0.06, permeability: 0.0001 }
        },
        {
          name: "Middle Bakken",
          lithology: "Sandstone/Siltstone",
          typicalThickness: 40,
          properties: { porosity: 0.18, permeability: 0.001 }
        }
      ]
    };
    
    return formationsDB[region] || formationsDB.Permian;
  }

  private calculateFormationConfidence(curves: any[]): number {
    let confidence = 0.7;
    
    const curveNames = curves.map(c => c.name);
    if (curveNames.includes('GR')) confidence += 0.05;
    if (curveNames.includes('RHOB')) confidence += 0.05;
    if (curveNames.includes('NPHI')) confidence += 0.05;
    
    return Math.min(confidence, 0.95);
  }

  private async generateGeologicalAssessment(rawData: any, analysis: GeologicalAnalysis, region: string): Promise<any> {
    return {
      geologicalAnalysis: analysis,
      rawDataSummary: {
        dataQuality: rawData.dataQuality,
        analysisTimestamp: rawData.analysisTimestamp,
        region
      },
      recommendations: analysis.drillingRecommendations,
      confidence: analysis.confidenceLevel
    };
  }

  private async generateOutputFiles(assessment: any, region: string): Promise<Record<string, any>> {
    // Generate formations from assessment for compatibility
    const zones = assessment.geologicalAnalysis.drillingRecommendations.optimalLandingZones;
    const formations: Formation[] = zones.map((zone: string, i: number) => ({
      name: zone,
      lithology: "Shale/Limestone",
      topDepth: 8000 + i * 200,
      bottomDepth: 8200 + i * 200,
      thickness: 200,
      depthUnit: "ft",
      confidence: assessment.confidence,
      properties: {
        porosity: 0.08 + i * 0.01,
        permeability: 0.0001 + i * 0.00005
      }
    }));

    // Generate zones.geojson
    const zonesGeojson = this.generateZonesGeoJSON(formations);
    await this.saveOutputFile(zonesGeojson, path.join(this.outputDir, 'zones.geojson'), 'geojson');
    
    // Generate geology_summary.md
    const geologySummary = this.generateGeologySummary(formations, assessment.rawDataSummary, region);
    await this.saveOutputFile(geologySummary, path.join(this.outputDir, 'geology_summary.md'), 'md');
    
    return {
      zonesGeojson: path.join(this.outputDir, 'zones.geojson'),
      geologySummary: path.join(this.outputDir, 'geology_summary.md'),
      geologicalAnalysis: assessment.geologicalAnalysis
    };
  }

  private generateZonesGeoJSON(formations: Formation[]): any {
    return {
      type: "FeatureCollection",
      crs: {
        type: "name",
        properties: {
          name: "EPSG:4326"
        }
      },
      features: formations.map((formation, i) => ({
        type: "Feature",
        properties: {
          formation_name: formation.name,
          lithology: formation.lithology,
          top_depth: formation.topDepth,
          bottom_depth: formation.bottomDepth,
          thickness: formation.thickness,
          depth_unit: formation.depthUnit,
          confidence: formation.confidence,
          porosity: formation.properties.porosity || 0.1,
          permeability: formation.properties.permeability || 0.0001,
          zone_id: `zone_${i + 1}`
        },
        geometry: {
          type: "Polygon",
          coordinates: [[
            [-102.0, 32.0],  // Default coordinates
            [-102.0, 32.1],
            [-101.9, 32.1],
            [-101.9, 32.0],
            [-102.0, 32.0]
          ]]
        }
      }))
    };
  }

  private generateGeologySummary(formations: Formation[], metadata: any, region: string): string {
    const totalThickness = formations.reduce((sum, f) => sum + f.thickness, 0);
    const avgConfidence = formations.reduce((sum, f) => sum + f.confidence, 0) / formations.length;

    let summary = `# Geological Analysis Summary

**Region:** ${region}
**Run ID:** ${this.runId}
**Analysis Date:** ${new Date().toISOString().split('T')[0]} ${new Date().toTimeString().split(' ')[0]}
**Analyst:** ${this.persona.name}, ${this.persona.role}

## Executive Summary

Geological analysis identified ${formations.length} distinct formations within the target interval.
Overall formation quality appears ${formations.length >= 3 ? 'favorable' : 'marginal'} for development.

## Formation Analysis

| Formation | Top (ft) | Bottom (ft) | Thickness (ft) | Lithology | Confidence | Porosity | Permeability |
|-----------|----------|-------------|----------------|-----------|------------|----------|--------------|
`;

    for (const formation of formations) {
      const porosity = formation.properties.porosity || 0.1;
      const permeability = formation.properties.permeability || 0.0001;
      
      summary += `| ${formation.name} | ${formation.topDepth} | ${formation.bottomDepth} | ${formation.thickness} | ${formation.lithology} | ${formation.confidence.toFixed(2)} | ${porosity.toFixed(3)} | ${permeability.toFixed(6)} |\n`;
    }

    summary += `
## Key Insights

- **Total Productive Thickness:** ${totalThickness} ft
- **Average Confidence Level:** ${avgConfidence.toFixed(2)}
- **Primary Lithology:** ${formations[0]?.lithology || 'Unknown'}
- **Depth Range:** ${formations[0]?.topDepth || 0} - ${formations[formations.length - 1]?.bottomDepth || 0} ft

## Data Quality Assessment

- **Data Source:** ${metadata.dataQuality === 'real' ? 'Well log data' : 'Regional geological knowledge'}
- **Analysis Method:** ${metadata.dataQuality === 'real' ? 'Log-based interpretation' : 'Regional analog approach'}

## Professional Recommendations

`;

    if (avgConfidence > 0.8) {
      summary += "- High confidence in formation identification supports proceeding with development planning\n";
    } else {
      summary += "- Consider additional log analysis or formation evaluation before proceeding\n";
    }

    if (totalThickness > 200) {
      summary += "- Sufficient thickness for horizontal drilling targets\n";
    } else {
      summary += "- Limited productive thickness may impact development economics\n";
    }

    summary += `
## Methodology

This analysis used ${this.persona.name}'s expertise in ${region} Basin geology combined with ${metadata.dataQuality === 'real' ? 'available well log data' : 'regional geological knowledge'}.
Formation boundaries were interpreted based on ${metadata.dataQuality === 'real' ? 'log character and regional stratigraphy' : 'typical regional stratigraphy'}.
Confidence levels reflect data quality and geological certainty.

## Risk Assessment

- **Data Quality Risk:** ${metadata.dataQuality === 'demo' ? 'High - based on regional analogs only' : 'Low - based on actual well data'}
- **Geological Risk:** ${avgConfidence < 0.7 ? 'High' : avgConfidence < 0.8 ? 'Medium' : 'Low'}
- **Development Risk:** Standard unconventional development risks apply
`;

    return summary;
  }

  protected checkEscalationCriterion(criterion: string, context?: any): boolean {
    switch (criterion) {
      case 'geological_confidence < 0.6':
        return (context?.geologicalConfidence || 0) < 0.6;
      case 'high_drilling_risk':
        return context?.region === 'Unknown' || context?.dataQuality === 'poor';
      case 'insufficient_data_quality':
        return context?.dataQuality === 'demo' && (context?.geologicalConfidence || 0) < 0.7;
      default:
        return false;
    }
  }
}

/**
 * CLI entry point
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const argMap: Record<string, string> = {};
  
  for (let i = 0; i < args.length; i += 2) {
    if (args[i].startsWith('--')) {
      argMap[args[i].slice(2)] = args[i + 1] || '';
    }
  }
  
  const runId = argMap['run-id'] || 'demo';
  const outputDir = argMap['output-dir'] || `./data/outputs/${runId}`;
  const shapefile = argMap.shapefile || 'data/samples/tract.shp.txt';
  const region = argMap.region || 'Permian';
  const lasFiles = argMap['las-files'];
  
  if (!shapefile || !region) {
    console.error('Usage: tsx src/agents/geowiz.ts --shapefile <file> --region <region> --run-id <id> --output-dir <dir> [--las-files <files>]');
    process.exit(1);
  }
  
  try {
    const agent = new GeoWizAgent(runId, outputDir);
    const result = await agent.execute({ shapefile, region, lasFiles });
    
    console.log(`Geowiz Agent Result: ${result.success ? 'SUCCESS' : 'FAILED'}`);
    console.log(`Confidence: ${(result.confidence * 100).toFixed(1)}%`);
    
    if (result.escalationRequired) {
      console.log(`⚠️  Human escalation required: ${result.escalationReason}`);
    }
    
    process.exit(result.success ? 0 : 1);
  } catch (error) {
    console.error('Geowiz Agent failed:', error);
    process.exit(1);
  }
}

// Only run main if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}