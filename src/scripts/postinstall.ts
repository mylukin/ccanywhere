#!/usr/bin/env node

/**
 * Postinstall script for CCanywhere
 * Automatically initializes user configuration and registers Claude Code hooks
 * when installed globally
 */

import chalkModule from 'chalk';
const chalk = chalkModule;
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { ClaudeCodeDetector } from '../utils/claude-detector.js';
import { HookInjector } from '../utils/hook-injector.js';
import type { CcanywhereConfig } from '../types/index.js';

// Disable verbose logging during postinstall
process.env.LOG_LEVEL = 'error';

/**
 * Check if CCanywhere is installed globally
 */
function isGlobalInstall(): boolean {
  // Check if running from npm global directory
  const npmPrefix = process.env.npm_config_prefix || '';
  const nodeModulesPath = process.cwd();

  // Various ways to detect global install
  return (
    // npm global install
    nodeModulesPath.includes('npm/node_modules/ccanywhere') ||
    nodeModulesPath.includes('npm\\node_modules\\ccanywhere') ||
    // yarn global install
    nodeModulesPath.includes('yarn/global/node_modules/ccanywhere') ||
    // pnpm global install
    nodeModulesPath.includes('pnpm-global') ||
    // Check npm prefix
    (npmPrefix && nodeModulesPath.startsWith(npmPrefix)) ||
    // Check if npm_config_global is set
    process.env.npm_config_global === 'true'
  );
}

/**
 * Get user config file path
 */
function getUserConfigPath(): string {
  return path.join(os.homedir(), '.claude', 'ccanywhere.config.json');
}

/**
 * Initialize user configuration if it doesn't exist
 */
async function initializeUserConfig(): Promise<boolean> {
  const configPath = getUserConfigPath();
  const configDir = path.dirname(configPath);

  // Check if config already exists
  if (await fs.pathExists(configPath)) {
    console.log(chalk.blue('ℹ️  User configuration already exists'));
    return false;
  }

  // Ensure directory exists
  await fs.ensureDir(configDir);

  // Create sample configuration
  const sampleConfig: Partial<CcanywhereConfig> = {
    notifications: {
      channels: ['telegram'],
      telegram: {
        botToken: 'YOUR_BOT_TOKEN_HERE',
        chatId: 'YOUR_CHAT_ID_HERE'
      }
    },
    artifacts: {
      baseUrl: 'https://artifacts.example.com',
      retentionDays: 7,
      storage: {
        provider: 'r2',
        folder: 'diffs',
        r2: {
          accountId: 'YOUR_CLOUDFLARE_ACCOUNT_ID',
          accessKeyId: 'YOUR_R2_ACCESS_KEY_ID',
          secretAccessKey: 'YOUR_R2_SECRET_ACCESS_KEY',
          bucket: 'my-artifacts-bucket'
        }
      }
    }
  };

  // Write configuration
  await fs.writeFile(configPath, JSON.stringify(sampleConfig, null, 2), 'utf8');

  console.log(chalk.green('✅ User configuration initialized successfully!'));
  console.log(chalk.gray(`   Location: ${configPath}`));

  return true;
}

/**
 * Register Claude Code hooks
 */
async function registerClaudeHooks(): Promise<void> {
  try {
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
    // Silently fail - don't break installation
    if (process.env.DEBUG) {
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

    console.log();
    console.log(chalk.blue('🚀 CCanywhere Global Installation'));
    console.log(chalk.gray('='.repeat(50)));

    // Initialize user configuration
    const configCreated = await initializeUserConfig();

    // Register Claude Code hooks
    await registerClaudeHooks();

    // Show next steps
    console.log();
    console.log(chalk.green('✨ Installation complete!'));
    console.log();

    if (configCreated) {
      console.log(chalk.yellow('📝 Next steps:'));
      console.log(chalk.gray('   1. Edit your user configuration:'));
      console.log(chalk.cyan('      ccanywhere config-user --edit'));
      console.log(chalk.gray('   2. Or set specific values:'));
      console.log(chalk.cyan('      ccanywhere config-user set notifications.telegram.botToken --value "YOUR_TOKEN"'));
      console.log(chalk.gray('   3. Initialize a project:'));
      console.log(chalk.cyan('      cd your-project && ccanywhere init'));
    } else {
      console.log(chalk.gray('💡 Tip: Manage your configuration with:'));
      console.log(chalk.cyan('   ccanywhere config-user --show'));
      console.log(chalk.cyan('   ccanywhere config-user --edit'));
    }

    console.log();
    console.log(chalk.gray('📚 Documentation: https://github.com/mylukin/ccanywhere'));
    console.log();
  } catch (error) {
    // Don't break npm install on errors
    if (process.env.DEBUG) {
      console.error('Postinstall error:', error);
    }
    process.exit(0);
  }
}

// Run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    if (process.env.DEBUG) {
      console.error('Fatal error:', error);
    }
    process.exit(0);
  });
}

export { main, isGlobalInstall, initializeUserConfig, registerClaudeHooks };
