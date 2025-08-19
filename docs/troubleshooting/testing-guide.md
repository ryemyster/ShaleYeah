# SHALE YEAH Testing Guide

Comprehensive testing procedures for SHALE YEAH multi-agent platform.

## Testing Philosophy

SHALE YEAH employs a multi-layered testing strategy:
- **Unit Tests**: Individual agent and component testing
- **Integration Tests**: Agent interaction and pipeline testing  
- **End-to-End Tests**: Full tract evaluation workflows
- **Performance Tests**: Load and scalability validation
- **Security Tests**: Vulnerability and compliance verification

## Test Environment Setup

### Local Development Testing
```bash
# Clone and setup
git clone https://github.com/your-org/ShaleYeah.git
cd ShaleYeah

# Install test dependencies
npm install --include=dev
pip install -r requirements-dev.txt

# Setup test environment
export TEST_ENV=local
export RUN_ID=test-$(date +%Y%m%d-%H%M%S)
export OUT_DIR=./data/test-outputs/${RUN_ID}
```

### Continuous Integration Testing
```bash
# GitHub Actions workflow
export CI=true
export TEST_ENV=ci
export INTEGRATION_TESTS=mock

# Run full test suite
npm run test:ci
```

## Unit Testing

### Agent Unit Tests
Each agent includes comprehensive unit tests covering:

```bash
# Run all agent unit tests
python -m pytest tests/agents/ -v

# Test specific agent
python -m pytest tests/agents/test_geowiz_agent.py -v

# Test with coverage
python -m pytest tests/agents/ --cov=agents --cov-report=html
```

### Test Structure
```python
# tests/agents/test_econobot_agent.py
import pytest
from agents.econobot_agent import EconobotAgent

class TestEconobotAgent:
    def setup_method(self):
        self.output_dir = "test_output"
        self.run_id = "test_run"
        self.agent = EconobotAgent(self.output_dir, self.run_id)
    
    def test_initialization(self):
        assert self.agent.agent_name == 'econobot'
        assert self.agent.run_id == 'test_run'
        
    def test_npv_calculation(self):
        cash_flows = [-1000000, 300000, 400000, 500000, 600000]
        discount_rate = 0.10
        npv = self.agent.calculate_npv(cash_flows, discount_rate)
        assert npv > 0
        assert abs(npv - 266139) < 1000  # Expected value ±$1000
```

### Shared Module Testing
```bash
# Test base classes and utilities
python -m pytest tests/shared/ -v

# Test economic calculations
python -m pytest tests/shared/test_economic_base.py::test_irr_calculation -v

# Test JSON serialization
python -m pytest tests/shared/test_utils.py::test_json_serializer -v
```

## Integration Testing

### Agent Pipeline Testing
```bash
# Test geowiz → curve-smith → reporter pipeline
python -m pytest tests/integration/test_core_pipeline.py -v

# Test full tract evaluation pipeline
python -m pytest tests/integration/test_tract_eval_pipeline.py -v

# Test error handling and recovery
python -m pytest tests/integration/test_error_scenarios.py -v
```

### MCP (Multi-Agent Control Plane) Testing
```bash
# Test agent orchestration
python -m pytest tests/integration/test_mcp_controller.py -v

# Test dynamic routing
python -m pytest tests/integration/test_agent_routing.py -v

# Test state management
python -m pytest tests/integration/test_state_persistence.py -v
```

### External Integration Testing
```bash
# Test with mock external systems
export USE_MOCK_INTEGRATIONS=true
python -m pytest tests/integration/test_external_integrations.py -v

# Test with real systems (requires credentials)
export USE_LIVE_INTEGRATIONS=true
export SPLUNK_HEC_TOKEN=your-token
python -m pytest tests/integration/test_live_integrations.py -v
```

## End-to-End Testing

### Full Pipeline Testing
```bash
# Run complete tract evaluation
export RUN_ID=e2e-test-$(date +%Y%m%d-%H%M%S)
python scripts/test-full-pipeline.sh $RUN_ID

# Validate all outputs
python scripts/validate-pipeline-outputs.py --run-id $RUN_ID

# Check quality gates
bash scripts/quality-gates-check.sh $RUN_ID
```

### Test Scenarios
1. **Successful Tract Evaluation**
   ```bash
   # Run with good synthetic data
   python mcp.py --goal tract_eval --run-id success-test --data-quality good
   ```

2. **Marginal Data Quality**
   ```bash
   # Test with limited/poor quality data
   python mcp.py --goal tract_eval --run-id marginal-test --data-quality poor
   ```

3. **Investment Rejection Scenario**
   ```bash
   # Test with data that should fail investment criteria
   python mcp.py --goal tract_eval --run-id reject-test --economics poor
   ```

### Output Validation
```bash
# Validate geological outputs
python scripts/validate-geology.py --zones zones.geojson --summary geology_summary.md

# Validate economic outputs  
python scripts/validate-economics.py --valuation valuation.json --npv-threshold 300000

# Validate investment decision
python scripts/validate-decision.py --decision investment_decision.json --criteria-file investment_criteria.yaml
```

## Performance Testing

### Load Testing
```bash
# Test with multiple concurrent runs
python scripts/load-test.py --concurrent-runs 10 --duration 600

# Memory usage testing
python -m memory_profiler scripts/memory-test.py --tract-count 100

# Processing time benchmarks
python scripts/benchmark-pipeline.py --iterations 50
```

### Scalability Testing
```bash
# Test with large datasets
python scripts/scalability-test.py --data-size large --tract-count 1000

# Database performance
python scripts/db-performance-test.py --records 100000

# File I/O performance
python scripts/io-performance-test.py --file-count 10000
```

### Performance Metrics
Expected performance benchmarks:
- **Single Tract Analysis**: < 2 minutes end-to-end
- **Memory Usage**: < 1GB per tract
- **Concurrent Processing**: 10 tracts simultaneously
- **Throughput**: 100 tracts/hour on standard hardware

## Security Testing

### Vulnerability Scanning
```bash
# Python security scanning
bandit -r agents/ -f json -o security-report.json

# Dependency vulnerability check
safety check --json

# Secrets detection
gitleaks detect --source . --report-format json --report-path secrets-report.json
```

### Input Validation Testing
```bash
# Test with malicious inputs
python tests/security/test_input_validation.py

# SQL injection testing (for database inputs)
python tests/security/test_sql_injection.py

# File path traversal testing
python tests/security/test_path_traversal.py
```

### Data Privacy Testing
```bash
# PII detection testing
python tests/security/test_pii_detection.py

# Data redaction validation
python tests/security/test_data_redaction.py

# Access control testing
python tests/security/test_access_controls.py
```

## Quality Gates

### Automated Quality Checks
Each agent and pipeline must pass these quality gates:

#### Geological Analysis (geowiz)
```bash
# Confidence threshold check
grep -q "confidence.*0\.[789]" ${OUT_DIR}/geology_summary.md || exit 1

# Formation count validation
python scripts/validate-formations.py --zones ${OUT_DIR}/zones.geojson --min-formations 2

# Depth unit validation
jq -e '.features[0].properties.depth_unit' ${OUT_DIR}/zones.geojson || exit 1
```

#### Curve Quality (curve-smith)
```bash
# RMSE/NRMSE validation
grep -q "RMSE.*NRMSE" ${OUT_DIR}/qc_report.md || exit 1

# Curve completeness check
python scripts/validate-curves.py --curves-dir ${OUT_DIR}/curves --min-completeness 0.8

# Statistical validation
python scripts/validate-statistics.py --qc-report ${OUT_DIR}/qc_report.md
```

#### Economic Analysis (econobot)
```bash
# NPV calculation validation
python scripts/validate-npv.py --valuation ${OUT_DIR}/valuation.json --min-npv 100000

# IRR reasonableness check
python scripts/validate-irr.py --valuation ${OUT_DIR}/valuation.json --min-irr 0.15 --max-irr 0.50

# Cash flow validation
python scripts/validate-cashflow.py --valuation ${OUT_DIR}/valuation.json
```

#### Investment Decision (the-core)
```bash
# Decision completeness
grep -qE "(PROCEED|NO_GO|CONDITIONAL)" ${OUT_DIR}/investment_decision.json || exit 1

# Threshold compliance
python scripts/validate-thresholds.py --decision ${OUT_DIR}/investment_decision.json

# Decision matrix validation
python scripts/validate-decision-matrix.py --matrix ${OUT_DIR}/decision_matrix.md
```

#### Report Quality (reporter)
```bash
# Attribution check
grep -q "SHALE YEAH.*Apache-2.0" ${OUT_DIR}/SHALE_YEAH_REPORT.md || exit 1

# Completeness validation
python scripts/validate-report.py --report ${OUT_DIR}/SHALE_YEAH_REPORT.md

# Data provenance check
python scripts/validate-provenance.py --report ${OUT_DIR}/SHALE_YEAH_REPORT.md
```

## Continuous Integration Testing

### GitHub Actions Workflow
```yaml
# .github/workflows/test.yml
name: Test Suite

on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.9'
      - name: Install dependencies
        run: |
          pip install -r requirements-dev.txt
      - name: Run unit tests
        run: |
          python -m pytest tests/agents/ --cov=agents
  
  integration-tests:
    runs-on: ubuntu-latest
    needs: unit-tests
    steps:
      - uses: actions/checkout@v3
      - name: Setup environment
        run: |
          export TEST_ENV=ci
          export USE_MOCK_INTEGRATIONS=true
      - name: Run integration tests
        run: |
          python -m pytest tests/integration/
  
  e2e-tests:
    runs-on: ubuntu-latest
    needs: [unit-tests, integration-tests]
    steps:
      - uses: actions/checkout@v3
      - name: Run end-to-end tests
        run: |
          bash scripts/test-full-pipeline.sh ci-e2e-test
```

### Test Data Management
```bash
# Generate consistent test data
python scripts/generate-test-data.py --seed 12345 --output tests/data/

# Validate test data integrity
python scripts/validate-test-data.py --data-dir tests/data/

# Clean up test outputs
bash scripts/cleanup-test-outputs.sh
```

## Mock Services

### Mock External Integrations
```python
# tests/mocks/mock_splunk.py
class MockSplunkHEC:
    def __init__(self):
        self.events = []
    
    def send_event(self, event):
        self.events.append(event)
        return {"success": True, "event_id": "mock_123"}
    
    def get_events(self):
        return self.events
```

### Mock Data Sources
```bash
# Generate mock LAS files
python tests/mocks/generate-mock-las.py --output tests/data/mock.las

# Generate mock Access database
python tests/mocks/generate-mock-access.py --output tests/data/mock.accdb
```

## Test Automation Scripts

### Daily Regression Tests
```bash
#!/bin/bash
# scripts/daily-regression.sh

export RUN_ID=regression-$(date +%Y%m%d)
export OUT_DIR=./data/test-outputs/${RUN_ID}

echo "Running daily regression tests..."

# Run unit tests
python -m pytest tests/agents/ --junitxml=test-results/unit-tests.xml

# Run integration tests  
python -m pytest tests/integration/ --junitxml=test-results/integration-tests.xml

# Run full pipeline
python mcp.py --goal tract_eval --run-id $RUN_ID

# Validate outputs
python scripts/validate-regression-outputs.py --run-id $RUN_ID

echo "Regression tests completed. Results in test-results/"
```

### Performance Regression Detection
```bash
#!/bin/bash
# scripts/performance-regression.sh

# Run performance benchmarks
python scripts/benchmark-pipeline.py --output benchmark-results.json

# Compare with baseline
python scripts/compare-performance.py \
  --current benchmark-results.json \
  --baseline performance-baseline.json \
  --threshold 0.1

# Alert if performance degraded > 10%
if [ $? -ne 0 ]; then
  echo "Performance regression detected!"
  exit 1
fi
```

## Debugging Failed Tests

### Test Failure Analysis
```bash
# Run tests with verbose output
python -m pytest tests/agents/test_econobot_agent.py -v -s --tb=long

# Debug specific test failure
python -m pytest tests/agents/test_econobot_agent.py::test_npv_calculation --pdb

# Generate test report
python -m pytest tests/ --html=test-report.html --self-contained-html
```

### Log Analysis
```bash
# View agent logs
tail -f logs/agents/econobot.log

# Analyze MCP controller logs  
grep -E "(ERROR|FAILED)" logs/mcp-controller.log

# Check integration logs
cat logs/integrations/splunk-connector.log | jq '.level == "ERROR"'
```

### Common Test Issues

#### Import Errors
```bash
# Check Python path
echo $PYTHONPATH

# Install missing dependencies
pip install -r requirements-dev.txt

# Fix import paths
export PYTHONPATH="${PYTHONPATH}:${PWD}"
```

#### Data File Issues
```bash
# Check test data integrity
md5sum tests/data/* > tests/data/checksums.md5
md5sum -c tests/data/checksums.md5

# Regenerate test data
python scripts/regenerate-test-data.py
```

#### Environment Issues
```bash
# Check environment variables
env | grep SHALE_YEAH

# Reset test environment
source scripts/reset-test-env.sh

# Clean test artifacts
bash scripts/cleanup-test-artifacts.sh
```

## Test Metrics and Reporting

### Coverage Reports
```bash
# Generate coverage report
python -m pytest --cov=agents --cov=shared --cov-report=html --cov-report=term

# View coverage in browser
open htmlcov/index.html

# Coverage thresholds
python -m pytest --cov=agents --cov-fail-under=80
```

### Test Result Reporting
```bash
# Generate JUnit XML reports
python -m pytest --junitxml=test-results.xml

# Convert to other formats
junit2html test-results.xml test-results.html

# Upload to test reporting service
curl -X POST -F "file=@test-results.xml" https://test-service.company.com/api/upload
```

### Metrics Collection
```bash
# Test execution time tracking
python scripts/collect-test-metrics.py --output test-metrics.json

# Agent performance profiling
python scripts/profile-agent-performance.py --agent econobot --output performance.prof

# Memory usage analysis
python scripts/analyze-memory-usage.py --test-run $RUN_ID
```

---

*For comprehensive testing support, refer to the test scripts in the `scripts/` directory and example test cases in `tests/examples/`.*

Generated with SHALE YEAH (c) Ryan McDonald / Ascendvent LLC - Apache-2.0