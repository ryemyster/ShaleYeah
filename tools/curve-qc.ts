#!/usr/bin/env tsx
/**
 * SHALE YEAH Curve Quality Control (TypeScript)
 * 
 * Computes RMSE and NRMSE for curve analysis and validation
 * Replaces curve-qc.py with modern TypeScript implementation
 */

import fs from "node:fs";
import { parseLASFile, type LASData } from './las-parse.js';

interface QCMetrics {
  rmse: number;
  nrmse: number;
}

interface CurveAnalysis {
  curve: string;
  totalPoints: number;
  validPoints: number;
  minValue: number;
  maxValue: number;
  meanValue: number;
  depthStart: number;
  depthStop: number;
  depthStep: number;
  rmse?: number;
  nrmse?: number;
  error?: string;
  availableCurves?: string[];
}

/**
 * Compute Root Mean Square Error (RMSE) and Normalized RMSE (NRMSE)
 */
function computeRMSE_NRMSE(values: number[], fittedValues: number[]): QCMetrics {
  if (values.length !== fittedValues.length || values.length === 0) {
    return { rmse: NaN, nrmse: NaN };
  }

  // Remove NaN values
  const validPairs: [number, number][] = [];
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    const f = fittedValues[i];
    if (!isNaN(v) && !isNaN(f)) {
      validPairs.push([v, f]);
    }
  }

  if (validPairs.length === 0) {
    return { rmse: NaN, nrmse: NaN };
  }

  // Calculate RMSE
  let sumSquaredErrors = 0;
  const validValues: number[] = [];
  
  for (const [v, f] of validPairs) {
    sumSquaredErrors += (v - f) ** 2;
    validValues.push(v);
  }

  const mse = sumSquaredErrors / validPairs.length;
  const rmse = Math.sqrt(mse);

  // Calculate NRMSE (normalized by range)
  const minValue = Math.min(...validValues);
  const maxValue = Math.max(...validValues);
  const valueRange = maxValue - minValue;
  const nrmse = valueRange > 0 ? rmse / valueRange : NaN;

  return { rmse, nrmse };
}

/**
 * Create a simple fitted curve using linear trend (for demonstration)
 */
function createLinearFit(values: number[]): number[] {
  if (values.length <= 1) {
    return values.slice();
  }

  // Filter out NaN values to calculate slope
  const validValues = values.filter(v => !isNaN(v));
  if (validValues.length < 2) {
    return values.slice();
  }

  const slope = (validValues[validValues.length - 1] - validValues[0]) / validValues.length;
  const startValue = validValues[0];

  return values.map((_, i) => startValue + slope * i);
}

/**
 * Analyze a specific curve in a LAS file
 */
function analyzeLASCurve(filePath: string, curveName: string): CurveAnalysis {
  try {
    // Parse LAS file using our existing parser
    const lasData: LASData = parseLASFile(filePath);
    
    // Find the requested curve
    const curve = lasData.curves.find(c => c.name.toUpperCase() === curveName.toUpperCase());
    
    if (!curve) {
      const availableCurves = lasData.curves.map(c => c.name);
      return {
        curve: curveName,
        error: `Curve '${curveName}' not found. Available curves: ${availableCurves.join(', ')}`,
        availableCurves,
        totalPoints: 0,
        validPoints: 0,
        minValue: 0,
        maxValue: 0,
        meanValue: 0,
        depthStart: 0,
        depthStop: 0,
        depthStep: 0
      };
    }

    // Get valid data points (filter out NaN)
    const validData = curve.data.filter(v => !isNaN(v));
    
    if (validData.length === 0) {
      return {
        curve: curveName,
        error: `No valid data points for curve '${curveName}'`,
        totalPoints: curve.data.length,
        validPoints: 0,
        minValue: 0,
        maxValue: 0,
        meanValue: 0,
        depthStart: lasData.depth_start,
        depthStop: lasData.depth_stop,
        depthStep: lasData.depth_step
      };
    }

    // Calculate basic statistics
    const minValue = Math.min(...validData);
    const maxValue = Math.max(...validData);
    const meanValue = validData.reduce((sum, v) => sum + v, 0) / validData.length;

    const analysis: CurveAnalysis = {
      curve: curveName,
      totalPoints: curve.data.length,
      validPoints: validData.length,
      minValue,
      maxValue,
      meanValue,
      depthStart: lasData.depth_start,
      depthStop: lasData.depth_stop,
      depthStep: lasData.depth_step
    };

    // Create fitted curve and compute QC metrics
    if (validData.length > 1) {
      const fittedValues = createLinearFit(curve.data);
      const qcMetrics = computeRMSE_NRMSE(curve.data, fittedValues);
      
      analysis.rmse = qcMetrics.rmse;
      analysis.nrmse = qcMetrics.nrmse;
    } else {
      analysis.rmse = 0;
      analysis.nrmse = 0;
    }

    return analysis;

  } catch (error) {
    return {
      curve: curveName,
      error: `Failed to analyze LAS file: ${error}`,
      totalPoints: 0,
      validPoints: 0,
      minValue: 0,
      maxValue: 0,
      meanValue: 0,
      depthStart: 0,
      depthStop: 0,
      depthStep: 0
    };
  }
}

/**
 * CLI usage
 */
const main = () => {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.error('Usage: curve-qc <file.las> CURVE=<curve_name>');
    console.error('Example: curve-qc demo.las CURVE=GR');
    process.exit(1);
  }

  const filePath = args[0];
  const curveArg = args[1];

  if (!fs.existsSync(filePath)) {
    console.error(`Error: File '${filePath}' not found`);
    process.exit(1);
  }

  if (!curveArg.startsWith('CURVE=')) {
    console.error('Error: Second argument must be CURVE=<curve_name>');
    process.exit(1);
  }

  const curveName = curveArg.split('=')[1];
  
  if (!curveName) {
    console.error('Error: Curve name cannot be empty');
    process.exit(1);
  }

  try {
    const result = analyzeLASCurve(filePath, curveName);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(`Error analyzing curve: ${error}`);
    process.exit(1);
  }
};

// ESM compatible check
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { analyzeLASCurve, computeRMSE_NRMSE, type CurveAnalysis, type QCMetrics };