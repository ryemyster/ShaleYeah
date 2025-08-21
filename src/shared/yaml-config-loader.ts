/**
 * Unified YAML Configuration Loader
 * DRY principle: Consolidates YAML loading and validation logic across the codebase
 */

import fs from 'fs/promises';
import path from 'path';
import YAML from 'yaml';
import type { AgentConfig } from './types.js';
import type { MCPAgentResourceConfig } from './mcp-types.js';

export interface YAMLValidationRule {
  field: string;
  required: boolean;
  type?: 'string' | 'number' | 'boolean' | 'object' | 'array';
  validator?: (value: any) => boolean;
  errorMessage?: string;
}

export interface YAMLLoadOptions {
  encoding?: 'utf8' | 'ascii';
  validateRequired?: boolean;
  allowPartial?: boolean;
  throwOnError?: boolean;
  transformKeys?: boolean; // Convert kebab-case to camelCase
}

export interface YAMLDirectoryLoadOptions extends YAMLLoadOptions {
  filePattern?: RegExp;
  recursive?: boolean;
  maxDepth?: number;
  ignoreDirs?: string[];
}

export interface YAMLValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  data?: any;
}

export class YAMLConfigLoader {
  private static cache = new Map<string, { data: any; mtime: number }>();
  private static defaultOptions: YAMLLoadOptions = {
    encoding: 'utf8',
    validateRequired: true,
    allowPartial: false,
    throwOnError: true,
    transformKeys: false
  };

  /**
   * Load a single YAML file with validation and caching
   */
  static async loadFile<T = any>(
    filePath: string,
    validationRules?: YAMLValidationRule[],
    options: YAMLLoadOptions = {}
  ): Promise<T> {
    const fullOptions = { ...this.defaultOptions, ...options };
    const absolutePath = path.resolve(filePath);

    // Check cache first
    if (this.cache.has(absolutePath)) {
      const cached = this.cache.get(absolutePath)!;
      try {
        const stats = await fs.stat(absolutePath);
        if (stats.mtimeMs === cached.mtime) {
          return cached.data as T;
        }
      } catch {
        // File doesn't exist anymore, remove from cache
        this.cache.delete(absolutePath);
      }
    }

    try {
      const content = await fs.readFile(absolutePath, fullOptions.encoding);
      let data = YAML.parse(content.toString());

      // Transform keys if requested
      if (fullOptions.transformKeys && typeof data === 'object' && data !== null) {
        data = this.transformObjectKeys(data);
      }

      // Validate if rules provided
      if (validationRules && fullOptions.validateRequired) {
        const validation = this.validateData(data, validationRules);
        if (!validation.valid) {
          const error = new Error(`YAML validation failed for ${filePath}: ${validation.errors.join(', ')}`);
          if (fullOptions.throwOnError) {
            throw error;
          }
          if (!fullOptions.allowPartial) {
            throw error;
          }
        }
      }

      // Cache the result
      try {
        const stats = await fs.stat(absolutePath);
        this.cache.set(absolutePath, { data, mtime: stats.mtimeMs });
      } catch {
        // Can't stat file, don't cache
      }

      return data as T;
    } catch (error) {
      if (fullOptions.throwOnError) {
        throw new Error(`Failed to load YAML file ${filePath}: ${error}`);
      }
      return {} as T;
    }
  }

  /**
   * Load all YAML files from a directory
   */
  static async loadDirectory<T = any>(
    dirPath: string,
    validationRules?: YAMLValidationRule[],
    options: YAMLDirectoryLoadOptions = {}
  ): Promise<Map<string, T>> {
    const fullOptions = { 
      ...this.defaultOptions, 
      filePattern: /\.(yaml|yml)$/i,
      recursive: false,
      maxDepth: 1,
      ignoreDirs: ['node_modules', '.git', 'dist', 'build'],
      ...options 
    };

    const results = new Map<string, T>();
    
    try {
      await this.loadDirectoryRecursive(
        path.resolve(dirPath), 
        results, 
        validationRules, 
        fullOptions, 
        0
      );
    } catch (error) {
      if (fullOptions.throwOnError) {
        throw new Error(`Failed to load YAML directory ${dirPath}: ${error}`);
      }
    }

    return results;
  }

  private static async loadDirectoryRecursive<T>(
    dirPath: string,
    results: Map<string, T>,
    validationRules?: YAMLValidationRule[],
    options: YAMLDirectoryLoadOptions = {},
    depth: number = 0
  ): Promise<void> {
    if (options.maxDepth && depth > options.maxDepth) {
      return;
    }

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isFile() && options.filePattern!.test(entry.name)) {
          try {
            const data = await this.loadFile<T>(fullPath, validationRules, options);
            const key = this.generateMapKey(fullPath, dirPath);
            results.set(key, data);
          } catch (error) {
            console.warn(`⚠️  Failed to load YAML file ${entry.name}:`, error);
            if (!options.allowPartial) {
              throw error;
            }
          }
        } else if (entry.isDirectory() && options.recursive) {
          if (!options.ignoreDirs?.includes(entry.name)) {
            await this.loadDirectoryRecursive(fullPath, results, validationRules, options, depth + 1);
          }
        }
      }
    } catch (error) {
      if (options.throwOnError) {
        throw error;
      }
    }
  }

  /**
   * Load agent configurations with standardized validation
   */
  static async loadAgentConfigs(
    agentsDir: string,
    options: YAMLDirectoryLoadOptions = {}
  ): Promise<Map<string, AgentConfig & MCPAgentResourceConfig>> {
    const agentValidationRules: YAMLValidationRule[] = [
      { field: 'name', required: true, type: 'string' },
      { field: 'description', required: false, type: 'string' },
      { field: 'persona', required: false, type: 'object' },
      { field: 'resources', required: false, type: 'object' },
      { field: 'cli', required: false, type: 'object' },
      { field: 'errorHandling', required: false, type: 'object' }
    ];

    const agentOptions: YAMLDirectoryLoadOptions = {
      validateRequired: true,
      allowPartial: true, // Allow agents with missing optional fields
      transformKeys: true, // Convert YAML kebab-case to JS camelCase
      ...options
    };

    return await this.loadDirectory<AgentConfig & MCPAgentResourceConfig>(
      agentsDir,
      agentValidationRules,
      agentOptions
    );
  }

  /**
   * Validate YAML data against rules
   */
  static validateData(data: any, rules: YAMLValidationRule[]): YAMLValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const rule of rules) {
      const value = this.getNestedValue(data, rule.field);

      // Required field check
      if (rule.required && (value === undefined || value === null)) {
        errors.push(rule.errorMessage || `Required field '${rule.field}' is missing`);
        continue;
      }

      // Skip validation if field is optional and missing
      if (!rule.required && (value === undefined || value === null)) {
        continue;
      }

      // Type validation
      if (rule.type && !this.validateType(value, rule.type)) {
        errors.push(rule.errorMessage || `Field '${rule.field}' must be of type ${rule.type}, got ${typeof value}`);
        continue;
      }

      // Custom validator
      if (rule.validator && !rule.validator(value)) {
        errors.push(rule.errorMessage || `Field '${rule.field}' failed custom validation`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      data: errors.length === 0 ? data : undefined
    };
  }

  /**
   * Clear file cache (useful for testing or development)
   */
  static clearCache(filePath?: string): void {
    if (filePath) {
      this.cache.delete(path.resolve(filePath));
    } else {
      this.cache.clear();
    }
  }

  /**
   * Get cache statistics
   */
  static getCacheStats(): { size: number; files: string[] } {
    return {
      size: this.cache.size,
      files: Array.from(this.cache.keys())
    };
  }

  private static generateMapKey(fullPath: string, basePath: string): string {
    const relativePath = path.relative(basePath, fullPath);
    return path.basename(relativePath, path.extname(relativePath));
  }

  private static getNestedValue(obj: any, fieldPath: string): any {
    return fieldPath.split('.').reduce((current, key) => current?.[key], obj);
  }

  private static validateType(value: any, expectedType: string): boolean {
    switch (expectedType) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number';
      case 'boolean':
        return typeof value === 'boolean';
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      case 'array':
        return Array.isArray(value);
      default:
        return true;
    }
  }

  private static transformObjectKeys(obj: any): any {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.transformObjectKeys(item));
    }

    const transformed: any = {};
    for (const [key, value] of Object.entries(obj)) {
      const camelKey = this.kebabToCamel(key);
      transformed[camelKey] = this.transformObjectKeys(value);
    }
    
    return transformed;
  }

  private static kebabToCamel(str: string): string {
    return str.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
  }
}

/**
 * Convenience functions for common YAML loading patterns
 */
export class YAMLLoaderHelpers {
  /**
   * Load single agent configuration
   */
  static async loadAgentConfig(filePath: string): Promise<AgentConfig & MCPAgentResourceConfig> {
    return await YAMLConfigLoader.loadFile<AgentConfig & MCPAgentResourceConfig>(
      filePath,
      [
        { field: 'name', required: true, type: 'string' },
        { field: 'description', required: false, type: 'string' }
      ],
      { transformKeys: true }
    );
  }

  /**
   * Load pipeline configuration  
   */
  static async loadPipelineConfig(filePath: string): Promise<any> {
    return await YAMLConfigLoader.loadFile(
      filePath,
      [
        { field: 'name', required: true, type: 'string' },
        { field: 'stages', required: true, type: 'array' }
      ]
    );
  }

  /**
   * Load configuration with environment variable substitution
   */
  static async loadConfigWithEnvSubstitution(filePath: string): Promise<any> {
    const rawContent = await fs.readFile(filePath, 'utf8');
    
    // Replace environment variables in YAML content
    const processedContent = rawContent.replace(/\$\{([^}]+)\}/g, (match, varName) => {
      return process.env[varName] || match;
    });
    
    return YAML.parse(processedContent);
  }
}