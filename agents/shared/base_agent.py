#!/usr/bin/env python3
"""
BaseAgent - Common base class for all SHALE YEAH agents

Provides standard initialization, logging, file I/O, and output management
patterns that all agents inherit.
"""

import os
import sys
import json
import logging
from pathlib import Path
from typing import Dict, List, Optional, Any
from datetime import datetime
from abc import ABC, abstractmethod

from .utils import json_serializer, setup_logging


class BaseAgent(ABC):
    """Base class for all SHALE YEAH agents"""
    
    def __init__(self, output_dir: str, run_id: str, agent_name: str = None):
        """Initialize base agent with common setup
        
        Args:
            output_dir: Directory for output files
            run_id: Unique run identifier
            agent_name: Name of the agent (defaults to class name)
        """
        self.output_dir = Path(output_dir)
        self.run_id = run_id
        self.agent_name = agent_name or self.__class__.__name__.lower().replace('agent', '')
        
        # Setup logging
        self.logger = setup_logging(self.agent_name)
        
        # Ensure output directory exists
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        # Track expected outputs (to be defined by subclasses)
        self.expected_outputs = {}
        
        # Initialize agent-specific attributes
        self._initialize_agent()
    
    @abstractmethod
    def _initialize_agent(self):
        """Initialize agent-specific attributes and configurations"""
        pass
    
    @abstractmethod
    def run_analysis(self, **kwargs) -> bool:
        """Run the main agent analysis logic"""
        pass
    
    def _load_input_file(self, file_path: str, file_type: str = 'json') -> Dict:
        """Load input file with standardized error handling
        
        Args:
            file_path: Path to input file
            file_type: Type of file ('json', 'csv', etc.)
            
        Returns:
            Loaded data or demo data on failure
        """
        self.logger.info(f"Loading {file_type} data from {file_path}")
        
        try:
            file_path = Path(file_path)
            
            if not file_path.exists():
                self.logger.warning(f"Input file not found: {file_path}")
                return self._get_demo_data(file_type)
            
            if file_type == 'json':
                with open(file_path, 'r') as f:
                    data = json.load(f)
            elif file_type == 'csv':
                import pandas as pd
                data = pd.read_csv(file_path)
            else:
                with open(file_path, 'r') as f:
                    data = f.read()
            
            self.logger.info(f"Successfully loaded {file_type} data")
            return data
            
        except Exception as e:
            self.logger.error(f"Error loading {file_type} data: {e}")
            return self._get_demo_data(file_type)
    
    def _save_output_file(self, data: Any, filename: str, file_type: str = 'json') -> bool:
        """Save output file with standardized format and error handling
        
        Args:
            data: Data to save
            filename: Output filename
            file_type: Type of file ('json', 'csv', 'md')
            
        Returns:
            True if successful, False otherwise
        """
        try:
            output_path = self.output_dir / filename
            
            if file_type == 'json':
                with open(output_path, 'w') as f:
                    json.dump(data, f, indent=2, default=json_serializer)
            elif file_type == 'csv':
                data.to_csv(output_path, index=False)
            elif file_type == 'md':
                with open(output_path, 'w') as f:
                    f.write(str(data))
            else:
                with open(output_path, 'w') as f:
                    f.write(str(data))
            
            self.logger.info(f"Generated {file_type} output: {output_path}")
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to save {filename}: {e}")
            return False
    
    def _get_demo_data(self, data_type: str) -> Dict:
        """Get demo data for testing - to be implemented by subclasses or use shared demo data"""
        from .demo_data import DemoDataGenerator
        generator = DemoDataGenerator()
        return generator.get_demo_data(self.agent_name, data_type)
    
    def _validate_inputs(self, inputs: Dict, required_fields: List[str]) -> bool:
        """Validate that required input fields are present
        
        Args:
            inputs: Input data dictionary
            required_fields: List of required field names
            
        Returns:
            True if all required fields present, False otherwise
        """
        missing_fields = []
        
        for field in required_fields:
            if field not in inputs or inputs[field] is None:
                missing_fields.append(field)
        
        if missing_fields:
            self.logger.error(f"Missing required input fields: {missing_fields}")
            return False
        
        return True
    
    def _validate_outputs(self, required_files: List[str]) -> bool:
        """Validate that all expected output files were generated
        
        Args:
            required_files: List of required output filenames
            
        Returns:
            True if all files exist, False otherwise
        """
        missing_files = []
        
        for filename in required_files:
            file_path = self.output_dir / filename
            if not file_path.exists():
                missing_files.append(filename)
        
        if missing_files:
            self.logger.error(f"Missing output files: {missing_files}")
            return False
        
        self.logger.info("All expected outputs generated successfully")
        return True
    
    def _add_shale_yeah_footer(self, content: str) -> str:
        """Add standard SHALE YEAH footer to markdown content
        
        Args:
            content: Markdown content
            
        Returns:
            Content with footer appended
        """
        footer = "\n---\n\nGenerated with SHALE YEAH (c) Ryan McDonald / Ascendvent LLC - Apache-2.0\n"
        
        if content.endswith('\n'):
            return content + footer
        else:
            return content + '\n' + footer
    
    def get_agent_metadata(self) -> Dict:
        """Get agent metadata for reporting
        
        Returns:
            Dictionary with agent metadata
        """
        return {
            'agent_name': self.agent_name,
            'run_id': self.run_id,
            'output_dir': str(self.output_dir),
            'execution_time': datetime.now().isoformat(),
            'expected_outputs': list(self.expected_outputs.keys())
        }