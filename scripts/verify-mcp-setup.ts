#!/usr/bin/env tsx
/**
 * SHALE YEAH MCP Setup Verification Script
 * 
 * This script verifies that claude-flow MCP server is properly configured
 * and that the hive mind coordination tools are available.
 */

import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

interface VerificationResult {
  check: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  message: string;
  details?: string;
}

class MCPSetupVerifier {
  private results: VerificationResult[] = [];
  
  private log(check: string, status: 'PASS' | 'FAIL' | 'WARN', message: string, details?: string) {
    this.results.push({ check, status, message, details });
    const emoji = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
    console.log(`${emoji} ${check}: ${message}`);
    if (details) {
      console.log(`   ${details}`);
    }
  }
  
  private async runCommand(command: string, args: string[], timeoutMs = 10000): Promise<{ stdout: string; stderr: string; code: number }> {
    return new Promise((resolve) => {
      const child = spawn(command, args, { 
        stdio: ['pipe', 'pipe', 'pipe'] 
      });
      
      let stdout = '';
      let stderr = '';
      
      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      const timeout = setTimeout(() => {
        child.kill();
        resolve({ stdout, stderr, code: -1 });
      }, timeoutMs);
      
      child.on('close', (code) => {
        clearTimeout(timeout);
        resolve({ stdout, stderr, code: code || 0 });
      });
    });
  }
  
  async verifyFileExists(filePath: string, description: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      this.log('File Check', 'PASS', `${description} exists`, filePath);
      return true;
    } catch {
      this.log('File Check', 'FAIL', `${description} not found`, filePath);
      return false;
    }
  }
  
  async verifyClaudeFlowInstallation(): Promise<boolean> {
    const result = await this.runCommand('npx', ['claude-flow@alpha', '--version'], 5000);
    
    if (result.code === 0 || result.stdout.includes('Claude-Flow')) {
      this.log('Installation', 'PASS', 'claude-flow@alpha is available');
      return true;
    } else {
      this.log('Installation', 'FAIL', 'claude-flow@alpha not accessible', result.stderr);
      return false;
    }
  }
  
  async verifyMCPTools(): Promise<boolean> {
    const result = await this.runCommand('npx', ['claude-flow@alpha', 'mcp', 'tools'], 15000);
    
    if (result.code === 0 && result.stdout.includes('SWARM COORDINATION')) {
      const toolCount = (result.stdout.match(/•/g) || []).length;
      this.log('MCP Tools', 'PASS', `${toolCount} MCP tools available`);
      
      // Check for specific hive mind tools
      const requiredTools = [
        'swarm_init', 'agent_spawn', 'task_orchestrate', 
        'swarm_status', 'agent_list', 'memory_usage'
      ];
      
      const missingTools = requiredTools.filter(tool => !result.stdout.includes(tool));
      
      if (missingTools.length === 0) {
        this.log('Hive Tools', 'PASS', 'All required hive mind tools available');
        return true;
      } else {
        this.log('Hive Tools', 'WARN', `Some tools missing: ${missingTools.join(', ')}`);
        return false;
      }
    } else {
      this.log('MCP Tools', 'FAIL', 'Could not retrieve MCP tools list', result.stderr);
      return false;
    }
  }
  
  async verifyHiveMindSystem(): Promise<boolean> {
    const result = await this.runCommand('npx', ['claude-flow@alpha', 'hive-mind', 'status'], 10000);
    
    if (result.code === 0 && result.stdout.includes('Active Hive Mind Swarms')) {
      this.log('Hive Mind', 'PASS', 'Hive mind system is active');
      
      // Count swarms
      const swarmCount = (result.stdout.match(/Swarm:/g) || []).length;
      this.log('Swarm Count', 'PASS', `${swarmCount} active swarms detected`);
      return true;
    } else {
      this.log('Hive Mind', 'FAIL', 'Hive mind system not responding', result.stderr);
      return false;
    }
  }
  
  async verifyMCPConfiguration(): Promise<boolean> {
    const configExists = await this.verifyFileExists(
      '/Users/rmcdonald/Repos/ShaleYeah/.claude.json',
      'MCP server configuration (.claude.json)'
    );
    
    if (!configExists) return false;
    
    try {
      const configContent = await fs.readFile('/Users/rmcdonald/Repos/ShaleYeah/.claude.json', 'utf8');
      const config = JSON.parse(configContent);
      
      if (config.mcpServers?.['claude-flow']) {
        this.log('MCP Config', 'PASS', 'claude-flow MCP server configured');
        return true;
      } else {
        this.log('MCP Config', 'FAIL', 'claude-flow server not found in configuration');
        return false;
      }
    } catch (error) {
      this.log('MCP Config', 'FAIL', 'Could not parse .claude.json configuration', String(error));
      return false;
    }
  }
  
  async runAllVerifications(): Promise<void> {
    console.log('🔍 SHALE YEAH MCP Setup Verification');
    console.log('=====================================');
    
    // Run all verification checks
    const checks = await Promise.allSettled([
      this.verifyClaudeFlowInstallation(),
      this.verifyMCPConfiguration(),
      this.verifyMCPTools(),
      this.verifyHiveMindSystem(),
      this.verifyFileExists('/Users/rmcdonald/Repos/ShaleYeah/.claude-flow/metrics/performance.json', 'Claude-flow metrics'),
      this.verifyFileExists('/Users/rmcdonald/Repos/ShaleYeah/.hive-mind/hive.db', 'Hive mind database')
    ]);
    
    // Summary
    console.log('\n📊 VERIFICATION SUMMARY');
    console.log('=======================');
    
    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    const warned = this.results.filter(r => r.status === 'WARN').length;
    
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⚠️  Warnings: ${warned}`);
    
    if (failed === 0) {
      console.log('\n🎉 MCP Setup Verification PASSED!');
      console.log('   The claude-flow MCP server is properly configured.');
      console.log('   Hive mind coordination tools should now be available.');
    } else {
      console.log('\n❌ MCP Setup Verification FAILED!');
      console.log('   Some configuration issues were found.');
      console.log('   Please review the failed checks above.');
    }
    
    // Exit with appropriate code
    process.exit(failed === 0 ? 0 : 1);
  }
}

// Run verification if script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const verifier = new MCPSetupVerifier();
  verifier.runAllVerifications().catch(console.error);
}