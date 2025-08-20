/**
 * MCP Resource Server Implementation
 * File-system based resource backend with proper MCP patterns
 */

import fs from 'fs/promises';
import path from 'path';
import { EventEmitter } from 'events';
import type { 
  MCPResource, 
  MCPResourceServer, 
  MCPResourceMeta, 
  MCPResourceEvent 
} from './mcp-types.js';

export class FileSystemMCPResourceServer extends EventEmitter implements MCPResourceServer {
  private resourceRoot: string;
  private watchers = new Map<string, NodeJS.Timeout>();
  private resourceCache = new Map<string, MCPResource>();
  private initialized = false;

  constructor(resourceRoot: string) {
    super();
    this.resourceRoot = path.resolve(resourceRoot);
  }

  async initialize(): Promise<void> {
    await fs.mkdir(this.resourceRoot, { recursive: true });
    await this.setupResourceStructure();
    await this.indexExistingResources();
    this.initialized = true;
    console.log(`🔧 MCP Resource Server initialized at: ${this.resourceRoot}`);
  }

  async shutdown(): Promise<void> {
    // Clear all watchers
    for (const [uri, timeout] of this.watchers) {
      clearTimeout(timeout);
    }
    this.watchers.clear();
    this.resourceCache.clear();
    this.initialized = false;
  }

  private async setupResourceStructure(): Promise<void> {
    const dirs = [
      'inputs/las-files',
      'inputs/access-db', 
      'outputs',
      'state',
      'config',
      'temp'
    ];

    for (const dir of dirs) {
      await fs.mkdir(path.join(this.resourceRoot, dir), { recursive: true });
    }
  }

  private async indexExistingResources(): Promise<void> {
    const directories = ['inputs', 'outputs', 'state', 'config'];

    for (const dir of directories) {
      const dirPath = path.join(this.resourceRoot, dir);
      try {
        await this.indexDirectory(dirPath, dir);
      } catch (error) {
        // Directory doesn't exist yet, skip
      }
    }
  }

  private async indexDirectory(dirPath: string, relativePath: string): Promise<void> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        const relativeFile = path.join(relativePath, entry.name);
        
        if (entry.isFile()) {
          const uri = this.pathToUri(relativeFile);
          const resource = await this.createResourceFromFile(uri, fullPath);
          this.resourceCache.set(uri, resource);
        } else if (entry.isDirectory()) {
          await this.indexDirectory(fullPath, relativeFile);
        }
      }
    } catch (error) {
      // Skip directories that can't be read
    }
  }

  private pathToUri(filePath: string): string {
    return `mcp://shale-data/${filePath.replace(/\\\\/g, '/')}`;
  }

  private uriToPath(uri: string): string {
    const relativePath = uri.replace('mcp://shale-data/', '');
    return path.join(this.resourceRoot, relativePath);
  }

  private async createResourceFromFile(uri: string, filePath: string): Promise<MCPResource> {
    const stat = await fs.stat(filePath);
    const ext = path.extname(filePath).toLowerCase();
    
    const formatMap: Record<string, MCPResource['format']> = {
      '.json': 'json',
      '.geojson': 'geojson', 
      '.md': 'markdown',
      '.csv': 'csv',
      '.las': 'las'
    };

    return {
      uri,
      type: 'file',
      format: formatMap[ext] || 'binary',
      metadata: {
        description: `File resource: ${path.basename(filePath)}`,
        size: stat.size
      },
      available: true,
      lastModified: stat.mtime.getTime()
    };
  }

  async listResources(): Promise<MCPResource[]> {
    this.ensureInitialized();
    return Array.from(this.resourceCache.values());
  }

  async listResourcesByPattern(pattern: string): Promise<MCPResource[]> {
    this.ensureInitialized();
    const resources = Array.from(this.resourceCache.values());
    
    // Convert MCP URI pattern to regex
    const regexPattern = pattern
      .replace(/\*\*/g, '.*')
      .replace(/\*/g, '[^/]*')
      .replace(/\?/g, '.');
    
    const regex = new RegExp(`^${regexPattern}$`);
    
    return resources.filter(resource => regex.test(resource.uri));
  }

  async getResource(uri: string): Promise<any> {
    this.ensureInitialized();
    
    const filePath = this.uriToPath(uri);
    
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const resource = this.resourceCache.get(uri);
      
      if (resource?.format === 'json' || resource?.format === 'geojson') {
        return JSON.parse(content);
      }
      
      return content;
    } catch (error) {
      throw new Error(`Resource not found: ${uri}`);
    }
  }

  async putResource(uri: string, data: any, meta?: Partial<MCPResourceMeta>): Promise<void> {
    this.ensureInitialized();
    
    const filePath = this.uriToPath(uri);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    
    let content: string;
    const ext = path.extname(filePath).toLowerCase();
    
    if (ext === '.json' || ext === '.geojson') {
      content = JSON.stringify(data, null, 2);
    } else {
      content = typeof data === 'string' ? data : String(data);
    }
    
    await fs.writeFile(filePath, content, 'utf8');
    
    // Update resource cache
    const resource = await this.createResourceFromFile(uri, filePath);
    if (meta) {
      resource.metadata = { ...resource.metadata, ...meta };
    }
    this.resourceCache.set(uri, resource);
    
    // Emit event
    this.emit('resource-updated', {
      type: 'updated',
      uri,
      timestamp: Date.now(),
      resource
    } as MCPResourceEvent);
    
    console.log(`📁 MCP Resource updated: ${uri}`);
  }

  async deleteResource(uri: string): Promise<void> {
    this.ensureInitialized();
    
    const filePath = this.uriToPath(uri);
    
    try {
      await fs.unlink(filePath);
      this.resourceCache.delete(uri);
      
      this.emit('resource-deleted', {
        type: 'deleted',
        uri,
        timestamp: Date.now()
      } as MCPResourceEvent);
      
    } catch (error) {
      // File doesn't exist, that's fine
    }
  }

  async *watchResource(uri: string): AsyncIterator<MCPResourceEvent> {
    this.ensureInitialized();
    
    const eventQueue: MCPResourceEvent[] = [];
    let resolveNext: ((value: IteratorResult<MCPResourceEvent>) => void) | null = null;
    
    const eventHandler = (event: MCPResourceEvent) => {
      if (event.uri === uri) {
        if (resolveNext) {
          resolveNext({ value: event, done: false });
          resolveNext = null;
        } else {
          eventQueue.push(event);
        }
      }
    };
    
    this.on('resource-updated', eventHandler);
    this.on('resource-created', eventHandler);
    this.on('resource-deleted', eventHandler);
    
    try {
      while (true) {
        if (eventQueue.length > 0) {
          yield eventQueue.shift()!;
        } else {
          yield await new Promise<MCPResourceEvent>((resolve) => {
            resolveNext = (result) => resolve(result.value);
          });
        }
      }
    } finally {
      this.off('resource-updated', eventHandler);
      this.off('resource-created', eventHandler);
      this.off('resource-deleted', eventHandler);
    }
  }

  async *watchPattern(pattern: string): AsyncIterator<MCPResourceEvent> {
    this.ensureInitialized();
    
    const regexPattern = pattern
      .replace(/\*\*/g, '.*')
      .replace(/\*/g, '[^/]*')
      .replace(/\?/g, '.');
    const regex = new RegExp(`^${regexPattern}$`);
    
    const eventQueue: MCPResourceEvent[] = [];
    let resolveNext: ((value: IteratorResult<MCPResourceEvent>) => void) | null = null;
    
    const eventHandler = (event: MCPResourceEvent) => {
      if (regex.test(event.uri)) {
        if (resolveNext) {
          resolveNext({ value: event, done: false });
          resolveNext = null;
        } else {
          eventQueue.push(event);
        }
      }
    };
    
    this.on('resource-updated', eventHandler);
    this.on('resource-created', eventHandler);
    this.on('resource-deleted', eventHandler);
    
    try {
      while (true) {
        if (eventQueue.length > 0) {
          yield eventQueue.shift()!;
        } else {
          yield await new Promise<MCPResourceEvent>((resolve) => {
            resolveNext = (result) => resolve(result.value);
          });
        }
      }
    } finally {
      this.off('resource-updated', eventHandler);
      this.off('resource-created', eventHandler);
      this.off('resource-deleted', eventHandler);
    }
  }

  async getResourceMeta(uri: string): Promise<MCPResourceMeta> {
    this.ensureInitialized();
    
    const resource = this.resourceCache.get(uri);
    if (!resource) {
      throw new Error(`Resource not found: ${uri}`);
    }
    
    return resource.metadata;
  }

  async resourceExists(uri: string): Promise<boolean> {
    this.ensureInitialized();
    return this.resourceCache.has(uri);
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('MCP Resource Server not initialized');
    }
  }
}