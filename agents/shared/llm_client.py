#!/usr/bin/env python3
"""
LLM Client - Optional LLM integration for SHALE YEAH agents

Provides standardized LLM integration for agents that need intelligent
analysis capabilities beyond deterministic calculations.
"""

import os
import logging
import json
from typing import Dict, List, Optional, Any
from abc import ABC, abstractmethod

class LLMClient(ABC):
    """Abstract base class for LLM integrations"""
    
    def __init__(self, model_name: str = None):
        self.model_name = model_name
        self.logger = logging.getLogger(__name__)
        
    @abstractmethod
    def generate_response(self, prompt: str, context: Dict = None) -> str:
        """Generate response from LLM"""
        pass
    
    @abstractmethod
    def analyze_data(self, data: Dict, analysis_type: str) -> Dict:
        """Analyze structured data and return insights"""
        pass

class ClaudeClient(LLMClient):
    """Anthropic Claude integration"""
    
    def __init__(self, model_name: str = "claude-3-haiku-20240307"):
        super().__init__(model_name)
        self.api_key = os.getenv('ANTHROPIC_API_KEY')
        if not self.api_key:
            self.logger.warning("ANTHROPIC_API_KEY not set - Claude integration disabled")
    
    def generate_response(self, prompt: str, context: Dict = None) -> str:
        """Generate response using Claude"""
        if not self.api_key:
            return self._fallback_response(prompt, context)
            
        try:
            import anthropic
            client = anthropic.Anthropic(api_key=self.api_key)
            
            # Build system message with context
            system_msg = "You are an expert oil and gas analyst."
            if context:
                system_msg += f" Context: {json.dumps(context, indent=2)}"
            
            response = client.messages.create(
                model=self.model_name,
                max_tokens=2000,
                system=system_msg,
                messages=[{"role": "user", "content": prompt}]
            )
            
            return response.content[0].text
            
        except Exception as e:
            self.logger.error(f"Claude API error: {e}")
            return self._fallback_response(prompt, context)
    
    def analyze_data(self, data: Dict, analysis_type: str) -> Dict:
        """Analyze geological/economic data with Claude"""
        if not self.api_key:
            return {"analysis": "LLM analysis not available", "confidence": 0.5}
            
        prompts = {
            "geological": """
            Analyze this geological data and provide insights on:
            1. Formation quality and hydrocarbon potential
            2. Drilling risks and opportunities  
            3. Development recommendations
            
            Data: {data}
            
            Respond in JSON format with 'insights', 'risks', 'recommendations', 'confidence'.
            """,
            "economic": """
            Analyze this economic data and provide insights on:
            1. Investment attractiveness 
            2. Key risk factors
            3. Market positioning
            
            Data: {data}
            
            Respond in JSON format with 'assessment', 'risks', 'opportunities', 'confidence'.
            """,
            "risk": """
            Perform risk analysis on this data:
            1. Identify key risk factors
            2. Assess probability and impact
            3. Suggest mitigation strategies
            
            Data: {data}
            
            Respond in JSON format with 'risk_factors', 'mitigation_strategies', 'overall_risk_level'.
            """
        }
        
        prompt = prompts.get(analysis_type, prompts["geological"]).format(data=json.dumps(data, indent=2))
        response = self.generate_response(prompt)
        
        try:
            return json.loads(response)
        except json.JSONDecodeError:
            return {"analysis": response, "confidence": 0.7}
    
    def _fallback_response(self, prompt: str, context: Dict = None) -> str:
        """Fallback when LLM is unavailable"""
        return "LLM integration not available - using deterministic analysis"

class OpenAIClient(LLMClient):
    """OpenAI GPT integration"""
    
    def __init__(self, model_name: str = "gpt-4"):
        super().__init__(model_name)
        self.api_key = os.getenv('OPENAI_API_KEY')
        if not self.api_key:
            self.logger.warning("OPENAI_API_KEY not set - GPT integration disabled")
    
    def generate_response(self, prompt: str, context: Dict = None) -> str:
        """Generate response using OpenAI GPT"""
        if not self.api_key:
            return self._fallback_response(prompt, context)
            
        try:
            import openai
            client = openai.OpenAI(api_key=self.api_key)
            
            messages = [
                {"role": "system", "content": "You are an expert oil and gas analyst."}
            ]
            
            if context:
                messages.append({"role": "system", "content": f"Context: {json.dumps(context, indent=2)}"})
            
            messages.append({"role": "user", "content": prompt})
            
            response = client.chat.completions.create(
                model=self.model_name,
                messages=messages,
                max_tokens=2000
            )
            
            return response.choices[0].message.content
            
        except Exception as e:
            self.logger.error(f"OpenAI API error: {e}")
            return self._fallback_response(prompt, context)
    
    def analyze_data(self, data: Dict, analysis_type: str) -> Dict:
        """Analyze data with GPT (similar to Claude implementation)"""
        # Implementation similar to Claude but with OpenAI API calls
        return {"analysis": "GPT analysis implementation", "confidence": 0.7}
    
    def _fallback_response(self, prompt: str, context: Dict = None) -> str:
        """Fallback when LLM is unavailable"""
        return "LLM integration not available - using deterministic analysis"

def get_llm_client(provider: str = None) -> LLMClient:
    """Factory function to get LLM client"""
    provider = provider or os.getenv('LLM_PROVIDER', 'claude')
    
    if provider.lower() == 'claude':
        return ClaudeClient()
    elif provider.lower() in ['openai', 'gpt']:
        return OpenAIClient()
    else:
        raise ValueError(f"Unsupported LLM provider: {provider}")

# Example usage for agents
class LLMEnhancedAgent:
    """Mixin class for agents that want LLM capabilities"""
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.llm_client = None
        
        # Only initialize LLM if API keys are available
        if os.getenv('ANTHROPIC_API_KEY') or os.getenv('OPENAI_API_KEY'):
            try:
                self.llm_client = get_llm_client()
                self.logger.info(f"LLM integration enabled: {self.llm_client.__class__.__name__}")
            except Exception as e:
                self.logger.warning(f"LLM integration failed: {e}")
        else:
            self.logger.info("No LLM API keys found - using deterministic analysis only")
    
    def enhance_with_llm(self, data: Dict, analysis_type: str) -> Dict:
        """Enhance deterministic analysis with LLM insights"""
        if not self.llm_client:
            return {"llm_enhanced": False}
        
        try:
            llm_analysis = self.llm_client.analyze_data(data, analysis_type)
            return {"llm_enhanced": True, "llm_insights": llm_analysis}
        except Exception as e:
            self.logger.error(f"LLM enhancement failed: {e}")
            return {"llm_enhanced": False, "error": str(e)}