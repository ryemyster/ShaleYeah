#!/usr/bin/env python3
"""
EconomicBase - Shared economic calculations and financial modeling utilities

Common financial calculations, NPV/DCF methods, and economic utilities
used across econobot, riskranger, and the-core agents.
"""

import numpy as np
from typing import Dict, List, Tuple, Optional
from datetime import datetime


class EconomicBase:
    """Base class for economic calculations and financial modeling"""
    
    # Standard industry thresholds
    STANDARD_THRESHOLDS = {
        'minimum_npv': 300000,      # $300K minimum NPV
        'minimum_irr': 0.25,        # 25% minimum IRR
        'minimum_roi': 3.0,         # 3x minimum ROI
        'maximum_payback': 14,      # 14 months maximum payback
        'discount_rate': 0.10       # 10% standard discount rate
    }
    
    # Standard economic assumptions
    STANDARD_PRICING = {
        'oil_price': 75.00,         # $/bbl
        'gas_price': 3.50,          # $/mcf
        'ngl_price': 25.00,         # $/bbl
        'loe': 8.50,               # $/boe lease operating expense
    }
    
    @staticmethod
    def calculate_npv(cash_flows: np.ndarray, discount_rate: float = None) -> float:
        """Calculate Net Present Value using standard DCF methodology
        
        Args:
            cash_flows: Array of monthly cash flows (month 0 = initial investment)
            discount_rate: Annual discount rate (default: 10%)
            
        Returns:
            Net Present Value
        """
        if discount_rate is None:
            discount_rate = EconomicBase.STANDARD_THRESHOLDS['discount_rate']
        
        # Monthly discounting
        periods = np.arange(len(cash_flows))
        discount_factors = (1 + discount_rate) ** (-periods / 12)
        npv = np.sum(cash_flows * discount_factors)
        
        return float(npv)
    
    @staticmethod
    def calculate_irr(cash_flows: np.ndarray, max_iterations: int = 100) -> float:
        """Calculate Internal Rate of Return using Newton-Raphson method
        
        Args:
            cash_flows: Array of monthly cash flows
            max_iterations: Maximum iterations for convergence
            
        Returns:
            Annual Internal Rate of Return
        """
        # Initial guess
        irr = 0.1
        
        for _ in range(max_iterations):
            # Calculate NPV and derivative
            periods = np.arange(len(cash_flows))
            discount_factors = (1 + irr) ** (-periods / 12)
            npv = np.sum(cash_flows * discount_factors)
            
            # Derivative of NPV with respect to IRR
            derivative = np.sum(-periods / 12 * cash_flows * discount_factors / (1 + irr))
            
            if abs(derivative) < 1e-10:
                break
                
            # Newton-Raphson update
            irr_new = irr - npv / derivative
            
            if abs(irr_new - irr) < 1e-6:
                break
                
            irr = irr_new
        
        return float(irr)
    
    @staticmethod
    def calculate_roi(total_revenue: float, total_investment: float) -> float:
        """Calculate Return on Investment
        
        Args:
            total_revenue: Total undiscounted revenue
            total_investment: Total capital investment
            
        Returns:
            Return on Investment ratio
        """
        if total_investment <= 0:
            return 0.0
        
        return float(total_revenue / total_investment)
    
    @staticmethod
    def calculate_payback_period(cash_flows: np.ndarray) -> int:
        """Calculate payback period in months
        
        Args:
            cash_flows: Array of monthly cash flows
            
        Returns:
            Payback period in months
        """
        cumulative_cf = np.cumsum(cash_flows)
        payback_periods = np.where(cumulative_cf > 0)[0]
        
        if len(payback_periods) == 0:
            return len(cash_flows)  # Never pays back
        
        return int(payback_periods[0])
    
    @staticmethod
    def check_investment_thresholds(npv: float, irr: float, roi: float, 
                                  payback_months: int, 
                                  thresholds: Dict = None) -> Dict:
        """Check if financial metrics meet investment thresholds
        
        Args:
            npv: Net Present Value
            irr: Internal Rate of Return
            roi: Return on Investment
            payback_months: Payback period in months
            thresholds: Custom thresholds (optional)
            
        Returns:
            Dictionary with threshold compliance results
        """
        if thresholds is None:
            thresholds = EconomicBase.STANDARD_THRESHOLDS
        
        return {
            'npv': bool(npv >= thresholds['minimum_npv']),
            'irr': bool(irr >= thresholds['minimum_irr']),
            'roi': bool(roi >= thresholds['minimum_roi']),
            'payback': bool(payback_months <= thresholds['maximum_payback']),
            'all_met': bool(
                npv >= thresholds['minimum_npv'] and
                irr >= thresholds['minimum_irr'] and
                roi >= thresholds['minimum_roi'] and
                payback_months <= thresholds['maximum_payback']
            )
        }
    
    @staticmethod
    def build_cash_flow_model(production_forecast: Dict, pricing: Dict = None, 
                            nri: float = 0.6) -> Tuple[np.ndarray, Dict]:
        """Build monthly cash flow model from production forecast
        
        Args:
            production_forecast: Production forecast data
            pricing: Commodity pricing (optional)
            nri: Net Revenue Interest
            
        Returns:
            Tuple of (cash_flows_array, summary_dict)
        """
        if pricing is None:
            pricing = EconomicBase.STANDARD_PRICING
        
        well_forecasts = production_forecast.get('well_forecasts', [])
        forecast_months = production_forecast.get('forecast_months', 60)
        
        if not well_forecasts:
            # Return empty cash flows
            return np.zeros(forecast_months), {}
        
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
            cash_flows.append(net_cash_flow)
        
        cash_flows_array = np.array(cash_flows)
        
        summary = {
            'total_revenue': float(np.sum([cf for cf in cash_flows if cf > 0])),
            'total_operating_costs': float(np.sum([abs(cf) for cf in cash_flows if cf < 0])),
            'total_net_cash_flow': float(np.sum(cash_flows)),
            'peak_monthly_cashflow': float(np.max(cash_flows)) if len(cash_flows) > 0 else 0,
            'average_monthly_cashflow': float(np.mean(cash_flows)) if len(cash_flows) > 0 else 0
        }
        
        return cash_flows_array, summary
    
    @staticmethod
    def perform_sensitivity_analysis(base_case: Dict, variables: Dict, 
                                   sensitivity_ranges: Dict) -> Dict:
        """Perform sensitivity analysis on key economic variables
        
        Args:
            base_case: Base case financial metrics
            variables: Base case variable values
            sensitivity_ranges: Dictionary of variable ranges to test
            
        Returns:
            Sensitivity analysis results
        """
        results = {}
        
        for variable, ranges in sensitivity_ranges.items():
            results[variable] = {}
            
            for change in ranges:
                # Create modified case
                modified_variables = variables.copy()
                
                if variable in modified_variables:
                    modified_variables[variable] = variables[variable] * (1 + change)
                    
                    # Recalculate metrics with modified variables
                    # This would need to be implemented based on specific calculation logic
                    results[variable][f"{change:+.1%}"] = {
                        'npv': base_case.get('npv', 0) * (1 + change * 0.5),  # Simplified
                        'irr': base_case.get('irr', 0) * (1 + change * 0.3),  # Simplified
                        'roi': base_case.get('roi', 0) * (1 + change * 0.4),  # Simplified
                    }
        
        return results
    
    @staticmethod
    def format_financial_number(value: float, format_type: str = 'currency') -> str:
        """Format financial numbers for display
        
        Args:
            value: Numeric value
            format_type: Format type ('currency', 'percentage', 'ratio', 'number')
            
        Returns:
            Formatted string
        """
        if format_type == 'currency':
            return f"${value:,.0f}"
        elif format_type == 'percentage':
            return f"{value:.1%}"
        elif format_type == 'ratio':
            return f"{value:.1f}x"
        elif format_type == 'number':
            return f"{value:,.0f}"
        else:
            return str(value)