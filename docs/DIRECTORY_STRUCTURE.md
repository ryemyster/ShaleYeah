# Directory Structure & Requirements

This document explains the SHALE YEAH directory structure and what's required for production runs.

## **Overview**

SHALE YEAH follows a clear separation between **static required data** and **generated outputs**:

- **`/data`** - Static data required for the system to function
- **`/outputs`** - Generated analysis results (auto-created, ignored by git)

## **Required Pre-existing Directories**

### **Static Data (`/data`)**

These directories and files **must exist** before running production analysis:

```
data/
├── samples/              # REQUIRED: Sample input files
│   ├── demo.las         # Valid LAS 2.0 well log file
│   ├── economics.csv    # Economic parameters spreadsheet
│   └── README.md        # Documentation for sample files
└── [server-directories] # Auto-created by MCP servers
    ├── geowiz/          # Geological analysis data
    ├── econobot/        # Economic analysis data
    ├── curve-smith/     # Engineering analysis data
    └── ...              # 11 other MCP server directories
```

### **Critical Sample Files**

#### **`data/samples/demo.las`**
- **Format**: LAS 2.0 (Log ASCII Standard)
- **Purpose**: Well log data for geological and reservoir analysis
- **Used by**: `geowiz` (geological analysis) and `curve-smith` (engineering analysis)
- **Required curves**: DEPT, GR, NPHI, RHOB, PEF
- **Depth range**: Must contain valid depth data

#### **`data/samples/economics.csv`**
- **Format**: CSV (Excel .xlsx also supported)
- **Purpose**: Economic parameters for financial modeling
- **Used by**: `econobot` (economic analysis)
- **Required parameters**: Oil Price, Gas Price, Drilling Cost, Operating Cost, Discount Rate
- **Structure**: Columns - Parameter, Value, Unit, Description

## **Auto-created Output Directories**

### **Generated Outputs (`/outputs`)**

These directories are **automatically created** during analysis runs:

```
outputs/
├── reports/             # Production analysis reports
│   └── production-YYYYMMDDTHHMMSS/
│       ├── INVESTMENT_DECISION.md
│       ├── DETAILED_ANALYSIS.md
│       └── FINANCIAL_MODEL.json
├── demo/                # Demo run outputs
│   └── demo-YYYYMMDDTHHMMSS/
│       ├── [same report files]
│       └── ...
├── processing/          # Batch/research processing outputs
│   └── [batch/research]-YYYYMMDDTHHMMSS/
└── test/               # All test outputs (consolidated)
    └── test-YYYYMMDDTHHMMSS/
```

## **Production Setup Checklist**

Before running **production analysis** (`npm run prod`), ensure:

### **✅ Repository Setup**
- [ ] Repository cloned
- [ ] `npm install --legacy-peer-deps` completed successfully
- [ ] `npm run build` completes without errors

### **✅ Required Files Exist**
- [ ] `data/samples/demo.las` exists and is valid LAS format
- [ ] `data/samples/economics.csv` exists with required parameters
- [ ] Both files contain realistic data for your analysis area

### **✅ File Validation**
- [ ] LAS file opens without errors (check with any LAS viewer)
- [ ] CSV file has all required economic parameters
- [ ] File paths are exactly as specified (case-sensitive)

### **✅ Ready to Run**
- [ ] `npm run type-check` passes
- [ ] All MCP servers can start: `npm run server:geowiz` (test one)
- [ ] **Ready for production**: `npm run prod`

## **Mode-Specific Directory Usage**

| Mode | Command | Output Directory | Sample Files Used |
|------|---------|-----------------|-------------------|
| **Demo** | `npm run dev` | `outputs/demo/demo-YYYYMMDDTHHMMSS/` | ❌ Uses mock data |
| **Production** | `npm run prod` | `outputs/reports/production-YYYYMMDDTHHMMSS/` | ✅ Requires real files |
| **Batch** | `npm run start -- --mode=batch` | `outputs/processing/batch-YYYYMMDDTHHMMSS/` | ✅ Requires real files |
| **Research** | `npm run start -- --mode=research` | `outputs/processing/research-YYYYMMDDTHHMMSS/` | ✅ Requires real files |

## **File Format Requirements**

### **LAS Files (`demo.las`)**
```
~VERSION INFORMATION
VERS.                    2.0 : CWLS LOG ASCII STANDARD -VERSION 2.0
~WELL INFORMATION
STRT .FT               5000.0000 : START DEPTH
STOP .FT               5100.0000 : STOP DEPTH
~CURVE INFORMATION
DEPT .FT                        : DEPTH
GR   .GAPI                      : GAMMA RAY
NPHI .V/V                       : NEUTRON POROSITY
RHOB .G/C3                      : BULK DENSITY
~ASCII
[depth] [gr] [nphi] [rhob] [...]
```

### **Economics Files (`economics.csv`)**
```csv
Parameter,Value,Unit,Description
Oil Price,75.00,$/bbl,WTI Crude Oil Price
Gas Price,3.50,$/MCF,Natural Gas Price
Drilling Cost,8500000,$,Total Drilling & Completion Cost
Operating Cost,25000,$/month,Monthly Operating Expenses
Discount Rate,0.10,decimal,NPV Discount Rate
[... more parameters]
```

## **Troubleshooting**

### **"No such file or directory" errors**
1. Verify `data/samples/demo.las` exists
2. Verify `data/samples/economics.csv` exists
3. Check file permissions (should be readable)
4. Ensure exact file names (case-sensitive)

### **"Invalid file format" errors**
1. Validate LAS file with online LAS checker
2. Ensure CSV has header row with required columns
3. Check for special characters or encoding issues

### **Production mode fails but demo works**
1. Demo mode uses mock data - production requires real files
2. Check that sample files contain valid, realistic data
3. Verify file formats match requirements above

## **Cleanup & Maintenance**

### **Automatic Cleanup**
- `npm run clean:demo` - Removes old demo runs (keeps last 3)
- `npm run clean:outputs` - Removes all generated outputs
- `npm run clean:workspace` - Full workspace cleanup

### **Manual Cleanup**
- **Safe to delete**: Entire `/outputs` directory (regenerated on next run)
- **Never delete**: `/data/samples` directory (contains required static data)

## **Advanced Configuration**

### **Custom Output Directories**
```bash
# Specify custom output location
npm run prod -- --output="/custom/path/analysis-results"

# Multiple file inputs
npm run prod -- --files="data/wells/well1.las,data/economics/project.xlsx"
```

### **MCP Server Data Directories**
Each MCP server creates its own data directory under `/data/[server-name]/`:
- Auto-created with `{ recursive: true }`
- Used for server-specific caching and intermediate files
- Safe to delete (regenerated as needed)

## **Migration from Legacy Structure**

If migrating from old structure:
1. **Outputs moved**: `data/outputs/` → `outputs/`
2. **Temp removed**: `data/temp/` → `outputs/`
3. **Samples added**: New requirement for `data/samples/`
4. **Tests consolidated**: All test outputs → `outputs/test/`

---

**For more information:**
- [GETTING_STARTED.md](./GETTING_STARTED.md) - Quick start guide
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture
- [API_REFERENCE.md](./API_REFERENCE.md) - MCP server APIs