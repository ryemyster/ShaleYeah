#!/usr/bin/env python3
"""
NotaryBot Agent - LOI generation and legal document preparation specialist

Generates Letters of Intent and preliminary legal documentation for approved investments.
Generates loi.md, term_sheet.json, and investment_summary.md.
"""

import os
import sys
import argparse
from typing import Dict, List, Optional, Tuple
from datetime import datetime, timedelta

from shared import BaseAgent, DemoDataGenerator

class NotarybotAgent(BaseAgent):
    """LOI generation and legal document preparation specialist"""
    
    def __init__(self, output_dir: str, run_id: str):
        super().__init__(output_dir, run_id, 'notarybot')
    
    def _initialize_agent(self):
        """Initialize notarybot-specific attributes"""
        # Expected outputs
        self.expected_outputs = {
            'loi.md': self.output_dir / "loi.md",
            'term_sheet.json': self.output_dir / "term_sheet.json",
            'investment_summary.md': self.output_dir / "investment_summary.md"
        }
        
        # Standard LOI terms and templates
        self.standard_terms = {
            'due_diligence_period': 45,  # days
            'exclusive_negotiation_period': 60,  # days
            'closing_deadline': 90,  # days from LOI execution
            'earnest_money_percent': 0.01,  # 1% of transaction value
            'confidentiality_period': 24,  # months
            'assignment_rights': True,
            'inspection_period': 30  # days
        }
        
        # Legal disclaimers and boilerplate
        self.legal_disclaimers = [
            "This Letter of Intent is non-binding except for confidentiality and exclusivity provisions",
            "All terms subject to satisfactory completion of due diligence",
            "Transaction subject to execution of definitive purchase and sale agreement",
            "No party shall be bound until execution of definitive agreements",
            "This LOI shall be governed by the laws of the State of Texas"
        ]
    
    def load_investment_decision(self, decision_file: str) -> Dict:
        """Load investment decision data"""
        return self._load_input_file(decision_file, 'json')
    
    def load_ownership_data(self, ownership_file: str) -> Dict:
        """Load ownership and title data"""
        return self._load_input_file(ownership_file, 'json')
    
    def load_valuation_data(self, valuation_file: str) -> Dict:
        """Load economic valuation data"""
        return self._load_input_file(valuation_file, 'json')
    
    def _get_demo_data(self, data_type: str) -> Dict:
        """Get demo data for notarybot agent"""
        demo_generator = DemoDataGenerator()
        
        if data_type == 'json':
            # For decision files, return investment decision data
            return demo_generator._create_demo_investment_decision()
        else:
            return super()._get_demo_data(data_type)
    
    def validate_loi_eligibility(self, decision_data: Dict) -> Tuple[bool, List[str]]:
        """Validate that investment decision supports LOI generation"""
        self.logger.info("Validating LOI eligibility")
        
        eligible = True
        issues = []
        
        # Check investment decision
        final_decision = decision_data.get('final_decision', {})
        decision = final_decision.get('decision', 'NO_GO')
        
        if decision != 'PROCEED':
            eligible = False
            issues.append(f"Investment decision is '{decision}', not 'PROCEED'")
        
        # Check confidence level
        confidence = final_decision.get('confidence_level', 'LOW')
        if confidence == 'LOW':
            issues.append("Low confidence level may require additional conditions")
        
        # Check composite score
        score = final_decision.get('composite_score', 0)
        if score < 60:
            eligible = False
            issues.append(f"Composite score ({score}) below LOI threshold (60)")
        
        return eligible, issues
    
    def calculate_transaction_terms(self, decision_data: Dict, ownership_data: Dict, 
                                  valuation_data: Dict) -> Dict:
        """Calculate key transaction terms and values"""
        self.logger.info("Calculating transaction terms")
        
        # Extract financial data
        metrics = valuation_data.get('financial_metrics', {})
        npv = metrics.get('npv_10', 0)
        total_capex = metrics.get('total_capex', 0)
        
        # Calculate purchase price (simplified - based on NPV and working interest)
        working_interest = sum(owner.get('wi', 0) for owner in ownership_data.get('owners', []) 
                              if owner.get('type') == 'operator')
        
        # Purchase price as percentage of NPV + development costs
        purchase_price = max(npv * 0.3, total_capex * 0.1)  # 30% of NPV or 10% of capex
        
        # Calculate earnest money
        earnest_money = purchase_price * self.standard_terms['earnest_money_percent']
        
        # Transaction structure
        transaction_terms = {
            'purchase_price': round(purchase_price, 0),
            'earnest_money': round(earnest_money, 0),
            'working_interest': working_interest,
            'net_revenue_interest': sum(owner.get('nri', 0) for owner in ownership_data.get('owners', []) 
                                       if owner.get('type') == 'operator'),
            'acreage': ownership_data.get('total_acres', 0),
            'price_per_acre': round(purchase_price / ownership_data.get('total_acres', 1), 0),
            'development_commitment': total_capex,
            'estimated_reserves': {
                'npv_basis': npv,
                'development_cost': total_capex
            }
        }
        
        return transaction_terms
    
    def generate_loi_document(self, decision_data: Dict, ownership_data: Dict, 
                            valuation_data: Dict, transaction_terms: Dict) -> str:
        """Generate formal Letter of Intent document"""
        self.logger.info("Generating Letter of Intent document")
        
        # Calculate key dates
        today = datetime.now()
        due_diligence_end = today + timedelta(days=self.standard_terms['due_diligence_period'])
        exclusive_end = today + timedelta(days=self.standard_terms['exclusive_negotiation_period'])
        closing_deadline = today + timedelta(days=self.standard_terms['closing_deadline'])
        
        # Get primary operator
        operator = next((owner for owner in ownership_data.get('owners', []) 
                        if owner.get('type') == 'operator'), ownership_data.get('owners', [{}])[0])
        
        loi_document = f"""# LETTER OF INTENT

**TO PURCHASE OIL AND GAS INTERESTS**

---

**Date:** {today.strftime('%B %d, %Y')}
**Run ID:** {self.run_id}

## PARTIES

**BUYER:** {operator.get('name', 'BUYER ENTITY')}
**SELLER:** [TO BE DETERMINED DURING DUE DILIGENCE]

## PROPERTY DESCRIPTION

**Legal Description:** {ownership_data.get('legal_description', 'See Exhibit A')}
**Total Acres:** {ownership_data.get('total_acres', 0):,.0f} acres
**County/State:** As described in legal description
**Tract ID:** {ownership_data.get('tract_id', 'TBD')}

## PROPOSED TRANSACTION TERMS

### Purchase Price and Structure
- **Total Purchase Price:** ${transaction_terms['purchase_price']:,.0f}
- **Price per Acre:** ${transaction_terms['price_per_acre']:,.0f}
- **Working Interest:** {transaction_terms['working_interest']:.1%}
- **Net Revenue Interest:** {transaction_terms['net_revenue_interest']:.1%}

### Earnest Money
- **Amount:** ${transaction_terms['earnest_money']:,.0f} ({self.standard_terms['earnest_money_percent']:.1%} of purchase price)
- **Deposit Timeline:** Within 5 business days of LOI execution
- **Escrow Agent:** To be mutually agreed upon

### Development Commitment
- **Estimated Development Investment:** ${transaction_terms['development_commitment']:,.0f}
- **Development Timeline:** As outlined in development plan
- **Minimum Development:** Subject to economic thresholds

## KEY TERMS AND CONDITIONS

### Due Diligence Period
- **Duration:** {self.standard_terms['due_diligence_period']} days from LOI execution
- **Expiration:** {due_diligence_end.strftime('%B %d, %Y')}
- **Scope:** Title, environmental, geological, engineering, and regulatory review
- **Buyer Rights:** Full access to all relevant data and documentation

### Exclusivity Period
- **Duration:** {self.standard_terms['exclusive_negotiation_period']} days from LOI execution
- **Expiration:** {exclusive_end.strftime('%B %d, %Y')}
- **Restrictions:** Seller agrees not to negotiate with other parties
- **Scope:** Covers all oil and gas interests within defined area

### Closing Conditions
- **Target Closing Date:** {closing_deadline.strftime('%B %d, %Y')}
- **Maximum Closing Date:** {closing_deadline.strftime('%B %d, %Y')}
- **Conditions Precedent:**
  - Satisfactory completion of due diligence
  - Execution of definitive purchase and sale agreement
  - Title clearance and insurance availability
  - Regulatory approvals as required
  - Board/partner approvals as applicable

### Property Condition and Warranties
- **Title Requirements:** Marketable title with standard title insurance
- **Environmental Condition:** No material environmental liabilities
- **Regulatory Status:** All permits and approvals current and transferable
- **Operational Status:** No material operational defects or deficiencies

## INVESTMENT DECISION BASIS

**Investment Committee Approval:** Based on comprehensive analysis including:
- **Economic Analysis:** NPV of ${valuation_data.get('financial_metrics', {}).get('npv_10', 0):,.0f} at 10% discount rate
- **Risk Assessment:** {decision_data.get('final_decision', {}).get('confidence_level', 'MEDIUM')} confidence level
- **Strategic Fit:** Approved per investment criteria
- **Composite Score:** {decision_data.get('final_decision', {}).get('composite_score', 0)}/100

## DEFINITIVE AGREEMENT TERMS

The parties agree to negotiate in good faith toward a definitive purchase and sale agreement containing customary terms including:

### Representations and Warranties
- Title ownership and absence of liens
- Environmental compliance and condition
- Regulatory compliance and permit status
- Financial and operational condition
- No material adverse changes

### Closing Adjustments
- Proration of revenues and expenses as of closing
- Assumption of plugging and abandonment obligations
- Working capital adjustments
- Customary purchase price adjustments

### Post-Closing Operations
- Operator designation and responsibilities
- Joint venture terms if applicable
- Development obligations and timelines
- Reporting and approval procedures

## CONTINGENCIES AND CONDITIONS

### Inspection and Access
- **Inspection Period:** {self.standard_terms['inspection_period']} days for physical inspection
- **Access Rights:** Reasonable access to properties and records
- **Expert Engagement:** Right to engage third-party experts
- **Cost Responsibility:** Buyer responsible for inspection costs

### Financing Contingency
- **Development Financing:** Subject to Buyer securing development capital
- **Acquisition Financing:** Buyer to arrange acquisition financing if required
- **Timeline:** Financing commitments required before closing

### Regulatory Approvals
- **Transfer Approvals:** All required regulatory transfer approvals
- **Operating Permits:** Transfer of all operating permits and licenses
- **Environmental Clearances:** Required environmental approvals

## CONFIDENTIALITY AND NON-DISCLOSURE

Both parties agree to maintain strict confidentiality regarding:
- Terms and conditions of this LOI
- Proprietary technical and financial information
- Geological and engineering data
- Strategic business information

**Confidentiality Period:** {self.standard_terms['confidentiality_period']} months from LOI date

## ASSIGNMENT RIGHTS

{'Buyer shall have the right to assign this LOI and related obligations to affiliates or qualified third parties with Seller consent' if self.standard_terms['assignment_rights'] else 'No assignment rights without prior written consent'}

## GOVERNING LAW AND JURISDICTION

This Letter of Intent shall be governed by and construed in accordance with the laws of the State of Texas. Any disputes shall be resolved in the appropriate courts of Texas.

## BINDING PROVISIONS

**Non-Binding Nature:** Except as specifically provided below, this LOI is non-binding and creates no legal obligations.

**Binding Provisions:**
- Confidentiality and non-disclosure obligations
- Exclusive negotiation period restrictions
- Good faith negotiation requirements
- Expense responsibility provisions

## TERMINATION

This LOI may be terminated:
- By mutual agreement of the parties
- By either party if definitive agreement not executed by deadline
- By Buyer if due diligence conditions not satisfied
- Upon material breach by either party

## LEGAL DISCLAIMERS

"""
        
        for disclaimer in self.legal_disclaimers:
            loi_document += f"- {disclaimer}\n"
        
        loi_document += f"""
## EXECUTION

This Letter of Intent may be executed in counterparts and transmitted electronically.

**BUYER SIGNATURE:**

_________________________________
{operator.get('name', 'BUYER ENTITY')}

By: _____________________________
Name: [TO BE COMPLETED]
Title: [TO BE COMPLETED]
Date: ___________________________

**SELLER SIGNATURE:**

_________________________________
[SELLER ENTITY NAME]

By: _____________________________
Name: [TO BE COMPLETED]  
Title: [TO BE COMPLETED]
Date: ___________________________

---

**EXHIBIT A:** Legal Property Description
[Detailed legal description to be attached]

**EXHIBIT B:** Development Plan Summary
[Development plan and timeline to be attached]

**EXHIBIT C:** Economic Analysis Summary
[Financial projections and analysis to be attached]

---

Generated with SHALE YEAH (c) Ryan McDonald / Ascendvent LLC - Apache-2.0

**NOTICE:** This document is generated by automated analysis software. Legal review by qualified counsel is required before execution. All terms subject to modification during negotiation of definitive agreements.
"""
        
        return loi_document
    
    def generate_term_sheet(self, decision_data: Dict, ownership_data: Dict, 
                          valuation_data: Dict, transaction_terms: Dict) -> Dict:
        """Generate structured term sheet in JSON format"""
        self.logger.info("Generating term sheet")
        
        today = datetime.now()
        
        term_sheet = {
            'run_id': self.run_id,
            'generation_date': today.isoformat(),
            'transaction_summary': {
                'transaction_type': 'Oil and Gas Interest Acquisition',
                'structure': 'Asset Purchase',
                'status': 'Letter of Intent Stage'
            },
            'property_details': {
                'tract_id': ownership_data.get('tract_id', ''),
                'legal_description': ownership_data.get('legal_description', ''),
                'total_acres': ownership_data.get('total_acres', 0),
                'state': 'Texas',  # Extracted from legal description
                'county': 'Permian County'  # Extracted from legal description
            },
            'financial_terms': {
                'purchase_price': transaction_terms['purchase_price'],
                'price_per_acre': transaction_terms['price_per_acre'],
                'earnest_money': transaction_terms['earnest_money'],
                'earnest_money_percent': self.standard_terms['earnest_money_percent'],
                'development_commitment': transaction_terms['development_commitment']
            },
            'interest_structure': {
                'working_interest': transaction_terms['working_interest'],
                'net_revenue_interest': transaction_terms['net_revenue_interest'],
                'royalty_burden': 1 - transaction_terms['net_revenue_interest'],
                'operator_status': True
            },
            'timeline': {
                'loi_execution': today.strftime('%Y-%m-%d'),
                'due_diligence_period_days': self.standard_terms['due_diligence_period'],
                'due_diligence_expiration': (today + timedelta(days=self.standard_terms['due_diligence_period'])).strftime('%Y-%m-%d'),
                'exclusivity_period_days': self.standard_terms['exclusive_negotiation_period'],
                'exclusivity_expiration': (today + timedelta(days=self.standard_terms['exclusive_negotiation_period'])).strftime('%Y-%m-%d'),
                'target_closing': (today + timedelta(days=self.standard_terms['closing_deadline'])).strftime('%Y-%m-%d')
            },
            'conditions_precedent': [
                'Satisfactory completion of due diligence',
                'Execution of definitive purchase and sale agreement',
                'Title insurance availability',
                'Regulatory transfer approvals',
                'No material adverse changes'
            ],
            'due_diligence_scope': [
                'Title examination and clearance',
                'Environmental assessment',
                'Geological and engineering review',
                'Regulatory compliance verification',
                'Financial and operational audit'
            ],
            'development_plan': {
                'estimated_wells': len([owner for owner in ownership_data.get('owners', [])]),  # Simplified
                'development_timeline_months': 24,
                'total_capex': transaction_terms['development_commitment'],
                'first_production_target': (today + timedelta(days=365)).strftime('%Y-%m-%d')
            },
            'investment_basis': {
                'npv_10_percent': valuation_data.get('financial_metrics', {}).get('npv_10', 0),
                'decision_score': decision_data.get('final_decision', {}).get('composite_score', 0),
                'confidence_level': decision_data.get('final_decision', {}).get('confidence_level', 'MEDIUM'),
                'investment_decision': decision_data.get('final_decision', {}).get('decision', 'UNKNOWN')
            },
            'legal_structure': {
                'governing_law': 'Texas',
                'assignment_rights': self.standard_terms['assignment_rights'],
                'confidentiality_period_months': self.standard_terms['confidentiality_period'],
                'binding_provisions': [
                    'Confidentiality',
                    'Exclusivity',
                    'Good faith negotiation',
                    'Expense responsibility'
                ]
            },
            'risk_factors': [
                'Geological and reservoir performance risk',
                'Commodity price volatility',
                'Regulatory and environmental compliance',
                'Development execution risk',
                'Title and ownership verification'
            ]
        }
        
        return term_sheet
    
    def generate_investment_summary(self, decision_data: Dict, ownership_data: Dict, 
                                  valuation_data: Dict, transaction_terms: Dict) -> str:
        """Generate executive investment summary"""
        self.logger.info("Generating investment summary")
        
        summary = f"""# Investment Summary and LOI Execution

**Run ID:** {self.run_id}
**Date:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

## Executive Summary

Following comprehensive analysis and investment committee approval, this summary outlines the recommended acquisition of oil and gas interests and the execution of a Letter of Intent to proceed with the transaction.

**Investment Decision:** {decision_data.get('final_decision', {}).get('decision', 'UNKNOWN')}
**Confidence Level:** {decision_data.get('final_decision', {}).get('confidence_level', 'UNKNOWN')}
**Composite Score:** {decision_data.get('final_decision', {}).get('composite_score', 0)}/100

## Property Overview

**Location:** {ownership_data.get('legal_description', 'See legal description')}
**Total Acreage:** {ownership_data.get('total_acres', 0):,.0f} acres
**Tract ID:** {ownership_data.get('tract_id', 'TBD')}

## Transaction Structure

**Purchase Price:** ${transaction_terms['purchase_price']:,.0f}
**Price per Acre:** ${transaction_terms['price_per_acre']:,.0f}
**Working Interest:** {transaction_terms['working_interest']:.1%}
**Net Revenue Interest:** {transaction_terms['net_revenue_interest']:.1%}
**Earnest Money:** ${transaction_terms['earnest_money']:,.0f}

## Investment Metrics

**NPV (10%):** ${valuation_data.get('financial_metrics', {}).get('npv_10', 0):,.0f}
**Development Capital:** ${transaction_terms['development_commitment']:,.0f}
**Total Investment:** ${transaction_terms['purchase_price'] + transaction_terms['development_commitment']:,.0f}

## Key Transaction Terms

### Due Diligence
- **Period:** {self.standard_terms['due_diligence_period']} days
- **Scope:** Comprehensive title, environmental, geological, and regulatory review
- **Outcome:** Proceed/no-proceed decision based on findings

### Exclusivity
- **Period:** {self.standard_terms['exclusive_negotiation_period']} days
- **Scope:** Exclusive negotiation rights for definitive agreement
- **Purpose:** Protect investment in due diligence process

### Closing
- **Timeline:** {self.standard_terms['closing_deadline']} days maximum
- **Conditions:** Standard oil and gas acquisition conditions
- **Structure:** Asset purchase with operator assumption

## Next Steps

### Immediate Actions (Days 1-7)
1. **Execute LOI** - Obtain signatures from authorized representatives
2. **Deposit Earnest Money** - Transfer funds to agreed escrow agent
3. **Initiate Due Diligence** - Engage title, environmental, and technical experts
4. **Data Room Setup** - Request access to seller's data room

### Due Diligence Phase (Days 8-45)
1. **Title Examination** - Comprehensive title and ownership verification
2. **Environmental Assessment** - Phase I environmental site assessment
3. **Technical Review** - Geological and engineering analysis validation
4. **Regulatory Review** - Permit and compliance verification
5. **Financial Audit** - Revenue and expense verification

### Negotiation Phase (Days 30-60)
1. **PSA Drafting** - Prepare definitive purchase and sale agreement
2. **Term Negotiation** - Finalize all commercial and legal terms
3. **Approval Process** - Obtain all required internal approvals
4. **Closing Preparation** - Coordinate closing logistics and documentation

## Risk Management

### Identified Risks
- **Title Risk:** Potential title defects or ownership disputes
- **Environmental Risk:** Unknown environmental liabilities
- **Regulatory Risk:** Transfer approval delays or denials
- **Market Risk:** Commodity price volatility during process
- **Operational Risk:** Development execution challenges

### Mitigation Strategies
- **Comprehensive Due Diligence:** Thorough investigation of all risk factors
- **Title Insurance:** Obtain comprehensive title insurance coverage
- **Environmental Insurance:** Consider environmental liability coverage
- **Contractual Protections:** Include appropriate representations and warranties
- **Contingency Planning:** Develop backup plans for identified risks

## Authorization and Approval

This investment recommendation is based on:
- **Technical Analysis:** Geological and engineering evaluation
- **Economic Analysis:** NPV and financial modeling
- **Risk Assessment:** Comprehensive risk evaluation
- **Strategic Alignment:** Fit with portfolio objectives

**Investment Committee Status:** APPROVED
**Board Authorization:** PENDING LOI EXECUTION
**Management Recommendation:** PROCEED

## Execution Authority

**Authorized Signatories:** [TO BE COMPLETED]
**Execution Deadline:** {(datetime.now() + timedelta(days=14)).strftime('%Y-%m-%d')}
**Required Approvals:** Investment Committee (Complete), Board (Pending)

## Contact Information

**Transaction Manager:** [TO BE ASSIGNED]
**Legal Counsel:** [TO BE ASSIGNED]
**Due Diligence Coordinator:** [TO BE ASSIGNED]

## Confidentiality Notice

This document contains confidential and proprietary information. Distribution is restricted to authorized personnel only. All recipients are bound by confidentiality obligations.

---

Generated with SHALE YEAH (c) Ryan McDonald / Ascendvent LLC - Apache-2.0

**IMPORTANT:** This summary is based on automated analysis. All terms and conditions are subject to final negotiation and execution of definitive agreements. Legal and technical review by qualified professionals is required before proceeding.
"""
        
        return summary
    
    def run_analysis(self, decision_file: str, ownership_file: str, valuation_file: str) -> bool:
        """Run complete LOI generation analysis"""
        self.logger.info("Starting LOI generation")
        
        try:
            # Step 1: Load input data
            decision_data = self.load_investment_decision(decision_file)
            ownership_data = self.load_ownership_data(ownership_file)
            valuation_data = self.load_valuation_data(valuation_file)
            
            # Step 2: Validate LOI eligibility
            eligible, issues = self.validate_loi_eligibility(decision_data)
            
            if not eligible:
                self.logger.error(f"LOI generation not eligible: {'; '.join(issues)}")
                return False
            
            if issues:
                self.logger.warning(f"LOI generation issues: {'; '.join(issues)}")
            
            # Step 3: Calculate transaction terms
            transaction_terms = self.calculate_transaction_terms(decision_data, ownership_data, valuation_data)
            
            # Step 4: Generate outputs using shared base class methods
            
            # Generate loi.md with SHALE YEAH footer
            loi_document = self.generate_loi_document(decision_data, ownership_data, valuation_data, transaction_terms)
            loi_document = self._add_shale_yeah_footer(loi_document)
            self._save_output_file(loi_document, 'loi.md', 'md')
            
            # Generate term_sheet.json
            term_sheet = self.generate_term_sheet(decision_data, ownership_data, valuation_data, transaction_terms)
            self._save_output_file(term_sheet, 'term_sheet.json', 'json')
            
            # Generate investment_summary.md with SHALE YEAH footer
            investment_summary = self.generate_investment_summary(decision_data, ownership_data, valuation_data, transaction_terms)
            investment_summary = self._add_shale_yeah_footer(investment_summary)
            self._save_output_file(investment_summary, 'investment_summary.md', 'md')
            
            # Validate outputs using shared method
            required_files = list(self.expected_outputs.keys())
            if not self._validate_outputs(required_files):
                return False
            
            self.logger.info("LOI generation completed successfully")
            return True
            
        except Exception as e:
            self.logger.error(f"LOI generation failed: {e}")
            return False

def main():
    """Main entry point for NotaryBot agent"""
    parser = argparse.ArgumentParser(description="NotaryBot - LOI Generation Agent")
    parser.add_argument("--decision", required=True, help="Investment decision file")
    parser.add_argument("--ownership", required=True, help="Ownership data file")
    parser.add_argument("--valuation", required=True, help="Valuation data file")
    parser.add_argument("--output-dir", required=True, help="Output directory")
    parser.add_argument("--run-id", required=True, help="Run identifier")
    
    args = parser.parse_args()
    
    # Create agent
    agent = NotarybotAgent(args.output_dir, args.run_id)
    
    # Run analysis
    success = agent.run_analysis(args.decision, args.ownership, args.valuation)
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()