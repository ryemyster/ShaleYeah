/**
 * SHALE YEAH LLM Client - AI-Powered Agent Intelligence
 * 
 * Provides LLM integration for agent personas using Anthropic Claude and OpenAI GPT
 * Each agent uses this to think and reason like a human oil & gas professional
 */

import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import type { 
  LLMResponse, 
  LLMAnalysisResult, 
  AgentPersona,
  GeologicalAnalysis,
  OrchestrationDecision 
} from './types.js';

export abstract class LLMClient {
  protected modelName: string;
  protected logger: Console;

  constructor(modelName: string = 'default') {
    this.modelName = modelName;
    this.logger = console;
  }

  abstract generateResponse(prompt: string, context?: any): Promise<string>;
  abstract analyzeData(data: any, analysisType: string): Promise<LLMAnalysisResult>;
}

export class ClaudeClient extends LLMClient {
  private client: Anthropic;
  private apiKey: string;

  constructor(modelName: string = 'claude-3-haiku-20240307') {
    super(modelName);
    this.apiKey = process.env.ANTHROPIC_API_KEY || '';
    
    if (!this.apiKey) {
      throw new Error('ANTHROPIC_API_KEY not set - Claude integration disabled');
    }

    this.client = new Anthropic({
      apiKey: this.apiKey,
    });
  }

  async generateResponse(prompt: string, context?: any): Promise<string> {
    try {
      // Build system message with context
      let systemMsg = "You are an expert oil and gas analyst.";
      if (context) {
        if (context.persona) {
          systemMsg = `You are ${context.persona.name}, ${context.persona.role}. ${context.persona.llmInstructions}`;
        }
        if (context.projectContext) {
          systemMsg += `\\n\\nProject Context: ${JSON.stringify(context.projectContext, null, 2)}`;
        }
      }

      const response = await this.client.messages.create({
        model: this.modelName,
        max_tokens: 4000,
        system: systemMsg,
        messages: [{ role: 'user', content: prompt }],
      });

      const content = response.content[0];
      if (content.type === 'text') {
        return content.text;
      }
      
      throw new Error('Unexpected response type from Claude API');
      
    } catch (error) {
      this.logger.error(`Claude API error:`, error);
      throw error;
    }
  }

  async analyzeData(data: any, analysisType: string): Promise<LLMAnalysisResult> {
    const prompts = {
      geological: `
        Analyze this geological data and provide insights on:
        1. Formation quality and hydrocarbon potential
        2. Drilling risks and opportunities
        3. Development recommendations
        
        Data: ${JSON.stringify(data, null, 2)}
        
        Respond in JSON format with 'insights', 'risks', 'recommendations', 'confidence'.
      `,
      economic: `
        Analyze this economic data and provide insights on:
        1. Investment attractiveness
        2. Key risk factors
        3. Market positioning
        
        Data: ${JSON.stringify(data, null, 2)}
        
        Respond in JSON format with 'assessment', 'risks', 'opportunities', 'confidence'.
      `,
      risk: `
        Perform risk analysis on this data:
        1. Identify key risk factors
        2. Assess probability and impact
        3. Suggest mitigation strategies
        
        Data: ${JSON.stringify(data, null, 2)}
        
        Respond in JSON format with 'risk_factors', 'mitigation_strategies', 'overall_risk_level'.
      `
    };

    const prompt = prompts[analysisType as keyof typeof prompts] || prompts.geological;
    const response = await this.generateResponse(prompt);

    try {
      const parsedResponse = JSON.parse(response);
      return {
        analysis: parsedResponse.insights || parsedResponse.assessment || response,
        confidence: parsedResponse.confidence || 0.7,
        insights: parsedResponse,
        risks: parsedResponse.risks || [],
        recommendations: parsedResponse.recommendations || []
      };
    } catch (error) {
      return {
        analysis: response,
        confidence: 0.7
      };
    }
  }
}

export class OpenAIClient extends LLMClient {
  private client: OpenAI;
  private apiKey: string;

  constructor(modelName: string = 'gpt-4') {
    super(modelName);
    this.apiKey = process.env.OPENAI_API_KEY || '';
    
    if (!this.apiKey) {
      throw new Error('OPENAI_API_KEY not set - GPT integration disabled');
    }

    this.client = new OpenAI({
      apiKey: this.apiKey,
    });
  }

  async generateResponse(prompt: string, context?: any): Promise<string> {
    try {
      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: 'system', content: 'You are an expert oil and gas analyst.' }
      ];

      if (context?.persona) {
        messages[0] = {
          role: 'system',
          content: `You are ${context.persona.name}, ${context.persona.role}. ${context.persona.llmInstructions}`
        };
      }

      if (context?.projectContext) {
        messages.push({
          role: 'system',
          content: `Project Context: ${JSON.stringify(context.projectContext, null, 2)}`
        });
      }

      messages.push({ role: 'user', content: prompt });

      const response = await this.client.chat.completions.create({
        model: this.modelName,
        messages,
        max_tokens: 4000,
      });

      return response.choices[0]?.message?.content || '';
      
    } catch (error) {
      this.logger.error(`OpenAI API error:`, error);
      throw error;
    }
  }

  async analyzeData(data: any, analysisType: string): Promise<LLMAnalysisResult> {
    // Similar implementation to Claude but with OpenAI API
    const prompt = `Analyze this ${analysisType} data: ${JSON.stringify(data, null, 2)}`;
    const response = await this.generateResponse(prompt);
    
    return {
      analysis: response,
      confidence: 0.7
    };
  }
}

export class MockLLMClient extends LLMClient {
  constructor(modelName: string = 'mock-intelligent-model') {
    super(modelName);
  }

  async generateResponse(prompt: string, context?: any): Promise<string> {
    // Analyze prompt to determine response type
    if (prompt.toLowerCase().includes('geological') && prompt.toLowerCase().includes('json')) {
      return JSON.stringify({
        formationQuality: {
          reservoirQuality: "good",
          porosityAssessment: "Moderate porosity of 8-12% observed in target intervals based on offset well data",
          permeabilityAssessment: "Typical unconventional permeability range of 0.0001-0.0005 md",
          hydrocarbonPotential: "medium",
          completionEffectiveness: "Standard multi-stage hydraulic fracturing expected to be effective"
        },
        drillingRecommendations: {
          optimalLandingZones: ["Wolfcamp A", "Wolfcamp B"],
          lateralLengthRecommendation: "10000 ft to optimize drainage and economics",
          completionStrategy: "60-stage hydraulic fracturing with optimized cluster spacing",
          drillingRisks: ["Formation heterogeneity", "Pressure depletion in nearby wells"]
        },
        investmentPerspective: {
          geologicalConfidence: 0.82,
          developmentPotential: "Above-average development potential in proven fairway",
          keyRisks: ["Commodity price volatility", "Completion optimization needs"],
          comparableAnalogues: ["XTO Permian wells", "Pioneer Natural Resources offsets"],
          recommendedAction: "drill"
        },
        professionalSummary: "Strong geological indicators support development with 82% confidence. Target formations show excellent thickness and lateral continuity.",
        confidenceLevel: 0.82
      }, null, 2);
    }
    
    if (prompt.toLowerCase().includes('investment director') && prompt.toLowerCase().includes('json')) {
      return JSON.stringify({
        nextAgents: ["drillcast", "titletracker"],
        reasoning: "Following geological analysis, we need drilling engineering and ownership verification before economic modeling",
        confidence: 0.85,
        escalateToHuman: false,
        escalationReason: null
      }, null, 2);
    }
    
    return "Mock LLM response: Intelligent analysis would be provided here based on the specific domain expertise requested.";
  }

  async analyzeData(data: any, analysisType: string): Promise<LLMAnalysisResult> {
    if (analysisType === 'geological') {
      return {
        analysis: "Strong reservoir characteristics with above-average porosity",
        confidence: 0.82,
        insights: {
          formationQuality: "good",
          developmentPotential: "above-average"
        },
        risks: ["Formation variability", "Drilling complexity"],
        recommendations: ["Proceed with development", "Consider extended laterals"]
      };
    }
    
    return {
      analysis: `Mock ${analysisType} analysis of provided data`,
      confidence: 0.75
    };
  }
}

/**
 * Factory function to get appropriate LLM client
 */
export function createLLMClient(provider?: string): LLMClient {
  const selectedProvider = provider || process.env.LLM_PROVIDER || 'claude';
  
  // Check if we have real API keys and can use real LLMs
  const hasAnthropicKey = Boolean(process.env.ANTHROPIC_API_KEY);
  const hasOpenAIKey = Boolean(process.env.OPENAI_API_KEY);
  
  try {
    if (selectedProvider.toLowerCase() === 'claude' && hasAnthropicKey) {
      return new ClaudeClient();
    } else if (selectedProvider.toLowerCase() === 'openai' && hasOpenAIKey) {
      return new OpenAIClient();
    } else {
      console.warn(`No API key available for ${selectedProvider}, using mock LLM client`);
      return new MockLLMClient();
    }
  } catch (error) {
    console.warn(`Failed to create ${selectedProvider} client, falling back to mock:`, error);
    return new MockLLMClient();
  }
}

/**
 * Always return a working LLM client, using mock if real ones unavailable
 */
export function getLLMClientOrMock(provider?: string): LLMClient {
  return createLLMClient(provider);
}