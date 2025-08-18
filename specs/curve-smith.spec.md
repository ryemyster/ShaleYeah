Name: curve-smith
Goal: Curve fitting and quality control for well log data
Inputs: LAS files, zones.geojson
Outputs: curves/*.csv, qc_report.md
Notes: Fit missing curves with baselines, compute RMSE and NRMSE, export QC'd data

## Description

The curve-smith agent specializes in well log curve analysis, fitting, and quality control. It processes LAS files and geological zones to produce clean, QC'd curve data with statistical validation.

## Core Functions

1. **LAS Data Processing**: Parse and validate well log curves from LAS files
2. **Missing Data Handling**: Fit simple baselines for missing or invalid curve segments  
3. **Quality Control**: Compute Root Mean Square Error (RMSE) and Normalized RMSE (NRMSE)
4. **Data Export**: Generate individual curve CSV files and comprehensive QC report

## Quality Gates

- qc_report.md must include per-curve RMSE and NRMSE statistics
- All curve CSVs must include proper depth units and metadata
- Missing data segments must be clearly identified and documented
- Statistical thresholds must be applied and reported

## Expected Outputs

- `curves/GR.csv` - Gamma ray curve with fitted values
- `curves/RHOB.csv` - Bulk density curve with fitted values  
- `curves/NPHI.csv` - Neutron porosity curve with fitted values
- `qc_report.md` - Statistical analysis with RMSE/NRMSE per curve

Generated with SHALE YEAH (c) Ryan McDonald / Ascendvent LLC - Apache-2.0