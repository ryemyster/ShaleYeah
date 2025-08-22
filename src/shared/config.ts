/**
 * SHALE YEAH Configuration Management
 * 
 * Handles environment variables and configuration for the agentic AI platform
 */

import { config } from 'dotenv';
import path from 'path';
import type { EnvironmentConfig, NodeEnvironment, PipelineMode, ModeConfig } from './types.js';

// Load environment variables from .env file
config();

/**
 * Detect Node environment
 */
export function getNodeEnvironment(): NodeEnvironment {
  const env = process.env.NODE_ENV?.toLowerCase();
  if (env === 'production') return 'production';
  if (env === 'test') return 'test';
  return 'development';
}

/**
 * Detect pipeline mode from environment or arguments
 */
export function getPipelineMode(override?: string): PipelineMode {
  // Check CLI override first
  if (override) {
    const overrideMode = override.toLowerCase();
    if (overrideMode === 'production') return 'production';
    if (overrideMode === 'batch') return 'batch';
    if (overrideMode === 'research') return 'research';
    if (overrideMode === 'demo') return 'demo';
  }
  
  // Check environment variable
  const envMode = process.env.PIPELINE_MODE?.toLowerCase();
  if (envMode === 'production') return 'production';
  if (envMode === 'batch') return 'batch';
  if (envMode === 'research') return 'research';
  if (envMode === 'demo') return 'demo';
  
  // Default based on NODE_ENV, but allow override
  const nodeEnv = getNodeEnvironment();
  if (nodeEnv === 'production') {
    return 'production';
  } else {
    // In development, default to demo but can be overridden by CLI
    return 'demo';
  }
}

/**
 * Get mode-specific configuration
 */
export function getModeConfig(mode: PipelineMode, nodeEnv: NodeEnvironment): ModeConfig {
  const modeConfigs: Record<PipelineMode, ModeConfig> = {
    demo: {
      allowMockLlm: true,
      requireApiKeys: false,
      strictValidation: false,
      enableAuditLogging: false,
      useDemoData: true,
      fastExecution: true,
      fullOrchestration: false
    },
    production: {
      allowMockLlm: false,
      requireApiKeys: true,
      strictValidation: true,
      enableAuditLogging: true,
      useDemoData: false,
      fastExecution: false,
      fullOrchestration: true
    },
    batch: {
      allowMockLlm: false,
      requireApiKeys: true,
      strictValidation: true,
      enableAuditLogging: true,
      useDemoData: false,
      fastExecution: false,
      fullOrchestration: true
    },
    research: {
      allowMockLlm: true,
      requireApiKeys: false,
      strictValidation: false,
      enableAuditLogging: false,
      useDemoData: true,
      fastExecution: true,
      fullOrchestration: false
    }
  };

  const config = modeConfigs[mode];
  
  // Override some settings based on NODE_ENV
  if (nodeEnv === 'production') {
    config.allowMockLlm = false;
    config.requireApiKeys = true;
    config.strictValidation = true;
    config.enableAuditLogging = true;
  }
  
  return config;
}

/**
 * Get environment configuration with defaults
 */
export function getEnvironmentConfig(modeOverride?: string): EnvironmentConfig {
  const nodeEnv = getNodeEnvironment();
  const mode = getPipelineMode(modeOverride);
  const modeConfig = getModeConfig(mode, nodeEnv);
  
  return {
    // Core environment
    nodeEnv,
    mode,
    modeConfig,
    
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
    devMode: process.env.DEV_MODE === 'true' || nodeEnv === 'development',
    
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
 * Validate required environment variables based on mode
 */
export function validateEnvironment(): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const config = getEnvironmentConfig();
  
  // Mode-specific validation
  if (config.modeConfig.requireApiKeys) {
    if (!config.anthropicApiKey && !config.openaiApiKey) {
      errors.push(`${config.mode.toUpperCase()} mode requires at least one LLM API key (ANTHROPIC_API_KEY or OPENAI_API_KEY)`);
    }
  } else {
    if (!config.anthropicApiKey && !config.openaiApiKey) {
      warnings.push(`No LLM API keys configured. ${config.mode.toUpperCase()} mode will use mock responses.`);
    }
  }
  
  // Validate output directory path
  if (!config.outDir) {
    errors.push('OUT_DIR not configured properly');
  }
  
  // Production-specific validations
  if (config.nodeEnv === 'production') {
    if (config.devMode) {
      warnings.push('DEV_MODE is enabled in production environment');
    }
    
    if (config.logLevel === 'debug') {
      warnings.push('Debug logging enabled in production - may impact performance');
    }
  }
  
  // Demo mode warnings
  if (config.mode === 'demo' && config.modeConfig.useDemoData) {
    warnings.push('Demo mode using sample data - not suitable for production analysis');
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
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
  return '\\n\\n---\\n\\nGenerated with SHALE YEAH 2025 Ryan McDonald / Ascendvent LLC - Apache-2.0';
}

/**
 * Setup logging based on environment configuration
 */
export function setupLogging(): void {
  const config = getEnvironmentConfig();
  
  // In a more sophisticated setup, you might configure a proper logging library here
  // For now, we'll use console with different levels
  console.log(`🌍 Environment: ${config.nodeEnv.toUpperCase()}`);
  console.log(`🎯 Pipeline Mode: ${config.mode.toUpperCase()}`);
  
  if (config.devMode) {
    console.log('🔧 Development mode enabled');
  }
  
  // Mode-specific logging
  if (config.modeConfig.useDemoData) {
    console.log('📋 Using demo/sample data');
  }
  
  if (config.modeConfig.allowMockLlm) {
    console.log('🎭 Mock LLM responses enabled');
  }
  
  if (config.modeConfig.enableAuditLogging) {
    console.log('📝 Audit logging enabled');
  }
  
  console.log(`📊 Log level: ${config.logLevel}`);
  console.log(`🤖 LLM Provider: ${config.llmProvider}`);
  console.log(`📁 Output directory: ${config.outDir}`);
}