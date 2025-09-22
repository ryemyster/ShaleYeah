# SHALE YEAH Workspace Management

## Directory Structure

SHALE YEAH uses an organized directory structure that separates temporary demo/test runs from production analysis outputs:

```
data/
├── inputs/              # Sample input files (committed to repo)
│   ├── las/            # LAS well log files
│   ├── excel/          # Excel economic data files
│   └── databases/      # Access database files
├── temp/               # Temporary files (auto-cleaned, not committed)
│   ├── demo/          # Demo runs (cleaned after 24hrs, keep last 3)
│   ├── test/          # Test runs (cleaned immediately)
│   └── processing/    # Intermediate processing files
└── outputs/            # Production results only (committed selectively)
    ├── reports/       # Final client deliverables
    ├── models/        # Financial models
    └── archive/       # Long-term storage
```

## Analysis Output Locations

### Demo Mode
- **Location**: `data/temp/demo/demo-YYYYMMDDTHHMMSS/`
- **Purpose**: Quick demonstrations and testing
- **Cleanup**: Automatic (keep last 3 runs, remove older than 24hrs)
- **Files**: 3 files per run (investment decision, detailed analysis, financial model)

### Production Mode
- **Location**: `data/outputs/reports/production-YYYYMMDDTHHMMSS/`
- **Purpose**: Real client analysis and deliverables
- **Cleanup**: Manual (permanent storage)
- **Files**: Complete analysis package for client delivery

### Test Mode
- **Location**: `data/temp/test/test-TIMESTAMP/`
- **Purpose**: Automated testing and CI/CD
- **Cleanup**: Immediate removal after test completion

### Batch/Research Mode
- **Location**: `data/temp/processing/batch-YYYYMMDDTHHMMSS/`
- **Purpose**: Multi-prospect analysis and deep research
- **Cleanup**: Manual cleanup after analysis review

## Cleanup Commands

### Automatic Cleanup (Recommended)
```bash
npm run clean              # Clean build artifacts, cache, and old demos
npm run clean:workspace    # Run intelligent workspace cleanup only
```

### Manual Cleanup Options
```bash
npm run clean:dist         # Remove TypeScript build files
npm run clean:cache        # Remove Node.js and TSX cache
npm run clean:demo         # Clean old demo/test runs (same as workspace)
npm run clean:outputs      # Remove ALL outputs (use with caution!)
npm run clean:all          # Nuclear option: clean everything including node_modules
```

### Workspace Cleanup Logic

The `scripts/cleanup-workspace.sh` script implements intelligent cleanup:

1. **Demo Runs**: Keep last 3 runs, remove others older than 1 day
2. **Test Runs**: Remove all test runs immediately
3. **Build Artifacts**: Clean dist/ and cache directories
4. **Logs**: Remove all .log files
5. **Safety**: Never removes production outputs or input files

## Best Practices

### For Developers
- Use `npm run demo` for testing - outputs go to temp directory
- Use `npm run clean` regularly to maintain clean workspace
- Check `data/temp/demo/` size occasionally with cleanup script

### For Production Use
- Use `--mode=production` for real client analysis
- Specify custom output directory with `--output` for important analyses
- Archive production results in `data/outputs/archive/` for long-term storage
- Never run cleanup commands on production outputs without backing up

### For CI/CD
- Test runs automatically use temp directories
- Cleanup happens automatically in CI environment
- No persistent files are left behind after testing

## File Lifecycle

```
┌─────────────┐    ┌──────────────┐    ┌─────────────────┐
│   Demo Run  │───▶│  data/temp/  │───▶│  Auto-cleaned   │
│             │    │    demo/     │    │  after 24hrs    │
└─────────────┘    └──────────────┘    └─────────────────┘

┌─────────────┐    ┌──────────────┐    ┌─────────────────┐
│ Production  │───▶│ data/outputs │───▶│ Permanent       │
│   Analysis  │    │   reports/   │    │ Storage         │
└─────────────┘    └──────────────┘    └─────────────────┘

┌─────────────┐    ┌──────────────┐    ┌─────────────────┐
│  Test Run   │───▶│  data/temp/  │───▶│ Immediate       │
│             │    │    test/     │    │ Cleanup         │
└─────────────┘    └──────────────┘    └─────────────────┘
```

## Monitoring Disk Usage

The cleanup script provides disk usage information:
```bash
npm run clean:workspace
# Shows:
# - Number of demo runs preserved
# - Total data directory size
# - Node modules size
# - Cleanup summary
```

## Troubleshooting

### "Disk space full" errors
1. Run `npm run clean` to free up space
2. Check `data/temp/` for large accumulated files
3. Consider `npm run clean:all` for maximum cleanup (requires reinstall)

### "Permission denied" errors
1. Ensure cleanup script is executable: `chmod +x scripts/cleanup-workspace.sh`
2. Check file permissions in data/ directories
3. Run cleanup as same user who created the files

### Missing output files
1. Check if running in demo mode (outputs go to `data/temp/demo/`)
2. Verify output directory exists and is writable
3. Check for recent cleanup that may have removed files

## Git Integration

- `data/temp/` is completely ignored by git
- `data/outputs/reports/*/` subdirectories are ignored
- `data/inputs/` sample files are committed
- `.gitkeep` files maintain directory structure in empty repos