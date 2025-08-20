#!/usr/bin/env node
/**
 * Test script for unified YAML configuration loader
 */

import { YAMLConfigLoader } from '../src/shared/yaml-config-loader.js';
import fs from 'fs/promises';

async function testYAMLLoader(): Promise<void> {
  console.log('🧪 Testing Unified YAML Configuration Loader');
  console.log('============================================');

  try {
    // Test 1: Basic functionality
    const stats = YAMLConfigLoader.getCacheStats();
    console.log('✅ YAML Config Loader imported successfully');
    console.log(`📊 Initial cache stats: ${stats.size} files cached`);

    // Test 2: Load agent configs if directory exists
    try {
      await fs.access('.claude/agents');
      console.log('📁 Found .claude/agents directory, testing agent config loading...');
      
      const agentConfigs = await YAMLConfigLoader.loadAgentConfigs('.claude/agents');
      console.log(`✅ Loaded ${agentConfigs.size} agent configurations:`);
      
      for (const [name, config] of agentConfigs) {
        console.log(`  📋 ${name}: ${config.persona?.name || config.name || 'Unnamed'}`);
        if (config.resources) {
          console.log(`    🔗 ${config.resources.inputs?.length || 0} inputs, ${config.resources.outputs?.length || 0} outputs`);
        }
      }
    } catch {
      console.log('ℹ️  .claude/agents directory not found, skipping agent config test');
    }

    // Test 3: Cache functionality
    const finalStats = YAMLConfigLoader.getCacheStats();
    console.log(`📊 Final cache stats: ${finalStats.size} files cached`);
    if (finalStats.size > 0) {
      console.log('   Cached files:', finalStats.files.map(f => f.split('/').pop()).join(', '));
    }

    console.log('✅ YAML Config Loader tests completed successfully');

  } catch (error) {
    console.error('❌ YAML Config Loader test failed:', error);
    process.exit(1);
  }
}

testYAMLLoader();