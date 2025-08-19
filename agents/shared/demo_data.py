#!/usr/bin/env python3
"""
DemoDataGenerator - Centralized demo data generation for all agents

Replaces the duplicate _create_demo_*() methods across all agents with
a single, consistent demo data source.
"""

import numpy as np
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any


class DemoDataGenerator:
    """Centralized demo data generator for all SHALE YEAH agents"""
    
    def __init__(self):
        # Base demo parameters
        self.demo_tract_id = "DEMO_TRACT_001"
        self.demo_legal_description = "Section 15, Township 2 South, Range 3 East, Permian County, Texas"
        self.demo_total_acres = 640
        self.demo_operator = "SHALE YEAH ENERGY LLC"
        
        # Default geological zones
        self.demo_zones = [
            {
                'formation_name': 'Wolfcamp A',
                'lithology': 'Shale/Limestone',
                'top_depth': 5000,
                'bottom_depth': 5150,
                'thickness': 150,
                'porosity': 0.08,
                'permeability': 0.0001,
                'confidence': 0.8
            },
            {
                'formation_name': 'Wolfcamp B', 
                'lithology': 'Shale/Sandstone',
                'top_depth': 5150,
                'bottom_depth': 5350,
                'thickness': 200,
                'porosity': 0.10,
                'permeability': 0.0002,
                'confidence': 0.75
            },
            {
                'formation_name': 'Bone Spring',
                'lithology': 'Limestone/Sandstone',
                'top_depth': 5350,
                'bottom_depth': 5650,
                'thickness': 300,
                'porosity': 0.12,
                'permeability': 0.0005,
                'confidence': 0.70
            }
        ]
    
    def get_demo_data(self, agent_name: str, data_type: str) -> Dict:
        """Get demo data for specific agent and data type
        
        Args:
            agent_name: Name of the requesting agent
            data_type: Type of demo data needed
            
        Returns:
            Demo data dictionary
        """
        method_name = f"_create_demo_{data_type}"
        
        if hasattr(self, method_name):
            return getattr(self, method_name)()
        else:
            # Generic demo data
            return self._create_demo_generic()
    
    def _create_demo_ownership_data(self) -> Dict:
        """Demo ownership and title data"""
        return {
            'source_type': 'demo',
            'tract_id': self.demo_tract_id,
            'legal_description': self.demo_legal_description,
            'total_acres': self.demo_total_acres,
            'owners': [
                {
                    'name': self.demo_operator,
                    'entity_type': 'LLC',
                    'role': 'operator',
                    'wi': 0.75,  # 75% working interest
                    'nri': 0.60, # 60% net revenue interest
                    'address': '123 Energy Plaza, Midland, TX 79701',
                    'contact_person': 'Development Manager',
                    'type': 'operator'
                },
                {
                    'name': 'PERMIAN MINERALS TRUST',
                    'entity_type': 'Trust',
                    'role': 'working_interest_owner',
                    'wi': 0.25,  # 25% working interest
                    'nri': 0.20, # 20% net revenue interest
                    'address': '456 Trust Building, Houston, TX 77002',
                    'contact_person': 'Trustee',
                    'type': 'working_interest_owner'
                },
                {
                    'name': 'JOHNSON FAMILY MINERALS',
                    'entity_type': 'Individual',
                    'role': 'royalty_owner',
                    'wi': 0.0,   # No working interest
                    'nri': 0.0,  # Royalty only
                    'royalty_rate': 0.125,  # 12.5% royalty
                    'type': 'royalty_owner'
                },
                {
                    'name': 'WEST TEXAS OVERRIDES LLC',
                    'entity_type': 'LLC',
                    'role': 'override_owner', 
                    'wi': 0.0,   # No working interest
                    'nri': 0.0,  # Override only
                    'override_rate': 0.025,  # 2.5% override
                    'type': 'override_owner'
                }
            ],
            'lease_terms': {
                'primary_term': 5,  # years
                'royalty_rate': 0.125,  # 12.5%
                'lease_date': '2023-01-15',
                'expiration_date': '2028-01-15',
                'bonus_paid': 5000,  # per acre
                'rental_rate': 25    # per acre per year
            }
        }
    
    def _create_demo_valuation_data(self) -> Dict:
        """Demo economic valuation data"""
        return {
            'run_id': 'demo',
            'analysis_date': datetime.now().isoformat(),
            'financial_metrics': {
                'npv_10': 2500000,      # $2.5M NPV
                'irr': 0.28,            # 28% IRR
                'roi': 3.5,             # 3.5x ROI
                'payback_months': 12,    # 12 month payback
                'total_capex': 53000000, # $53M total capex
                'total_revenue': 89000000,
                'total_operating_costs': 15000000,
                'total_free_cash_flow': 74000000,
                'discount_rate': 0.10,
                'meets_thresholds': {
                    'npv': True,
                    'irr': True, 
                    'roi': True,
                    'payback': True
                }
            },
            'economic_assumptions': {
                'discount_rate': 0.10,
                'oil_price': 75.00,
                'gas_price': 3.50,
                'ngl_price': 25.00,
                'loe': 8.50
            },
            'sensitivity_analysis': {
                'oil_price': {
                    '-20.0%': {'npv': 1800000, 'irr': 0.22, 'roi': 2.8},
                    '+20.0%': {'npv': 3200000, 'irr': 0.34, 'roi': 4.2}
                },
                'production': {
                    '-30.0%': {'npv': 1600000, 'irr': 0.19, 'roi': 2.5},
                    '+30.0%': {'npv': 3400000, 'irr': 0.37, 'roi': 4.5}
                }
            }
        }
    
    def _create_demo_risk_data(self) -> Dict:
        """Demo risk assessment data"""
        return {
            'run_id': 'demo',
            'analysis_date': datetime.now().isoformat(),
            'composite_risk': {
                'composite_score': 45,  # Medium risk
                'risk_level': 'medium'
            },
            'category_assessments': {
                'geological': {
                    'risk_score': 40,
                    'factors': ['Formation variability within acceptable range']
                },
                'operational': {
                    'risk_score': 35,
                    'factors': ['Standard drilling and completion operations']
                },
                'market': {
                    'risk_score': 50,
                    'factors': ['Commodity price volatility']
                },
                'financial': {
                    'risk_score': 25,
                    'factors': ['Strong financial metrics']
                },
                'title': {
                    'risk_score': 20,
                    'factors': ['Clear title with standard protections']
                }
            },
            'success_probability': 0.75,
            'mitigation_strategies': [
                {
                    'category': 'market',
                    'strategy': 'Commodity Hedging',
                    'description': 'Hedge 60% of production for first 2 years'
                }
            ]
        }
    
    def _create_demo_investment_decision(self) -> Dict:
        """Demo investment decision data"""
        return {
            'run_id': 'demo',
            'decision_date': datetime.now().isoformat(),
            'final_decision': {
                'decision': 'PROCEED',
                'composite_score': 78,
                'confidence_level': 'HIGH',
                'next_agent': 'notarybot',
                'decision_rationale': [
                    'All investment criteria met',
                    'Strategic fit confirmed',
                    '3x ROI threshold exceeded'
                ],
                'threshold_compliance': {
                    'financial': True,
                    'risk': True,
                    'operational': True,
                    'strategic': True
                }
            }
        }
    
    def _create_demo_drilling_forecast(self) -> Dict:
        """Demo drilling forecast data"""
        wells_count = 8
        months = 60
        
        well_forecasts = []
        for well_id in range(1, wells_count + 1):
            # Generate synthetic production profiles
            variation = np.random.uniform(0.85, 1.15)
            initial_oil = 800 * variation  # bbl/day
            initial_gas = 2500 * variation  # mcf/day
            decline_rate = 0.65
            
            oil_profile = []
            gas_profile = []
            cumulative_oil = 0
            cumulative_gas = 0
            
            for month in range(1, months + 1):
                decline_factor = (1 + decline_rate * (month - 1) / 12) ** (-1 / decline_rate)
                monthly_oil = initial_oil * decline_factor * 30
                monthly_gas = initial_gas * decline_factor * 30
                
                cumulative_oil += monthly_oil
                cumulative_gas += monthly_gas
                
                oil_profile.append(round(monthly_oil, 1))
                gas_profile.append(round(monthly_gas, 1))
            
            well_forecasts.append({
                'well_id': f"WELL_{well_id:02d}",
                'eur_oil': round(cumulative_oil, 0),
                'eur_gas': round(cumulative_gas, 0), 
                'peak_oil_rate': round(initial_oil, 1),
                'peak_gas_rate': round(initial_gas, 1),
                'monthly_oil': oil_profile,
                'monthly_gas': gas_profile,
                'target_zones': ['Wolfcamp A', 'Wolfcamp B']
            })
        
        return {
            'run_id': 'demo',
            'analysis_date': datetime.now().isoformat(),
            'development_summary': {
                'total_wells': wells_count,
                'total_capex': wells_count * 8_500_000 + 2_000_000,
                'development_phases': [
                    {'phase': 1, 'wells': 4, 'capex': 4 * 8_500_000 + 2_000_000},
                    {'phase': 2, 'wells': 4, 'capex': 4 * 8_500_000}
                ]
            },
            'production_forecast': {
                'total_wells': wells_count,
                'total_eur_oil': sum(w['eur_oil'] for w in well_forecasts),
                'total_eur_gas': sum(w['eur_gas'] for w in well_forecasts),
                'well_forecasts': well_forecasts,
                'forecast_months': months
            }
        }
    
    def _create_demo_geological_data(self) -> Dict:
        """Demo geological data"""
        return {
            'features': [
                {
                    'properties': zone,
                    'geometry': {
                        'type': 'Polygon',
                        'coordinates': [[
                            [-102.0, 32.0], [-102.0, 32.1], 
                            [-101.9, 32.1], [-101.9, 32.0], [-102.0, 32.0]
                        ]]
                    }
                }
                for zone in self.demo_zones
            ]
        }
    
    def _create_demo_generic(self) -> Dict:
        """Generic demo data for unspecified types"""
        return {
            'demo': True,
            'tract_id': self.demo_tract_id,
            'operator': self.demo_operator,
            'generated_at': datetime.now().isoformat()
        }