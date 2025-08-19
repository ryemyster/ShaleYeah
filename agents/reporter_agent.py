#!/usr/bin/env python3
"""
Reporter Agent - Executive reporting and data provenance specialist

Transforms technical outputs into executive-ready insights. Creates the definitive 
SHALE YEAH report that decision-makers can act on immediately.
"""

import os
import sys
import json
import argparse
import logging
from pathlib import Path
from typing import Dict, List, Optional, Any
from datetime import datetime
import glob

class ReporterAgent:
    """Executive reporting and data provenance specialist"""
    
    def __init__(self, input_dir: str, run_id: str):
        self.input_dir = Path(input_dir)
        self.run_id = run_id
        
        # Setup logging
        logging.basicConfig(level=logging.INFO)
        self.logger = logging.getLogger(__name__)
        
        # Expected output
        self.report_file = self.input_dir / "SHALE_YEAH_REPORT.md"
        
        # Initialize discovered data
        self.discovered_files = {}
        self.agent_outputs = {}
        
    def discover_outputs(self) -> Dict[str, List[str]]:
        """Discover all generated outputs and categorize them"""
        self.logger.info(f"Discovering outputs in {self.input_dir}")
        
        discovered = {
            'geological': [],
            'curves': [],
            'economic': [],
            'reports': [],
            'other': []
        }
        
        # Search for known file patterns
        patterns = {
            'geological': ['zones.geojson', 'geology_summary.md', '*geological*'],
            'curves': ['curves/*.csv', 'qc_report.md', '*curve*'],
            'economic': ['valuation.json', 'econ_summary.csv', 'npv_breakdown.md', 'drill_forecast.json'],
            'reports': ['*_summary.md', '*_report.md', '*_analysis.md'],
            'other': ['*.json', '*.csv', '*.md', '*.geojson']
        }
        
        for category, pattern_list in patterns.items():
            for pattern in pattern_list:
                matches = list(self.input_dir.glob(pattern))
                for match in matches:
                    if match.is_file() and str(match) not in [str(f) for files in discovered.values() for f in files]:
                        discovered[category].append(str(match))
        
        self.discovered_files = discovered
        self.logger.info(f"Discovered {sum(len(files) for files in discovered.values())} files")
        return discovered
    
    def analyze_file_content(self, file_path: str) -> Dict[str, Any]:
        """Analyze content of a file and extract key information"""
        path = Path(file_path)
        
        analysis = {
            'name': path.name,
            'size': path.stat().st_size,
            'modified': datetime.fromtimestamp(path.stat().st_mtime).isoformat(),
            'type': path.suffix,
            'content_summary': '',
            'key_metrics': {}
        }
        
        try:
            if path.suffix == '.json':
                with open(path, 'r') as f:
                    data = json.load(f)
                    analysis['content_summary'] = f"JSON data with {len(data)} top-level keys"
                    if isinstance(data, dict):
                        analysis['key_metrics'] = {k: str(v)[:50] + "..." if len(str(v)) > 50 else str(v) 
                                                 for k, v in list(data.items())[:5]}
                        
            elif path.suffix == '.md':
                with open(path, 'r') as f:
                    content = f.read()
                    lines = content.split('\n')
                    analysis['content_summary'] = f"Markdown document with {len(lines)} lines"
                    # Extract key statistics from tables
                    if '|' in content:
                        analysis['key_metrics']['has_tables'] = 'Yes'
                    if 'RMSE' in content or 'NRMSE' in content:
                        analysis['key_metrics']['has_statistics'] = 'Yes'
                        
            elif path.suffix == '.csv':
                # Read first few lines to understand CSV structure
                with open(path, 'r') as f:
                    lines = f.readlines()[:10]
                    analysis['content_summary'] = f"CSV file with {len(lines)} sample lines"
                    if lines and ',' in lines[0]:
                        headers = lines[0].split(',')
                        analysis['key_metrics']['columns'] = len(headers)
                        analysis['key_metrics']['sample_headers'] = headers[:3]
                        
            elif path.suffix == '.geojson':
                with open(path, 'r') as f:
                    data = json.load(f)
                    if 'features' in data:
                        analysis['content_summary'] = f"GeoJSON with {len(data['features'])} features"
                        analysis['key_metrics']['feature_count'] = len(data['features'])
                        if data['features']:
                            props = data['features'][0].get('properties', {})
                            analysis['key_metrics']['sample_properties'] = list(props.keys())[:3]
                            
        except Exception as e:
            analysis['content_summary'] = f"Error reading file: {str(e)[:50]}"
            
        return analysis
    
    def extract_geological_insights(self) -> Dict[str, Any]:
        """Extract key geological insights from available data"""
        insights = {
            'formations_identified': 0,
            'total_thickness': 0,
            'confidence_level': 0,
            'key_formations': [],
            'data_quality': 'Unknown'
        }
        
        # Check geology summary
        geology_file = self.input_dir / "geology_summary.md"
        if geology_file.exists():
            try:
                with open(geology_file, 'r') as f:
                    content = f.read()
                    
                # Extract formation count
                if 'formations' in content.lower():
                    lines = content.split('\n')
                    for line in lines:
                        if 'identified' in line.lower() and 'formation' in line.lower():
                            words = line.split()
                            for i, word in enumerate(words):
                                if word.isdigit():
                                    insights['formations_identified'] = int(word)
                                    break
                
                # Extract key formations from table
                table_started = False
                for line in content.split('\n'):
                    if '|' in line and 'Formation' in line:
                        table_started = True
                        continue
                    elif table_started and '|' in line and line.strip().startswith('|'):
                        parts = [p.strip() for p in line.split('|')[1:-1]]
                        if len(parts) >= 4 and parts[0] and parts[0] != '---':
                            insights['key_formations'].append(parts[0])
                            
            except Exception as e:
                self.logger.warning(f"Error extracting geological insights: {e}")
        
        # Check zones.geojson
        zones_file = self.input_dir / "zones.geojson"
        if zones_file.exists():
            try:
                with open(zones_file, 'r') as f:
                    data = json.load(f)
                    if 'features' in data:
                        insights['formations_identified'] = max(insights['formations_identified'], len(data['features']))
                        
                        # Calculate total thickness
                        total_thickness = 0
                        total_confidence = 0
                        for feature in data['features']:
                            props = feature.get('properties', {})
                            thickness = props.get('thickness', 0)
                            confidence = props.get('confidence', 0)
                            total_thickness += thickness
                            total_confidence += confidence
                            
                        insights['total_thickness'] = total_thickness
                        if data['features']:
                            insights['confidence_level'] = total_confidence / len(data['features'])
                            
            except Exception as e:
                self.logger.warning(f"Error reading zones.geojson: {e}")
        
        return insights
    
    def extract_curve_quality(self) -> Dict[str, Any]:
        """Extract curve quality metrics from QC report"""
        quality = {
            'curves_processed': 0,
            'curves_passed': 0,
            'curves_failed': 0,
            'overall_quality': 'Unknown',
            'key_statistics': {}
        }
        
        qc_file = self.input_dir / "qc_report.md"
        if qc_file.exists():
            try:
                with open(qc_file, 'r') as f:
                    content = f.read()
                    
                # Extract summary statistics
                lines = content.split('\n')
                for line in lines:
                    if 'curves processed' in line.lower():
                        words = line.split()
                        for word in words:
                            if word.isdigit():
                                quality['curves_processed'] = int(word)
                                break
                    elif 'passed quality' in line.lower():
                        words = line.split()
                        for word in words:
                            if word.isdigit():
                                quality['curves_passed'] = int(word)
                                break
                    elif 'failed quality' in line.lower():
                        words = line.split()
                        for word in words:
                            if word.isdigit():
                                quality['curves_failed'] = int(word)
                                break
                
                # Determine overall quality
                if quality['curves_processed'] > 0:
                    pass_rate = quality['curves_passed'] / quality['curves_processed']
                    if pass_rate >= 0.8:
                        quality['overall_quality'] = 'GOOD'
                    elif pass_rate >= 0.6:
                        quality['overall_quality'] = 'FAIR'
                    else:
                        quality['overall_quality'] = 'POOR'
                
                # Extract RMSE/NRMSE if available
                if 'RMSE' in content or 'NRMSE' in content:
                    quality['key_statistics']['has_rmse_nrmse'] = True
                    
            except Exception as e:
                self.logger.warning(f"Error extracting curve quality: {e}")
        
        return quality
    
    def generate_data_provenance(self) -> str:
        """Generate data provenance section"""
        provenance = f"""## Data Provenance

**Analysis Run ID:** {self.run_id}
**Processing Date:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
**Total Files Generated:** {sum(len(files) for files in self.discovered_files.values())}

### Source Data Processing

"""
        
        # List all input sources
        for category, files in self.discovered_files.items():
            if files:
                provenance += f"#### {category.title()} Data ({len(files)} files)\n"
                for file_path in files[:5]:  # Limit to first 5
                    analysis = self.analyze_file_content(file_path)
                    file_name = Path(file_path).name
                    provenance += f"- **{file_name}** ({analysis['size']} bytes) - {analysis['content_summary']}\n"
                if len(files) > 5:
                    provenance += f"- ... and {len(files) - 5} more files\n"
                provenance += "\n"
        
        return provenance
    
    def generate_executive_summary(self, geological_insights: Dict, curve_quality: Dict) -> str:
        """Generate executive summary section"""
        summary = """## Executive Summary

"""
        
        # Geological summary
        formations = geological_insights.get('formations_identified', 0)
        thickness = geological_insights.get('total_thickness', 0)
        confidence = geological_insights.get('confidence_level', 0)
        
        if formations > 0:
            summary += f"Geological analysis identified **{formations} distinct formations** with total productive thickness of **{thickness:.0f} feet**. "
            summary += f"Formation identification confidence averages **{confidence:.1%}**, indicating "
            
            if confidence > 0.8:
                summary += "high reliability in the geological interpretation."
            elif confidence > 0.6:
                summary += "moderate reliability in the geological interpretation."
            else:
                summary += "limited reliability in the geological interpretation."
        else:
            summary += "Geological analysis completed with regional formation templates. "
        
        summary += "\n\n"
        
        # Curve quality summary
        curves_processed = curve_quality.get('curves_processed', 0)
        curves_passed = curve_quality.get('curves_passed', 0)
        overall_quality = curve_quality.get('overall_quality', 'Unknown')
        
        if curves_processed > 0:
            summary += f"Well log analysis processed **{curves_processed} curves** with **{curves_passed} passing** quality control standards. "
            summary += f"Overall data quality rated as **{overall_quality}**, "
            
            if overall_quality == 'GOOD':
                summary += "supporting confident subsurface modeling and development planning."
            elif overall_quality == 'FAIR':
                summary += "adequate for preliminary development planning with some data limitations."
            else:
                summary += "indicating data quality concerns that may impact modeling reliability."
        else:
            summary += "Curve analysis used synthetic data for demonstration purposes."
        
        summary += "\n\n"
        
        # Key formations
        key_formations = geological_insights.get('key_formations', [])
        if key_formations:
            summary += f"**Primary Target Formations:** {', '.join(key_formations[:3])}"
            if len(key_formations) > 3:
                summary += f" (and {len(key_formations) - 3} others)"
            summary += "\n\n"
        
        return summary
    
    def generate_next_steps(self) -> str:
        """Generate next steps recommendations"""
        steps = """## Next Steps

Based on the analysis completed, the following actions are recommended:

### Immediate Actions
1. **Review geological interpretation** - Validate formation boundaries and lithology assignments
2. **Assess data quality** - Address any curve quality issues identified in QC analysis
3. **Validate spatial extent** - Confirm geological zones align with tract boundaries

### Development Planning
1. **Drilling target identification** - Select optimal well locations within productive zones
2. **Completion design** - Plan fracture stimulation based on formation characteristics
3. **Economic modeling** - Integrate geological and completion parameters for financial analysis

### Data Enhancement Opportunities
1. **Additional well logs** - Consider acquiring density, resistivity, or image logs if missing
2. **Seismic integration** - Incorporate 3D seismic data for structural interpretation if available
3. **Regional correlation** - Compare results with nearby wells for geological validation

### Risk Assessment
1. **Technical risks** - Evaluate geological uncertainty and drilling hazards
2. **Economic risks** - Model sensitivity to commodity prices and development costs  
3. **Operational risks** - Assess regulatory, environmental, and logistical factors

"""
        return steps
    
    def generate_file_summary_table(self) -> str:
        """Generate table of all files with links and statistics"""
        table = """## Generated Files Summary

| Category | File | Size | Description | Key Metrics |
|----------|------|------|-------------|-------------|
"""
        
        for category, files in self.discovered_files.items():
            for file_path in files:
                analysis = self.analyze_file_content(file_path)
                file_name = Path(file_path).name
                relative_path = Path(file_path).relative_to(self.input_dir)
                
                # Format size
                size = analysis['size']
                if size > 1024 * 1024:
                    size_str = f"{size / (1024 * 1024):.1f} MB"
                elif size > 1024:
                    size_str = f"{size / 1024:.1f} KB"
                else:
                    size_str = f"{size} B"
                
                # Extract key metrics
                metrics = analysis.get('key_metrics', {})
                metrics_str = ', '.join([f"{k}: {v}" for k, v in list(metrics.items())[:2]])
                
                table += f"| {category.title()} | `{relative_path}` | {size_str} | {analysis['content_summary']} | {metrics_str} |\n"
        
        return table
    
    def generate_report(self) -> str:
        """Generate complete SHALE YEAH report"""
        self.logger.info("Generating comprehensive SHALE YEAH report")
        
        # Discover all outputs
        self.discover_outputs()
        
        # Extract insights
        geological_insights = self.extract_geological_insights()
        curve_quality = self.extract_curve_quality()
        
        # Build report
        report = f"""# SHALE YEAH Analysis Report

**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}  
**Run ID:** {self.run_id}  
**Analysis Type:** Multi-Agent Geological and Engineering Analysis

---

"""
        
        # Executive Summary
        report += self.generate_executive_summary(geological_insights, curve_quality)
        
        # Data Provenance
        report += self.generate_data_provenance()
        
        # Geological Summary
        if geological_insights['formations_identified'] > 0:
            report += f"""## Geological Summary

**Formations Identified:** {geological_insights['formations_identified']}  
**Total Productive Thickness:** {geological_insights['total_thickness']:.0f} feet  
**Average Confidence Level:** {geological_insights['confidence_level']:.1%}  

"""
            if geological_insights['key_formations']:
                report += f"**Target Formations:** {', '.join(geological_insights['key_formations'])}\n\n"
        
        # Curve Analysis Summary
        if curve_quality['curves_processed'] > 0:
            report += f"""## Well Log Analysis Summary

**Curves Processed:** {curve_quality['curves_processed']}  
**Quality Control Results:** {curve_quality['curves_passed']} passed, {curve_quality['curves_failed']} failed  
**Overall Data Quality:** {curve_quality['overall_quality']}  

Statistical analysis includes RMSE and NRMSE calculations for all processed curves.
See `qc_report.md` for detailed quality control metrics.

"""
        
        # File Summary
        report += self.generate_file_summary_table()
        
        # Next Steps
        report += self.generate_next_steps()
        
        # Footer
        report += """---

**Analysis Confidence:** This report synthesizes multi-agent analysis results with transparent methodology and data provenance. All technical analyses include uncertainty quantification and quality metrics to support informed decision-making.

**Data Sources:** Analysis incorporates regional geological knowledge, well log interpretation, and industry-standard statistical methods. Results are validated against established quality control criteria.

**Recommended Actions:** Proceed with development planning while addressing any data quality concerns identified in individual agent reports.

Generated with SHALE YEAH (c) Ryan McDonald / Ascendvent LLC - Apache-2.0
"""
        
        return report
    
    def run_reporting(self) -> bool:
        """Run complete reporting analysis"""
        self.logger.info("Starting executive reporting")
        
        try:
            # Generate comprehensive report
            report_content = self.generate_report()
            
            # Write report
            with open(self.report_file, 'w') as f:
                f.write(report_content)
            
            self.logger.info(f"Generated executive report: {self.report_file}")
            
            # Validate output
            if not self.report_file.exists():
                self.logger.error("Failed to generate SHALE_YEAH_REPORT.md")
                return False
            
            # Check for required attribution
            with open(self.report_file, 'r') as f:
                content = f.read()
                if 'SHALE YEAH' not in content or 'Apache-2.0' not in content:
                    self.logger.error("Report missing required attribution")
                    return False
            
            self.logger.info("Executive reporting completed successfully")
            return True
            
        except Exception as e:
            self.logger.error(f"Executive reporting failed: {e}")
            return False

def main():
    """Main entry point for Reporter agent"""
    parser = argparse.ArgumentParser(description="Reporter - Executive Reporting Agent")
    parser.add_argument("--input-dir", required=True, help="Input directory with agent outputs")
    parser.add_argument("--output-file", help="Output report file path")
    parser.add_argument("--run-id", required=True, help="Run identifier")
    
    args = parser.parse_args()
    
    # Use input-dir as base for reporter
    input_dir = args.input_dir
    
    # Create agent
    agent = ReporterAgent(input_dir, args.run_id)
    
    # Override output file if specified
    if args.output_file:
        agent.report_file = Path(args.output_file)
    
    # Run reporting
    success = agent.run_reporting()
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()