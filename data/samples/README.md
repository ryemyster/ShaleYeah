# Sample Data Files

This directory contains sample data files required for **production mode** analysis.

## Required Files

### `demo.las`
- **Purpose**: Well log data for geological and engineering analysis
- **Format**: LAS 2.0 (Log ASCII Standard)
- **Used by**: `geowiz` and `curve-smith` MCP servers
- **Content**: Gamma ray, neutron porosity, bulk density, and photoelectric factor curves
- **Depth Range**: 5000-5020 ft (Permian Basin simulation)

### `economics.csv`
- **Purpose**: Economic parameters for financial modeling
- **Format**: CSV (recommended: Excel .xlsx for production)
- **Used by**: `econobot` MCP server
- **Content**: Commodity prices, costs, production parameters, tax rates
- **Note**: Contains realistic Permian Basin economic assumptions

## Production Setup

For **production analysis** with real data:

1. Replace `demo.las` with actual well log data in LAS 2.0+ format
2. Replace `economics.csv` with Excel file containing project-specific economics
3. Ensure file paths match the references in MCP server configurations

## File Format Requirements

### LAS Files
- Must be valid LAS 2.0 or higher
- Require depth column and at least one log curve
- Supported curves: GR, NPHI, RHOB, PEF, ILD, SP, CALI

### Economics Files
- CSV or Excel format (.xlsx preferred)
- Must contain columns: Parameter, Value, Unit, Description
- Required parameters: Oil Price, Gas Price, Drilling Cost, Operating Cost, Discount Rate

## Demo vs Production

- **Demo Mode**: Uses mock data, ignores these files
- **Production Mode**: Requires these files to exist and be valid
- **File Validation**: MCP servers validate file formats and required parameters

## Troubleshooting

If production mode fails:
1. Verify files exist in this directory
2. Check file formats match requirements above
3. Validate LAS files have required curves (GR, NPHI, RHOB)
4. Ensure economics files have all required parameters