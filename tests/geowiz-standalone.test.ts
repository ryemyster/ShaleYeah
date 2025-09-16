/**
 * Test suite for Geowiz Standalone MCP Server
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';
import { GeowizStandaloneMCPServer } from '../src/mcp-servers/geowiz-standalone.js';

describe('Geowiz Standalone MCP Server', () => {
  let server: GeowizStandaloneMCPServer;
  const testDataDir = './tests/data/geowiz-test';

  beforeEach(async () => {
    // Create test server instance
    server = new GeowizStandaloneMCPServer(testDataDir);

    // Initialize server
    await server.initialize();
  });

  afterEach(async () => {
    // Cleanup test server
    await server.stop();

    // Clean up test data directory
    try {
      await fs.rm(testDataDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  test('should initialize successfully', async () => {
    const serverInfo = server.getServerInfo();

    expect(serverInfo.name).toBe('geowiz-server');
    expect(serverInfo.version).toBe('1.0.0');
    expect(serverInfo.initialized).toBe(true);
    expect(serverInfo.transport).toBe('stdio');
  });

  test('should have correct directory structure', async () => {
    const expectedDirs = [
      'analyses',
      'gis_data',
      'well_logs',
      'formations',
      'reports',
      'quality_reports'
    ];

    for (const dir of expectedDirs) {
      const dirPath = path.join(testDataDir, 'geowiz-server', dir);
      const stats = await fs.stat(dirPath);
      expect(stats.isDirectory()).toBe(true);
    }
  });

  test('should provide server info with capabilities', () => {
    const serverInfo = server.getServerInfo();

    expect(serverInfo).toHaveProperty('name');
    expect(serverInfo).toHaveProperty('version');
    expect(serverInfo).toHaveProperty('description');
    expect(serverInfo).toHaveProperty('initialized');
    expect(serverInfo).toHaveProperty('transport');
    expect(serverInfo).toHaveProperty('capabilities');
    expect(serverInfo).toHaveProperty('resourceRoot');
    expect(serverInfo).toHaveProperty('dataPath');
  });

  // Note: Additional integration tests would require setting up MCP client
  // to actually test tool calling and resource access through the MCP protocol
});

// Helper to create test LAS file content
function createTestLASContent(): string {
  return `~VERSION INFORMATION
VERS.                          2.0 : CWLS log ASCII Standard -VERSION 2.0
WRAP.                          NO  : ONE LINE PER DEPTH STEP
~WELL INFORMATION
STRT.M                      1000.0 : START DEPTH
STOP.M                      2000.0 : STOP DEPTH
STEP.M                        0.125: STEP
NULL.                      -999.25 : NULL VALUE
COMP.     TEST COMPANY            : COMPANY
WELL.     TEST WELL               : WELL
FLD .     TEST FIELD              : FIELD
LOC .     TEST LOCATION           : LOCATION
~CURVE INFORMATION
DEPT.M              : DEPTH
GR  .GAPI           : GAMMA RAY
RHOB.G/C3           : DENSITY
NPHI.V/V            : NEUTRON POROSITY
~ASCII
1000.000   65.5   2.45   0.15
1000.125   67.2   2.44   0.16
1000.250   69.1   2.43   0.17`;
}

// Helper to create test GeoJSON content
function createTestGeoJSONContent(): string {
  return JSON.stringify({
    "type": "FeatureCollection",
    "features": [
      {
        "type": "Feature",
        "properties": {
          "TRACT_ID": "TEST_001",
          "ACRES": 640,
          "OWNER": "Test Owner"
        },
        "geometry": {
          "type": "Polygon",
          "coordinates": [[
            [-101.5, 31.8],
            [-101.4, 31.8],
            [-101.4, 31.9],
            [-101.5, 31.9],
            [-101.5, 31.8]
          ]]
        }
      }
    ]
  });
}