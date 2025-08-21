/**
 * File Utilities - Consolidated file operations
 * Eliminates duplicate fs and path imports across the codebase
 */

import fs from 'fs/promises';
import path from 'path';

/**
 * Common file system operations used throughout the application
 */
export class FileUtils {
  /**
   * Ensure directory exists, create if needed
   */
  static async ensureDirectory(dirPath: string): Promise<void> {
    await fs.mkdir(dirPath, { recursive: true });
  }

  /**
   * Safely read JSON file with error handling
   */
  static async readJSON<T = any>(filePath: string): Promise<T | null> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.warn(`⚠️ Could not read JSON file: ${filePath}`);
      return null;
    }
  }

  /**
   * Safely write JSON file with pretty formatting
   */
  static async writeJSON(filePath: string, data: any): Promise<void> {
    await FileUtils.ensureDirectory(path.dirname(filePath));
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
  }

  /**
   * Read text file with error handling
   */
  static async readText(filePath: string): Promise<string | null> {
    try {
      return await fs.readFile(filePath, 'utf-8');
    } catch (error) {
      console.warn(`⚠️ Could not read text file: ${filePath}`);
      return null;
    }
  }

  /**
   * Write text file with directory creation
   */
  static async writeText(filePath: string, content: string): Promise<void> {
    await FileUtils.ensureDirectory(path.dirname(filePath));
    await fs.writeFile(filePath, content);
  }

  /**
   * Check if file exists
   */
  static async exists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get all files in directory with optional extension filter
   */
  static async getFiles(dirPath: string, extension?: string): Promise<string[]> {
    try {
      const files = await fs.readdir(dirPath);
      if (extension) {
        return files.filter(file => file.endsWith(extension));
      }
      return files;
    } catch {
      return [];
    }
  }

  /**
   * Create multiple directories at once
   */
  static async createDirectories(basePath: string, dirNames: string[]): Promise<void> {
    for (const dirName of dirNames) {
      await FileUtils.ensureDirectory(path.join(basePath, dirName));
    }
  }

  /**
   * Get file extension without dot
   */
  static getExtension(filePath: string): string {
    return path.extname(filePath).slice(1);
  }

  /**
   * Get filename without extension
   */
  static getBasename(filePath: string): string {
    return path.basename(filePath, path.extname(filePath));
  }

  /**
   * Join paths safely
   */
  static joinPath(...segments: string[]): string {
    return path.join(...segments);
  }

  /**
   * Resolve absolute path
   */
  static resolvePath(filePath: string): string {
    return path.resolve(filePath);
  }
}