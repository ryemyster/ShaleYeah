#!/usr/bin/env python3
"""
SHALE YEAH Multi-Agent Control Plane (MCP)

Smart, dynamic coordination between agents. Governs which agents to run, 
in what order, with what data, and when to stop or escalate.

Based on specs/mcp.spec - replaces rigid workflows with runtime decision logic.
"""

import json
import os
import sys
import time
import subprocess
import logging
from pathlib import Path
from typing import Dict, List, Optional, Any
import yaml

class MCPController:
    """Multi-Agent Control Plane Controller"""
    
    def __init__(self, run_id: str, out_dir: str):
        self.run_id = run_id
        self.out_dir = Path(out_dir)
        self.state_file = self.out_dir / "state.json"
        self.agents_dir = Path(".claude/agents")
        
        # Initialize state
        self.state = {
            "run_id": run_id,
            "start_time": time.time(),
            "agents_completed": [],
            "agents_failed": [],
            "current_agent": None,
            "outputs": {},
            "metadata": {}
        }
        
        # Setup logging
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(levelname)s - %(message)s'
        )
        self.logger = logging.getLogger(__name__)
        
        # Load agent registry
        self.agent_registry = self._load_agent_registry()
        
        # Ensure output directory exists
        self.out_dir.mkdir(parents=True, exist_ok=True)
        self._save_state()
    
    def _load_agent_registry(self) -> Dict[str, Dict]:
        """Load all agent configurations from YAML files"""
        registry = {}
        
        for yaml_file in self.agents_dir.glob("*.yaml"):
            try:
                with open(yaml_file, 'r') as f:
                    agent_config = yaml.safe_load(f)
                    agent_name = agent_config.get('name')
                    if agent_name:
                        registry[agent_name] = agent_config
                        self.logger.info(f"Loaded agent: {agent_name}")
                    else:
                        self.logger.warning(f"Agent in {yaml_file} missing name field")
            except Exception as e:
                self.logger.error(f"Failed to load agent {yaml_file}: {e}")
        
        self.logger.info(f"Loaded {len(registry)} agents")
        return registry
    
    def _save_state(self):
        """Save current state to state.json"""
        try:
            with open(self.state_file, 'w') as f:
                json.dump(self.state, f, indent=2)
        except Exception as e:
            self.logger.error(f"Failed to save state: {e}")
    
    def _load_state(self) -> Dict:
        """Load state from state.json if it exists"""
        if self.state_file.exists():
            try:
                with open(self.state_file, 'r') as f:
                    return json.load(f)
            except Exception as e:
                self.logger.error(f"Failed to load state: {e}")
        return self.state
    
    def _get_agent_config(self, agent_name: str) -> Optional[Dict]:
        """Get agent configuration by name"""
        return self.agent_registry.get(agent_name)
    
    def _check_prerequisites(self, agent_name: str) -> bool:
        """Check if agent prerequisites are met"""
        agent_config = self._get_agent_config(agent_name)
        if not agent_config:
            return False
        
        # Check if required inputs are available
        inputs = agent_config.get('inputs', {})
        required_inputs = inputs.get('required', {})
        
        # Handle both dictionary and list formats for inputs
        if isinstance(required_inputs, list):
            # Convert list of dicts to flat dict
            input_items = []
            for item in required_inputs:
                if isinstance(item, dict):
                    input_items.extend(item.items())
                else:
                    input_items.append((item, ""))
        elif isinstance(required_inputs, dict):
            input_items = required_inputs.items()
        else:
            input_items = []
        
        for input_name, description in input_items:
            # Check if input is available in state or as file
            if input_name not in self.state.get('outputs', {}):
                # Check if it exists as a file
                input_patterns = [
                    f"{input_name}.*",
                    f"*{input_name}*",
                    f"{input_name}.json",
                    f"{input_name}.geojson",
                    f"{input_name}.csv"
                ]
                
                found = False
                for pattern in input_patterns:
                    if list(self.out_dir.glob(pattern)):
                        found = True
                        break
                
                if not found and input_name != 'shapefile' and input_name != 'region':
                    self.logger.warning(f"Missing required input for {agent_name}: {input_name}")
                    return False
        
        return True
    
    def _execute_agent(self, agent_name: str, inputs: Dict = None) -> bool:
        """Execute a single agent"""
        agent_config = self._get_agent_config(agent_name)
        if not agent_config:
            self.logger.error(f"Agent {agent_name} not found in registry")
            return False
        
        self.logger.info(f"Executing agent: {agent_name}")
        self.state['current_agent'] = agent_name
        self._save_state()
        
        # Prepare environment variables
        env = os.environ.copy()
        env['RUN_ID'] = self.run_id
        env['OUT_DIR'] = str(self.out_dir)
        
        # Get CLI configuration
        cli_config = agent_config.get('cli', {})
        entrypoint = cli_config.get('entrypoint', f"python agents/{agent_name}_agent.py")
        args = cli_config.get('args', [])
        
        # Replace variables in arguments
        processed_args = []
        for arg in args:
            processed_arg = arg.replace('${RUN_ID}', self.run_id)
            processed_arg = processed_arg.replace('${OUT_DIR}', str(self.out_dir))
            
            # Handle input variable replacements
            if inputs and '${input.' in processed_arg:
                for input_name, input_value in inputs.items():
                    placeholder = f'${{input.{input_name}}}'
                    if placeholder in processed_arg:
                        processed_arg = processed_arg.replace(placeholder, str(input_value))
            
            # Set default values for missing inputs
            if '${input.' in processed_arg:
                # Extract input name from placeholder
                import re
                input_matches = re.findall(r'\$\{input\.([^}]+)\}', processed_arg)
                for input_name in input_matches:
                    placeholder = f'${{input.{input_name}}}'
                    # Use demo defaults or agent-appropriate values
                    default_value = self._get_default_input_value(agent_name, input_name)
                    processed_arg = processed_arg.replace(placeholder, default_value)
            
            processed_args.append(processed_arg)
        
        # Build command
        cmd = entrypoint.split() + processed_args
        
        try:
            # Execute agent
            start_time = time.time()
            result = subprocess.run(
                cmd,
                env=env,
                capture_output=True,
                text=True,
                timeout=agent_config.get('error_handling', {}).get('timeout', 300)
            )
            
            execution_time = time.time() - start_time
            
            # Check result
            if result.returncode == 0:
                self.logger.info(f"Agent {agent_name} completed successfully in {execution_time:.2f}s")
                self.state['agents_completed'].append({
                    'name': agent_name,
                    'execution_time': execution_time,
                    'timestamp': time.time()
                })
                
                # Record outputs
                self._record_agent_outputs(agent_name, agent_config)
                return True
            else:
                self.logger.error(f"Agent {agent_name} failed with code {result.returncode}")
                self.logger.error(f"Error output: {result.stderr}")
                self.state['agents_failed'].append({
                    'name': agent_name,
                    'error_code': result.returncode,
                    'error_message': result.stderr,
                    'timestamp': time.time()
                })
                return False
                
        except subprocess.TimeoutExpired:
            self.logger.error(f"Agent {agent_name} timed out")
            self.state['agents_failed'].append({
                'name': agent_name,
                'error_code': -1,
                'error_message': "Timeout",
                'timestamp': time.time()
            })
            return False
        except Exception as e:
            self.logger.error(f"Failed to execute agent {agent_name}: {e}")
            self.state['agents_failed'].append({
                'name': agent_name,
                'error_code': -1,
                'error_message': str(e),
                'timestamp': time.time()
            })
            return False
        finally:
            self.state['current_agent'] = None
            self._save_state()
    
    def _get_default_input_value(self, agent_name: str, input_name: str) -> str:
        """Get default input value for agent when not provided"""
        # Default input mappings for demo/test mode
        default_inputs = {
            'geowiz': {
                'shapefile': 'data/samples/tract.shp.txt',
                'region': 'Permian',
                'las_files': 'data/samples/demo.las'
            },
            'curve-smith': {
                'las_files': 'data/samples/demo.las',
                'zones': f'{self.out_dir}/zones.geojson'
            },
            'drillcast': {
                'zones': f'{self.out_dir}/zones.geojson'
            },
            'titletracker': {
                'access_db': 'data/samples/demo.accdb.txt'
            },
            'econobot': {
                'drill_forecast': f'{self.out_dir}/drill_forecast.json',
                'ownership_data': f'{self.out_dir}/ownership.json'
            },
            'riskranger': {
                'valuation_data': f'{self.out_dir}/valuation.json',
                'ownership_data': f'{self.out_dir}/ownership.json'
            },
            'the-core': {
                'valuation_data': f'{self.out_dir}/valuation.json',
                'risk_assessment': f'{self.out_dir}/risk_score.json',
                'ownership_data': f'{self.out_dir}/ownership.json'
            },
            'notarybot': {
                'investment_decision': f'{self.out_dir}/investment_decision.json'
            }
        }
        
        return default_inputs.get(agent_name, {}).get(input_name, 'demo_input')
    
    def _record_agent_outputs(self, agent_name: str, agent_config: Dict):
        """Record agent outputs in state"""
        outputs = agent_config.get('outputs', [])
        agent_outputs = {}
        
        for output in outputs:
            output_name = output.get('name')
            output_path = output.get('path', '').replace('${OUT_DIR}', str(self.out_dir))
            
            if Path(output_path).exists():
                agent_outputs[output_name] = output_path
                self.logger.info(f"Recorded output: {output_name} -> {output_path}")
        
        self.state['outputs'][agent_name] = agent_outputs
    
    def _get_next_agents(self, completed_agent: str, success: bool) -> List[str]:
        """Determine next agents based on completed agent and success status"""
        agent_config = self._get_agent_config(completed_agent)
        if not agent_config:
            return []
        
        next_agents = agent_config.get('next_agents', {})
        
        # Handle both dictionary and list formats
        if isinstance(next_agents, dict):
            if success:
                candidates = next_agents.get('on_success', [])
            else:
                candidates = next_agents.get('on_failure', ['reporter'])
        elif isinstance(next_agents, list):
            # Legacy format - just use the list
            candidates = next_agents if success else ['reporter']
        else:
            candidates = ['reporter']  # Default fallback
        
        # Filter agents that haven't been completed yet
        available_agents = []
        for agent in candidates:
            if agent in self.agent_registry and not self._agent_completed(agent):
                if self._check_prerequisites(agent):
                    available_agents.append(agent)
                else:
                    self.logger.info(f"Agent {agent} prerequisites not met, skipping")
        
        return available_agents
    
    def _agent_completed(self, agent_name: str) -> bool:
        """Check if agent has already been completed"""
        completed = [a['name'] for a in self.state.get('agents_completed', [])]
        return agent_name in completed
    
    def _should_continue(self) -> bool:
        """Determine if pipeline should continue"""
        # Continue if there are agents that can be executed
        return len(self.state.get('agents_failed', [])) == 0 or self._has_executable_agents()
    
    def _has_executable_agents(self) -> bool:
        """Check if there are any executable agents remaining"""
        for agent_name in self.agent_registry:
            if not self._agent_completed(agent_name) and self._check_prerequisites(agent_name):
                return True
        return False
    
    def run_pipeline(self, goal: str = "tract_eval", initial_agents: List[str] = None) -> bool:
        """Run the complete pipeline"""
        self.logger.info(f"Starting pipeline for goal: {goal}")
        
        # Default initial agents for tract_eval goal
        if initial_agents is None:
            if goal == "tract_eval":
                initial_agents = ["geowiz"]
            else:
                initial_agents = ["geowiz"]  # Default fallback
        
        # Execute initial agents
        success = True
        current_agents = initial_agents[:]
        
        while current_agents and self._should_continue():
            next_round = []
            
            for agent_name in current_agents:
                if not self._agent_completed(agent_name):
                    agent_success = self._execute_agent(agent_name)
                    
                    if agent_success:
                        # Get next agents to execute
                        next_agents = self._get_next_agents(agent_name, True)
                        next_round.extend(next_agents)
                    else:
                        # Handle failure
                        failure_agents = self._get_next_agents(agent_name, False)
                        next_round.extend(failure_agents)
                        success = False
            
            # Remove duplicates and set up next round
            current_agents = list(set(next_round))
            
            # Safety check to prevent infinite loops
            if len(self.state.get('agents_completed', [])) + len(self.state.get('agents_failed', [])) > 20:
                self.logger.warning("Too many agents executed, stopping pipeline")
                break
        
        # Always run reporter at the end
        if not self._agent_completed('reporter'):
            self.logger.info("Running final reporter agent")
            self._execute_agent('reporter')
        
        # Final state update
        self.state['end_time'] = time.time()
        self.state['total_duration'] = self.state['end_time'] - self.state['start_time']
        self.state['pipeline_success'] = success and len(self.state.get('agents_failed', [])) == 0
        self._save_state()
        
        self.logger.info(f"Pipeline completed. Success: {self.state['pipeline_success']}")
        return self.state['pipeline_success']

def main():
    """Main entry point for MCP controller"""
    import argparse
    
    parser = argparse.ArgumentParser(description="SHALE YEAH Multi-Agent Control Plane")
    parser.add_argument("--goal", default="tract_eval", help="Pipeline goal to execute")
    parser.add_argument("--run-id", required=True, help="Unique run identifier")
    parser.add_argument("--out-dir", help="Output directory (default: ./data/outputs/{run_id})")
    parser.add_argument("--agents", nargs="*", help="Initial agents to execute")
    
    args = parser.parse_args()
    
    # Set default output directory
    if not args.out_dir:
        args.out_dir = f"./data/outputs/{args.run_id}"
    
    # Create MCP controller
    mcp = MCPController(args.run_id, args.out_dir)
    
    # Run pipeline
    success = mcp.run_pipeline(args.goal, args.agents)
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()