#!/usr/bin/env python3
"""
Drillcast Agent - Drilling forecast and development simulation specialist

Creates drilling development forecasts with production estimates based on geological analysis.
Generates drill_forecast.json, well_locations.geojson, and development_summary.md.
"""

import os
import sys
import argparse
import numpy as np
from typing import Dict, List, Optional, Tuple
from datetime import datetime, timedelta

from shared import BaseAgent, DemoDataGenerator

class DrillcastAgent(BaseAgent):
    """Drilling forecast and development simulation specialist"""
    
    def __init__(self, output_dir: str, run_id: str):
        super().__init__(output_dir, run_id, 'drillcast')
    
    def _initialize_agent(self):
        """Initialize drillcast-specific attributes"""
        # Expected outputs
        self.expected_outputs = {
            'drill_forecast.json': self.output_dir / "drill_forecast.json",
            'well_locations.geojson': self.output_dir / "well_locations.geojson",
            'development_summary.md': self.output_dir / "development_summary.md"
        }
        
        # Development parameters
        self.spacing_params = {
            'minimum': 660,   # feet
            'optimal': 880,   # feet
            'maximum': 1320   # feet
        }
        
        # Production modeling parameters
        self.production_params = {
            'initial_rate_oil': 800,     # bbl/day initial
            'initial_rate_gas': 2500,    # mcf/day initial  
            'decline_rate': 0.65,        # annual decline
            'forecast_months': 60        # 5 years
        }
    
    def load_zones_data(self, zones_file: str) -> List[Dict]:
        """Load geological zones from zones.geojson"""
        self.logger.info(f"Loading zones data from {zones_file}")
        
        try:
            with open(zones_file, 'r') as f:
                zones_data = json.load(f)
            
            zones = []
            if 'features' in zones_data:
                for feature in zones_data['features']:
                    props = feature.get('properties', {})
                    zones.append({
                        'formation_name': props.get('formation_name', 'Unknown'),
                        'lithology': props.get('lithology', 'Unknown'),
                        'top_depth': props.get('top_depth', 0),
                        'bottom_depth': props.get('bottom_depth', 0),
                        'thickness': props.get('thickness', 0),
                        'porosity': props.get('porosity', 0.1),
                        'permeability': props.get('permeability', 0.0001),
                        'confidence': props.get('confidence', 0.7),
                        'geometry': feature.get('geometry', {})
                    })
            
            self.logger.info(f"Loaded {len(zones)} geological zones")
            return zones
            
        except Exception as e:
            self.logger.error(f"Error loading zones data: {e}")
            return self._create_default_zones()
    
    def _create_default_zones(self) -> List[Dict]:
        """Create default zones for demonstration"""
        self.logger.info("Creating default geological zones")
        
        return [
            {
                'formation_name': 'Wolfcamp A',
                'lithology': 'Shale/Limestone',
                'top_depth': 5000,
                'bottom_depth': 5150,
                'thickness': 150,
                'porosity': 0.08,
                'permeability': 0.0001,
                'confidence': 0.8,
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': [[[-102.0, 32.0], [-102.0, 32.1], [-101.9, 32.1], [-101.9, 32.0], [-102.0, 32.0]]]
                }
            },
            {
                'formation_name': 'Wolfcamp B',
                'lithology': 'Shale/Sandstone',
                'top_depth': 5150,
                'bottom_depth': 5350,
                'thickness': 200,
                'porosity': 0.10,
                'permeability': 0.0002,
                'confidence': 0.75,
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': [[[-102.0, 32.0], [-102.0, 32.1], [-101.9, 32.1], [-101.9, 32.0], [-102.0, 32.0]]]
                }
            }
        ]
    
    def optimize_well_spacing(self, zones: List[Dict]) -> List[Dict]:
        """Determine optimal well spacing and locations"""
        self.logger.info("Optimizing well spacing and locations")
        
        well_locations = []
        
        # Calculate total productive thickness
        total_thickness = sum(zone['thickness'] for zone in zones)
        
        # Determine number of wells based on formation quality and thickness
        if total_thickness > 300:
            wells_per_section = 8  # 8 wells per 640-acre section
        elif total_thickness > 200:
            wells_per_section = 6
        else:
            wells_per_section = 4
        
        # Generate well locations (simplified grid pattern)
        section_width = 5280  # feet (1 mile)
        
        if wells_per_section == 8:
            # 2x4 pattern
            x_spacing = section_width / 4
            y_spacing = section_width / 2
            rows, cols = 2, 4
        elif wells_per_section == 6:
            # 2x3 pattern  
            x_spacing = section_width / 3
            y_spacing = section_width / 2
            rows, cols = 2, 3
        else:
            # 2x2 pattern
            x_spacing = section_width / 2
            y_spacing = section_width / 2
            rows, cols = 2, 2
        
        well_id = 1
        for row in range(rows):
            for col in range(cols):
                # Calculate position (offset from section corner)
                x_offset = (col + 0.5) * x_spacing
                y_offset = (row + 0.5) * y_spacing
                
                # Convert to lat/lon (simplified)
                base_lon = -102.0
                base_lat = 32.0
                lon = base_lon + (x_offset / 5280) / 69  # Rough conversion
                lat = base_lat + (y_offset / 5280) / 69
                
                # Determine target zones for this well
                target_zones = self._select_target_zones(zones, well_id)
                
                well_location = {
                    'well_id': f"WELL_{well_id:02d}",
                    'latitude': lat,
                    'longitude': lon,
                    'surface_x': x_offset,
                    'surface_y': y_offset,
                    'target_zones': target_zones,
                    'total_depth': max(zone['bottom_depth'] for zone in zones) + 100,
                    'lateral_length': 7500,  # feet
                    'spacing_to_nearest': min(x_spacing, y_spacing)
                }
                
                well_locations.append(well_location)
                well_id += 1
        
        self.logger.info(f"Generated {len(well_locations)} well locations")
        return well_locations
    
    def _select_target_zones(self, zones: List[Dict], well_id: int) -> List[str]:
        """Select target zones for a specific well"""
        # Target the thickest and highest quality zones
        sorted_zones = sorted(zones, key=lambda z: z['thickness'] * z['porosity'], reverse=True)
        
        # Target top 2-3 zones depending on quality
        target_count = min(3, len(sorted_zones))
        return [zone['formation_name'] for zone in sorted_zones[:target_count]]
    
    def forecast_production(self, zones: List[Dict], well_locations: List[Dict]) -> Dict:
        """Model expected production from geological data"""
        self.logger.info("Forecasting production")
        
        # Calculate type curve parameters based on geological data
        avg_porosity = np.mean([zone['porosity'] for zone in zones])
        avg_permeability = np.mean([zone['permeability'] for zone in zones])
        total_thickness = sum(zone['thickness'] for zone in zones)
        
        # Adjust initial rates based on formation quality
        porosity_factor = avg_porosity / 0.10  # Normalize to 10% porosity
        permeability_factor = np.sqrt(avg_permeability / 0.0001)  # Normalize to 0.1 mD
        thickness_factor = total_thickness / 300  # Normalize to 300 ft
        
        quality_multiplier = (porosity_factor * permeability_factor * thickness_factor) ** 0.5
        quality_multiplier = np.clip(quality_multiplier, 0.3, 2.0)  # Reasonable bounds
        
        # Calculate production forecast
        initial_oil = self.production_params['initial_rate_oil'] * quality_multiplier
        initial_gas = self.production_params['initial_rate_gas'] * quality_multiplier
        decline_rate = self.production_params['decline_rate']
        
        # Generate monthly production profiles
        months = range(1, self.production_params['forecast_months'] + 1)
        
        well_forecasts = []
        for well in well_locations:
            # Apply small random variation per well (±15%)
            well_variation = np.random.uniform(0.85, 1.15)
            
            oil_profile = []
            gas_profile = []
            cumulative_oil = 0
            cumulative_gas = 0
            
            for month in months:
                # Hyperbolic decline curve
                decline_factor = (1 + decline_rate * (month - 1) / 12) ** (-1 / decline_rate)
                
                monthly_oil = initial_oil * decline_factor * well_variation * 30  # Convert to monthly
                monthly_gas = initial_gas * decline_factor * well_variation * 30
                
                cumulative_oil += monthly_oil
                cumulative_gas += monthly_gas
                
                oil_profile.append(round(monthly_oil, 1))
                gas_profile.append(round(monthly_gas, 1))
            
            well_forecast = {
                'well_id': well['well_id'],
                'eur_oil': round(cumulative_oil, 0),
                'eur_gas': round(cumulative_gas, 0),
                'peak_oil_rate': round(initial_oil * well_variation, 1),
                'peak_gas_rate': round(initial_gas * well_variation, 1),
                'monthly_oil': oil_profile,
                'monthly_gas': gas_profile,
                'target_zones': well['target_zones']
            }
            
            well_forecasts.append(well_forecast)
        
        # Calculate field totals
        total_eur_oil = sum(w['eur_oil'] for w in well_forecasts)
        total_eur_gas = sum(w['eur_gas'] for w in well_forecasts)
        
        forecast_summary = {
            'total_wells': len(well_locations),
            'total_eur_oil': round(total_eur_oil, 0),
            'total_eur_gas': round(total_eur_gas, 0),
            'avg_eur_oil_per_well': round(total_eur_oil / len(well_locations), 0),
            'avg_eur_gas_per_well': round(total_eur_gas / len(well_locations), 0),
            'forecast_months': self.production_params['forecast_months'],
            'geological_factors': {
                'avg_porosity': round(avg_porosity, 3),
                'avg_permeability': avg_permeability,
                'total_thickness': total_thickness,
                'quality_multiplier': round(quality_multiplier, 2)
            },
            'well_forecasts': well_forecasts
        }
        
        return forecast_summary
    
    def create_development_plan(self, well_locations: List[Dict], forecast: Dict) -> Dict:
        """Create development timeline and resource plan"""
        self.logger.info("Creating development plan")
        
        total_wells = len(well_locations)
        
        # Phase development plan
        if total_wells <= 4:
            phases = [{'phase': 1, 'wells': total_wells, 'duration_months': 6}]
        elif total_wells <= 8:
            wells_phase1 = total_wells // 2
            wells_phase2 = total_wells - wells_phase1
            phases = [
                {'phase': 1, 'wells': wells_phase1, 'duration_months': 6},
                {'phase': 2, 'wells': wells_phase2, 'duration_months': 4}
            ]
        else:
            wells_per_phase = total_wells // 3
            phases = [
                {'phase': 1, 'wells': wells_per_phase, 'duration_months': 6},
                {'phase': 2, 'wells': wells_per_phase, 'duration_months': 4},
                {'phase': 3, 'wells': total_wells - 2 * wells_per_phase, 'duration_months': 4}
            ]
        
        # Calculate costs (simplified estimates)
        cost_per_well = 8_500_000  # $8.5M per well (drilling + completion)
        facility_cost = 2_000_000  # $2M facilities
        total_capex = total_wells * cost_per_well + facility_cost
        
        # Development timeline
        start_date = datetime.now()
        current_date = start_date
        
        for phase in phases:
            phase['start_date'] = current_date.strftime('%Y-%m-%d')
            current_date += timedelta(days=phase['duration_months'] * 30)
            phase['end_date'] = current_date.strftime('%Y-%m-%d')
            phase['capex'] = phase['wells'] * cost_per_well
            if phase['phase'] == 1:
                phase['capex'] += facility_cost
        
        development_plan = {
            'total_wells': total_wells,
            'total_capex': total_capex,
            'development_phases': phases,
            'first_production': phases[0]['end_date'],
            'full_development': phases[-1]['end_date'],
            'cost_breakdown': {
                'drilling_completion': total_wells * cost_per_well,
                'facilities': facility_cost,
                'total': total_capex
            },
            'risk_factors': [
                'Geological risk: Formation variability',
                'Operational risk: Weather and logistics',
                'Market risk: Commodity price volatility',
                'Regulatory risk: Permitting delays'
            ]
        }
        
        return development_plan
    
    def generate_well_locations_geojson(self, well_locations: List[Dict]) -> Dict:
        """Generate well_locations.geojson"""
        self.logger.info("Generating well locations GeoJSON")
        
        geojson = {
            "type": "FeatureCollection",
            "crs": {
                "type": "name",
                "properties": {
                    "name": "EPSG:4326"
                }
            },
            "features": []
        }
        
        for well in well_locations:
            feature = {
                "type": "Feature",
                "properties": {
                    "well_id": well['well_id'],
                    "total_depth": well['total_depth'],
                    "lateral_length": well['lateral_length'],
                    "target_zones": well['target_zones'],
                    "spacing_feet": well['spacing_to_nearest'],
                    "surface_x": well['surface_x'],
                    "surface_y": well['surface_y']
                },
                "geometry": {
                    "type": "Point",
                    "coordinates": [well['longitude'], well['latitude']]
                }
            }
            geojson["features"].append(feature)
        
        return geojson
    
    def generate_development_summary(self, zones: List[Dict], well_locations: List[Dict], 
                                   forecast: Dict, development_plan: Dict) -> str:
        """Generate development_summary.md"""
        self.logger.info("Generating development summary")
        
        summary = f"""# Development Plan Summary

**Run ID:** {self.run_id}
**Analysis Date:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

## Executive Summary

Development plan for **{development_plan['total_wells']} wells** targeting **{len(zones)} formations** with total estimated reserves of **{forecast['total_eur_oil']:,.0f} bbls oil** and **{forecast['total_eur_gas']:,.0f} mcf gas**.

**Total Capital Investment:** ${development_plan['total_capex']:,.0f}
**Development Timeline:** {development_plan['development_phases'][0]['start_date']} to {development_plan['full_development']}
**First Production:** {development_plan['first_production']}

## Geological Targets

| Formation | Thickness (ft) | Porosity | Permeability (mD) | Confidence |
|-----------|----------------|----------|-------------------|------------|
"""
        
        for zone in zones:
            summary += f"| {zone['formation_name']} | {zone['thickness']} | {zone['porosity']:.3f} | {zone['permeability']:.6f} | {zone['confidence']:.1%} |\n"
        
        summary += f"""
**Total Net Pay:** {sum(z['thickness'] for z in zones)} feet
**Average Porosity:** {forecast['geological_factors']['avg_porosity']:.1%}
**Quality Multiplier:** {forecast['geological_factors']['quality_multiplier']:.2f}

## Development Program

### Well Count and Spacing
- **Total Wells:** {development_plan['total_wells']}
- **Spacing:** {self.spacing_params['optimal']} feet (optimal)
- **Lateral Length:** 7,500 feet average
- **Total Depth:** {well_locations[0]['total_depth']:,.0f} feet MD

### Phased Development Plan

"""
        
        for phase in development_plan['development_phases']:
            summary += f"""#### Phase {phase['phase']}
- **Wells:** {phase['wells']}
- **Timeline:** {phase['start_date']} to {phase['end_date']} ({phase['duration_months']} months)
- **Capital:** ${phase['capex']:,.0f}

"""
        
        summary += f"""## Production Forecast

### Field Level Reserves
- **Total Oil EUR:** {forecast['total_eur_oil']:,.0f} bbls
- **Total Gas EUR:** {forecast['total_eur_gas']:,.0f} mcf
- **Average Oil per Well:** {forecast['avg_eur_oil_per_well']:,.0f} bbls
- **Average Gas per Well:** {forecast['avg_eur_gas_per_well']:,.0f} mcf

### Type Curve Parameters
- **Peak Oil Rate:** {max(w['peak_oil_rate'] for w in forecast['well_forecasts']):.0f} bbl/day
- **Peak Gas Rate:** {max(w['peak_gas_rate'] for w in forecast['well_forecasts']):.0f} mcf/day
- **Forecast Period:** {forecast['forecast_months']} months

## Capital Requirements

| Category | Cost | Percentage |
|----------|------|------------|
| Drilling & Completion | ${development_plan['cost_breakdown']['drilling_completion']:,.0f} | {development_plan['cost_breakdown']['drilling_completion']/development_plan['total_capex']:.1%} |
| Facilities | ${development_plan['cost_breakdown']['facilities']:,.0f} | {development_plan['cost_breakdown']['facilities']/development_plan['total_capex']:.1%} |
| **Total** | **${development_plan['cost_breakdown']['total']:,.0f}** | **100%** |

## Risk Assessment

"""
        
        for risk in development_plan['risk_factors']:
            summary += f"- {risk}\n"
        
        summary += f"""
## Implementation Timeline

1. **Permitting & Surface Prep** (Month 1-2)
2. **Phase 1 Drilling** ({development_plan['development_phases'][0]['start_date']})
3. **Facilities Construction** (Parallel with drilling)
4. **First Production** ({development_plan['first_production']})
"""
        
        if len(development_plan['development_phases']) > 1:
            summary += f"5. **Phase 2+ Development** (Through {development_plan['full_development']})\n"
        
        summary += f"""
## Next Steps

1. **Geological Validation** - Confirm formation characteristics with additional data
2. **Economic Modeling** - Integrate production forecasts with pricing and costs
3. **Risk Analysis** - Quantify technical and commercial risks
4. **Permit Applications** - Submit drilling and production permits
5. **Surface Agreements** - Secure surface access and facilities locations

---

Generated with SHALE YEAH (c) Ryan McDonald / Ascendvent LLC - Apache-2.0
"""
        
        return summary
    
    def run_analysis(self, zones_geojson: str, las_files: str = None) -> bool:
        """Run complete drilling forecast analysis"""
        self.logger.info("Starting drilling forecast analysis")
        
        try:
            # Step 1: Load geological zones
            zones = self.load_zones_data(zones_geojson)
            
            if not zones:
                self.logger.error("No geological zones available")
                return False
            
            # Step 2: Optimize well spacing and locations
            well_locations = self.optimize_well_spacing(zones)
            
            # Step 3: Forecast production
            forecast = self.forecast_production(zones, well_locations)
            
            # Step 4: Create development plan
            development_plan = self.create_development_plan(well_locations, forecast)
            
            # Step 5: Generate outputs
            
            # Generate drill_forecast.json
            drill_forecast = {
                'run_id': self.run_id,
                'analysis_date': datetime.now().isoformat(),
                'geological_input': {
                    'zones_count': len(zones),
                    'total_thickness': sum(z['thickness'] for z in zones)
                },
                'development_summary': development_plan,
                'production_forecast': forecast,
                'well_locations_summary': {
                    'total_wells': len(well_locations),
                    'spacing_feet': self.spacing_params['optimal'],
                    'avg_lateral_length': 7500
                }
            }
            
            with open(self.drill_forecast_file, 'w') as f:
                json.dump(drill_forecast, f, indent=2)
            
            self.logger.info(f"Generated drill forecast: {self.drill_forecast_file}")
            
            # Generate well_locations.geojson
            well_locations_geojson = self.generate_well_locations_geojson(well_locations)
            
            with open(self.well_locations_file, 'w') as f:
                json.dump(well_locations_geojson, f, indent=2)
            
            self.logger.info(f"Generated well locations: {self.well_locations_file}")
            
            # Generate development_summary.md
            development_summary = self.generate_development_summary(zones, well_locations, forecast, development_plan)
            
            with open(self.development_summary_file, 'w') as f:
                f.write(development_summary)
            
            self.logger.info(f"Generated development summary: {self.development_summary_file}")
            
            # Validate outputs
            required_files = [self.drill_forecast_file, self.well_locations_file, self.development_summary_file]
            for file_path in required_files:
                if not file_path.exists():
                    self.logger.error(f"Failed to generate {file_path}")
                    return False
            
            self.logger.info("Drilling forecast analysis completed successfully")
            return True
            
        except Exception as e:
            self.logger.error(f"Drilling forecast analysis failed: {e}")
            return False

def main():
    """Main entry point for Drillcast agent"""
    parser = argparse.ArgumentParser(description="Drillcast - Drilling Forecast Agent")
    parser.add_argument("--zones", required=True, help="Geological zones GeoJSON file")
    parser.add_argument("--las-files", help="LAS well log files")
    parser.add_argument("--output-dir", required=True, help="Output directory")
    parser.add_argument("--run-id", required=True, help="Run identifier")
    
    args = parser.parse_args()
    
    # Create agent
    agent = DrillcastAgent(args.output_dir, args.run_id)
    
    # Run analysis
    success = agent.run_analysis(args.zones, args.las_files)
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()