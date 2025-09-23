/**
 * SHALE YEAH TypeScript Type Definitions
 * 
 * Core types for the agentic AI oil & gas investment platform
 */

import { z } from 'zod';

// ==========================================
// Agent Persona Types
// ==========================================

export interface AgentPersona {
  name: string;
  role: string;
  experience: string;
  personality: string;
  llmInstructions: string;
  decisionAuthority: string;
  confidenceThreshold: number;
  escalationCriteria?: string[];
}

export interface AgentConfig {
  name: string;
  persona: AgentPersona;
  cli: {
    entrypoint: string;
    args: string[];
  };
  inputs: {
    required: Record<string, string> | string[];
    optional?: Record<string, string>;
  };
  outputs: Array<{
    name: string;
    path: string;
    type: string;
  }>;
  nextAgents: {
    onSuccess: string[];
    onFailure: string[];
  };
  errorHandling: {
    timeout: number;
    retries: number;
  };
}

// ==========================================
// Pipeline and Orchestration Types
// ==========================================

export interface PipelineState {
  runId: string;
  startTime: number;
  endTime?: number;
  totalDuration?: number;
  agentsCompleted: Array<{
    name: string;
    executionTime: number;
    timestamp: number;
  }>;
  agentsFailed: Array<{
    name: string;
    errorCode: number;
    errorMessage: string;
    timestamp: number;
  }>;
  currentAgent?: string;
  outputs: Record<string, Record<string, string>>;
  metadata: Record<string, any>;
  pipelineSuccess?: boolean;
  orchestrationReasoning?: string;
}

export interface ProjectContext {
  availableOutputs: Record<string, any>;
  runState: PipelineState;
  timestamp: number;
}

export interface OrchestrationDecision {
  nextAgents: string[];
  reasoning: string;
  confidence: number;
  escalateToHuman: boolean;
  escalationReason?: string;
}

// ==========================================
// LLM Integration Types
// ==========================================

export interface LLMResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface LLMAnalysisResult {
  analysis: string;
  confidence: number;
  insights?: any;
  risks?: string[];
  recommendations?: string[];
  errors?: string[];
}

// ==========================================
// Geological Data Types
// ==========================================

export interface LASCurve {
  name: string;
  unit: string;
  description: string;
  data: number[];
}

export interface LASData {
  version: string;
  wellName: string;
  depthUnit: string;
  depthStart: number;
  depthStop: number;
  depthStep: number;
  nullValue: number;
  curves: LASCurve[];
  depthData: number[];
  rows: number;
  company?: string;
  field?: string;
  location?: string;
}

export interface Formation {
  name: string;
  lithology: string;
  topDepth: number;
  bottomDepth: number;
  thickness: number;
  depthUnit: string;
  confidence: number;
  properties: {
    porosity?: number;
    permeability?: number;
    [key: string]: any;
  };
}

export interface GeologicalAnalysis {
  formationQuality: {
    reservoirQuality: 'excellent' | 'good' | 'fair' | 'poor';
    porosityAssessment: string;
    permeabilityAssessment: string;
    hydrocarbonPotential: 'high' | 'medium' | 'low';
    completionEffectiveness: string;
  };
  drillingRecommendations: {
    optimalLandingZones: string[];
    lateralLengthRecommendation: string;
    completionStrategy: string;
    drillingRisks: string[];
  };
  investmentPerspective: {
    geologicalConfidence: number;
    developmentPotential: string;
    keyRisks: string[];
    comparableAnalogues: string[];
    recommendedAction: 'drill' | 'pass' | 'more_data_needed';
  };
  professionalSummary: string;
  confidenceLevel: number;
  llmEnhanced?: boolean;
  geologistPersona?: string;
}

// ==========================================
// Economic and Risk Types
// ==========================================

export interface EconomicAnalysis {
  npv: number;
  irr: number;
  roi: number;
  paybackPeriod: number;
  assumptions: {
    oilPrice: number;
    gasPrice: number;
    drillingCost: number;
    completionCost: number;
  };
  sensitivityAnalysis: Array<{
    variable: string;
    scenarios: Record<string, number>;
  }>;
}

export interface RiskAssessment {
  overallRiskScore: number;
  riskFactors: Array<{
    category: string;
    description: string;
    probability: number;
    impact: number;
    mitigationStrategies: string[];
  }>;
  monteCarloResults?: {
    p10: number;
    p50: number;
    p90: number;
  };
}

// ==========================================
// Agent Result Types
// ==========================================

export interface AgentResult {
  success: boolean;
  confidence: number;
  outputs: Record<string, any>;
  errors?: string[];
  escalationRequired?: boolean;
  escalationReason?: string;
  executionTime?: number;
}

// ==========================================
// Configuration Schema Validation
// ==========================================

export const AgentConfigSchema = z.object({
  name: z.string(),
  persona: z.object({
    name: z.string(),
    role: z.string(),
    experience: z.string(),
    personality: z.string(),
    llmInstructions: z.string(),
    decisionAuthority: z.string(),
    confidenceThreshold: z.number().min(0).max(1),
    escalationCriteria: z.array(z.string()).optional(),
  }),
  cli: z.object({
    entrypoint: z.string(),
    args: z.array(z.string()),
  }),
  inputs: z.object({
    required: z.union([z.record(z.string(), z.string()), z.array(z.string())]),
    optional: z.record(z.string(), z.string()).optional(),
  }),
  outputs: z.array(z.object({
    name: z.string(),
    path: z.string(),
    type: z.string(),
  })),
  nextAgents: z.object({
    onSuccess: z.array(z.string()),
    onFailure: z.array(z.string()),
  }),
  errorHandling: z.object({
    timeout: z.number(),
    retries: z.number(),
  }),
});

export type ValidatedAgentConfig = z.infer<typeof AgentConfigSchema>;

// ==========================================
// Environment Configuration
// ==========================================

// ==========================================
// Mode and Environment Types
// ==========================================

export type NodeEnvironment = 'development' | 'production' | 'test';
export type PipelineMode = 'demo' | 'production' | 'batch' | 'research';

export interface ModeConfig {
  allowMockLlm: boolean;
  requireApiKeys: boolean;
  strictValidation: boolean;
  enableAuditLogging: boolean;
  useDemoData: boolean;
  fastExecution: boolean;
  fullOrchestration: boolean;
}

export interface EnvironmentConfig {
  // Core environment
  nodeEnv: NodeEnvironment;
  mode: PipelineMode;
  modeConfig: ModeConfig;
  
  // LLM Configuration
  anthropicApiKey?: string;
  openaiApiKey?: string;
  llmProvider: 'claude' | 'openai';
  
  // Pipeline Configuration
  runId: string;
  outDir: string;
  pipelineGoal: string;
  
  // Development Settings
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  devMode: boolean;
  
  // Optional integrations
  splunkHecToken?: string;
  sentinelBearer?: string;
  elasticApiKey?: string;
  cortexApiKey?: string;
  arcgisToken?: string;
  qgisServerUrl?: string;
  leapfrogApiUrl?: string;
  surpacServer?: string;
}