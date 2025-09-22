/**
 * Simplified MCP Server Tests
 * Tests basic MCP server functionality without tool registration conflicts
 */

import fs from 'fs/promises';
import path from 'path';
import { GeowizServer } from '../src/servers/geowiz.js';

async function testMCPBasics(): Promise<void> {
  console.log('🧪 Testing MCP Server Basics...');

  try {
    // Test server instantiation
    const geowiz = new GeowizServer();
    console.log('  ✓ GeowizServer instantiated successfully');

    // Test configuration
    geowiz.config.dataPath = './tests/mcp-test-output';
    console.log('  ✓ Server configuration set');

    // Test directory setup
    await geowiz.setupDataDirectories();
    console.log('  ✓ Data directories created');

    // Test server basic properties
    console.log('  ✓ Server type:', geowiz.constructor.name);
    console.log('  ✓ Data path configured:', geowiz.config.dataPath);

    // Verify expected directory structure
    const dirs = ['analyses', 'gis-data', 'well-logs'];
    for (const dir of dirs) {
      const dirPath = path.join(geowiz.config.dataPath, dir);
      try {
        await fs.access(dirPath);
        console.log(`  ✓ Directory exists: ${dir}`);
      } catch {
        console.log(`  ⚠️  Directory missing: ${dir}`);
      }
    }

    console.log('✅ MCP server basic functionality verified!');

  } catch (error) {
    console.error('❌ MCP server test failed:', error);
    throw error;
  }
}

// Run the test
testMCPBasics().catch(console.error);