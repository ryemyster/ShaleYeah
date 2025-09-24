#!/usr/bin/env python3
"""
DLIS File Processor for SHALE YEAH
Uses dlisio library for Digital Log Interchange Standard format support

LEGAL NOTICE: This tool provides DLIS file parsing under DMCA Section 1201(f)
interoperability exception. Users must have appropriate DLIS software licenses.

Requirements:
    pip install dlisio

Sample data available from Equinor Volve dataset (open source)
"""

import json
import sys
import os
from typing import Dict, List, Any, Optional
import argparse

try:
    import dlisio
except ImportError:
    print("Error: dlisio library not installed.", file=sys.stderr)
    print("Install with: pip install dlisio", file=sys.stderr)
    print("Note: User must have appropriate DLIS software license.", file=sys.stderr)
    sys.exit(1)

def process_dlis_file(file_path: str) -> Dict[str, Any]:
    """
    Process DLIS file and return structured data compatible with SHALE YEAH

    Args:
        file_path: Path to .dlis file

    Returns:
        Dictionary with well log data in SHALE YEAH format
    """
    try:
        with dlisio.load(file_path) as (f, *_):
            logical_file = f

            # Extract origin information
            origin = logical_file.origins[0] if logical_file.origins else None

            # Extract well reference
            well_ref = logical_file.wellrefs[0] if logical_file.wellrefs else None

            # Extract frames (log data containers)
            frames = logical_file.frames

            # Build unified well log data structure
            well_data = {
                "format": "DLIS",
                "version": str(logical_file.version) if hasattr(logical_file, 'version') else "1.0",
                "wellName": well_ref.name if well_ref else "UNKNOWN_WELL",
                "depthUnit": "M",  # Default, will be updated from curves
                "depthStart": 0,
                "depthStop": 0,
                "depthStep": 0,
                "nullValue": -999.25,
                "curves": [],
                "depthData": [],
                "rows": 0,
                "metadata": {
                    "file_id": origin.file_id if origin else "",
                    "file_set_name": origin.file_set_name if origin else "",
                    "file_set_number": origin.file_set_number if origin else 0,
                    "file_number": origin.file_number if origin else 0,
                    "file_type": origin.file_type if origin else "",
                    "product": origin.product if origin else "",
                    "version": origin.version if origin else "",
                    "programs": [prog.name for prog in origin.programs] if origin and origin.programs else [],
                    "creation_time": str(origin.creation_time) if origin and origin.creation_time else "",
                    "order_number": origin.order_number if origin else "",
                    "descent_number": origin.descent_number if origin else "",
                    "run_number": origin.run_number if origin else "",
                    "well_id": well_ref.well_id if well_ref else "",
                    "well_name": well_ref.well_name if well_ref else "",
                    "field_name": well_ref.field_name if well_ref else "",
                    "operator": well_ref.operator if well_ref else "",
                    "location": well_ref.location if well_ref else "",
                    "county": well_ref.county if well_ref else "",
                    "state": well_ref.state if well_ref else "",
                    "country": well_ref.country if well_ref else "",
                },
                "qualityMetrics": {
                    "completeness": 0,
                    "continuity": 0,
                    "consistency": 0,
                    "confidence": 0
                }
            }

            if not frames:
                print("Warning: No frames found in DLIS file", file=sys.stderr)
                return well_data

            # Process the first frame (main log data)
            frame = frames[0]
            channels = frame.channels

            if not channels:
                print("Warning: No channels found in frame", file=sys.stderr)
                return well_data

            # Extract curve information
            curves_data = []
            depth_channel = None

            for channel in channels:
                curve_info = {
                    "name": channel.name,
                    "unit": channel.units if channel.units else "",
                    "description": channel.long_name if channel.long_name else channel.name,
                    "data": [],
                    "validPoints": 0,
                    "nullPoints": 0,
                    "mnemonic": channel.name
                }

                # Identify depth channel (usually first channel or contains DEPT/DEPTH)
                if (channel == channels[0] or
                    'DEPT' in channel.name.upper() or
                    'DEPTH' in channel.name.upper()):
                    depth_channel = channel
                    well_data["depthUnit"] = channel.units if channel.units else "M"

                curves_data.append(curve_info)

            # Extract actual data
            try:
                # Read frame data
                frame_data = frame.curves()

                if depth_channel and depth_channel.name in frame_data:
                    depth_data = frame_data[depth_channel.name]
                    if len(depth_data) > 0:
                        well_data["depthStart"] = float(depth_data[0])
                        well_data["depthStop"] = float(depth_data[-1])
                        well_data["depthStep"] = float(depth_data[1] - depth_data[0]) if len(depth_data) > 1 else 0
                        well_data["depthData"] = depth_data.tolist()
                        well_data["rows"] = len(depth_data)

                # Process curve data
                for i, curve_info in enumerate(curves_data):
                    channel_name = curve_info["name"]
                    if channel_name in frame_data:
                        data_array = frame_data[channel_name]
                        curve_info["data"] = data_array.tolist()

                        # Calculate valid/null points
                        valid_mask = ~np.isnan(data_array) if hasattr(data_array, 'dtype') else [x for x in data_array if x is not None]
                        curve_info["validPoints"] = int(np.sum(valid_mask)) if hasattr(valid_mask, 'sum') else len(valid_mask)
                        curve_info["nullPoints"] = len(data_array) - curve_info["validPoints"]

                        # Calculate statistics for valid data
                        if curve_info["validPoints"] > 0:
                            valid_data = data_array[valid_mask] if hasattr(data_array, 'dtype') else valid_mask
                            curve_info["minValue"] = float(np.min(valid_data)) if hasattr(valid_data, 'min') else min(valid_data)
                            curve_info["maxValue"] = float(np.max(valid_data)) if hasattr(valid_data, 'max') else max(valid_data)
                            curve_info["statistics"] = {
                                "mean": float(np.mean(valid_data)) if hasattr(valid_data, 'mean') else sum(valid_data) / len(valid_data),
                                "median": float(np.median(valid_data)) if hasattr(valid_data, 'median') else sorted(valid_data)[len(valid_data)//2],
                                "stdDev": float(np.std(valid_data)) if hasattr(valid_data, 'std') else 0,
                                "range": curve_info["maxValue"] - curve_info["minValue"]
                            }

            except Exception as e:
                print(f"Warning: Could not extract curve data: {e}", file=sys.stderr)

            well_data["curves"] = curves_data

            # Calculate quality metrics
            if curves_data:
                total_points = sum(curve["validPoints"] + curve["nullPoints"] for curve in curves_data)
                valid_points = sum(curve["validPoints"] for curve in curves_data)
                completeness = valid_points / total_points if total_points > 0 else 0

                # Simple quality assessment
                continuity = 1.0 if well_data["rows"] > 0 else 0
                consistency = len([c for c in curves_data if c["validPoints"] > 0]) / len(curves_data) if curves_data else 0
                confidence = (completeness + continuity + consistency) / 3

                well_data["qualityMetrics"] = {
                    "completeness": round(completeness, 3),
                    "continuity": round(continuity, 3),
                    "consistency": round(consistency, 3),
                    "confidence": round(confidence, 3)
                }

            return well_data

    except Exception as e:
        raise Exception(f"Failed to process DLIS file: {str(e)}")

def main():
    parser = argparse.ArgumentParser(description="Process DLIS files for SHALE YEAH")
    parser.add_argument("file", help="Path to DLIS file")
    parser.add_argument("--summary", action="store_true", help="Output summary only")
    parser.add_argument("--quality", action="store_true", help="Output quality metrics only")
    parser.add_argument("--curves", action="store_true", help="List curves only")

    args = parser.parse_args()

    if not os.path.exists(args.file):
        print(f"Error: File not found: {args.file}", file=sys.stderr)
        sys.exit(1)

    try:
        # Import numpy for statistical calculations
        try:
            import numpy as np
            globals()['np'] = np
        except ImportError:
            print("Warning: numpy not available, statistics will be limited", file=sys.stderr)

        well_data = process_dlis_file(args.file)

        if args.summary:
            summary = {
                "format": well_data["format"],
                "wellName": well_data["wellName"],
                "depthRange": f"{well_data['depthStart']}-{well_data['depthStop']} {well_data['depthUnit']}",
                "curves": len(well_data["curves"]),
                "rows": well_data["rows"],
                "quality": well_data["qualityMetrics"]
            }
            print(json.dumps(summary, indent=2))
        elif args.quality:
            quality_report = {
                "file": args.file,
                "format": well_data["format"],
                "qualityMetrics": well_data["qualityMetrics"],
                "curves": [
                    {
                        "name": curve["name"],
                        "validPoints": curve["validPoints"],
                        "nullPoints": curve["nullPoints"],
                        "completeness": curve["validPoints"] / (curve["validPoints"] + curve["nullPoints"]) if (curve["validPoints"] + curve["nullPoints"]) > 0 else 0
                    }
                    for curve in well_data["curves"]
                ]
            }
            print(json.dumps(quality_report, indent=2))
        elif args.curves:
            curves_list = [
                {
                    "name": curve["name"],
                    "unit": curve["unit"],
                    "description": curve["description"],
                    "points": curve["validPoints"] + curve["nullPoints"]
                }
                for curve in well_data["curves"]
            ]
            print(json.dumps(curves_list, indent=2))
        else:
            # Full output
            print(json.dumps(well_data, indent=2))

    except Exception as e:
        print(f"Error: {str(e)}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()