# SHALE YEAH – Evaluation Spec

## 🧠 Purpose

Define the evaluations, tests, and success criteria for each core SHALE YEAH agent and their orchestration. This includes human-like validation, file integrity, scoring accuracy, and cross-agent behavior.

---

## 🧪 Core Agent Evaluations

### `geowiz`

* ✅ Formation scores match public overlays within ±5% (against known DSUs)
* ✅ zones.geojson includes valid CRS and depth\_unit
* ✅ PNG/overlay visual matches shapefile bounds

### `drillcast`

* ✅ Forecast includes wells per year, operator tag, and formation
* ✅ Outputs reflect known patterns (e.g. 8 wells/DSU/2yrs in Permian)

### `titletracker`

* ✅ Extracts owner name, NMA, % interest, and lease status from at least 3 formats (PDF, OCR, DOCX)
* ✅ NMA sum matches DSU estimate within ±10%

### `econobot`

* ✅ Outputs PPA, NPV, and type curves with RMSE < 0.12 (against sample data)
* ✅ Economic forecast CSV and PNG exported

### `revcalc`

* ✅ NRI, WI, and revenue forecast totals match econobot
* ✅ Monthly cash flow rows = months in forecast

### `notarybot`

* ✅ LOI file includes offer value, signer, and terms
* ✅ Markdown to PDF conversion preserves key data

### `pulserig`

* ✅ Variance alerts triggered at ±15% delta
* ✅ Flagged assets appear in asset\_status.csv

### `reporter`

* ✅ All agent outputs logged with path + count
* ✅ SHALE\_YEAH\_REPORT.md includes credit footer

### `investor-notifier`

* ✅ investor\_memo.pdf summarizes top 3 assets by ROI, PPA
* ✅ Memo includes key visuals if present (map, curve)

---

## 🔄 Orchestration Evaluations

### `tract_eval`

* ✅ Tract moves from shapefile to LOI or valid rejection with reason
* ✅ Risk score + valuation align with decision
* ✅ Outputs: report.md, loi.pdf, risk.json

### `investment_batch`

* ✅ At least 3 tracts scored + ranked
* ✅ Shortlist.csv generated
* ✅ investor-notifier memo includes tract summaries

### `research_and_expand`

* ✅ RFC includes ≥2 vendor links + auth model
* ✅ agent-forge YAML passes syntax parse

---

## 🧪 Eval Types

* ⚙️ Structural: file type, format, schema
* 📊 Statistical: score accuracy, error bounds, matching known baselines
* 🧠 Semantic: LLM output clarity, risk/reward logic, consistency
* 📤 Output coverage: report contents, attachments, credit footer

---

## 📂 Output Paths to Validate

* `zones.geojson`, `valuation.json`, `loi.pdf`, `SHALE_YEAH_REPORT.md`, `investor_memo.pdf`

---

## 🧠 Scoring Benchmarks

Each agent includes optional `--eval-mode` that checks output vs ground truth.

* Score ≥90% match to test set = PASS
* RMSE/NRMSE thresholds per curve, PPA delta ≤ 8%
* “Pass” if all outputs present and explainable

---

## ✅ Eval Run Instructions

```bash
export RUN_ID=test_eval
npx claude-flow run pipelines/shale.yaml --vars RUN_ID=$RUN_ID --eval-mode
bash scripts/check-evals.sh $RUN_ID
```

---

This spec ensures SHALE YEAH agents and workflows behave like real analysts with traceable, auditable, and reproducible results.
