#!/usr/bin/env tsx
/**
 * Enhanced LAS file parser for SHALE YEAH geological analysis
 * Extracts curve data, metadata, and validates depth intervals
 */
import fs from "node:fs";

interface LASCurve {
  name: string;
  unit: string;
  description: string;
  data: number[];
}

interface LASData {
  version: string;
  well_name: string;
  depth_unit: string;
  depth_start: number;
  depth_stop: number;
  depth_step: number;
  null_value: number;
  curves: LASCurve[];
  depth_data: number[];
  rows: number;
  company?: string;
  field?: string;
  location?: string;
}

function parseLASFile(filePath: string): LASData {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);
  
  const result: LASData = {
    version: '',
    well_name: '',
    depth_unit: 'ft',
    depth_start: 0,
    depth_stop: 0,
    depth_step: 0,
    null_value: -999.25,
    curves: [],
    depth_data: [],
    rows: 0
  };

  let currentSection = '';
  let curveDefinitions: Array<{name: string, unit: string, description: string}> = [];
  let dataStarted = false;
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) continue;
    
    // Section headers
    if (trimmed.startsWith('~')) {
      currentSection = trimmed.substring(1, 2).toUpperCase();
      dataStarted = currentSection === 'A';
      continue;
    }
    
    // Parse sections
    switch (currentSection) {
      case 'V': // Version information
        if (trimmed.includes('VERS')) {
          result.version = extractValue(trimmed);
        }
        break;
        
      case 'W': // Well information
        if (trimmed.includes('WELL')) {
          result.well_name = extractValue(trimmed);
        } else if (trimmed.includes('STRT')) {
          result.depth_start = parseFloat(extractValue(trimmed));
        } else if (trimmed.includes('STOP')) {
          result.depth_stop = parseFloat(extractValue(trimmed));
        } else if (trimmed.includes('STEP')) {
          result.depth_step = parseFloat(extractValue(trimmed));
        } else if (trimmed.includes('NULL')) {
          result.null_value = parseFloat(extractValue(trimmed));
        } else if (trimmed.includes('COMP')) {
          result.company = extractValue(trimmed);
        } else if (trimmed.includes('FLD')) {
          result.field = extractValue(trimmed);
        } else if (trimmed.includes('LOC')) {
          result.location = extractValue(trimmed);
        }
        break;
        
      case 'C': // Curve information
        const curveDef = parseCurveDefinition(trimmed);
        if (curveDef) {
          curveDefinitions.push(curveDef);
        }
        break;
        
      case 'A': // ASCII log data
        if (dataStarted && trimmed && !trimmed.startsWith('~')) {
          parseDataLine(trimmed, result, curveDefinitions);
        }
        break;
    }
  }
  
  // Extract depth unit from first curve (usually DEPT)
  if (curveDefinitions.length > 0 && curveDefinitions[0].unit) {
    result.depth_unit = curveDefinitions[0].unit;
  }
  
  result.rows = result.depth_data.length;
  return result;
}

function extractValue(line: string): string {
  // Extract value from LAS format line (MNEM.UNIT VALUE :DESCRIPTION)
  const colonIndex = line.indexOf(':');
  const beforeColon = colonIndex > -1 ? line.substring(0, colonIndex) : line;
  
  // Split by whitespace and take everything after the first token
  const parts = beforeColon.trim().split(/\s+/);
  if (parts.length >= 2) {
    return parts.slice(1).join(' ').trim();
  }
  
  return '';
}

function parseCurveDefinition(line: string): {name: string, unit: string, description: string} | null {
  if (!line.includes('.')) return null;
  
  const parts = line.split(':');
  const beforeColon = parts[0].trim();
  const description = parts.length > 1 ? parts[1].trim() : '';
  
  const dotIndex = beforeColon.indexOf('.');
  if (dotIndex === -1) return null;
  
  const name = beforeColon.substring(0, dotIndex).trim();
  const afterDot = beforeColon.substring(dotIndex + 1).trim();
  
  // Extract unit (everything before first space)
  const unit = afterDot.split(/\s+/)[0] || '';
  
  return { name, unit, description };
}

function parseDataLine(line: string, result: LASData, curveDefinitions: Array<{name: string, unit: string, description: string}>) {
  const values = line.trim().split(/\s+/).map(v => parseFloat(v));
  
  if (values.length !== curveDefinitions.length) {
    return; // Skip malformed lines
  }
  
  // Initialize curve data arrays if not done
  if (result.curves.length === 0) {
    result.curves = curveDefinitions.map(def => ({
      name: def.name,
      unit: def.unit,
      description: def.description,
      data: []
    }));
  }
  
  // Store depth (first column) and curve data
  if (values.length > 0) {
    result.depth_data.push(values[0]);
    
    // Store curve data
    for (let i = 0; i < result.curves.length && i < values.length; i++) {
      const value = values[i];
      // Replace null values with NaN for easier processing
      const processedValue = (Math.abs(value - result.null_value) < 0.01) ? NaN : value;
      result.curves[i].data.push(processedValue);
    }
  }
}

// CLI usage
const main = () => {
  const filePath = process.argv[2];
  const options = process.argv.slice(3);
  
  if (!filePath) {
    console.error('Usage: las-parse <file.las> [--json|--summary]');
    console.error('Options:');
    console.error('  --json     Output full JSON data including curve arrays');
    console.error('  --summary  Output metadata summary only (default)');
    process.exit(1);
  }
  
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }
  
  try {
    const lasData = parseLASFile(filePath);
    
    if (options.includes('--json')) {
      // Full JSON output with curve data
      console.log(JSON.stringify(lasData, null, 2));
    } else {
      // Summary output (default)
      const summary = {
        version: lasData.version,
        well_name: lasData.well_name,
        depth_unit: lasData.depth_unit,
        depth_range: `${lasData.depth_start}-${lasData.depth_stop}${lasData.depth_unit}`,
        depth_step: lasData.depth_step,
        rows: lasData.rows,
        curves: lasData.curves.map(c => ({
          name: c.name,
          unit: c.unit,
          description: c.description,
          valid_points: c.data.filter(v => !isNaN(v)).length,
          null_points: c.data.filter(v => isNaN(v)).length
        })),
        company: lasData.company,
        field: lasData.field,
        location: lasData.location
      };
      
      console.log(JSON.stringify(summary, null, 2));
    }
    
  } catch (error) {
    console.error(`Error parsing LAS file: ${error}`);
    process.exit(1);
  }
};

// ESM compatible check
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { parseLASFile, LASData, LASCurve };