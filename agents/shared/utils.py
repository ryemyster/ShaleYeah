#!/usr/bin/env python3
"""
Shared utilities for SHALE YEAH agents

Common utility functions for JSON serialization, logging setup, 
validation, and other shared functionality.
"""

import json
import logging
import numpy as np
import pandas as pd
from typing import Any, Dict, List, Optional
from datetime import datetime, date


def json_serializer(obj: Any) -> Any:
    """Custom JSON serializer for numpy and pandas objects
    
    Handles serialization of numpy types, pandas objects, and datetime objects
    that are not natively JSON serializable.
    
    Args:
        obj: Object to serialize
        
    Returns:
        JSON serializable representation
        
    Raises:
        TypeError: If object is not serializable
    """
    if isinstance(obj, np.integer):
        return int(obj)
    elif isinstance(obj, np.floating):
        return float(obj)
    elif isinstance(obj, np.ndarray):
        return obj.tolist()
    elif isinstance(obj, (datetime, date)):
        return obj.isoformat()
    elif isinstance(obj, pd.DataFrame):
        return obj.to_dict('records')
    elif isinstance(obj, pd.Series):
        return obj.to_dict()
    elif hasattr(obj, '__dict__'):
        return obj.__dict__
    
    raise TypeError(f"Object of type {type(obj)} is not JSON serializable")


def setup_logging(agent_name: str, level: int = logging.INFO) -> logging.Logger:
    """Setup standardized logging for agents
    
    Args:
        agent_name: Name of the agent
        level: Logging level
        
    Returns:
        Configured logger instance
    """
    logger = logging.getLogger(agent_name)
    
    # Only configure if not already configured
    if not logger.handlers:
        # Create handler
        handler = logging.StreamHandler()
        
        # Create formatter
        formatter = logging.Formatter(
            f'%(levelname)s:%(name)s:%(message)s'
        )
        handler.setFormatter(formatter)
        
        # Add handler to logger
        logger.addHandler(handler)
        logger.setLevel(level)
        
        # Prevent duplicate logs
        logger.propagate = False
    
    return logger


def validate_file_path(file_path: str, required_extensions: List[str] = None) -> bool:
    """Validate file path and extension
    
    Args:
        file_path: Path to validate
        required_extensions: List of allowed extensions (e.g., ['.json', '.csv'])
        
    Returns:
        True if valid, False otherwise
    """
    from pathlib import Path
    
    try:
        path = Path(file_path)
        
        # Check if extension is allowed
        if required_extensions and path.suffix.lower() not in required_extensions:
            return False
        
        return True
        
    except Exception:
        return False


def safe_divide(numerator: float, denominator: float, default: float = 0.0) -> float:
    """Safely divide two numbers with default for division by zero
    
    Args:
        numerator: Numerator value
        denominator: Denominator value  
        default: Default value if denominator is zero
        
    Returns:
        Result of division or default value
    """
    if denominator == 0:
        return default
    return numerator / denominator


def round_financial(value: float, precision: int = 2) -> float:
    """Round financial values consistently
    
    Args:
        value: Value to round
        precision: Number of decimal places
        
    Returns:
        Rounded value
    """
    return round(float(value), precision)


def format_percentage(value: float, precision: int = 1) -> str:
    """Format value as percentage
    
    Args:
        value: Decimal value (e.g., 0.25 for 25%)
        precision: Decimal places to show
        
    Returns:
        Formatted percentage string
    """
    return f"{value:.{precision}%}"


def format_currency(value: float, symbol: str = '$') -> str:
    """Format value as currency
    
    Args:
        value: Numeric value
        symbol: Currency symbol
        
    Returns:
        Formatted currency string
    """
    return f"{symbol}{value:,.0f}"


def ensure_boolean(value: Any) -> bool:
    """Ensure value is a proper boolean for JSON serialization
    
    Args:
        value: Value to convert
        
    Returns:
        Boolean value
    """
    if isinstance(value, (np.bool_, bool)):
        return bool(value)
    elif isinstance(value, str):
        return value.lower() in ('true', '1', 'yes', 'on')
    elif isinstance(value, (int, float)):
        return bool(value)
    else:
        return False


def clean_filename(filename: str) -> str:
    """Clean filename for safe filesystem usage
    
    Args:
        filename: Original filename
        
    Returns:
        Cleaned filename
    """
    import re
    
    # Remove or replace invalid characters
    filename = re.sub(r'[<>:"/\\|?*]', '_', filename)
    
    # Remove multiple underscores and leading/trailing underscores
    filename = re.sub(r'_+', '_', filename)
    filename = filename.strip('_')
    
    return filename


def merge_dictionaries(dict1: Dict, dict2: Dict, deep: bool = True) -> Dict:
    """Merge two dictionaries with optional deep merging
    
    Args:
        dict1: First dictionary
        dict2: Second dictionary (takes precedence)
        deep: Whether to perform deep merge
        
    Returns:
        Merged dictionary
    """
    if not deep:
        result = dict1.copy()
        result.update(dict2)
        return result
    
    result = dict1.copy()
    
    for key, value in dict2.items():
        if key in result and isinstance(result[key], dict) and isinstance(value, dict):
            result[key] = merge_dictionaries(result[key], value, deep=True)
        else:
            result[key] = value
    
    return result


def extract_numeric_value(value: Any, default: float = 0.0) -> float:
    """Extract numeric value from various input types
    
    Args:
        value: Input value
        default: Default value if extraction fails
        
    Returns:
        Numeric value
    """
    try:
        if isinstance(value, (int, float)):
            return float(value)
        elif isinstance(value, str):
            # Remove common non-numeric characters
            cleaned = value.replace('$', '').replace(',', '').replace('%', '')
            return float(cleaned)
        elif hasattr(value, 'item'):  # numpy scalar
            return float(value.item())
        else:
            return default
    except (ValueError, TypeError):
        return default


def calculate_statistics(values: List[float]) -> Dict[str, float]:
    """Calculate basic statistics for a list of values
    
    Args:
        values: List of numeric values
        
    Returns:
        Dictionary with statistical measures
    """
    if not values:
        return {
            'count': 0,
            'mean': 0.0,
            'median': 0.0,
            'std_dev': 0.0,
            'min': 0.0,
            'max': 0.0
        }
    
    values_array = np.array(values)
    
    return {
        'count': len(values),
        'mean': float(np.mean(values_array)),
        'median': float(np.median(values_array)),
        'std_dev': float(np.std(values_array)),
        'min': float(np.min(values_array)),
        'max': float(np.max(values_array))
    }


def validate_required_keys(data: Dict, required_keys: List[str]) -> List[str]:
    """Validate that dictionary contains all required keys
    
    Args:
        data: Dictionary to validate
        required_keys: List of required key names
        
    Returns:
        List of missing keys (empty if all present)
    """
    missing_keys = []
    
    for key in required_keys:
        if key not in data:
            missing_keys.append(key)
        elif data[key] is None:
            missing_keys.append(f"{key} (null value)")
    
    return missing_keys