/**
 * MCP Resource Utilities
 * DRY principle: Consolidates resource URI operations and common patterns
 */

export class MCPResourceUtils {
  private static readonly BASE_URI = 'mcp://shale-data';
  
  /**
   * Standardized URI construction
   */
  static buildUri(category: string, ...parts: string[]): string {
    const cleanParts = parts.map(part => part.replace(/^\/+|\/+$/g, '')); // Remove leading/trailing slashes
    return `${this.BASE_URI}/${category}/${cleanParts.join('/')}`;
  }

  /**
   * Common URI patterns for inputs
   */
  static inputs = {
    lasFiles: (pattern = '**') => this.buildUri('inputs', 'las-files', pattern),
    accessDb: (pattern = '**') => this.buildUri('inputs', 'access-db', pattern),
    config: (name: string) => this.buildUri('inputs', 'config', name),
    samples: (name: string) => this.buildUri('inputs', 'samples', name)
  };

  /**
   * Common URI patterns for outputs
   */
  static outputs = {
    geology: {
      summary: () => this.buildUri('outputs', 'geology-summary.md'),
      zones: () => this.buildUri('outputs', 'zones.geojson'),
      analysis: () => this.buildUri('outputs', 'geological-analysis.json')
    },
    curves: {
      fitted: () => this.buildUri('outputs', 'curves', 'fitted-curves.json'),
      qc: () => this.buildUri('outputs', 'curves', 'qc-report.json'),
      all: (pattern = '**') => this.buildUri('outputs', 'curves', pattern)
    },
    economics: {
      valuation: () => this.buildUri('outputs', 'economics', 'valuation.json'),
      sensitivity: () => this.buildUri('outputs', 'economics', 'sensitivity-analysis.json'),
      summary: () => this.buildUri('outputs', 'economic-summary.md')
    },
    risk: {
      assessment: () => this.buildUri('outputs', 'risk', 'risk-assessment.json'),
      mitigation: () => this.buildUri('outputs', 'risk', 'mitigation-strategies.json'),
      summary: () => this.buildUri('outputs', 'risk-summary.md')
    },
    investment: {
      decision: () => this.buildUri('outputs', 'investment', 'decision.json'),
      actionPlan: () => this.buildUri('outputs', 'investment', 'action-plan.json'),
      summary: () => this.buildUri('outputs', 'investment-decision.md')
    },
    report: {
      final: () => this.buildUri('outputs', 'SHALE_YEAH_REPORT.md'),
      executive: () => this.buildUri('outputs', 'executive-summary.json')
    }
  };

  /**
   * Common URI patterns for state management
   */
  static state = {
    pipeline: () => this.buildUri('state', 'pipeline-state'),
    agents: () => this.buildUri('state', 'agent-status'),
    resources: () => this.buildUri('state', 'resource-status')
  };

  /**
   * Extract meaningful key from URI for data mapping
   */
  static extractKey(uri: string): string {
    const parts = uri.replace(`${this.BASE_URI}/`, '').split('/');
    if (parts.length >= 2) {
      const lastPart = parts[parts.length - 1];
      // Remove file extensions and clean up
      return lastPart.replace(/\.(json|md|geojson|csv)$/, '').replace(/[\*\?]/g, '');
    }
    return uri.split('/').pop()?.replace(/\.(json|md|geojson|csv)$/, '') || uri;
  }

  /**
   * Check if URI matches a pattern
   */
  static matchesPattern(uri: string, pattern: string): boolean {
    // Convert glob pattern to regex with proper escaping
    let regexPattern = pattern
      // Escape special regex chars except * and ?
      .replace(/[.+^${}()|[\]\\]/g, '\\$&');
      
    // Handle glob patterns - ** first to avoid conflicts with *
    regexPattern = regexPattern
      .replace(/\*\*/g, '{{DOUBLE_STAR}}')  // Temporarily replace **
      .replace(/\*/g, '[^/]*')              // Single * matches anything except /
      .replace(/{{DOUBLE_STAR}}/g, '.*')    // ** matches anything including /
      .replace(/\?/g, '.');                 // ? matches single character
    
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(uri);
  }

  /**
   * Parse URI components
   */
  static parseUri(uri: string): {
    base: string;
    category: string;
    subcategory?: string;
    filename?: string;
    extension?: string;
  } {
    if (!uri.startsWith(this.BASE_URI)) {
      throw new Error(`Invalid MCP URI: ${uri}`);
    }

    const path = uri.replace(`${this.BASE_URI}/`, '');
    const parts = path.split('/');
    
    const result: any = {
      base: this.BASE_URI,
      category: parts[0] || ''
    };

    if (parts.length > 1) {
      result.subcategory = parts[1];
    }

    if (parts.length > 2) {
      const lastPart = parts[parts.length - 1];
      const dotIndex = lastPart.lastIndexOf('.');
      
      if (dotIndex > 0) {
        result.filename = lastPart.substring(0, dotIndex);
        result.extension = lastPart.substring(dotIndex + 1);
      } else {
        result.filename = lastPart;
      }
    }

    return result;
  }

  /**
   * Validate URI format
   */
  static isValidUri(uri: string): boolean {
    try {
      this.parseUri(uri);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get file format from URI
   */
  static getFormat(uri: string): 'json' | 'markdown' | 'geojson' | 'csv' | 'binary' {
    const parsed = this.parseUri(uri);
    
    switch (parsed.extension?.toLowerCase()) {
      case 'json': return 'json';
      case 'md': return 'markdown';
      case 'geojson': return 'geojson';
      case 'csv': return 'csv';
      default: return 'binary';
    }
  }

  /**
   * Convert relative path to MCP URI
   */
  static fromPath(category: string, relativePath: string): string {
    return this.buildUri(category, relativePath);
  }

  /**
   * Convert MCP URI to relative path
   */
  static toPath(uri: string): string {
    return uri.replace(`${this.BASE_URI}/`, '');
  }

  /**
   * Common dependency patterns
   */
  static dependencies = {
    geological: () => [
      {
        uri: this.inputs.lasFiles(),
        condition: 'not-empty' as const,
        required: true
      }
    ],
    
    curves: () => [
      {
        uri: this.outputs.geology.zones(),
        condition: 'exists' as const,
        required: true
      },
      {
        uri: this.inputs.lasFiles(),
        condition: 'not-empty' as const,
        required: true
      }
    ],
    
    economics: () => [
      {
        uri: this.outputs.curves.fitted(),
        condition: 'valid-schema' as const,
        required: true
      },
      {
        uri: this.outputs.geology.zones(),
        condition: 'exists' as const,
        required: true
      }
    ],
    
    risk: () => [
      {
        uri: this.outputs.economics.valuation(),
        condition: 'valid-schema' as const,
        required: true
      },
      {
        uri: this.outputs.geology.analysis(),
        condition: 'exists' as const,
        required: true
      }
    ],
    
    decision: () => [
      {
        uri: this.outputs.economics.summary(),
        condition: 'not-empty' as const,
        required: true
      },
      {
        uri: this.outputs.risk.summary(),
        condition: 'not-empty' as const,
        required: true
      }
    ],
    
    reporting: () => [
      {
        uri: this.buildUri('outputs', '**'),
        condition: 'exists' as const,
        required: false
      }
    ]
  };
}