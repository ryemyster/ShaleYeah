/**
 * File Format Detection and Metadata Extraction
 * Identifies and validates oil & gas industry file formats
 */

import fs from 'fs/promises';
import path from 'path';

export interface FileMetadata {
  format: string;
  subtype?: string;
  version?: string;
  size: number;
  lastModified: Date;
  parsed: boolean;
  isValid: boolean;
  metadata: Record<string, any>;
  errors?: string[];
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  confidence: number;
}

export class FileFormatDetector {
  private static readonly FORMAT_SIGNATURES: Record<string, {
    extensions: string[];
    magicBytes: Buffer | null;
    headerPattern: RegExp | null;
    description: string;
    validator?: (buffer: Buffer) => boolean;
  }> = {
    // Well Log Formats
    las: {
      extensions: ['.las'],
      magicBytes: null,
      headerPattern: /^~VERSION INFORMATION/i,
      description: 'Log ASCII Standard well log file'
    },
    dlis: {
      extensions: ['.dlis'],
      magicBytes: Buffer.from([0x20, 0x00, 0x00, 0x00]),
      headerPattern: null,
      description: 'Digital Log Interchange Standard file'
    },
    witsml: {
      extensions: ['.xml'],
      magicBytes: null,
      headerPattern: /<\?xml.*witsml/i,
      description: 'WITSML XML well data'
    },

    // Seismic Formats
    segy: {
      extensions: ['.segy', '.sgy'],
      magicBytes: null,
      headerPattern: null,
      description: 'SEG-Y seismic data format',
      validator: (buffer: Buffer) => buffer.length >= 3600 // Minimum for headers
    },

    // GIS Formats
    shapefile: {
      extensions: ['.shp'],
      magicBytes: Buffer.from([0x00, 0x00, 0x27, 0x0a]),
      headerPattern: null,
      description: 'ESRI Shapefile'
    },
    geojson: {
      extensions: ['.geojson', '.json'],
      magicBytes: null,
      headerPattern: /^\s*\{\s*"type"\s*:\s*["']FeatureCollection["']/i,
      description: 'GeoJSON geographic data'
    },
    kml: {
      extensions: ['.kml'],
      magicBytes: null,
      headerPattern: /<kml\s/i,
      description: 'Keyhole Markup Language'
    },

    // Reservoir Formats
    grdecl: {
      extensions: ['.grdecl', '.inc'],
      magicBytes: null,
      headerPattern: /^(SPECGRID|COORD|ZCORN|ACTNUM|PORO|PERMX)/im,
      description: 'Eclipse reservoir grid format'
    },

    // Spreadsheet & Document Formats
    excel: {
      extensions: ['.xlsx', '.xls'],
      magicBytes: Buffer.from([0x50, 0x4B, 0x03, 0x04]), // ZIP signature for .xlsx
      headerPattern: null,
      description: 'Microsoft Excel spreadsheet'
    },
    csv: {
      extensions: ['.csv'],
      magicBytes: null,
      headerPattern: null,
      description: 'Comma-separated values'
    },

    // Image/Raster Formats
    geotiff: {
      extensions: ['.tif', '.tiff', '.geotiff'],
      magicBytes: Buffer.from([0x49, 0x49, 0x2A, 0x00]), // TIFF little-endian
      headerPattern: null,
      description: 'GeoTIFF raster image'
    },

    // Database Formats
    access: {
      extensions: ['.mdb', '.accdb'],
      magicBytes: Buffer.from([0x00, 0x01, 0x00, 0x00]), // Simplified signature
      headerPattern: null,
      description: 'Microsoft Access database'
    }
  };

  /**
   * Detect file format based on extension, magic bytes, and content
   */
  async detectFormat(filePath: string): Promise<FileMetadata> {
    try {
      const stats = await fs.stat(filePath);
      const ext = path.extname(filePath).toLowerCase();
      
      // Read first 1KB for header analysis
      const buffer = await this.readFileHeader(filePath, 1024);
      
      // Detect format
      const format = await this.identifyFormat(filePath, buffer);
      
      // Extract metadata
      const metadata = await this.extractBasicMetadata(filePath, format, buffer);

      return {
        format: format.name,
        subtype: format.subtype,
        version: format.version,
        size: stats.size,
        lastModified: stats.mtime,
        parsed: false,
        isValid: format.isValid,
        metadata,
        errors: format.errors
      };

    } catch (error) {
      return {
        format: 'unknown',
        size: 0,
        lastModified: new Date(),
        parsed: false,
        isValid: false,
        metadata: {},
        errors: [`Failed to detect format: ${error}`]
      };
    }
  }

  /**
   * Validate file format against expected type
   */
  async validateFormat(filePath: string, expectedFormat: string): Promise<ValidationResult> {
    try {
      const detected = await this.detectFormat(filePath);
      
      const isValid = detected.format === expectedFormat && detected.isValid;
      const errors = detected.errors || [];
      const warnings: string[] = [];

      if (!isValid && detected.format !== expectedFormat) {
        errors.push(`Expected ${expectedFormat}, detected ${detected.format}`);
      }

      // Add format-specific validations
      if (isValid) {
        const specificValidation = await this.validateFormatSpecific(filePath, expectedFormat);
        errors.push(...specificValidation.errors);
        warnings.push(...specificValidation.warnings);
      }

      return {
        isValid: isValid && errors.length === 0,
        errors,
        warnings,
        confidence: this.calculateConfidence(detected, expectedFormat)
      };

    } catch (error) {
      return {
        isValid: false,
        errors: [`Validation failed: ${error}`],
        warnings: [],
        confidence: 0
      };
    }
  }

  /**
   * Extract comprehensive metadata from file
   */
  async extractMetadata(filePath: string): Promise<Record<string, any>> {
    const detected = await this.detectFormat(filePath);
    
    const baseMetadata = {
      filePath,
      fileName: path.basename(filePath),
      format: detected.format,
      size: detected.size,
      lastModified: detected.lastModified
    };

    // Add format-specific metadata
    switch (detected.format) {
      case 'las':
        return { ...baseMetadata, ...(await this.extractLASMetadata(filePath)) };
      case 'shapefile':
        return { ...baseMetadata, ...(await this.extractShapefileMetadata(filePath)) };
      case 'geojson':
        return { ...baseMetadata, ...(await this.extractGeoJSONMetadata(filePath)) };
      case 'excel':
        return { ...baseMetadata, ...(await this.extractExcelMetadata(filePath)) };
      default:
        return baseMetadata;
    }
  }

  private async readFileHeader(filePath: string, bytes: number): Promise<Buffer> {
    try {
      const fileHandle = await fs.open(filePath, 'r');
      const buffer = Buffer.alloc(bytes);
      const { bytesRead } = await fileHandle.read(buffer, 0, bytes, 0);
      await fileHandle.close();
      return buffer.subarray(0, bytesRead);
    } catch (error) {
      return Buffer.alloc(0);
    }
  }

  private async identifyFormat(filePath: string, buffer: Buffer): Promise<{
    name: string;
    subtype?: string;
    version?: string;
    isValid: boolean;
    errors: string[];
  }> {
    const ext = path.extname(filePath).toLowerCase();
    const content = buffer.toString('utf-8', 0, Math.min(512, buffer.length));
    
    // Check each format signature
    for (const [formatName, signature] of Object.entries(FileFormatDetector.FORMAT_SIGNATURES)) {
      // Extension match
      if (signature.extensions.includes(ext)) {
        
        // Magic bytes check
        if (signature.magicBytes && buffer.length >= signature.magicBytes.length) {
          if (buffer.subarray(0, signature.magicBytes.length).equals(signature.magicBytes)) {
            return { name: formatName, isValid: true, errors: [] };
          }
        }
        
        // Header pattern check
        if (signature.headerPattern && signature.headerPattern.test(content)) {
          return { name: formatName, isValid: true, errors: [] };
        }
        
        // Custom validator
        if (signature.validator && signature.validator(buffer)) {
          return { name: formatName, isValid: true, errors: [] };
        }
        
        // Extension match only (lower confidence)
        if (!signature.magicBytes && !signature.headerPattern && !signature.validator) {
          return { name: formatName, isValid: true, errors: [] };
        }
      }
    }

    return { 
      name: 'unknown', 
      isValid: false, 
      errors: [`Unrecognized file format for ${path.basename(filePath)}`] 
    };
  }

  private async extractBasicMetadata(filePath: string, format: any, buffer: Buffer): Promise<Record<string, any>> {
    const metadata: Record<string, any> = {
      encoding: this.detectEncoding(buffer),
      hasHeader: this.hasTextHeader(buffer),
      estimatedRows: format.name === 'csv' ? this.estimateCSVRows(buffer) : null
    };

    // Add format-specific basic metadata
    if (format.name === 'las' && buffer.length > 0) {
      metadata.hasVersionSection = /~VERSION/i.test(buffer.toString('utf-8'));
    }

    return metadata;
  }

  private detectEncoding(buffer: Buffer): string {
    // Simple encoding detection
    const text = buffer.toString('utf-8');
    const hasNullBytes = buffer.includes(0);
    
    if (hasNullBytes) return 'binary';
    if (/^[\x00-\x7F]*$/.test(text)) return 'ascii';
    return 'utf-8';
  }

  private hasTextHeader(buffer: Buffer): boolean {
    const firstLine = buffer.toString('utf-8').split('\n')[0];
    return /^[a-zA-Z~#]/.test(firstLine);
  }

  private estimateCSVRows(buffer: Buffer): number {
    const text = buffer.toString('utf-8');
    const lines = text.split('\n').length;
    // Rough estimate based on first chunk
    const avgBytesPerLine = buffer.length / lines;
    return avgBytesPerLine > 0 ? Math.floor(1024 * 1024 / avgBytesPerLine) : 0;
  }

  private calculateConfidence(detected: FileMetadata, expected: string): number {
    if (detected.format !== expected) return 0;
    if (!detected.isValid) return 0.3;
    if (detected.errors && detected.errors.length > 0) return 0.7;
    return 0.95;
  }

  private async validateFormatSpecific(filePath: string, format: string): Promise<{
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Format-specific validations would go here
    // This is a placeholder for now
    
    return { errors, warnings };
  }

  // Placeholder metadata extractors - will be implemented with parsers
  private async extractLASMetadata(filePath: string): Promise<Record<string, any>> {
    return { curves: [], wellName: 'Unknown', depth: { start: 0, stop: 0, step: 0 } };
  }

  private async extractShapefileMetadata(filePath: string): Promise<Record<string, any>> {
    return { features: 0, geometryType: 'Unknown', bounds: null };
  }

  private async extractGeoJSONMetadata(filePath: string): Promise<Record<string, any>> {
    return { features: 0, crs: 'Unknown' };
  }

  private async extractExcelMetadata(filePath: string): Promise<Record<string, any>> {
    return { sheets: [], rows: 0, columns: 0 };
  }
}