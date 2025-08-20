/**
 * SHALE YEAH Configuration Management
 * 
 * Handles environment variables and configuration for the agentic AI platform
 */

import { config } from 'dotenv';
import path from 'path';
import type { EnvironmentConfig } from './types.js';

// Load environment variables from .env file
config();

/**
 * Get environment configuration with defaults
 */
export function getEnvironmentConfig(): EnvironmentConfig {
  return {
    // LLM Configuration
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    openaiApiKey: process.env.OPENAI_API_KEY,
    llmProvider: (process.env.LLM_PROVIDER as 'claude' | 'openai') || 'claude',
    
    // Pipeline Configuration
    runId: process.env.RUN_ID || generateRunId(),
    outDir: process.env.OUT_DIR || `./data/outputs/${process.env.RUN_ID || generateRunId()}`,
    pipelineGoal: process.env.PIPELINE_GOAL || 'tract_eval',
    
    // Development Settings
    logLevel: (process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error') || 'info',
    devMode: process.env.DEV_MODE === 'true',
    
    // Optional SIEM Integrations
    splunkHecToken: process.env.SPLUNK_HEC_TOKEN,
    sentinelBearer: process.env.SENTINEL_BEARER,
    elasticApiKey: process.env.ELASTIC_API_KEY,
    cortexApiKey: process.env.CORTEX_API_KEY,
    
    // Optional GIS Integrations
    arcgisToken: process.env.ARCGIS_TOKEN,
    qgisServerUrl: process.env.QGIS_SERVER_URL,
    
    // Optional Mining Software Integrations
    leapfrogApiUrl: process.env.LEAPFROG_API_URL,
    surpacServer: process.env.SURPAC_SERVER,
  };
}

/**
 * Generate a unique run ID based on timestamp
 */
export function generateRunId(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hour = String(now.getHours()).padStart(2, '0');
  const minute = String(now.getMinutes()).padStart(2, '0');
  const second = String(now.getSeconds()).padStart(2, '0');
  
  return `${year}${month}${day}-${hour}${minute}${second}`;
}

/**
 * Validate required environment variables
 */
export function validateEnvironment(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const config = getEnvironmentConfig();
  
  // Check if at least one LLM provider is configured
  if (!config.anthropicApiKey && !config.openaiApiKey) {
    errors.push('Warning: No LLM API keys configured. Agents will use mock responses.');
  }
  
  // Validate output directory path
  if (!config.outDir) {
    errors.push('OUT_DIR not configured properly');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Get absolute path for output directory
 */
export function getOutputDir(runId?: string): string {
  const config = getEnvironmentConfig();
  const actualRunId = runId || config.runId;
  const baseDir = config.outDir.replace('${RUN_ID}', actualRunId);
  return path.resolve(baseDir);
}

/**
 * Get default input values for agents when not provided
 */
export function getDefaultInputs(agentName: string, runId: string): Record<string, string> {
  const outDir = getOutputDir(runId);
  
  const defaultInputs: Record<string, Record<string, string>> = {
    geowiz: {
      shapefile: 'data/samples/tract.shp.txt',
      region: 'Permian',
      lasFiles: 'data/samples/demo.las'
    },
    'curve-smith': {
      lasFiles: 'data/samples/demo.las',
      zones: path.join(outDir, 'zones.geojson')
    },
    drillcast: {
      zones: path.join(outDir, 'zones.geojson')
    },
    titletracker: {
      accessDb: 'data/samples/demo.accdb.txt'
    },
    econobot: {
      drillForecast: path.join(outDir, 'drill_forecast.json'),
      ownershipData: path.join(outDir, 'ownership.json')
    },
    riskranger: {
      valuationData: path.join(outDir, 'valuation.json'),
      ownershipData: path.join(outDir, 'ownership.json')
    },
    'the-core': {
      valuationData: path.join(outDir, 'valuation.json'),
      riskAssessment: path.join(outDir, 'risk_score.json'),
      ownershipData: path.join(outDir, 'ownership.json')
    },
    notarybot: {
      investmentDecision: path.join(outDir, 'investment_decision.json')
    }
  };
  
  return defaultInputs[agentName] || {};
}

/**
 * Create SHALE YEAH footer for all outputs
 */
export function createShaleYeahFooter(): string {
  return '\\n\\n---\\n\\nGenerated with SHALE YEAH (c) Ryan McDonald / Ascendvent LLC - Apache-2.0';
}

/**
 * Setup logging based on environment configuration
 */
export function setupLogging(): void {
  const config = getEnvironmentConfig();
  
  // In a more sophisticated setup, you might configure a proper logging library here
  // For now, we'll use console with different levels
  if (config.devMode) {
    console.log('🔧 Development mode enabled');
  }
  
  console.log(`📊 Log level: ${config.logLevel}`);
  console.log(`🤖 LLM Provider: ${config.llmProvider}`);
  console.log(`📁 Output directory: ${config.outDir}`);
}