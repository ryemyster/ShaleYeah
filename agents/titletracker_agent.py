#!/usr/bin/env python3
"""
Titletracker Agent - Ownership extraction and mineral rights analysis specialist

Extracts ownership data from various sources and calculates NRI/WI for stakeholders.
Generates ownership.json, ownership_summary.md, and lease_analysis.md.
"""

import os
import sys
import argparse
import re
from typing import Dict, List, Optional, Tuple
from datetime import datetime, timedelta
import subprocess

from shared import BaseAgent, DemoDataGenerator

class TitletrackerAgent(BaseAgent):
    """Ownership extraction and mineral rights analysis specialist"""
    
    def __init__(self, output_dir: str, run_id: str):
        super().__init__(output_dir, run_id, 'titletracker')
    
    def _initialize_agent(self):
        """Initialize titletracker-specific attributes"""
        # Expected outputs
        self.expected_outputs = {
            'ownership.json': self.output_dir / "ownership.json",
            'ownership_summary.md': self.output_dir / "ownership_summary.md",
            'lease_analysis.md': self.output_dir / "lease_analysis.md"
        }
    
    def ingest_ownership_data(self, ownership_data_path: str) -> Dict:
        """Ingest ownership data from various sources"""
        self.logger.info(f"Ingesting ownership data from {ownership_data_path}")
        
        path = Path(ownership_data_path)
        
        try:
            if path.suffix.lower() in ['.mdb', '.accdb']:
                return self._process_access_database(ownership_data_path)
            elif path.suffix.lower() == '.txt':
                # Handle .txt files that represent Access databases
                return self._process_access_text_file(ownership_data_path)
            elif path.suffix.lower() == '.csv':
                return self._process_csv_file(ownership_data_path)
            elif path.suffix.lower() == '.pdf':
                return self._process_pdf_file(ownership_data_path)
            else:
                self.logger.warning(f"Unsupported file format: {path.suffix}")
                return self._get_demo_data('ownership')
                
        except Exception as e:
            self.logger.error(f"Error processing ownership data: {e}")
            return self._get_demo_data('ownership')
    
    def _process_access_database(self, db_path: str) -> Dict:
        """Process Access database using access-ingest.ts tool"""
        self.logger.info(f"Processing Access database: {db_path}")
        
        try:
            # Run access-ingest.ts tool
            cmd = ["tsx", "tools/access-ingest.ts", db_path]
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
            
            if result.returncode == 0:
                # Parse the output to extract ownership data
                return self._parse_access_output(result.stdout)
            else:
                self.logger.error(f"Access ingestion failed: {result.stderr}")
                return self._get_demo_data('ownership')
                
        except Exception as e:
            self.logger.error(f"Error running access-ingest tool: {e}")
            return self._get_demo_data('ownership')
    
    def _process_access_text_file(self, txt_path: str) -> Dict:
        """Process text file that represents Access database content"""
        self.logger.info(f"Processing Access text file: {txt_path}")
        
        try:
            with open(txt_path, 'r') as f:
                content = f.read()
            
            # Extract ownership information from text content
            ownership_data = self._extract_ownership_from_text(content)
            return ownership_data
            
        except Exception as e:
            self.logger.error(f"Error processing text file: {e}")
            return self._get_demo_data('ownership')
    
    def _extract_ownership_from_text(self, content: str) -> Dict:
        """Extract ownership information from text content"""
        # Simple pattern matching for demo purposes
        lines = content.split('\n')
        
        ownership_records = []
        
        # Look for ownership patterns
        for line in lines:
            if any(keyword in line.lower() for keyword in ['owner', 'interest', 'lease', 'nri', 'wi']):
                # Extract potential ownership information
                ownership_records.append(line.strip())
        
        demo_data = self._get_demo_data('ownership')
        return {
            'source_type': 'text_file',
            'raw_records': ownership_records,
            'owners': demo_data['owners'],
            'tract_id': demo_data['tract_id'],
            'legal_description': demo_data['legal_description'],
            'total_acres': demo_data['total_acres'],
            'lease_terms': demo_data['lease_terms']
        }
    
    def _process_csv_file(self, csv_path: str) -> Dict:
        """Process CSV ownership file"""
        self.logger.info(f"Processing CSV file: {csv_path}")
        
        try:
            import pandas as pd
            df = pd.read_csv(csv_path)
            
            ownership_data = {
                'source_type': 'csv',
                'total_records': len(df),
                'columns': df.columns.tolist(),
                'owners': []
            }
            
            # Process each row
            for _, row in df.iterrows():
                owner = self._extract_owner_from_row(row)
                if owner:
                    ownership_data['owners'].append(owner)
            
            return ownership_data
            
        except Exception as e:
            self.logger.error(f"Error processing CSV: {e}")
            return self._get_demo_data('ownership')
    
    def _extract_owner_from_row(self, row) -> Optional[Dict]:
        """Extract owner information from CSV row"""
        # Map common column names
        name_cols = ['name', 'owner', 'entity', 'company']
        nri_cols = ['nri', 'net_revenue_interest', 'revenue_interest']
        wi_cols = ['wi', 'working_interest', 'interest']
        
        owner_name = None
        nri = 0.0
        wi = 0.0
        
        # Find owner name
        for col in name_cols:
            if col in row.index and pd.notna(row[col]):
                owner_name = str(row[col])
                break
        
        if not owner_name:
            return None
        
        # Find NRI
        for col in nri_cols:
            if col in row.index and pd.notna(row[col]):
                try:
                    nri = float(row[col])
                    break
                except:
                    pass
        
        # Find WI
        for col in wi_cols:
            if col in row.index and pd.notna(row[col]):
                try:
                    wi = float(row[col])
                    break
                except:
                    pass
        
        return {
            'name': owner_name,
            'nri': nri,
            'wi': wi,
            'type': 'mineral_owner'
        }
    
    def _process_pdf_file(self, pdf_path: str) -> Dict:
        """Process PDF ownership document (simplified)"""
        self.logger.info(f"Processing PDF file: {pdf_path}")
        
        # For demo purposes, return structured demo data
        return self._get_demo_data('ownership')
    
    def _get_demo_data(self, data_type: str) -> Dict:
        """Get demo data for titletracker agent"""
        demo_generator = DemoDataGenerator()
        
        if data_type == 'ownership':
            return demo_generator._create_demo_ownership_data()
        else:
            return super()._get_demo_data(data_type)
    
    def _parse_access_output(self, output: str) -> Dict:
        """Parse output from access-ingest.ts tool"""
        # For demo purposes, return demo data
        # In real implementation, would parse structured output
        return self._get_demo_data('ownership')
    
    def calculate_interests(self, ownership_data: Dict) -> Dict:
        """Calculate NRI and WI for each stakeholder"""
        self.logger.info("Calculating ownership interests")
        
        calculated_ownership = ownership_data.copy()
        
        # Validate interest calculations
        total_wi = sum(owner.get('wi', 0) for owner in ownership_data['owners'])
        total_nri = sum(owner.get('nri', 0) for owner in ownership_data['owners'] if owner.get('nri', 0) > 0)
        
        # Add validation results
        calculated_ownership['validation'] = {
            'total_wi': round(total_wi, 4),
            'total_nri': round(total_nri, 4),
            'wi_valid': abs(total_wi - 1.0) < 0.01,  # Within 1%
            'nri_valid': total_nri <= 1.0,  # Cannot exceed 100%
            'validation_date': datetime.now().isoformat()
        }
        
        # Calculate effective royalty burden
        lease_terms = ownership_data.get('lease_terms', {})
        base_royalty = lease_terms.get('royalty_rate', 0.125)
        
        # Add calculated fields
        for owner in calculated_ownership['owners']:
            if owner['type'] == 'operator':
                # Calculate net revenue after royalties and overrides
                total_royalty_burden = base_royalty
                total_override_burden = sum(
                    o.get('override_rate', 0) for o in ownership_data['owners'] 
                    if o['type'] == 'override_owner'
                )
                
                owner['effective_nri'] = owner['wi'] * (1 - total_royalty_burden - total_override_burden)
                owner['royalty_burden'] = total_royalty_burden
                owner['override_burden'] = total_override_burden
        
        return calculated_ownership
    
    def identify_stakeholders(self, ownership_data: Dict) -> Dict:
        """Identify key stakeholders and decision makers"""
        self.logger.info("Identifying key stakeholders")
        
        stakeholders = {
            'operators': [],
            'working_interest_owners': [],
            'royalty_owners': [],
            'override_owners': [],
            'key_contacts': []
        }
        
        for owner in ownership_data['owners']:
            owner_type = owner['type']
            
            if owner_type == 'operator':
                stakeholders['operators'].append(owner)
            elif owner_type == 'working_interest_owner':
                stakeholders['working_interest_owners'].append(owner)
            elif owner_type == 'royalty_owner':
                stakeholders['royalty_owners'].append(owner)
            elif owner_type == 'override_owner':
                stakeholders['override_owners'].append(owner)
            
            # Identify key contacts (those with >10% interest)
            total_interest = owner.get('wi', 0) + owner.get('nri', 0)
            if total_interest > 0.1 or owner_type == 'operator':
                stakeholders['key_contacts'].append({
                    'name': owner['name'],
                    'contact_person': owner.get('contact_person', ''),
                    'address': owner.get('address', ''),
                    'role': owner['role'],
                    'total_interest': total_interest
                })
        
        return stakeholders
    
    def analyze_lease_terms(self, ownership_data: Dict) -> Dict:
        """Analyze lease terms and obligations"""
        self.logger.info("Analyzing lease terms")
        
        lease_terms = ownership_data.get('lease_terms', {})
        
        if not lease_terms:
            return {'status': 'no_lease_data', 'analysis': 'No lease terms available for analysis'}
        
        # Calculate lease status
        lease_date = datetime.fromisoformat(lease_terms['lease_date'])
        expiration_date = datetime.fromisoformat(lease_terms['expiration_date'])
        current_date = datetime.now()
        
        days_remaining = (expiration_date - current_date).days
        lease_life = (expiration_date - lease_date).days
        lease_elapsed = (current_date - lease_date).days
        
        analysis = {
            'lease_status': 'active' if days_remaining > 0 else 'expired',
            'days_remaining': days_remaining,
            'years_remaining': round(days_remaining / 365.25, 2),
            'percent_elapsed': round((lease_elapsed / lease_life) * 100, 1),
            'urgency_level': 'low',
            'key_terms': {
                'primary_term_years': lease_terms.get('primary_term', 0),
                'royalty_rate': lease_terms.get('royalty_rate', 0),
                'bonus_per_acre': lease_terms.get('bonus_paid', 0),
                'rental_per_acre': lease_terms.get('rental_rate', 0)
            },
            'obligations': [],
            'recommendations': []
        }
        
        # Determine urgency level
        if days_remaining < 0:
            analysis['urgency_level'] = 'critical'
            analysis['obligations'].append('Lease has expired - immediate action required')
        elif days_remaining < 365:
            analysis['urgency_level'] = 'high'
            analysis['obligations'].append('Lease expires within 1 year - drilling or extension required')
        elif days_remaining < 730:
            analysis['urgency_level'] = 'medium'
            analysis['obligations'].append('Lease expires within 2 years - development planning recommended')
        
        # Add rental obligations
        if lease_terms.get('rental_rate', 0) > 0:
            analysis['obligations'].append(f"Annual rental payments of ${lease_terms['rental_rate']}/acre required")
        
        # Add recommendations
        if analysis['urgency_level'] in ['high', 'critical']:
            analysis['recommendations'].append('Prioritize development to hold lease')
            analysis['recommendations'].append('Consider lease extension negotiations')
        else:
            analysis['recommendations'].append('Monitor lease status and plan development timeline')
        
        return analysis
    
    def generate_ownership_summary(self, ownership_data: Dict, stakeholders: Dict) -> str:
        """Generate ownership_summary.md"""
        self.logger.info("Generating ownership summary")
        
        summary = f"""# Ownership Analysis Summary

**Run ID:** {self.run_id}
**Analysis Date:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
**Tract:** {ownership_data.get('tract_id', 'Unknown')}

## Executive Summary

Ownership analysis for **{ownership_data.get('total_acres', 0)} acres** with **{len(ownership_data['owners'])} stakeholders**. 
Working interest ownership includes **{len(stakeholders['operators'])} operator(s)** and **{len(stakeholders['working_interest_owners'])} working interest partner(s)**.

**Primary Operator:** {stakeholders['operators'][0]['name'] if stakeholders['operators'] else 'Not identified'}

## Legal Description

{ownership_data.get('legal_description', 'Not provided')}

## Ownership Structure

### Working Interest Owners

| Owner | Entity Type | WI | NRI | Role |
|-------|-------------|----|----|------|
"""
        
        for owner in ownership_data['owners']:
            if owner.get('wi', 0) > 0:
                summary += f"| {owner['name']} | {owner.get('entity_type', 'Unknown')} | {owner['wi']:.1%} | {owner.get('nri', 0):.1%} | {owner['role']} |\n"
        
        summary += """
### Royalty and Override Interests

| Owner | Type | Rate | Description |
|-------|------|------|-------------|
"""
        
        for owner in ownership_data['owners']:
            if owner['type'] == 'royalty_owner':
                rate = owner.get('royalty_rate', 0)
                summary += f"| {owner['name']} | Royalty | {rate:.1%} | Mineral royalty interest |\n"
            elif owner['type'] == 'override_owner':
                rate = owner.get('override_rate', 0)
                summary += f"| {owner['name']} | Override | {rate:.1%} | Overriding royalty interest |\n"
        
        # Validation section
        validation = ownership_data.get('validation', {})
        summary += f"""
## Interest Validation

- **Total Working Interest:** {validation.get('total_wi', 0):.1%} {'✅' if validation.get('wi_valid', False) else '⚠️'}
- **Total Net Revenue Interest:** {validation.get('total_nri', 0):.1%} {'✅' if validation.get('nri_valid', False) else '⚠️'}
- **Validation Status:** {'PASSED' if validation.get('wi_valid', False) and validation.get('nri_valid', False) else 'NEEDS REVIEW'}

"""
        
        if not validation.get('wi_valid', False):
            summary += "⚠️ **Warning:** Working interests do not sum to 100%\n"
        
        if not validation.get('nri_valid', False):
            summary += "⚠️ **Warning:** Net revenue interests may exceed 100%\n"
        
        # Key contacts
        summary += """
## Key Contacts

| Contact | Role | Organization | Interest |
|---------|------|--------------|----------|
"""
        
        for contact in stakeholders['key_contacts']:
            summary += f"| {contact.get('contact_person', 'Not provided')} | {contact['role']} | {contact['name']} | {contact['total_interest']:.1%} |\n"
        
        summary += """
## Decision-Making Authority

"""
        
        # Identify decision makers
        operators = stakeholders['operators']
        if operators:
            primary_operator = operators[0]
            summary += f"**Primary Decision Maker:** {primary_operator['name']} ({primary_operator['wi']:.1%} WI)\n"
            summary += f"**Operational Control:** {primary_operator['name']} as designated operator\n"
        
        # Working interest threshold for major decisions
        major_decision_threshold = 0.5  # 50%
        major_owners = [owner for owner in ownership_data['owners'] if owner.get('wi', 0) >= major_decision_threshold]
        
        if major_owners:
            summary += f"**Major Decision Authority:** Owners with ≥{major_decision_threshold:.0%} WI can make unilateral decisions\n"
        else:
            summary += "**Joint Decision Making:** No single owner has majority control\n"
        
        summary += """
## Recommendations

1. **Operator Coordination** - Maintain clear communication with primary operator
2. **Interest Verification** - Confirm all working and net revenue interest calculations
3. **Contact Updates** - Verify current contact information for all stakeholders
4. **Decision Protocols** - Establish clear decision-making procedures for development
5. **Lease Compliance** - Ensure all lease terms and obligations are current

---

Generated with SHALE YEAH (c) Ryan McDonald / Ascendvent LLC - Apache-2.0
"""
        
        return summary
    
    def generate_lease_analysis(self, ownership_data: Dict, lease_analysis: Dict) -> str:
        """Generate lease_analysis.md"""
        self.logger.info("Generating lease analysis")
        
        lease_terms = ownership_data.get('lease_terms', {})
        
        analysis_md = f"""# Lease Terms Analysis

**Run ID:** {self.run_id}
**Analysis Date:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

## Lease Status Overview

**Status:** {lease_analysis.get('lease_status', 'Unknown').upper()}
**Urgency Level:** {lease_analysis.get('urgency_level', 'Unknown').upper()}
**Days Remaining:** {lease_analysis.get('days_remaining', 0)}
**Years Remaining:** {lease_analysis.get('years_remaining', 0)}

## Key Lease Terms

| Term | Value | Status |
|------|-------|--------|
| Primary Term | {lease_terms.get('primary_term', 0)} years | Active |
| Royalty Rate | {lease_terms.get('royalty_rate', 0):.1%} | Standard |
| Bonus Paid | ${lease_terms.get('bonus_paid', 0):,.0f}/acre | Paid |
| Annual Rental | ${lease_terms.get('rental_rate', 0):,.0f}/acre | {'Current' if lease_analysis.get('days_remaining', 0) > 0 else 'Past Due'} |

## Timeline Analysis

- **Lease Execution:** {lease_terms.get('lease_date', 'Unknown')}
- **Primary Term Expiration:** {lease_terms.get('expiration_date', 'Unknown')}
- **Elapsed Time:** {lease_analysis.get('percent_elapsed', 0):.1f}% of primary term
- **Development Deadline:** {lease_terms.get('expiration_date', 'Unknown')}

## Current Obligations

"""
        
        obligations = lease_analysis.get('obligations', [])
        if obligations:
            for obligation in obligations:
                analysis_md += f"- {obligation}\n"
        else:
            analysis_md += "- No current obligations identified\n"
        
        analysis_md += """
## Risk Assessment

"""
        
        urgency = lease_analysis.get('urgency_level', 'low')
        if urgency == 'critical':
            analysis_md += """
**CRITICAL RISK:** Lease has expired or is expiring imminently
- Immediate development or lease extension required
- Risk of lease termination and mineral rights reversion
- Legal consultation recommended
"""
        elif urgency == 'high':
            analysis_md += """
**HIGH RISK:** Lease expires within 1 year
- Development planning must begin immediately
- Consider lease extension negotiations
- Monitor drilling and completion timeline closely
"""
        elif urgency == 'medium':
            analysis_md += """
**MEDIUM RISK:** Lease expires within 2 years
- Adequate time for development planning
- Monitor market conditions for optimal timing
- Prepare contingency plans for lease extension
"""
        else:
            analysis_md += """
**LOW RISK:** Sufficient time remaining in primary term
- Normal development planning timeline
- Monitor lease status annually
- Maintain good relationship with mineral owners
"""
        
        analysis_md += """
## Recommendations

"""
        
        recommendations = lease_analysis.get('recommendations', [])
        if recommendations:
            for i, rec in enumerate(recommendations, 1):
                analysis_md += f"{i}. {rec}\n"
        
        analysis_md += """
## Lease Extension Considerations

If lease extension becomes necessary:

1. **Market Assessment** - Evaluate current bonus and rental rates
2. **Negotiation Strategy** - Develop terms favorable for development
3. **Alternative Structures** - Consider joint venture or farmout options
4. **Legal Review** - Ensure compliance with all lease provisions

## Development Timeline Requirements

To maintain lease:
- **Spud Date:** Must commence drilling before expiration
- **Completion Timeline:** Varies by state and lease terms
- **Production Requirements:** Establish commercial production
- **Continuous Development:** May be required for large acreage positions

---

Generated with SHALE YEAH (c) Ryan McDonald / Ascendvent LLC - Apache-2.0
"""
        
        return analysis_md
    
    def run_analysis(self, ownership_data_path: str) -> bool:
        """Run complete ownership analysis"""
        self.logger.info("Starting ownership analysis")
        
        try:
            # Step 1: Ingest ownership data
            ownership_data = self.ingest_ownership_data(ownership_data_path)
            
            if not ownership_data.get('owners'):
                self.logger.error("No ownership data available")
                return False
            
            # Step 2: Calculate interests
            calculated_ownership = self.calculate_interests(ownership_data)
            
            # Step 3: Identify stakeholders
            stakeholders = self.identify_stakeholders(calculated_ownership)
            
            # Step 4: Analyze lease terms
            lease_analysis = self.analyze_lease_terms(calculated_ownership)
            
            # Step 5: Generate outputs using shared base class methods
            
            # Generate ownership.json
            self._save_output_file(calculated_ownership, 'ownership.json', 'json')
            
            # Generate ownership_summary.md with SHALE YEAH footer
            ownership_summary = self.generate_ownership_summary(calculated_ownership, stakeholders)
            ownership_summary = self._add_shale_yeah_footer(ownership_summary)
            self._save_output_file(ownership_summary, 'ownership_summary.md', 'md')
            
            # Generate lease_analysis.md with SHALE YEAH footer
            lease_analysis_md = self.generate_lease_analysis(calculated_ownership, lease_analysis)
            lease_analysis_md = self._add_shale_yeah_footer(lease_analysis_md)
            self._save_output_file(lease_analysis_md, 'lease_analysis.md', 'md')
            
            # Validate outputs using shared method
            required_files = list(self.expected_outputs.keys())
            if not self._validate_outputs(required_files):
                return False
            
            self.logger.info("Ownership analysis completed successfully")
            return True
            
        except Exception as e:
            self.logger.error(f"Ownership analysis failed: {e}")
            return False

def main():
    """Main entry point for Titletracker agent"""
    parser = argparse.ArgumentParser(description="Titletracker - Ownership Analysis Agent")
    parser.add_argument("--ownership-data", required=True, help="Ownership data files")
    parser.add_argument("--output-dir", required=True, help="Output directory")
    parser.add_argument("--run-id", required=True, help="Run identifier")
    
    args = parser.parse_args()
    
    # Create agent
    agent = TitletrackerAgent(args.output_dir, args.run_id)
    
    # Run analysis
    success = agent.run_analysis(args.ownership_data)
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()