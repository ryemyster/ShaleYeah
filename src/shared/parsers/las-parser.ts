/**
 * LAS (Log ASCII Standard) File Parser
 * Parses well log data in LAS format versions 1.2, 2.0, 3.0
 */

import fs from 'fs/promises';
import path from 'path';

export interface LASHeader {
  version: string;
  wrap: boolean;
  delimiter: string;
  wellName?: string;
  company?: string;
  field?: string;
  location?: string;
  date?: string;
  uwi?: string; // Unique Well Identifier
  api?: string; // API number
}

export interface LASCurve {
  mnemonic: string;
  unit: string;
  data: string;
  description: string;
  values?: number[];
}

export interface LASParameter {
  mnemonic: string;
  unit: string;
  value: string;
  description: string;
}

export interface LASWellInfo {
  [key: string]: {
    unit: string;
    value: string;
    description: string;
  };
}

export interface LASData {
  header: LASHeader;
  wellInfo: LASWellInfo;
  curves: LASCurve[];
  parameters: LASParameter[];
  data: number[][];
  depthRange: {
    start: number;
    stop: number;
    step: number;
    unit: string;
  };
  metadata: {
    totalRows: number;
    curveCount: number;
    nullValue: number;
    fileSize: number;
    parseTime: number;
    quality: {
      completeness: number; // 0-1
      hasGammaRay: boolean;
      hasResistivity: boolean;
      hasPorosity: boolean;
      dataGaps: number;
    };
  };
}

export class LASParser {
  private nullValue = -999.25; // Default LAS null value

  async parseLASFile(filePath: string): Promise<LASData> {
    const startTime = Date.now();
    
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const stats = await fs.stat(filePath);
      
      const sections = this.parseIntoSections(content);
      
      const header = this.parseVersionSection(sections.version || '');
      const wellInfo = this.parseWellSection(sections.well || '');
      const curves = this.parseCurveSection(sections.curve || '');
      const parameters = this.parseParameterSection(sections.parameter || '');
      const dataMatrix = this.parseDataSection(sections.data || '', curves, header.wrap);
      
      // Calculate depth range
      const depthRange = this.calculateDepthRange(dataMatrix, curves);
      
      // Populate curve values
      const populatedCurves = this.populateCurveValues(curves, dataMatrix);
      
      // Calculate quality metrics
      const quality = this.assessDataQuality(populatedCurves, dataMatrix);
      
      return {
        header,
        wellInfo,
        curves: populatedCurves,
        parameters,
        data: dataMatrix,
        depthRange,
        metadata: {
          totalRows: dataMatrix.length,
          curveCount: curves.length,
          nullValue: this.nullValue,
          fileSize: stats.size,
          parseTime: Date.now() - startTime,
          quality
        }
      };
      
    } catch (error) {
      throw new Error(`Failed to parse LAS file: ${error}`);
    }
  }

  private parseIntoSections(content: string): Record<string, string> {
    const sections: Record<string, string> = {};
    const lines = content.split('\n');
    let currentSection = '';
    let sectionContent: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      
      // Skip comments and empty lines
      if (!trimmed || trimmed.startsWith('#')) continue;
      
      // Check for section headers
      if (trimmed.startsWith('~')) {
        // Save previous section
        if (currentSection && sectionContent.length > 0) {
          sections[currentSection] = sectionContent.join('\n');
        }
        
        // Start new section
        currentSection = this.extractSectionName(trimmed);
        sectionContent = [];
      } else {
        sectionContent.push(line);
      }
    }
    
    // Save final section
    if (currentSection && sectionContent.length > 0) {
      sections[currentSection] = sectionContent.join('\n');
    }
    
    return sections;
  }

  private extractSectionName(sectionHeader: string): string {
    const match = sectionHeader.match(/~([A-Z]+)/i);
    if (!match) return 'unknown';
    
    const sectionName = match[1].toLowerCase();
    
    // Map common section variations
    const sectionMap: Record<string, string> = {
      'v': 'version',
      'version': 'version',
      'w': 'well',
      'well': 'well',
      'c': 'curve',
      'curve': 'curve',
      'curves': 'curve',
      'p': 'parameter',
      'parameter': 'parameter',
      'parameters': 'parameter',
      'a': 'data',
      'ascii': 'data',
      'data': 'data'
    };
    
    return sectionMap[sectionName] || sectionName;
  }

  private parseVersionSection(content: string): LASHeader {
    const header: LASHeader = {
      version: '2.0',
      wrap: false,
      delimiter: ' '
    };
    
    const lines = content.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      
      const parsed = this.parseInfoLine(trimmed);
      if (!parsed) continue;
      
      switch (parsed.mnemonic.toLowerCase()) {
        case 'vers':
          header.version = parsed.value;
          break;
        case 'wrap':
          header.wrap = parsed.value.toLowerCase() === 'yes';
          break;
        case 'delim':
          header.delimiter = parsed.value === 'TAB' ? '\t' : parsed.value;
          break;
      }
    }
    
    return header;
  }

  private parseWellSection(content: string): LASWellInfo {
    const wellInfo: LASWellInfo = {};
    const lines = content.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      
      const parsed = this.parseInfoLine(trimmed);
      if (!parsed) continue;
      
      wellInfo[parsed.mnemonic] = {
        unit: parsed.unit,
        value: parsed.value,
        description: parsed.description
      };
    }
    
    return wellInfo;
  }

  private parseCurveSection(content: string): LASCurve[] {
    const curves: LASCurve[] = [];
    const lines = content.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      
      const parsed = this.parseInfoLine(trimmed);
      if (!parsed) continue;
      
      curves.push({
        mnemonic: parsed.mnemonic,
        unit: parsed.unit,
        data: parsed.value,
        description: parsed.description
      });
    }
    
    return curves;
  }

  private parseParameterSection(content: string): LASParameter[] {
    const parameters: LASParameter[] = [];
    const lines = content.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      
      const parsed = this.parseInfoLine(trimmed);
      if (!parsed) continue;
      
      parameters.push({
        mnemonic: parsed.mnemonic,
        unit: parsed.unit,
        value: parsed.value,
        description: parsed.description
      });
    }
    
    return parameters;
  }

  private parseInfoLine(line: string): {
    mnemonic: string;
    unit: string;
    value: string;
    description: string;
  } | null {
    // LAS format: MNEM.UNIT VALUE : DESCRIPTION
    const match = line.match(/^([A-Za-z0-9_]+)(?:\.([^.\s]*))?\s+([^:]*?)\s*:\s*(.*)$/);
    
    if (!match) return null;
    
    return {
      mnemonic: match[1].trim(),
      unit: match[2] ? match[2].trim() : '',
      value: match[3].trim(),
      description: match[4].trim()
    };
  }

  private parseDataSection(content: string, curves: LASCurve[], wrap: boolean): number[][] {
    const lines = content.split('\n');
    const data: number[][] = [];
    let currentRow: number[] = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      
      const values = this.parseDataLine(trimmed);
      
      if (wrap) {
        // Handle wrapped data
        currentRow.push(...values);
        
        if (currentRow.length >= curves.length) {
          data.push(currentRow.slice(0, curves.length));
          currentRow = currentRow.slice(curves.length);
        }
      } else {
        // Standard format - one row per line
        if (values.length > 0) {
          data.push(values);
        }
      }
    }
    
    // Handle any remaining wrapped data
    if (wrap && currentRow.length > 0) {
      // Pad with null values if needed
      while (currentRow.length < curves.length) {
        currentRow.push(this.nullValue);
      }
      data.push(currentRow);
    }
    
    return data;
  }

  private parseDataLine(line: string): number[] {
    // Split on whitespace and convert to numbers
    const values: number[] = [];
    const parts = line.split(/\s+/);
    
    for (const part of parts) {
      if (part.trim()) {
        const num = parseFloat(part);
        values.push(isNaN(num) ? this.nullValue : num);
      }
    }
    
    return values;
  }

  private calculateDepthRange(data: number[][], curves: LASCurve[]): {
    start: number;
    stop: number;
    step: number;
    unit: string;
  } {
    if (data.length === 0 || curves.length === 0) {
      return { start: 0, stop: 0, step: 0, unit: '' };
    }
    
    // First curve is typically depth
    const depthValues = data.map(row => row[0]).filter(val => val !== this.nullValue);
    
    if (depthValues.length === 0) {
      return { start: 0, stop: 0, step: 0, unit: curves[0]?.unit || '' };
    }
    
    const start = Math.min(...depthValues);
    const stop = Math.max(...depthValues);
    
    // Calculate average step
    let totalStep = 0;
    let stepCount = 0;
    
    for (let i = 1; i < depthValues.length; i++) {
      const step = Math.abs(depthValues[i] - depthValues[i - 1]);
      if (step > 0 && step < 100) { // Reasonable step size
        totalStep += step;
        stepCount++;
      }
    }
    
    const step = stepCount > 0 ? totalStep / stepCount : 0;
    
    return {
      start,
      stop,
      step,
      unit: curves[0]?.unit || 'FT'
    };
  }

  private populateCurveValues(curves: LASCurve[], data: number[][]): LASCurve[] {
    return curves.map((curve, index) => ({
      ...curve,
      values: data.map(row => row[index] || this.nullValue)
    }));
  }

  private assessDataQuality(curves: LASCurve[], data: number[][]): {
    completeness: number;
    hasGammaRay: boolean;
    hasResistivity: boolean;
    hasPorosity: boolean;
    dataGaps: number;
  } {
    const totalCells = data.length * curves.length;
    const nullCells = data.flat().filter(val => val === this.nullValue).length;
    const completeness = totalCells > 0 ? (totalCells - nullCells) / totalCells : 0;
    
    // Check for common curve types
    const curveNames = curves.map(c => c.mnemonic.toLowerCase());
    const hasGammaRay = curveNames.some(name => 
      ['gr', 'gamma', 'gamma_ray', 'cgr'].includes(name)
    );
    const hasResistivity = curveNames.some(name => 
      ['rt', 'res', 'resistivity', 'lld', 'lls', 'ild'].includes(name)
    );
    const hasPorosity = curveNames.some(name => 
      ['por', 'poro', 'porosity', 'nphi', 'phie'].includes(name)
    );
    
    // Count data gaps (consecutive null values)
    let dataGaps = 0;
    if (data.length > 0) {
      for (let col = 0; col < curves.length; col++) {
        let inGap = false;
        for (let row = 0; row < data.length; row++) {
          const isNull = data[row][col] === this.nullValue;
          if (isNull && !inGap) {
            dataGaps++;
            inGap = true;
          } else if (!isNull) {
            inGap = false;
          }
        }
      }
    }
    
    return {
      completeness,
      hasGammaRay,
      hasResistivity,
      hasPorosity,
      dataGaps
    };
  }

  /**
   * Extract summary statistics for a specific curve
   */
  getCurveStatistics(curve: LASCurve): {
    min: number;
    max: number;
    mean: number;
    stdDev: number;
    nullCount: number;
    validCount: number;
  } {
    if (!curve.values) {
      return { min: 0, max: 0, mean: 0, stdDev: 0, nullCount: 0, validCount: 0 };
    }
    
    const validValues = curve.values.filter(val => val !== this.nullValue);
    const nullCount = curve.values.length - validValues.length;
    
    if (validValues.length === 0) {
      return { min: 0, max: 0, mean: 0, stdDev: 0, nullCount, validCount: 0 };
    }
    
    const min = Math.min(...validValues);
    const max = Math.max(...validValues);
    const mean = validValues.reduce((sum, val) => sum + val, 0) / validValues.length;
    
    const variance = validValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / validValues.length;
    const stdDev = Math.sqrt(variance);
    
    return {
      min,
      max,
      mean,
      stdDev,
      nullCount,
      validCount: validValues.length
    };
  }
}