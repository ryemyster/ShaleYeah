#!/usr/bin/env node
/**
 * SHALE YEAH - Production MCP Server Orchestration
 *
 * Main entry point for SHALE YEAH oil & gas investment analysis platform.
 * Coordinates multiple domain-specific MCP servers for comprehensive analysis.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

interface ServerConfig {
  name: string;
  script: string;
  description: string;
}

const MCP_SERVERS: ServerConfig[] = [
  {
    name: 'geowiz',
    script: 'src/servers/geowiz.ts',
    description: 'Geological Analysis Server - Marcus Aurelius Geologicus'
  },
  {
    name: 'econobot',
    script: 'src/servers/econobot.ts',
    description: 'Economic Analysis Server - Caesar Augustus Economicus'
  },
  {
    name: 'curve-smith',
    script: 'src/servers/curve-smith.ts',
    description: 'Reservoir Engineering Server - Lucius Technicus Engineer'
  },
  {
    name: 'reporter',
    script: 'src/servers/reporter.ts',
    description: 'Executive Reporting Server - Scriptor Reporticus Maximus'
  }
];

async function main(): Promise<void> {
  console.log('🛢️  SHALE YEAH - Production MCP Server Platform');
  console.log('================================================');
  console.log(`📋 Available MCP Servers: ${MCP_SERVERS.length}`);
  console.log();

  // Parse command line arguments
  const args = process.argv.slice(2);
  const mode = args.find(arg => arg.startsWith('--mode='))?.split('=')[1] || 'help';

  switch (mode) {
    case 'help':
    case '--help':
    case '-h':
      showHelp();
      break;

    case 'list':
      listServers();
      break;

    case 'demo':
      await runDemo();
      break;

    case 'production':
      console.log('🚀 Production mode: Use individual MCP servers');
      console.log('   Run: npm run server:<name> for each server');
      listServers();
      break;

    default:
      console.log(`❌ Unknown mode: ${mode}`);
      showHelp();
      process.exit(1);
  }
}

function showHelp(): void {
  console.log('SHALE YEAH - Oil & Gas Investment Analysis Platform');
  console.log();
  console.log('Usage: npm run [command]');
  console.log();
  console.log('Commands:');
  console.log('  demo                     Run demonstration analysis');
  console.log('  server:geowiz           Start geological analysis server');
  console.log('  server:econobot         Start economic analysis server');
  console.log('  server:curve-smith      Start reservoir engineering server');
  console.log('  server:reporter         Start executive reporting server');
  console.log();
  console.log('Production MCP Usage:');
  console.log('  Each server runs independently via MCP protocol');
  console.log('  Connect via Claude Desktop or other MCP clients');
  console.log();
  console.log('Examples:');
  console.log('  npm run demo            # Run complete demo analysis');
  console.log('  npm run server:geowiz   # Start geological server');
}

function listServers(): void {
  console.log('Available MCP Servers:');
  console.log();

  MCP_SERVERS.forEach(server => {
    console.log(`📡 ${server.name}`);
    console.log(`   ${server.description}`);
    console.log(`   Command: npm run server:${server.name}`);
    console.log();
  });
}

async function runDemo(): Promise<void> {
  console.log('🎬 Running SHALE YEAH Demo...');
  console.log();

  try {
    await execAsync('npx tsx src/demo-runner.ts');
  } catch (error) {
    console.error('❌ Demo failed:', error);
    process.exit(1);
  }
}

// Run main function
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('❌ SHALE YEAH failed:', error);
    process.exit(1);
  });
}