#!/usr/bin/env python3
"""
SHALE YEAH Goal Runner

Main entry point for executing SHALE YEAH multi-agent pipelines.
Provides user-friendly interface for common goals like tract evaluation.

Usage:
    python goal_runner.py --goal tract_eval --run_id=demo1
    python goal_runner.py --goal tract_eval --run_id=demo1 --shapefile=tract.shp --region=Permian
"""

import os
import sys
import argparse
import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional
import subprocess

# Import MCP controller
from mcp import MCPController

class GoalRunner:
    """High-level goal execution interface for SHALE YEAH"""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        
        # Goal definitions
        self.goals = {
            "tract_eval": {
                "description": "Complete tract evaluation from geology to LOI decision",
                "initial_agents": ["geowiz"],
                "required_inputs": ["shapefile", "region"],
                "optional_inputs": ["las_files", "ownership_data"],
                "expected_outputs": ["SHALE_YEAH_REPORT.md", "investment_decision.json"]
            },
            "geology_only": {
                "description": "Geological analysis and curve QC only",
                "initial_agents": ["geowiz"],
                "required_inputs": ["las_files"],
                "optional_inputs": ["shapefile", "region"],
                "expected_outputs": ["geology_summary.md", "qc_report.md"]
            },
            "research_mode": {
                "description": "Research new integration and generate agent",
                "initial_agents": ["research-hub"],
                "required_inputs": ["research_topic"],
                "optional_inputs": ["integration_requirements"],
                "expected_outputs": ["rfcs/*.md", "generated_agents/*.yaml"]
            },
            "demo": {
                "description": "Demo pipeline with sample data",
                "initial_agents": ["geowiz"],
                "required_inputs": [],
                "optional_inputs": [],
                "expected_outputs": ["SHALE_YEAH_REPORT.md"]
            }
        }
    
    def validate_inputs(self, goal: str, args: argparse.Namespace) -> bool:
        """Validate that required inputs are available"""
        goal_config = self.goals.get(goal)
        if not goal_config:
            self.logger.error(f"Unknown goal: {goal}")
            return False
        
        required_inputs = goal_config.get("required_inputs", [])
        
        for input_name in required_inputs:
            if not hasattr(args, input_name) or not getattr(args, input_name):
                # Check if it's available as sample data
                sample_patterns = [
                    f"data/samples/demo.{input_name}",
                    f"data/samples/{input_name}.txt",
                    f"data/samples/tract.shp.txt"  # Special case for shapefile
                ]
                
                sample_found = False
                for pattern in sample_patterns:
                    sample_file = Path(pattern)
                    if sample_file.exists():
                        self.logger.info(f"Using sample data for {input_name}: {sample_file}")
                        sample_found = True
                        break
                
                if not sample_found:
                    self.logger.error(f"Required input missing: {input_name}")
                    return False
        
        return True
    
    def setup_environment(self, run_id: str, out_dir: str, args: argparse.Namespace):
        """Setup environment variables for pipeline execution"""
        env_vars = {
            "RUN_ID": run_id,
            "OUT_DIR": out_dir,
            "SHALE_YEAH_MODE": "production"
        }
        
        # Add input file paths to environment
        if hasattr(args, 'shapefile') and args.shapefile:
            env_vars["SHAPEFILE"] = args.shapefile
        else:
            env_vars["SHAPEFILE"] = "data/samples/tract.shp.txt"
            
        if hasattr(args, 'region') and args.region:
            env_vars["REGION"] = args.region
        else:
            env_vars["REGION"] = "Permian"
        
        if hasattr(args, 'las_files') and args.las_files:
            env_vars["LAS_FILES"] = args.las_files
        else:
            env_vars["LAS_FILES"] = "data/samples/demo.las"
        
        if hasattr(args, 'ownership_data') and args.ownership_data:
            env_vars["OWNERSHIP_DATA"] = args.ownership_data
        else:
            env_vars["OWNERSHIP_DATA"] = "data/samples/demo.accdb.txt"
        
        # Set environment variables
        for key, value in env_vars.items():
            os.environ[key] = value
            self.logger.info(f"Set {key}={value}")
    
    def run_goal(self, goal: str, run_id: str, args: argparse.Namespace) -> bool:
        """Execute a specific goal"""
        self.logger.info(f"Starting goal execution: {goal}")
        
        # Validate goal
        if goal not in self.goals:
            self.logger.error(f"Unknown goal: {goal}. Available goals: {list(self.goals.keys())}")
            return False
        
        goal_config = self.goals[goal]
        self.logger.info(f"Goal description: {goal_config['description']}")
        
        # Validate inputs
        if not self.validate_inputs(goal, args):
            return False
        
        # Setup output directory
        out_dir = args.out_dir or f"./data/outputs/{run_id}"
        out_path = Path(out_dir)
        out_path.mkdir(parents=True, exist_ok=True)
        
        # Setup environment
        self.setup_environment(run_id, out_dir, args)
        
        # Create MCP controller
        mcp = MCPController(run_id, out_dir)
        
        # Execute pipeline
        initial_agents = goal_config["initial_agents"]
        success = mcp.run_pipeline(goal, initial_agents)
        
        # Validate outputs
        if success:
            success = self.validate_outputs(goal, out_path)
        
        # Generate summary
        self.generate_execution_summary(goal, run_id, out_path, success)
        
        return success
    
    def validate_outputs(self, goal: str, out_dir: Path) -> bool:
        """Validate that expected outputs were generated"""
        goal_config = self.goals[goal]
        expected_outputs = goal_config.get("expected_outputs", [])
        
        missing_outputs = []
        for output_pattern in expected_outputs:
            if "*" in output_pattern:
                # Handle glob patterns
                matches = list(out_dir.glob(output_pattern))
                if not matches:
                    missing_outputs.append(output_pattern)
            else:
                # Handle specific files
                output_file = out_dir / output_pattern
                if not output_file.exists():
                    missing_outputs.append(output_pattern)
        
        if missing_outputs:
            self.logger.warning(f"Missing expected outputs: {missing_outputs}")
            return False
        
        self.logger.info("All expected outputs generated successfully")
        return True
    
    def generate_execution_summary(self, goal: str, run_id: str, out_dir: Path, success: bool):
        """Generate execution summary"""
        summary = {
            "goal": goal,
            "run_id": run_id,
            "timestamp": datetime.now().isoformat(),
            "success": success,
            "output_directory": str(out_dir),
            "generated_files": []
        }
        
        # List generated files
        for file_path in out_dir.rglob("*"):
            if file_path.is_file():
                summary["generated_files"].append({
                    "name": file_path.name,
                    "path": str(file_path.relative_to(out_dir)),
                    "size": file_path.stat().st_size
                })
        
        # Save summary
        summary_file = out_dir / "execution_summary.json"
        with open(summary_file, 'w') as f:
            json.dump(summary, f, indent=2)
        
        self.logger.info(f"Execution summary saved to: {summary_file}")
        
        # Print user-friendly summary
        print(f"\n{'='*50}")
        print(f"SHALE YEAH Execution Summary")
        print(f"{'='*50}")
        print(f"Goal: {goal}")
        print(f"Run ID: {run_id}")
        print(f"Status: {'SUCCESS' if success else 'FAILED'}")
        print(f"Output Directory: {out_dir}")
        print(f"Files Generated: {len(summary['generated_files'])}")
        
        if success:
            print(f"\n✅ Pipeline completed successfully!")
            print(f"📄 Main report: {out_dir}/SHALE_YEAH_REPORT.md")
        else:
            print(f"\n❌ Pipeline failed. Check logs for details.")
            print(f"📋 State file: {out_dir}/state.json")

def create_parser() -> argparse.ArgumentParser:
    """Create command line argument parser"""
    parser = argparse.ArgumentParser(
        description="SHALE YEAH Goal Runner - Execute multi-agent oil & gas analysis pipelines",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Complete tract evaluation with sample data
  python goal_runner.py --goal tract_eval --run_id demo1
  
  # Tract evaluation with custom shapefile
  python goal_runner.py --goal tract_eval --run_id proj1 --shapefile tract.shp --region Permian
  
  # Geology analysis only
  python goal_runner.py --goal geology_only --run_id geo1 --las_files well.las
  
  # Research new integration
  python goal_runner.py --goal research_mode --run_id research1 --research_topic "Splunk HEC"
  
  # Demo mode with all sample data
  python goal_runner.py --goal demo --run_id demo2
        """
    )
    
    # Required arguments
    parser.add_argument("--goal", required=True, 
                       choices=["tract_eval", "geology_only", "research_mode", "demo"],
                       help="Goal to execute")
    parser.add_argument("--run_id", required=True,
                       help="Unique run identifier")
    
    # Optional arguments
    parser.add_argument("--out_dir", 
                       help="Output directory (default: ./data/outputs/{run_id})")
    
    # Input files
    parser.add_argument("--shapefile", 
                       help="Shapefile for tract boundaries")
    parser.add_argument("--region", 
                       help="Geographic region (e.g., Permian, Bakken)")
    parser.add_argument("--las_files", 
                       help="LAS well log files")
    parser.add_argument("--ownership_data", 
                       help="Ownership data files (PDF, CSV, MDB)")
    parser.add_argument("--research_topic", 
                       help="Research topic for research_mode")
    
    # Execution options
    parser.add_argument("--verbose", "-v", action="store_true",
                       help="Verbose logging")
    parser.add_argument("--dry_run", action="store_true",
                       help="Validate inputs without executing")
    
    return parser

def main():
    """Main entry point"""
    parser = create_parser()
    args = parser.parse_args()
    
    # Setup logging
    log_level = logging.DEBUG if args.verbose else logging.INFO
    logging.basicConfig(
        level=log_level,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    logger = logging.getLogger(__name__)
    
    # Create goal runner
    runner = GoalRunner()
    
    # Handle dry run
    if args.dry_run:
        logger.info("Dry run mode - validating inputs only")
        if runner.validate_inputs(args.goal, args):
            print("✅ Input validation passed")
            return 0
        else:
            print("❌ Input validation failed")
            return 1
    
    # Execute goal
    try:
        success = runner.run_goal(args.goal, args.run_id, args)
        return 0 if success else 1
    except KeyboardInterrupt:
        logger.info("Execution interrupted by user")
        return 130
    except Exception as e:
        logger.error(f"Execution failed: {e}")
        return 1

if __name__ == "__main__":
    sys.exit(main())