# DEMO ARIES DATABASE FILE
# This is a mock structure representing ARIES petroleum economics data
# In production, this would be a binary database file

[DATABASE_INFO]
Version=5000.1.13
Database_Name=Demo_ARIES_Project
Created_Date=2024-01-15
Modified_Date=2024-09-24
License_Required=true

[PROJECTS]
Project_ID=PROJ_001
Project_Name=Permian Basin Development
Operator=Demo Energy LLC
Area=Midland Basin
Project_Type=development
Status=active
Well_Count=12

[WELLS]
Well_ID=WELL_001
Well_Name=DEMO-001H
Operator=Demo Energy LLC
Field=Demo Field
Project_ID=PROJ_001
Latitude=32.0
Longitude=-102.0
County=Midland
State=Texas
Well_Type=oil
Status=producing
Spud_Date=2023-01-15
Completion_Date=2023-03-20
First_Production_Date=2023-04-01
Total_Depth=12500
Lateral_Length=8500
Formation=Wolfcamp A

[FORECASTS]
Forecast_ID=FCST_001
Well_ID=WELL_001
Forecast_Name=DEMO-001H Type Curve
Forecast_Type=decline_curve
Initial_Rate=1200
Decline_Rate=65
B_Factor=1.8
Minimum_Rate=10
Economic_Limit=5
Forecast_Length=300
Oil_Reserves=875000
Gas_Reserves=2100000
NGL_Reserves=125000
BOE_Reserves=1350000
R2=0.92
Confidence_Level=0.85

[ECONOMICS]
Economics_ID=ECON_001
Well_ID=WELL_001
Project_ID=PROJ_001
Economics_Name=DEMO-001H Base Case
Analysis_Type=single_well
Oil_Price=75.0
Gas_Price=3.50
NGL_Price=45.0
Well_Cost=8500000
Facilities_Cost=1500000
Operating_Cost=25000
Abandonment_Cost=150000
Royalty=0.1875
Working_Interest=0.80
Net_Revenue_Interest=0.65
Severance_Tax=0.046
Ad_Valorem_Tax=0.015
Gross_Revenue=95600000
Net_Revenue=62140000
Total_Costs=32500000
Before_Tax_Cash_Flow=29640000
After_Tax_Cash_Flow=21750000
NPV_10=18200000
NPV_15=14800000
IRR=28.5
Payout=18
EUR=1350000
Breakeven=42.50