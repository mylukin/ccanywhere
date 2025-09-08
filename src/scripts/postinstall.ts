#!/usr/bin/env node

/**
 * Postinstall script for CCanywhere
 * Automatically initializes user configuration and registers Claude Code hooks
 * when installed globally
 */

import path from 'path';
import os from 'os';
import type { CcanywhereConfig } from '../types/index.js';

/**
 * Check if CCanywhere is installed globally
 * Uses the flag set by postinstall-wrapper.cjs for consistency
 */
function isGlobalInstall(): boolean {
  // Prefer the flag set by wrapper script
  if (process.env.CCANYWHERE_IS_GLOBAL !== undefined) {
    return process.env.CCANYWHERE_IS_GLOBAL === 'true';
  }
  // Fallback to simple check
  return process.env.npm_config_global === 'true';
}

/**
 * Get user config file path
 */
function getUserConfigPath(): string {
  return path.join(os.homedir(), '.claude', 'ccanywhere.config.json');
}

/**
 * Check if user configuration exists
 */
async function checkUserConfig(): Promise<boolean> {
  // Lazy load fs-extra only when needed
  const fs = await import('fs-extra');

  const configPath = getUserConfigPath();
  return await fs.pathExists(configPath);
}

/**
 * Register Claude Code hooks
 */
async function registerClaudeHooks(): Promise<void> {
  try {
    // Lazy load Claude-related modules
    const { ClaudeCodeDetector } = await import('../utils/claude-detector.js');
    const { HookInjector } = await import('../utils/hook-injector.js');
    const chalk = (await import('chalk')).default;

    // Detect Claude Code environment
    const environment = await ClaudeCodeDetector.detectEnvironment();

    if (!environment.isClaudeCode) {
      console.log(chalk.gray('ℹ️  Claude Code not detected - skipping hook registration'));
      return;
    }

    console.log(chalk.blue('🔗 Registering Claude Code hooks...'));

    // Check if hooks are already registered
    const alreadyInjected = await HookInjector.areHooksInjected();
    if (alreadyInjected) {
      console.log(chalk.gray('   Hooks already registered'));
      return;
    }

    // Register hooks
    const result = await HookInjector.injectHooks({
      enableStop: true,
      createBackup: true,
      force: false
    });

    if (result.success) {
      console.log(chalk.green('✅ Claude Code hooks registered successfully!'));
    } else {
      console.log(chalk.yellow(`⚠️  Could not register hooks: ${result.message}`));
    }
  } catch (error) {
    // Only log in debug mode
    if (process.env.CCANYWHERE_DEBUG) {
      console.error('Error registering hooks:', error);
    }
  }
}

/**
 * Main postinstall logic
 */
async function main() {
  try {
    // Only run for global installs
    if (!isGlobalInstall()) {
      // Local/project install - skip initialization
      return;
    }

    // Lazy load chalk for console output
    const chalk = (await import('chalk')).default;

    console.log();
    console.log(chalk.blue('🚀 CCanywhere Global Installation'));
    console.log(chalk.gray('='.repeat(50)));

    // Check if user configuration exists
    const userConfigExists = await checkUserConfig();

    // Register Claude Code hooks
    await registerClaudeHooks();

    // Show next steps
    console.log();
    console.log(chalk.green('✨ Installation complete!'));
    console.log();

    if (!userConfigExists) {
      console.log(chalk.yellow('📝 Get started:'));
      console.log();
      console.log(chalk.gray('   Run the following command to configure CCanywhere:'));
      console.log();
      console.log(chalk.cyan.bold('      ccanywhere init'));
      console.log();
      console.log(chalk.gray('   This will guide you through:'));
      console.log(chalk.gray('   • Setting up cloud storage (S3, R2, or OSS)'));
      console.log(chalk.gray('   • Configuring notifications (Telegram, DingTalk, etc.)'));
      console.log(chalk.gray('   • Registering Claude Code hooks'));
    } else {
      console.log(chalk.gray('💡 Quick tips:'));
      console.log();
      console.log(chalk.gray('   • Initialize a project:') + chalk.cyan(' cd your-project && ccanywhere init'));
      console.log(chalk.gray('   • Run pipeline:') + chalk.cyan(' ccanywhere run'));
      console.log(chalk.gray('   • Test configuration:') + chalk.cyan(' ccanywhere test'));
    }

    console.log();
    console.log(chalk.gray('📚 Documentation: https://github.com/mylukin/ccanywhere'));
    console.log();
  } catch (error) {
    // Only show errors in debug mode
    if (process.env.CCANYWHERE_DEBUG) {
      console.error('Postinstall error:', error);
    }
    // Always exit gracefully
    process.exit(0);
  }
}

// Run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    if (process.env.CCANYWHERE_DEBUG) {
      console.error('Fatal error:', error);
    }
    // Always exit gracefully to not break npm install
    process.exit(0);
  });
}

export { main, isGlobalInstall, checkUserConfig, registerClaudeHooks };
