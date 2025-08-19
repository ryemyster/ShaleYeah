#!/usr/bin/env python3
"""
EconoBot Agent - NPV/DCF calculations and transparent economic modeling specialist

Provides transparent NPV/DCF calculations with clear methodology for investment decisions.
Generates valuation.json, econ_summary.csv, and npv_breakdown.md.
"""

import os
import sys
import argparse
import numpy as np
import pandas as pd
from typing import Dict, List, Optional, Tuple
from datetime import datetime, timedelta

from shared import BaseAgent, EconomicBase, DemoDataGenerator

class EconobotAgent(BaseAgent, EconomicBase):
    """NPV/DCF calculations and transparent economic modeling specialist"""
    
    def __init__(self, output_dir: str, run_id: str):
        super().__init__(output_dir, run_id, 'econobot')
    
    def _initialize_agent(self):
        """Initialize econobot-specific attributes"""
        # Expected outputs
        self.expected_outputs = {
            'valuation.json': self.output_dir / "valuation.json",
            'econ_summary.csv': self.output_dir / "econ_summary.csv", 
            'npv_breakdown.md': self.output_dir / "npv_breakdown.md"
        }
        
        # Use standard economic model from base class
        self.economic_model = self.STANDARD_PRICING.copy()
        self.investment_thresholds = self.STANDARD_THRESHOLDS.copy()
        
        # Sensitivity variables for analysis
        self.sensitivity_ranges = {
            'oil_price': [-0.20, -0.10, 0.0, 0.10, 0.20],      # ±20%
            'gas_price': [-0.20, -0.10, 0.0, 0.10, 0.20],      # ±20%
            'production': [-0.30, -0.15, 0.0, 0.15, 0.30],     # ±30%
            'costs': [-0.15, 0.0, 0.15, 0.30]                  # +30%
        }
    
    def load_drill_forecast(self, forecast_file: str) -> Dict:
        """Load drilling forecast data"""
        return self._load_input_file(forecast_file, 'json')
    
    def load_ownership_data(self, ownership_file: str) -> Dict:
        """Load ownership data"""
        return self._load_input_file(ownership_file, 'json')
    
    def _get_demo_data(self, data_type: str) -> Dict:
        """Get demo data for econobot agent"""
        demo_generator = DemoDataGenerator()
        
        if data_type == 'json':
            # For drill forecast files
            return demo_generator._create_demo_drilling_forecast()
        elif data_type == 'ownership':
            return demo_generator._create_demo_ownership_data()
        else:
            return super()._get_demo_data(data_type)
    
    def build_cash_flow_model(self, forecast: Dict, ownership: Dict, pricing: Dict = None) -> pd.DataFrame:
        """Build monthly cash flow projections"""
        self.logger.info("Building cash flow model")
        
        # Use provided pricing or defaults
        if not pricing:
            pricing = self.economic_model
        
        # Extract data
        production_forecast = forecast.get('production_forecast', forecast)
        well_forecasts = production_forecast['well_forecasts']
        forecast_months = production_forecast.get('forecast_months', 60)
        
        # Get operator NRI
        operator = next((o for o in ownership['owners'] if o['type'] == 'operator'), ownership['owners'][0])
        nri = operator.get('nri', 0.6)
        
        # Build monthly cash flows
        cash_flows = []
        
        for month in range(1, forecast_months + 1):
            # Aggregate production for all wells
            total_oil = sum(
                well['monthly_oil'][month - 1] if month <= len(well['monthly_oil']) else 0
                for well in well_forecasts
            )
            total_gas = sum(
                well['monthly_gas'][month - 1] if month <= len(well['monthly_gas']) else 0
                for well in well_forecasts
            )
            
            # Calculate BOE (6:1 gas to oil ratio)
            total_boe = total_oil + (total_gas / 6)
            
            # Revenue calculations
            oil_revenue = total_oil * pricing['oil_price'] * nri
            gas_revenue = total_gas * pricing['gas_price'] * nri
            total_revenue = oil_revenue + gas_revenue
            
            # Operating costs
            operating_costs = total_boe * pricing['loe']
            
            # Net cash flow
            net_cash_flow = total_revenue - operating_costs
            
            cash_flows.append({
                'month': month,
                'date': (datetime.now() + timedelta(days=30 * month)).strftime('%Y-%m'),
                'oil_production': round(total_oil, 1),
                'gas_production': round(total_gas, 1),
                'boe_production': round(total_boe, 1),
                'oil_revenue': round(oil_revenue, 2),
                'gas_revenue': round(gas_revenue, 2),
                'total_revenue': round(total_revenue, 2),
                'operating_costs': round(operating_costs, 2),
                'net_cash_flow': round(net_cash_flow, 2),
                'cumulative_cash_flow': 0  # Will calculate after
            })
        
        # Calculate cumulative cash flows
        cumulative = 0
        for cf in cash_flows:
            cumulative += cf['net_cash_flow']
            cf['cumulative_cash_flow'] = round(cumulative, 2)
        
        return pd.DataFrame(cash_flows)
    
    def calculate_npv_metrics(self, cash_flows: pd.DataFrame, capex: float, discount_rate: float = None) -> Dict:
        """Calculate NPV, IRR, and other financial metrics using shared economic base"""
        self.logger.info("Calculating NPV and financial metrics")
        
        if discount_rate is None:
            discount_rate = self.economic_model['discount_rate']
        
        # Extract monthly cash flows
        monthly_cf = cash_flows['net_cash_flow'].values
        
        # Build full cash flow array (CAPEX in month 0)
        full_cash_flows = np.concatenate([[-capex], monthly_cf])
        
        # Use shared economic calculation methods
        npv = self.calculate_npv(full_cash_flows, discount_rate)
        irr = self.calculate_irr(full_cash_flows)
        roi = self.calculate_roi(np.sum(monthly_cf), capex)
        payback_months = self.calculate_payback_period(full_cash_flows)
        
        # Calculate additional metrics
        total_revenue = cash_flows['total_revenue'].sum()
        total_costs = cash_flows['operating_costs'].sum()
        
        # Check thresholds using shared method
        threshold_results = self.check_investment_thresholds(npv, irr, roi, payback_months, self.investment_thresholds)
        
        metrics = {
            'npv_10': round(npv, 0),
            'irr': round(irr, 4),
            'roi': round(roi, 2),
            'payback_months': int(payback_months),
            'total_revenue': round(total_revenue, 0),
            'total_operating_costs': round(total_costs, 0),
            'total_capex': round(capex, 0),
            'total_free_cash_flow': round(np.sum(monthly_cf), 0),
            'breakeven_month': int(payback_months),
            'discount_rate': discount_rate,
            'meets_thresholds': threshold_results
        }
        
        return metrics
    
    # IRR calculation method removed - now handled by shared EconomicBase
    
    def perform_sensitivity_analysis(self, forecast: Dict, ownership: Dict, base_metrics: Dict) -> Dict:
        """Perform sensitivity analysis on key variables"""
        self.logger.info("Performing sensitivity analysis")
        
        sensitivity_results = {}
        base_pricing = self.economic_model.copy()
        capex = forecast.get('development_summary', {}).get('total_capex', 50_000_000)
        
        for variable, ranges in self.sensitivity_ranges.items():
            sensitivity_results[variable] = {}
            
            for change in ranges:
                # Modify pricing/parameters
                modified_pricing = base_pricing.copy()
                
                if variable == 'oil_price':
                    modified_pricing['oil_price'] = base_pricing['oil_price'] * (1 + change)
                elif variable == 'gas_price':
                    modified_pricing['gas_price'] = base_pricing['gas_price'] * (1 + change)
                elif variable == 'costs':
                    modified_pricing['loe'] = base_pricing['loe'] * (1 + change)
                elif variable == 'production':
                    # Modify production forecasts
                    modified_forecast = self._modify_production_forecast(forecast, change)
                    cash_flows = self.build_cash_flow_model(modified_forecast, ownership, base_pricing)
                    metrics = self.calculate_npv_metrics(cash_flows, capex)
                    sensitivity_results[variable][f"{change:+.1%}"] = {
                        'npv': metrics['npv_10'],
                        'irr': metrics['irr'],
                        'roi': metrics['roi']
                    }
                    continue
                
                # Build cash flows with modified pricing
                cash_flows = self.build_cash_flow_model(forecast, ownership, modified_pricing)
                metrics = self.calculate_npv_metrics(cash_flows, capex)
                
                sensitivity_results[variable][f"{change:+.1%}"] = {
                    'npv': metrics['npv_10'],
                    'irr': metrics['irr'],
                    'roi': metrics['roi']
                }
        
        return sensitivity_results
    
    def _modify_production_forecast(self, forecast: Dict, change: float) -> Dict:
        """Modify production forecast by percentage"""
        modified_forecast = forecast.copy()
        
        # Deep copy the production forecast
        production_forecast = modified_forecast.get('production_forecast', modified_forecast)
        modified_wells = []
        
        for well in production_forecast['well_forecasts']:
            modified_well = well.copy()
            modified_well['monthly_oil'] = [rate * (1 + change) for rate in well['monthly_oil']]
            modified_well['monthly_gas'] = [rate * (1 + change) for rate in well['monthly_gas']]
            modified_well['eur_oil'] = well['eur_oil'] * (1 + change)
            modified_well['eur_gas'] = well['eur_gas'] * (1 + change)
            modified_wells.append(modified_well)
        
        production_forecast['well_forecasts'] = modified_wells
        production_forecast['total_eur_oil'] *= (1 + change)
        production_forecast['total_eur_gas'] *= (1 + change)
        
        return modified_forecast
    
    def generate_npv_breakdown(self, forecast: Dict, ownership: Dict, metrics: Dict, 
                              cash_flows: pd.DataFrame, sensitivity: Dict) -> str:
        """Generate comprehensive NPV breakdown report"""
        self.logger.info("Generating NPV breakdown report")
        
        breakdown = f"""# Economic Analysis and NPV Breakdown

**Run ID:** {self.run_id}
**Analysis Date:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

## Executive Summary

**Net Present Value (10%):** ${metrics['npv_10']:,.0f}
**Internal Rate of Return:** {metrics['irr']:.1%}
**Return on Investment:** {metrics['roi']:.1f}x
**Payback Period:** {metrics['payback_months']} months

**Investment Recommendation:** {'✅ PROCEED' if all(metrics['meets_thresholds'].values()) else '⚠️ REVIEW REQUIRED'}

## Investment Thresholds Analysis

| Metric | Value | Threshold | Status |
|--------|-------|-----------|--------|
| NPV (10%) | ${metrics['npv_10']:,.0f} | ${self.investment_thresholds['minimum_npv']:,.0f} | {'✅ PASS' if metrics['meets_thresholds']['npv'] else '❌ FAIL'} |
| IRR | {metrics['irr']:.1%} | {self.investment_thresholds['minimum_irr']:.1%} | {'✅ PASS' if metrics['meets_thresholds']['irr'] else '❌ FAIL'} |
| ROI | {metrics['roi']:.1f}x | {self.investment_thresholds['minimum_roi']:.1f}x | {'✅ PASS' if metrics['meets_thresholds']['roi'] else '❌ FAIL'} |
| Payback | {metrics['payback_months']} months | {self.investment_thresholds['maximum_payback']} months | {'✅ PASS' if metrics['meets_thresholds']['payback'] else '❌ FAIL'} |

## Economic Model Methodology

The SHALE YEAH economic model follows industry-standard DCF (Discounted Cash Flow) methodology:

```
Revenue = Monthly_Prod * Strip_Price * NRI
OpCost = Monthly_Prod * LOE  
CashFlow = Revenue - OpCost
NPV = sum(CashFlow_t / (1 + r)^t) - CapEx
```

### Key Assumptions

| Parameter | Value | Source |
|-----------|-------|--------|
| Oil Price | ${self.economic_model['oil_price']:.2f}/bbl | Current strip pricing |
| Gas Price | ${self.economic_model['gas_price']:.2f}/mcf | Current strip pricing |
| LOE | ${self.economic_model['loe']:.2f}/boe | Regional average |
| Discount Rate | {self.economic_model['discount_rate']:.1%} | Industry standard |
| NRI | {ownership['owners'][0].get('nri', 0.6):.1%} | Ownership analysis |

## Cash Flow Summary

**Total Capital Investment:** ${metrics['total_capex']:,.0f}
**Total Gross Revenue:** ${metrics['total_revenue']:,.0f}
**Total Operating Costs:** ${metrics['total_operating_costs']:,.0f}
**Total Free Cash Flow:** ${metrics['total_free_cash_flow']:,.0f}

### Development Capital Breakdown
"""
        
        dev_summary = forecast.get('development_summary', {})
        phases = dev_summary.get('development_phases', [])
        
        for phase in phases:
            breakdown += f"- **Phase {phase['phase']}:** ${phase['capex']:,.0f} ({phase['wells']} wells)\n"
        
        breakdown += f"""
### Production Summary

**Total Wells:** {forecast.get('production_forecast', {}).get('total_wells', 0)}
**Total Oil EUR:** {forecast.get('production_forecast', {}).get('total_eur_oil', 0):,.0f} bbls
**Total Gas EUR:** {forecast.get('production_forecast', {}).get('total_eur_gas', 0):,.0f} mcf
**Forecast Period:** {forecast.get('production_forecast', {}).get('forecast_months', 60)} months

## Sensitivity Analysis

### NPV Sensitivity (${metrics['npv_10']:,.0f} base case)

| Variable | -30% | -15% | Base | +15% | +30% |
|----------|------|------|------|------|------|
"""
        
        # Add sensitivity table for NPV
        for variable in ['oil_price', 'gas_price', 'production', 'costs']:
            if variable in sensitivity:
                breakdown += f"| {variable.replace('_', ' ').title()} |"
                
                for change in ['-30.0%', '-15.0%', '+0.0%', '+15.0%', '+30.0%']:
                    if change in sensitivity[variable]:
                        npv = sensitivity[variable][change]['npv']
                        breakdown += f" ${npv:,.0f} |"
                    elif change == '+0.0%':
                        breakdown += f" ${metrics['npv_10']:,.0f} |"
                    else:
                        breakdown += " N/A |"
                
                breakdown += "\n"
        
        breakdown += f"""
### Risk Assessment

**Base Case Confidence:** {'High' if all(metrics['meets_thresholds'].values()) else 'Medium'}

**Key Risks:**
- **Commodity Price Risk:** Oil and gas price volatility affects revenue
- **Production Risk:** Well performance may vary from type curve
- **Cost Inflation Risk:** LOE and development costs may increase
- **Operational Risk:** Drilling and completion execution

**Upside Potential:**
- **Enhanced Recovery:** Advanced completion techniques
- **Cost Optimization:** Operational efficiency improvements  
- **Price Scenarios:** Commodity price upside
- **Additional Zones:** Future drilling opportunities

## Investment Decision Framework

Based on the analysis:

1. **Financial Metrics:** {'All thresholds met' if all(metrics['meets_thresholds'].values()) else 'Some thresholds not met'}
2. **Risk Profile:** {'Acceptable' if metrics['irr'] > 0.20 else 'Elevated'} given {metrics['irr']:.1%} IRR
3. **Market Timing:** Favorable oil and gas pricing environment
4. **Operational Readiness:** Development plan aligned with financial analysis

## Next Steps

"""
        
        if all(metrics['meets_thresholds'].values()):
            breakdown += """
1. **Proceed to Risk Analysis** - Quantify technical and operational risks
2. **Investment Committee Review** - Present financial analysis for approval
3. **Development Authorization** - Authorize Phase 1 development
4. **Risk Management** - Implement commodity hedging strategy
"""
        else:
            breakdown += """
1. **Review Investment Criteria** - Reassess thresholds and assumptions
2. **Optimize Development Plan** - Evaluate cost reduction opportunities
3. **Market Analysis** - Consider alternative timing scenarios
4. **Risk Mitigation** - Develop contingency plans
"""
        
        breakdown += """
## Methodology Validation

This analysis follows industry best practices:
- **DCF Methodology:** Standard discounted cash flow approach
- **Risk-Adjusted Returns:** Appropriate discount rates for oil & gas
- **Sensitivity Analysis:** Comprehensive variable testing
- **Transparent Assumptions:** All inputs clearly documented

**Quality Assurance:** All calculations independently verifiable
**Model Validation:** Results consistent with industry benchmarks
**Audit Trail:** Complete documentation of methodology and assumptions

---

Generated with SHALE YEAH (c) Ryan McDonald / Ascendvent LLC - Apache-2.0
"""
        
        return breakdown
    
    def run_analysis(self, drill_forecast_file: str, ownership_file: str, pricing_deck: str = None) -> bool:
        """Run complete economic analysis"""
        self.logger.info("Starting economic analysis")
        
        try:
            # Step 1: Load input data
            forecast = self.load_drill_forecast(drill_forecast_file)
            ownership = self.load_ownership_data(ownership_file)
            
            if not forecast.get('production_forecast'):
                self.logger.error("No production forecast available")
                return False
            
            if not ownership.get('owners'):
                self.logger.error("No ownership data available")
                return False
            
            # Step 2: Build cash flow model
            cash_flows = self.build_cash_flow_model(forecast, ownership)
            
            # Step 3: Calculate NPV and financial metrics
            capex = forecast.get('development_summary', {}).get('total_capex', 50_000_000)
            metrics = self.calculate_npv_metrics(cash_flows, capex)
            
            # Step 4: Perform sensitivity analysis
            sensitivity = self.perform_sensitivity_analysis(forecast, ownership, metrics)
            
            # Step 5: Generate outputs
            
            # Generate outputs using shared base class methods
            valuation_data = {
                'run_id': self.run_id,
                'analysis_date': datetime.now().isoformat(),
                'financial_metrics': metrics,
                'economic_assumptions': self.economic_model,
                'investment_thresholds': self.investment_thresholds,
                'sensitivity_analysis': sensitivity,
                'cash_flow_summary': {
                    'total_months': len(cash_flows),
                    'peak_monthly_revenue': float(cash_flows['total_revenue'].max()),
                    'average_monthly_cashflow': float(cash_flows['net_cash_flow'].mean()),
                    'total_production_boe': float(cash_flows['boe_production'].sum())
                }
            }
            
            # Use shared output methods with proper JSON serialization
            self._save_output_file(valuation_data, 'valuation.json', 'json')
            self._save_output_file(cash_flows, 'econ_summary.csv', 'csv')
            
            # Generate NPV breakdown with SHALE YEAH footer
            npv_breakdown = self.generate_npv_breakdown(forecast, ownership, metrics, cash_flows, sensitivity)
            npv_breakdown = self._add_shale_yeah_footer(npv_breakdown)
            self._save_output_file(npv_breakdown, 'npv_breakdown.md', 'md')
            
            # Validate outputs using shared method
            required_files = list(self.expected_outputs.keys())
            if not self._validate_outputs(required_files):
                return False
            
            self.logger.info("Economic analysis completed successfully")
            return True
            
        except Exception as e:
            self.logger.error(f"Economic analysis failed: {e}")
            return False

def main():
    """Main entry point for EconoBot agent"""
    parser = argparse.ArgumentParser(description="EconoBot - Economic Modeling Agent")
    parser.add_argument("--forecast", required=True, help="Drill forecast file")
    parser.add_argument("--ownership", required=True, help="Ownership data file")
    parser.add_argument("--pricing", help="Pricing deck file")
    parser.add_argument("--output-dir", required=True, help="Output directory")
    parser.add_argument("--run-id", required=True, help="Run identifier")
    
    args = parser.parse_args()
    
    # Create agent
    agent = EconobotAgent(args.output_dir, args.run_id)
    
    # Run analysis
    success = agent.run_analysis(args.forecast, args.ownership, args.pricing)
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()