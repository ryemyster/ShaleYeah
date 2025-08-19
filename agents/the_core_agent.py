#!/usr/bin/env python3
"""
The-Core Agent - Investment decision logic and 3x ROI threshold enforcement specialist

Makes go/no-go investment decisions based on transparent criteria and thresholds.
Generates investment_decision.json, decision_matrix.md, and recommendation.md.
"""

import os
import sys
import argparse
from typing import Dict, List, Optional, Any
from datetime import datetime

from shared import BaseAgent, EconomicBase, DemoDataGenerator

class TheCoreAgent(BaseAgent, EconomicBase):
    """Investment decision logic and 3x ROI threshold enforcement specialist"""
    
    def __init__(self, output_dir: str, run_id: str):
        super().__init__(output_dir, run_id, 'the-core')
    
    def _initialize_agent(self):
        """Initialize the-core-specific attributes"""
        # Expected outputs
        self.expected_outputs = {
            'investment_decision.json': self.output_dir / "investment_decision.json",
            'decision_matrix.md': self.output_dir / "decision_matrix.md",
            'recommendation.md': self.output_dir / "recommendation.md"
        }
        
        
        # Use standard investment thresholds from economic base 
        self.financial_thresholds = self.STANDARD_THRESHOLDS.copy()
        
        self.risk_thresholds = {
            'maximum_risk_score': 65,           # Maximum acceptable risk score (1-100)
            'minimum_success_prob': 0.70,      # 70% minimum probability of success
            'maximum_capital_at_risk': 1000000 # $1M maximum single investment
        }
        
        self.operational_requirements = {
            'title_clarity': 0.95,              # 95% minimum title clarity
            'operator_control': True,           # Must have operational control
            'permit_status': 'approved_or_pending'
        }
        
        self.strategic_criteria = {
            'portfolio_fit': True,
            'market_timing': True,
            'risk_diversification': True
        }
        
        # Scoring weights
        self.scoring_weights = {
            'financial_score': 0.40,
            'risk_score': 0.30,
            'strategic_score': 0.30
        }
    
    def load_valuation_data(self, valuation_file: str) -> Dict:
        """Load valuation and financial metrics"""
        return self._load_input_file(valuation_file, 'json')
    
    def load_risk_assessment(self, risk_file: str) -> Dict:
        """Load risk analysis and probability data"""
        return self._load_input_file(risk_file, 'json')
    
    def load_ownership_data(self, ownership_file: str) -> Dict:
        """Load ownership and operational control data"""
        return self._load_input_file(ownership_file, 'json')
    
    def _get_demo_data(self, data_type: str) -> Dict:
        """Get demo data for the-core agent"""
        demo_generator = DemoDataGenerator()
        
        if data_type == 'json':
            # Could be valuation, risk, or ownership data - return investment decision data
            return demo_generator._create_demo_investment_decision()
        else:
            return super()._get_demo_data(data_type)
    
    def evaluate_financial_criteria(self, valuation_data: Dict) -> Dict:
        """Evaluate financial hurdle rates and thresholds"""
        self.logger.info("Evaluating financial criteria")
        
        metrics = valuation_data.get('financial_metrics', {})
        
        # Extract financial metrics
        npv = metrics.get('npv_10', 0)
        irr = metrics.get('irr', 0)
        roi = metrics.get('roi', 0)
        payback = metrics.get('payback_months', 999)
        
        # Evaluate each criterion
        criteria_results = {
            'npv': {
                'value': npv,
                'threshold': self.financial_thresholds['minimum_npv'],
                'meets_threshold': npv >= self.financial_thresholds['minimum_npv'],
                'score': min(100, (npv / self.financial_thresholds['minimum_npv']) * 60) if npv > 0 else 0
            },
            'irr': {
                'value': irr,
                'threshold': self.financial_thresholds['minimum_irr'],
                'meets_threshold': irr >= self.financial_thresholds['minimum_irr'],
                'score': min(100, (irr / self.financial_thresholds['minimum_irr']) * 70) if irr > 0 else 0
            },
            'roi': {
                'value': roi,
                'threshold': self.financial_thresholds['minimum_roi'],
                'meets_threshold': roi >= self.financial_thresholds['minimum_roi'],
                'score': min(100, (roi / self.financial_thresholds['minimum_roi']) * 80) if roi > 0 else 0
            },
            'payback': {
                'value': payback,
                'threshold': self.financial_thresholds['maximum_payback'],
                'meets_threshold': payback <= self.financial_thresholds['maximum_payback'],
                'score': max(0, 100 - ((payback - 6) * 5)) if payback < 36 else 0  # Score degrades after 6 months
            }
        }
        
        # Calculate composite financial score
        component_weights = {'npv': 0.30, 'irr': 0.25, 'roi': 0.25, 'payback': 0.20}
        financial_score = sum(
            criteria_results[component]['score'] * weight 
            for component, weight in component_weights.items()
        )
        
        # Check if all thresholds are met
        all_thresholds_met = all(
            criteria_results[criterion]['meets_threshold'] 
            for criterion in criteria_results
        )
        
        return {
            'financial_score': round(financial_score),
            'criteria_results': criteria_results,
            'all_thresholds_met': all_thresholds_met,
            'component_weights': component_weights
        }
    
    def evaluate_risk_criteria(self, risk_data: Dict) -> Dict:
        """Evaluate risk levels against acceptable limits"""
        self.logger.info("Evaluating risk criteria")
        
        composite_risk = risk_data.get('composite_risk', {})
        risk_score = composite_risk.get('composite_score', 50)
        success_prob = risk_data.get('success_probability', 0.5)
        
        # Evaluate risk criteria
        criteria_results = {
            'risk_score': {
                'value': risk_score,
                'threshold': self.risk_thresholds['maximum_risk_score'],
                'meets_threshold': risk_score <= self.risk_thresholds['maximum_risk_score'],
                'score': max(0, 100 - risk_score)  # Lower risk = higher score
            },
            'success_probability': {
                'value': success_prob,
                'threshold': self.risk_thresholds['minimum_success_prob'],
                'meets_threshold': success_prob >= self.risk_thresholds['minimum_success_prob'],
                'score': min(100, (success_prob / self.risk_thresholds['minimum_success_prob']) * 80)
            }
        }
        
        # Calculate composite risk score
        risk_assessment_score = (
            criteria_results['risk_score']['score'] * 0.60 +
            criteria_results['success_probability']['score'] * 0.40
        )
        
        all_thresholds_met = all(
            criteria_results[criterion]['meets_threshold'] 
            for criterion in criteria_results
        )
        
        return {
            'risk_assessment_score': round(risk_assessment_score),
            'criteria_results': criteria_results,
            'all_thresholds_met': all_thresholds_met,
            'risk_level': composite_risk.get('risk_level', 'unknown')
        }
    
    def evaluate_operational_criteria(self, ownership_data: Dict) -> Dict:
        """Evaluate operational control and title clarity"""
        self.logger.info("Evaluating operational criteria")
        
        validation = ownership_data.get('validation', {})
        owners = ownership_data.get('owners', [])
        
        # Find operator
        operators = [owner for owner in owners if owner.get('type') == 'operator']
        
        # Title clarity assessment
        title_clarity = validation.get('total_wi', 0.8)  # Assume 80% if not specified
        title_valid = validation.get('wi_valid', False)
        
        # Operator control assessment
        has_operator = len(operators) > 0
        operator_control = False
        operator_wi = 0
        
        if has_operator:
            operator_wi = operators[0].get('wi', 0)
            operator_control = operator_wi >= 0.5  # Majority control
        
        criteria_results = {
            'title_clarity': {
                'value': title_clarity,
                'threshold': self.operational_requirements['title_clarity'],
                'meets_threshold': title_clarity >= self.operational_requirements['title_clarity'] and title_valid,
                'score': (title_clarity * 80) + (20 if title_valid else 0)
            },
            'operator_control': {
                'value': operator_wi,
                'threshold': 0.5,  # 50% for control
                'meets_threshold': operator_control and has_operator,
                'score': 100 if (operator_control and has_operator) else 30
            }
        }
        
        operational_score = (
            criteria_results['title_clarity']['score'] * 0.60 +
            criteria_results['operator_control']['score'] * 0.40
        )
        
        all_thresholds_met = all(
            criteria_results[criterion]['meets_threshold'] 
            for criterion in criteria_results
        )
        
        return {
            'operational_score': round(operational_score),
            'criteria_results': criteria_results,
            'all_thresholds_met': all_thresholds_met,
            'operator_name': operators[0].get('name', 'None') if operators else 'None'
        }
    
    def evaluate_strategic_criteria(self, valuation_data: Dict, risk_data: Dict) -> Dict:
        """Evaluate strategic fit and portfolio considerations"""
        self.logger.info("Evaluating strategic criteria")
        
        # Simplified strategic assessment
        metrics = valuation_data.get('financial_metrics', {})
        irr = metrics.get('irr', 0)
        risk_level = risk_data.get('composite_risk', {}).get('risk_level', 'medium')
        
        # Portfolio fit (based on IRR strength)
        portfolio_fit_score = min(100, (irr / 0.20) * 60) if irr > 0.15 else 30
        
        # Market timing (simplified - assume favorable if IRR > 25%)
        market_timing_score = 80 if irr > 0.25 else 60
        
        # Risk diversification (prefer medium risk over high risk)
        if risk_level in ['low', 'very_low']:
            diversification_score = 90
        elif risk_level == 'medium':
            diversification_score = 80
        elif risk_level == 'high':
            diversification_score = 40
        else:
            diversification_score = 20
        
        strategic_score = (
            portfolio_fit_score * 0.40 +
            market_timing_score * 0.30 +
            diversification_score * 0.30
        )
        
        # Strategic criteria are mostly qualitative - assume they meet standards if score > 60
        strategic_criteria_met = strategic_score > 60
        
        return {
            'strategic_score': round(strategic_score),
            'portfolio_fit_score': round(portfolio_fit_score),
            'market_timing_score': round(market_timing_score),
            'diversification_score': round(diversification_score),
            'strategic_criteria_met': strategic_criteria_met
        }
    
    def make_investment_decision(self, financial_eval: Dict, risk_eval: Dict, 
                               operational_eval: Dict, strategic_eval: Dict) -> Dict:
        """Make final go/no-go investment decision"""
        self.logger.info("Making investment decision")
        
        # Calculate weighted composite score
        composite_score = (
            financial_eval['financial_score'] * self.scoring_weights['financial_score'] +
            risk_eval['risk_assessment_score'] * self.scoring_weights['risk_score'] +
            strategic_eval['strategic_score'] * self.scoring_weights['strategic_score']
        )
        
        # Check threshold compliance
        all_financial_met = financial_eval['all_thresholds_met']
        all_risk_met = risk_eval['all_thresholds_met']
        all_operational_met = operational_eval['all_thresholds_met']
        strategic_criteria_met = strategic_eval['strategic_criteria_met']
        
        # Decision logic from YAML config
        decision = "NO_GO"
        next_agent = "reporter"
        decision_rationale = []
        
        if (all_financial_met and all_risk_met and all_operational_met):
            if strategic_criteria_met:
                decision = "PROCEED"
                next_agent = "notarybot"
                decision_rationale.append("All investment criteria met")
                decision_rationale.append("Strategic fit confirmed")
            else:
                decision = "CONDITIONAL_PROCEED"
                next_agent = "reporter"
                decision_rationale.append("Financial and risk criteria met")
                decision_rationale.append("Strategic considerations require review")
        else:
            decision_rationale.append("Investment thresholds not met:")
            if not all_financial_met:
                decision_rationale.append("- Financial criteria failed")
            if not all_risk_met:
                decision_rationale.append("- Risk criteria failed")
            if not all_operational_met:
                decision_rationale.append("- Operational criteria failed")
        
        # Determine confidence level
        if composite_score > 80:
            confidence = "HIGH"
        elif composite_score > 60:
            confidence = "MEDIUM"
        else:
            confidence = "LOW"
        
        return {
            'decision': decision,
            'composite_score': round(composite_score),
            'confidence_level': confidence,
            'next_agent': next_agent,
            'decision_rationale': decision_rationale,
            'threshold_compliance': {
                'financial': all_financial_met,
                'risk': all_risk_met,
                'operational': all_operational_met,
                'strategic': strategic_criteria_met
            },
            'scoring_breakdown': {
                'financial_score': financial_eval['financial_score'],
                'risk_score': risk_eval['risk_assessment_score'],
                'strategic_score': strategic_eval['strategic_score'],
                'weights': self.scoring_weights
            }
        }
    
    def generate_decision_matrix(self, financial_eval: Dict, risk_eval: Dict, 
                               operational_eval: Dict, strategic_eval: Dict, 
                               final_decision: Dict) -> str:
        """Generate decision matrix report"""
        self.logger.info("Generating decision matrix")
        
        matrix = f"""# Investment Decision Matrix

**Run ID:** {self.run_id}
**Decision Date:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

## Final Recommendation

**DECISION: {final_decision['decision']}**
**Confidence Level:** {final_decision['confidence_level']}
**Composite Score:** {final_decision['composite_score']}/100

## Decision Criteria Evaluation

### Financial Criteria (Weight: {self.scoring_weights['financial_score']:.1%})

| Metric | Value | Threshold | Status | Score |
|--------|-------|-----------|--------|-------|
"""
        
        for criterion, result in financial_eval['criteria_results'].items():
            value = result['value']
            threshold = result['threshold']
            status = "✅ PASS" if result['meets_threshold'] else "❌ FAIL"
            score = result['score']
            
            # Format values appropriately
            if criterion == 'npv':
                value_str = f"${value:,.0f}"
                threshold_str = f"${threshold:,.0f}"
            elif criterion in ['irr']:
                value_str = f"{value:.1%}"
                threshold_str = f"{threshold:.1%}"
            elif criterion == 'roi':
                value_str = f"{value:.1f}x"
                threshold_str = f"{threshold:.1f}x"
            else:  # payback
                value_str = f"{value} months"
                threshold_str = f"{threshold} months"
            
            matrix += f"| {criterion.upper()} | {value_str} | {threshold_str} | {status} | {score:.0f} |\n"
        
        matrix += f"""
**Financial Score:** {financial_eval['financial_score']}/100

### Risk Criteria (Weight: {self.scoring_weights['risk_score']:.1%})

| Metric | Value | Threshold | Status | Score |
|--------|-------|-----------|--------|-------|
"""
        
        for criterion, result in risk_eval['criteria_results'].items():
            value = result['value']
            threshold = result['threshold']
            status = "✅ PASS" if result['meets_threshold'] else "❌ FAIL"
            score = result['score']
            
            if criterion == 'success_probability':
                value_str = f"{value:.1%}"
                threshold_str = f"{threshold:.1%}"
            else:  # risk_score
                value_str = f"{value}/100"
                threshold_str = f"≤{threshold}"
            
            matrix += f"| {criterion.replace('_', ' ').title()} | {value_str} | {threshold_str} | {status} | {score:.0f} |\n"
        
        matrix += f"""
**Risk Assessment Score:** {risk_eval['risk_assessment_score']}/100

### Operational Criteria

| Metric | Value | Threshold | Status | Score |
|--------|-------|-----------|--------|-------|
"""
        
        for criterion, result in operational_eval['criteria_results'].items():
            value = result['value']
            threshold = result['threshold']
            status = "✅ PASS" if result['meets_threshold'] else "❌ FAIL"
            score = result['score']
            
            if criterion == 'title_clarity':
                value_str = f"{value:.1%}"
                threshold_str = f"{threshold:.1%}"
            else:  # operator_control
                value_str = f"{value:.1%} WI"
                threshold_str = f"≥{threshold:.1%}"
            
            matrix += f"| {criterion.replace('_', ' ').title()} | {value_str} | {threshold_str} | {status} | {score:.0f} |\n"
        
        matrix += f"""
**Operational Score:** {operational_eval['operational_score']}/100
**Primary Operator:** {operational_eval['operator_name']}

### Strategic Criteria (Weight: {self.scoring_weights['strategic_score']:.1%})

| Component | Score | Weight | Weighted Score |
|-----------|-------|--------|----------------|
| Portfolio Fit | {strategic_eval['portfolio_fit_score']} | 40% | {strategic_eval['portfolio_fit_score'] * 0.4:.1f} |
| Market Timing | {strategic_eval['market_timing_score']} | 30% | {strategic_eval['market_timing_score'] * 0.3:.1f} |
| Risk Diversification | {strategic_eval['diversification_score']} | 30% | {strategic_eval['diversification_score'] * 0.3:.1f} |

**Strategic Score:** {strategic_eval['strategic_score']}/100

## Composite Scoring

| Category | Score | Weight | Weighted Score |
|----------|-------|--------|----------------|
| Financial | {financial_eval['financial_score']} | {self.scoring_weights['financial_score']:.1%} | {financial_eval['financial_score'] * self.scoring_weights['financial_score']:.1f} |
| Risk | {risk_eval['risk_assessment_score']} | {self.scoring_weights['risk_score']:.1%} | {risk_eval['risk_assessment_score'] * self.scoring_weights['risk_score']:.1f} |
| Strategic | {strategic_eval['strategic_score']} | {self.scoring_weights['strategic_score']:.1%} | {strategic_eval['strategic_score'] * self.scoring_weights['strategic_score']:.1f} |

**Total Weighted Score:** {final_decision['composite_score']}/100

## Decision Rationale

"""
        
        for rationale in final_decision['decision_rationale']:
            matrix += f"- {rationale}\n"
        
        matrix += f"""
## Threshold Compliance Summary

- **Financial Criteria:** {'✅ MET' if final_decision['threshold_compliance']['financial'] else '❌ NOT MET'}
- **Risk Criteria:** {'✅ MET' if final_decision['threshold_compliance']['risk'] else '❌ NOT MET'}
- **Operational Criteria:** {'✅ MET' if final_decision['threshold_compliance']['operational'] else '❌ NOT MET'}
- **Strategic Criteria:** {'✅ MET' if final_decision['threshold_compliance']['strategic'] else '❌ NOT MET'}

## Next Steps

"""
        
        if final_decision['decision'] == "PROCEED":
            matrix += """
1. **Execute LOI Generation** - Proceed to notarybot for Letter of Intent creation
2. **Due Diligence Execution** - Complete technical and commercial due diligence
3. **Final Investment Approval** - Present to investment committee for final authorization
4. **Development Planning** - Initiate detailed development planning and execution
"""
        elif final_decision['decision'] == "CONDITIONAL_PROCEED":
            matrix += """
1. **Address Strategic Concerns** - Resolve identified strategic issues
2. **Risk Mitigation Planning** - Develop specific risk mitigation strategies
3. **Re-evaluation** - Re-assess decision after addressing concerns
4. **Stakeholder Alignment** - Ensure all stakeholders support modified approach
"""
        else:
            matrix += """
1. **Criteria Gap Analysis** - Identify specific areas for improvement
2. **Alternative Scenarios** - Evaluate modified development approaches
3. **Market Timing Review** - Consider alternative timing for investment
4. **Portfolio Rebalancing** - Assess other opportunities in portfolio
"""
        
        #matrix += \"\\n---\\n\""
        matrix += "\n---\n"
        return matrix
    
    def generate_recommendation_report(self, final_decision: Dict, valuation_data: Dict, 
                                     risk_data: Dict) -> str:
        """Generate investment recommendation report"""
        self.logger.info("Generating recommendation report")
        
        recommendation = f"""# Investment Recommendation

**Run ID:** {self.run_id}
**Date:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

## Executive Recommendation

### **{final_decision['decision']}**

**Confidence Level:** {final_decision['confidence_level']}
**Overall Score:** {final_decision['composite_score']}/100

## Investment Summary

"""
        
        metrics = valuation_data.get('financial_metrics', {})
        
        recommendation += f"""
**Financial Metrics:**
- Net Present Value: ${metrics.get('npv_10', 0):,.0f}
- Internal Rate of Return: {metrics.get('irr', 0):.1%}
- Return on Investment: {metrics.get('roi', 0):.1f}x
- Payback Period: {metrics.get('payback_months', 0)} months

**Risk Assessment:**
- Risk Level: {risk_data.get('composite_risk', {}).get('risk_level', 'Unknown').title()}
- Success Probability: {risk_data.get('success_probability', 0):.1%}

## Decision Framework Applied

The SHALE YEAH investment decision framework enforces rigorous criteria:

1. **3x ROI Minimum** - {'✅ MET' if metrics.get('roi', 0) >= 3.0 else '❌ NOT MET'} ({metrics.get('roi', 0):.1f}x actual)
2. **25% IRR Minimum** - {'✅ MET' if metrics.get('irr', 0) >= 0.25 else '❌ NOT MET'} ({metrics.get('irr', 0):.1%} actual)
3. **14-Month Payback Maximum** - {'✅ MET' if metrics.get('payback_months', 999) <= 14 else '❌ NOT MET'} ({metrics.get('payback_months', 0)} months actual)
4. **$300K NPV Minimum** - {'✅ MET' if metrics.get('npv_10', 0) >= 300000 else '❌ NOT MET'} (${metrics.get('npv_10', 0):,.0f} actual)

## Terms and Conditions

"""
        
        if final_decision['decision'] == "PROCEED":
            recommendation += """
### Approved for Investment

**Conditions for Proceeding:**
1. **Due Diligence Completion** - Complete technical, environmental, and legal due diligence
2. **Risk Mitigation Implementation** - Execute identified risk mitigation strategies
3. **Financing Confirmation** - Secure necessary financing and partnerships
4. **Regulatory Approval** - Obtain all required permits and approvals

**Investment Authorization:**
- **Maximum Capital Commitment:** ${:,.0f}
- **Development Timeline:** Phased approach per development plan
- **Performance Monitoring:** Monthly review of actual vs. forecasted metrics
- **Risk Management:** Continuous monitoring and mitigation strategy execution

**Success Criteria:**
- Achieve target IRR of 25%+ over investment life
- Maintain risk levels within acceptable parameters
- Execute development plan within budget and timeline
""".format(metrics.get('total_capex', 0))
        
        elif final_decision['decision'] == "CONDITIONAL_PROCEED":
            recommendation += """
### Conditional Approval

**Conditions to Satisfy Before Proceeding:**
1. **Strategic Alignment** - Address identified strategic concerns
2. **Risk Mitigation** - Implement additional risk reduction measures
3. **Performance Enhancement** - Improve financial metrics through optimization
4. **Stakeholder Consensus** - Achieve full stakeholder alignment

**Modified Investment Parameters:**
- **Reduced Initial Commitment** - Consider phased or reduced initial investment
- **Enhanced Monitoring** - Increased oversight and milestone-based funding
- **Performance Triggers** - Clear performance criteria for continued investment
- **Exit Strategy** - Defined exit criteria if conditions are not met

**Re-evaluation Timeline:** 30-60 days to address conditions
"""
        
        else:  # NO_GO
            recommendation += """
### Investment Not Recommended

**Primary Deficiencies:**
"""
            for rationale in final_decision['decision_rationale']:
                if 'failed' in rationale.lower():
                    recommendation += f"- {rationale}\n"
            
            recommendation += """
**Alternative Considerations:**
1. **Scenario Optimization** - Explore alternative development scenarios
2. **Partnership Opportunities** - Consider risk-sharing partnerships
3. **Market Timing** - Re-evaluate under different market conditions
4. **Portfolio Alternatives** - Focus resources on higher-quality opportunities

**Future Re-evaluation Triggers:**
- Significant improvement in commodity prices
- Technological advances reducing costs or risks
- Changes in market conditions or competitive landscape
- Availability of superior partnership terms
"""
        
        recommendation += f"""
## Implementation Timeline

**Immediate Actions (0-30 days):**
"""
        
        if final_decision['decision'] == "PROCEED":
            recommendation += """
1. Execute Letter of Intent (LOI) with counterparties
2. Initiate comprehensive due diligence process
3. Secure necessary financing and partnerships
4. Begin regulatory approval process
"""
        elif final_decision['decision'] == "CONDITIONAL_PROCEED":
            recommendation += """
1. Address identified strategic and operational concerns
2. Develop enhanced risk mitigation strategies
3. Engage stakeholders for consensus building
4. Prepare modified investment proposal
"""
        else:
            recommendation += """
1. Document decision rationale and lessons learned
2. Explore alternative scenarios and optimizations
3. Identify portfolio alternatives for resource allocation
4. Establish criteria for future re-evaluation
"""
        
        recommendation += """
**Medium-term Actions (30-90 days):**
"""
        
        if final_decision['decision'] in ["PROCEED", "CONDITIONAL_PROCEED"]:
            recommendation += """
1. Complete due diligence and finalize investment terms
2. Execute development planning and resource allocation
3. Implement risk management and monitoring systems
4. Begin development execution per approved plan
"""
        else:
            recommendation += """
1. Conduct portfolio optimization and reallocation
2. Evaluate lessons learned for future opportunities
3. Enhance screening criteria based on experience
4. Pursue alternative investment opportunities
"""
        
        recommendation += """
## Risk Management

**Monitoring Requirements:**
- Monthly financial performance review against plan
- Quarterly risk assessment and mitigation strategy update
- Semi-annual strategic alignment and market condition review
- Annual comprehensive investment performance evaluation

**Escalation Triggers:**
- Performance deviation >15% from plan
- Risk level increase beyond acceptable parameters
- Market conditions significantly adverse to assumptions
- Operational or regulatory issues impacting timeline/costs

## Conclusion

This recommendation is based on comprehensive analysis using transparent, quantitative criteria. The decision framework ensures consistent application of investment standards while considering both financial returns and risk factors.

**Investment Committee Action Required:** {'Approve LOI execution and proceed with development' if final_decision['decision'] == 'PROCEED' else 'Review conditions and approve modified approach' if final_decision['decision'] == 'CONDITIONAL_PROCEED' else 'Reject investment and pursue alternatives'}
"""
        
        return recommendation
    
    def run_analysis(self, valuation_file: str, risk_file: str, ownership_file: str) -> bool:
        """Run complete investment decision analysis"""
        self.logger.info("Starting investment decision analysis")
        
        try:
            # Step 1: Load input data
            valuation_data = self.load_valuation_data(valuation_file)
            risk_data = self.load_risk_assessment(risk_file)
            ownership_data = self.load_ownership_data(ownership_file)
            
            # Step 2: Evaluate each criteria category
            financial_eval = self.evaluate_financial_criteria(valuation_data)
            risk_eval = self.evaluate_risk_criteria(risk_data)
            operational_eval = self.evaluate_operational_criteria(ownership_data)
            strategic_eval = self.evaluate_strategic_criteria(valuation_data, risk_data)
            
            # Step 3: Make final investment decision
            final_decision = self.make_investment_decision(
                financial_eval, risk_eval, operational_eval, strategic_eval
            )
            
            # Step 4: Generate outputs using shared base class methods
            
            # Generate investment_decision.json
            investment_decision_data = {
                'run_id': self.run_id,
                'decision_date': datetime.now().isoformat(),
                'final_decision': final_decision,
                'criteria_evaluation': {
                    'financial': financial_eval,
                    'risk': risk_eval,
                    'operational': operational_eval,
                    'strategic': strategic_eval
                },
                'thresholds_applied': {
                    'financial': self.financial_thresholds,
                    'risk': self.risk_thresholds,
                    'operational': self.operational_requirements
                }
            }
            
            self._save_output_file(investment_decision_data, 'investment_decision.json', 'json')
            
            # Generate decision_matrix.md with SHALE YEAH footer
            decision_matrix = self.generate_decision_matrix(
                financial_eval, risk_eval, operational_eval, strategic_eval, final_decision
            )
            decision_matrix = self._add_shale_yeah_footer(decision_matrix)
            self._save_output_file(decision_matrix, 'decision_matrix.md', 'md')
            
            # Generate recommendation.md with SHALE YEAH footer
            recommendation = self.generate_recommendation_report(final_decision, valuation_data, risk_data)
            recommendation = self._add_shale_yeah_footer(recommendation)
            self._save_output_file(recommendation, 'recommendation.md', 'md')
            
            # Validate outputs using shared method
            required_files = list(self.expected_outputs.keys())
            if not self._validate_outputs(required_files):
                return False
            
            self.logger.info(f"Investment decision analysis completed: {final_decision['decision']}")
            return True
            
        except Exception as e:
            self.logger.error(f"Investment decision analysis failed: {e}")
            return False

def main():
    """Main entry point for The-Core agent"""
    parser = argparse.ArgumentParser(description="The-Core - Investment Decision Agent")
    parser.add_argument("--valuation", required=True, help="Valuation data file")
    parser.add_argument("--risk", required=True, help="Risk assessment file")
    parser.add_argument("--ownership", required=True, help="Ownership data file")
    parser.add_argument("--output-dir", required=True, help="Output directory")
    parser.add_argument("--run-id", required=True, help="Run identifier")
    
    args = parser.parse_args()
    
    # Create agent
    agent = TheCoreAgent(args.output_dir, args.run_id)
    
    # Run analysis
    success = agent.run_analysis(args.valuation, args.risk, args.ownership)
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()