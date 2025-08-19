#!/usr/bin/env python3
"""
RiskRanger Agent - Risk scoring and probabilistic analysis specialist

Comprehensive risk assessment with Monte Carlo simulation and probability distributions.
Generates risk_score.json, risk_analysis.md, and probability_distributions.json.
"""

import os
import sys
import argparse
import numpy as np
from typing import Dict, List, Optional, Tuple
from datetime import datetime
import statistics

from shared import BaseAgent, EconomicBase, DemoDataGenerator

class RiskrangerAgent(BaseAgent, EconomicBase):
    """Risk scoring and probabilistic analysis specialist"""
    
    def __init__(self, output_dir: str, run_id: str):
        super().__init__(output_dir, run_id, 'riskranger')
    
    def _initialize_agent(self):
        """Initialize riskranger-specific attributes"""
        # Expected outputs
        self.expected_outputs = {
            'risk_score.json': self.output_dir / "risk_score.json",
            'risk_analysis.md': self.output_dir / "risk_analysis.md", 
            'probability_distributions.json': self.output_dir / "probability_distributions.json"
        }
        
        
        # Risk categories and weights
        self.risk_categories = {
            'geological': 0.30,
            'operational': 0.25,
            'market': 0.20,
            'financial': 0.15,
            'title': 0.10
        }
        
        # Risk thresholds (1-100 scale)
        self.risk_thresholds = {
            'very_low': (1, 20),
            'low': (21, 35),
            'medium': (36, 65),
            'high': (66, 85),
            'very_high': (86, 100)
        }
        
        # Monte Carlo parameters
        self.monte_carlo_params = {
            'iterations': 10000,
            'production_variance': 0.30,  # ±30%
            'price_variance': 0.40,       # ±40%
            'cost_variance': 0.25,        # ±25%
            'timing_variance': 0.20       # ±20%
        }
    
    def load_valuation_data(self, valuation_file: str) -> Dict:
        """Load valuation and economic data"""
        return self._load_input_file(valuation_file, 'json')
    
    def load_geological_data(self, geology_file: str) -> Dict:
        """Load geological zones and confidence data"""
        return self._load_input_file(geology_file, 'json')
    
    def load_ownership_data(self, ownership_file: str) -> Dict:
        """Load ownership and title data"""
        return self._load_input_file(ownership_file, 'json')
    
    def _get_demo_data(self, data_type: str) -> Dict:
        """Get demo data for riskranger agent"""
        demo_generator = DemoDataGenerator()
        
        if data_type == 'json':
            # For valuation files, return valuation data
            return demo_generator._create_demo_valuation_data()
        else:
            return super()._get_demo_data(data_type)
    
    def assess_geological_risk(self, geology_data: Dict) -> Dict:
        """Assess geological and reservoir risks"""
        self.logger.info("Assessing geological risks")
        
        features = geology_data.get('features', [])
        
        if not features:
            return {'risk_score': 75, 'factors': ['No geological data available']}
        
        # Calculate risk factors
        confidence_scores = [f['properties'].get('confidence', 0.5) for f in features]
        avg_confidence = statistics.mean(confidence_scores)
        
        thicknesses = [f['properties'].get('thickness', 100) for f in features]
        total_thickness = sum(thicknesses)
        
        porosities = [f['properties'].get('porosity', 0.08) for f in features]
        avg_porosity = statistics.mean(porosities)
        
        # Risk scoring (lower confidence = higher risk)
        confidence_risk = max(0, (0.9 - avg_confidence) * 100)  # 0-90 scale
        
        # Thickness risk (less than 200ft total = higher risk)
        thickness_risk = max(0, (300 - total_thickness) / 300 * 50)  # 0-50 scale
        
        # Porosity risk (less than 8% = higher risk)
        porosity_risk = max(0, (0.10 - avg_porosity) / 0.10 * 30)  # 0-30 scale
        
        # Structural complexity risk (simplified)
        structural_risk = 25  # Default moderate risk
        
        total_risk = min(100, confidence_risk + thickness_risk + porosity_risk + structural_risk)
        
        risk_factors = []
        if confidence_risk > 30:
            risk_factors.append(f"Low formation confidence ({avg_confidence:.1%})")
        if thickness_risk > 20:
            risk_factors.append(f"Limited productive thickness ({total_thickness}ft)")
        if porosity_risk > 15:
            risk_factors.append(f"Below-average porosity ({avg_porosity:.2%})")
        
        return {
            'risk_score': round(total_risk),
            'confidence_risk': round(confidence_risk),
            'thickness_risk': round(thickness_risk),
            'porosity_risk': round(porosity_risk),
            'structural_risk': round(structural_risk),
            'factors': risk_factors,
            'metrics': {
                'avg_confidence': avg_confidence,
                'total_thickness': total_thickness,
                'avg_porosity': avg_porosity
            }
        }
    
    def assess_operational_risk(self, valuation_data: Dict) -> Dict:
        """Assess drilling and operational risks"""
        self.logger.info("Assessing operational risks")
        
        # Base operational risk factors
        drilling_risk = 30    # Moderate drilling complexity
        completion_risk = 25  # Standard completion risk
        facility_risk = 20    # Infrastructure development risk
        environmental_risk = 15  # Regulatory and environmental
        timeline_risk = 25    # Development schedule risk
        
        # Adjust based on project size
        capex = valuation_data.get('financial_metrics', {}).get('total_capex', 50_000_000)
        
        if capex > 100_000_000:
            drilling_risk += 10  # Large projects = more complex
            timeline_risk += 15
        elif capex < 20_000_000:
            drilling_risk -= 10  # Smaller projects = less complex
            
        total_risk = min(100, drilling_risk + completion_risk + facility_risk + environmental_risk)
        
        risk_factors = []
        if drilling_risk > 35:
            risk_factors.append("High drilling complexity")
        if completion_risk > 30:
            risk_factors.append("Advanced completion requirements")
        if timeline_risk > 30:
            risk_factors.append("Aggressive development timeline")
        
        return {
            'risk_score': round(total_risk * 0.8),  # Scale down from components
            'drilling_risk': drilling_risk,
            'completion_risk': completion_risk,
            'facility_risk': facility_risk,
            'environmental_risk': environmental_risk,
            'timeline_risk': timeline_risk,
            'factors': risk_factors
        }
    
    def assess_market_risk(self, valuation_data: Dict) -> Dict:
        """Assess commodity price and market risks"""
        self.logger.info("Assessing market risks")
        
        # Analyze price sensitivity
        sensitivity = valuation_data.get('sensitivity_analysis', {})
        oil_sensitivity = sensitivity.get('oil_price', {})
        
        # Calculate price volatility impact
        base_npv = valuation_data.get('financial_metrics', {}).get('npv_10', 2500000)
        
        # Price risk based on sensitivity
        if oil_sensitivity:
            downside_20 = oil_sensitivity.get('-20.0%', {}).get('npv', base_npv * 0.7)
            upside_20 = oil_sensitivity.get('+20.0%', {}).get('npv', base_npv * 1.3)
            
            downside_impact = (base_npv - downside_20) / base_npv if base_npv > 0 else 0.3
            price_risk = min(60, downside_impact * 100)
        else:
            price_risk = 40  # Default moderate price risk
        
        # Market access and basis differential risk
        basis_risk = 20      # Local pricing vs benchmark
        transport_risk = 15  # Takeaway capacity
        demand_risk = 25     # Market demand volatility
        
        total_risk = min(100, price_risk + basis_risk + transport_risk + demand_risk)
        
        risk_factors = []
        if price_risk > 45:
            risk_factors.append("High commodity price sensitivity")
        if basis_risk > 25:
            risk_factors.append("Significant basis differential exposure")
        if transport_risk > 20:
            risk_factors.append("Limited transportation capacity")
        
        return {
            'risk_score': round(total_risk * 0.7),  # Scale down
            'price_risk': round(price_risk),
            'basis_risk': basis_risk,
            'transport_risk': transport_risk,
            'demand_risk': demand_risk,
            'factors': risk_factors
        }
    
    def assess_financial_risk(self, valuation_data: Dict) -> Dict:
        """Assess financial and capital risks"""
        self.logger.info("Assessing financial risks")
        
        metrics = valuation_data.get('financial_metrics', {})
        
        # IRR risk (lower IRR = higher risk)
        irr = metrics.get('irr', 0.15)
        irr_risk = max(0, (0.25 - irr) / 0.25 * 60)  # Risk if IRR < 25%
        
        # Payback risk (longer payback = higher risk)
        payback = metrics.get('payback_months', 18)
        payback_risk = max(0, (payback - 12) / 12 * 30)  # Risk if payback > 12 months
        
        # Capital intensity risk
        capex = metrics.get('total_capex', 50_000_000)
        if capex > 100_000_000:
            capital_risk = 35
        elif capex > 50_000_000:
            capital_risk = 25
        else:
            capital_risk = 15
        
        # Cost inflation risk
        inflation_risk = 20  # Default cost escalation risk
        
        total_risk = min(100, irr_risk + payback_risk + capital_risk + inflation_risk)
        
        risk_factors = []
        if irr_risk > 20:
            risk_factors.append(f"Below-target IRR ({irr:.1%})")
        if payback_risk > 15:
            risk_factors.append(f"Extended payback period ({payback} months)")
        if capital_risk > 30:
            risk_factors.append("High capital intensity")
        
        return {
            'risk_score': round(total_risk * 0.8),
            'irr_risk': round(irr_risk),
            'payback_risk': round(payback_risk),
            'capital_risk': capital_risk,
            'inflation_risk': inflation_risk,
            'factors': risk_factors
        }
    
    def assess_title_risk(self, ownership_data: Dict) -> Dict:
        """Assess title and ownership risks"""
        self.logger.info("Assessing title risks")
        
        validation = ownership_data.get('validation', {})
        
        # Working interest validation risk
        wi_valid = validation.get('wi_valid', False)
        wi_risk = 0 if wi_valid else 40
        
        # Title clarity risk
        total_wi = validation.get('total_wi', 0.8)
        clarity_risk = max(0, (1.0 - total_wi) * 50)
        
        # Operator control risk
        operators = [o for o in ownership_data.get('owners', []) if o.get('type') == 'operator']
        if operators and operators[0].get('wi', 0) >= 0.5:
            control_risk = 10  # Good operator control
        elif operators:
            control_risk = 25  # Weak operator position
        else:
            control_risk = 50  # No clear operator
        
        # Lease status risk (simplified)
        lease_risk = 20  # Default moderate lease risk
        
        total_risk = min(100, wi_risk + clarity_risk + control_risk + lease_risk)
        
        risk_factors = []
        if wi_risk > 30:
            risk_factors.append("Working interest validation issues")
        if clarity_risk > 20:
            risk_factors.append("Title clarity concerns")
        if control_risk > 30:
            risk_factors.append("Weak operational control")
        
        return {
            'risk_score': round(total_risk),
            'wi_risk': wi_risk,
            'clarity_risk': round(clarity_risk),
            'control_risk': control_risk,
            'lease_risk': lease_risk,
            'factors': risk_factors
        }
    
    def calculate_composite_risk(self, risk_assessments: Dict) -> Dict:
        """Calculate weighted composite risk score"""
        self.logger.info("Calculating composite risk score")
        
        weighted_score = 0
        total_weight = 0
        
        for category, weight in self.risk_categories.items():
            if category in risk_assessments:
                score = risk_assessments[category]['risk_score']
                weighted_score += score * weight
                total_weight += weight
        
        composite_score = weighted_score / total_weight if total_weight > 0 else 50
        
        # Determine risk level
        risk_level = 'medium'
        for level, (min_score, max_score) in self.risk_thresholds.items():
            if min_score <= composite_score <= max_score:
                risk_level = level
                break
        
        return {
            'composite_score': round(composite_score),
            'risk_level': risk_level,
            'category_scores': {cat: risk_assessments[cat]['risk_score'] 
                              for cat in risk_assessments},
            'weights': self.risk_categories
        }
    
    def run_monte_carlo_simulation(self, valuation_data: Dict) -> Dict:
        """Run Monte Carlo simulation for probabilistic analysis"""
        self.logger.info("Running Monte Carlo simulation")
        
        base_metrics = valuation_data.get('financial_metrics', {})
        base_npv = base_metrics.get('npv_10', 2500000)
        base_irr = base_metrics.get('irr', 0.25)
        
        iterations = self.monte_carlo_params['iterations']
        
        # Storage for results
        npv_results = []
        irr_results = []
        
        # Run simulation
        np.random.seed(42)  # For reproducible results
        
        for i in range(iterations):
            # Generate random variations
            prod_variation = np.random.normal(1.0, self.monte_carlo_params['production_variance'] / 3)
            price_variation = np.random.normal(1.0, self.monte_carlo_params['price_variance'] / 3)
            cost_variation = np.random.normal(1.0, self.monte_carlo_params['cost_variance'] / 3)
            
            # Ensure reasonable bounds
            prod_variation = np.clip(prod_variation, 0.4, 1.8)
            price_variation = np.clip(price_variation, 0.5, 1.8)
            cost_variation = np.clip(cost_variation, 0.7, 1.5)
            
            # Calculate scenario NPV and IRR
            revenue_factor = prod_variation * price_variation
            cost_factor = cost_variation
            
            # Simplified NPV calculation
            scenario_npv = base_npv * revenue_factor - (base_npv * 0.3 * (cost_factor - 1))
            scenario_irr = base_irr * (revenue_factor / cost_factor) ** 0.5
            
            npv_results.append(scenario_npv)
            irr_results.append(scenario_irr)
        
        # Calculate statistics
        npv_p10 = np.percentile(npv_results, 90)  # Optimistic
        npv_p50 = np.percentile(npv_results, 50)  # Most likely
        npv_p90 = np.percentile(npv_results, 10)  # Conservative
        
        irr_p10 = np.percentile(irr_results, 90)
        irr_p50 = np.percentile(irr_results, 50)
        irr_p90 = np.percentile(irr_results, 10)
        
        # Success probability (NPV > 0)
        success_prob = len([npv for npv in npv_results if npv > 0]) / len(npv_results)
        
        # Target threshold probability (NPV > minimum)
        target_npv = 300000  # Minimum NPV threshold
        target_prob = len([npv for npv in npv_results if npv > target_npv]) / len(npv_results)
        
        return {
            'iterations': iterations,
            'npv_statistics': {
                'p10': round(npv_p10, 0),
                'p50': round(npv_p50, 0),
                'p90': round(npv_p90, 0),
                'mean': round(np.mean(npv_results), 0),
                'std_dev': round(np.std(npv_results), 0)
            },
            'irr_statistics': {
                'p10': round(irr_p10, 4),
                'p50': round(irr_p50, 4),
                'p90': round(irr_p90, 4),
                'mean': round(np.mean(irr_results), 4),
                'std_dev': round(np.std(irr_results), 4)
            },
            'success_probability': round(success_prob, 3),
            'target_probability': round(target_prob, 3),
            'parameters': self.monte_carlo_params
        }
    
    def identify_mitigation_strategies(self, risk_assessments: Dict, composite_risk: Dict) -> List[Dict]:
        """Identify risk mitigation strategies"""
        self.logger.info("Identifying risk mitigation strategies")
        
        strategies = []
        
        # Geological risk mitigation
        if risk_assessments.get('geological', {}).get('risk_score', 0) > 50:
            strategies.append({
                'category': 'geological',
                'strategy': 'Enhanced Geological Analysis',
                'description': 'Acquire additional seismic data or drill pilot wells',
                'impact': 'Reduce formation uncertainty by 20-30%',
                'cost': 'Medium',
                'timeline': '3-6 months'
            })
        
        # Operational risk mitigation
        if risk_assessments.get('operational', {}).get('risk_score', 0) > 50:
            strategies.append({
                'category': 'operational',
                'strategy': 'Phased Development',
                'description': 'Stage development to reduce execution risk',
                'impact': 'Lower capital exposure and operational complexity',
                'cost': 'Low',
                'timeline': 'Immediate'
            })
        
        # Market risk mitigation
        if risk_assessments.get('market', {}).get('risk_score', 0) > 50:
            strategies.append({
                'category': 'market',
                'strategy': 'Commodity Hedging',
                'description': 'Hedge 50-70% of production for first 2 years',
                'impact': 'Reduce price volatility exposure',
                'cost': 'Low (hedging costs)',
                'timeline': 'Immediate'
            })
        
        # Financial risk mitigation
        if risk_assessments.get('financial', {}).get('risk_score', 0) > 50:
            strategies.append({
                'category': 'financial',
                'strategy': 'Joint Venture Partnership',
                'description': 'Bring in financial partner to share risk',
                'impact': 'Reduce capital requirements and risk exposure',
                'cost': 'Medium (equity dilution)',
                'timeline': '2-4 months'
            })
        
        # Title risk mitigation
        if risk_assessments.get('title', {}).get('risk_score', 0) > 50:
            strategies.append({
                'category': 'title',
                'strategy': 'Title Insurance',
                'description': 'Obtain comprehensive title insurance coverage',
                'impact': 'Protect against title defects and ownership disputes',
                'cost': 'Low',
                'timeline': '1-2 months'
            })
        
        # High composite risk strategies
        if composite_risk['composite_score'] > 70:
            strategies.append({
                'category': 'portfolio',
                'strategy': 'Risk Diversification',
                'description': 'Diversify across multiple assets and basins',
                'impact': 'Reduce overall portfolio risk through diversification',
                'cost': 'High (additional investments)',
                'timeline': '6-12 months'
            })
        
        return strategies
    
    def generate_risk_analysis_report(self, risk_assessments: Dict, composite_risk: Dict, 
                                    monte_carlo: Dict, mitigation_strategies: List[Dict]) -> str:
        """Generate comprehensive risk analysis report"""
        self.logger.info("Generating risk analysis report")
        
        report = f"""# Risk Analysis Report

**Run ID:** {self.run_id}
**Analysis Date:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

## Executive Summary

**Overall Risk Level:** {composite_risk['risk_level'].upper().replace('_', ' ')}
**Composite Risk Score:** {composite_risk['composite_score']}/100
**Success Probability:** {monte_carlo['success_probability']:.1%}

## Risk Assessment by Category

| Category | Score | Weight | Weighted Score | Level |
|----------|-------|--------|----------------|-------|
"""
        
        for category, weight in self.risk_categories.items():
            if category in risk_assessments:
                score = risk_assessments[category]['risk_score']
                weighted = score * weight
                level = self._get_risk_level(score)
                report += f"| {category.title()} | {score} | {weight:.1%} | {weighted:.1f} | {level} |\n"
        
        report += f"""
**Total Weighted Score:** {composite_risk['composite_score']:.1f}/100

## Detailed Risk Analysis

"""
        
        # Detailed category analysis
        for category, assessment in risk_assessments.items():
            report += f"""### {category.title()} Risk ({assessment['risk_score']}/100)

**Risk Level:** {self._get_risk_level(assessment['risk_score'])}

**Key Risk Factors:**
"""
            for factor in assessment.get('factors', []):
                report += f"- {factor}\n"
            
            report += "\n"
        
        # Monte Carlo Results
        report += f"""## Probabilistic Analysis

### Monte Carlo Simulation Results ({monte_carlo['iterations']:,} iterations)

#### NPV Distribution
- **P90 (Conservative):** ${monte_carlo['npv_statistics']['p90']:,.0f}
- **P50 (Most Likely):** ${monte_carlo['npv_statistics']['p50']:,.0f}
- **P10 (Optimistic):** ${monte_carlo['npv_statistics']['p10']:,.0f}
- **Mean:** ${monte_carlo['npv_statistics']['mean']:,.0f}
- **Standard Deviation:** ${monte_carlo['npv_statistics']['std_dev']:,.0f}

#### IRR Distribution
- **P90 (Conservative):** {monte_carlo['irr_statistics']['p90']:.1%}
- **P50 (Most Likely):** {monte_carlo['irr_statistics']['p50']:.1%}
- **P10 (Optimistic):** {monte_carlo['irr_statistics']['p10']:.1%}

#### Success Metrics
- **Success Probability (NPV > $0):** {monte_carlo['success_probability']:.1%}
- **Target Achievement (NPV > $300K):** {monte_carlo['target_probability']:.1%}

## Risk Mitigation Strategies

"""
        
        for strategy in mitigation_strategies:
            report += f"""### {strategy['strategy']}

**Category:** {strategy['category'].title()}
**Description:** {strategy['description']}
**Expected Impact:** {strategy['impact']}
**Implementation Cost:** {strategy['cost']}
**Timeline:** {strategy['timeline']}

"""
        
        report += f"""## Risk Management Recommendations

### Immediate Actions (0-3 months)
1. **Risk Monitoring** - Establish key risk indicators and monitoring protocols
2. **Contingency Planning** - Develop specific response plans for high-risk scenarios
3. **Stakeholder Communication** - Ensure all parties understand risk profile

### Medium-term Actions (3-12 months)
1. **Risk Mitigation Implementation** - Execute prioritized mitigation strategies
2. **Performance Monitoring** - Track actual vs. forecasted performance
3. **Strategy Adjustment** - Modify approach based on new information

### Long-term Considerations (12+ months)
1. **Portfolio Optimization** - Consider risk diversification across assets
2. **Lessons Learned** - Incorporate experience into future risk models
3. **Technology Adoption** - Leverage new technologies to reduce risk

## Risk Appetite and Tolerance

**Current Risk Profile:** {'Acceptable' if composite_risk['composite_score'] < 60 else 'Elevated'}

**Recommended Actions:**
"""
        
        if composite_risk['composite_score'] < 35:
            report += "- Proceed with development as planned\n- Monitor key risk indicators\n- Maintain contingency plans\n"
        elif composite_risk['composite_score'] < 60:
            report += "- Implement moderate risk mitigation measures\n- Enhanced monitoring and reporting\n- Consider phased development approach\n"
        else:
            report += "- Comprehensive risk mitigation required before proceeding\n- Consider alternative development strategies\n- Evaluate risk-sharing partnerships\n"
        
        report += """
## Conclusion

This risk analysis provides a comprehensive assessment of technical, operational, market, financial, and title risks associated with the investment opportunity. The probabilistic analysis quantifies uncertainty ranges and success probabilities to support informed decision-making.

**Key Takeaways:**
- Risk assessment is based on current available information
- Mitigation strategies can significantly reduce risk exposure
- Continuous monitoring and adjustment are essential for success
- Decision should consider risk tolerance and portfolio context
"""
        
        return report
    
    def _get_risk_level(self, score: float) -> str:
        """Get risk level description from score"""
        for level, (min_score, max_score) in self.risk_thresholds.items():
            if min_score <= score <= max_score:
                return level.replace('_', ' ').title()
        return 'Unknown'
    
    def run_analysis(self, valuation_file: str, geology_file: str, ownership_file: str) -> bool:
        """Run complete risk analysis"""
        self.logger.info("Starting risk analysis")
        
        try:
            # Step 1: Load input data
            valuation_data = self.load_valuation_data(valuation_file)
            geology_data = self.load_geological_data(geology_file)
            ownership_data = self.load_ownership_data(ownership_file)
            
            # Step 2: Assess risks by category
            risk_assessments = {}
            
            risk_assessments['geological'] = self.assess_geological_risk(geology_data)
            risk_assessments['operational'] = self.assess_operational_risk(valuation_data)
            risk_assessments['market'] = self.assess_market_risk(valuation_data)
            risk_assessments['financial'] = self.assess_financial_risk(valuation_data)
            risk_assessments['title'] = self.assess_title_risk(ownership_data)
            
            # Step 3: Calculate composite risk
            composite_risk = self.calculate_composite_risk(risk_assessments)
            
            # Step 4: Run Monte Carlo simulation
            monte_carlo_results = self.run_monte_carlo_simulation(valuation_data)
            
            # Step 5: Identify mitigation strategies
            mitigation_strategies = self.identify_mitigation_strategies(risk_assessments, composite_risk)
            
            # Step 6: Generate outputs using shared base class methods
            
            # Generate risk_score.json
            risk_score_data = {
                'run_id': self.run_id,
                'analysis_date': datetime.now().isoformat(),
                'composite_risk': composite_risk,
                'category_assessments': risk_assessments,
                'success_probability': monte_carlo_results['success_probability'],
                'mitigation_strategies': mitigation_strategies
            }
            
            self._save_output_file(risk_score_data, 'risk_score.json', 'json')
            
            # Generate probability_distributions.json
            self._save_output_file(monte_carlo_results, 'probability_distributions.json', 'json')
            
            # Generate risk_analysis.md with SHALE YEAH footer
            risk_analysis = self.generate_risk_analysis_report(
                risk_assessments, composite_risk, monte_carlo_results, mitigation_strategies
            )
            risk_analysis = self._add_shale_yeah_footer(risk_analysis)
            self._save_output_file(risk_analysis, 'risk_analysis.md', 'md')
            
            # Validate outputs using shared method
            required_files = list(self.expected_outputs.keys())
            if not self._validate_outputs(required_files):
                return False
            
            self.logger.info("Risk analysis completed successfully")
            return True
            
        except Exception as e:
            self.logger.error(f"Risk analysis failed: {e}")
            return False

def main():
    """Main entry point for RiskRanger agent"""
    parser = argparse.ArgumentParser(description="RiskRanger - Risk Analysis Agent")
    parser.add_argument("--valuation", required=True, help="Valuation data file")
    parser.add_argument("--geology", required=True, help="Geological zones file")
    parser.add_argument("--ownership", required=True, help="Ownership data file")
    parser.add_argument("--output-dir", required=True, help="Output directory")
    parser.add_argument("--run-id", required=True, help="Run identifier")
    
    args = parser.parse_args()
    
    # Create agent
    agent = RiskrangerAgent(args.output_dir, args.run_id)
    
    # Run analysis
    success = agent.run_analysis(args.valuation, args.geology, args.ownership)
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()