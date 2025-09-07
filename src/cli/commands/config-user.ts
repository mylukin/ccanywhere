/**
 * User configuration management command
 * Handles user-level configuration in ~/.claude/ccanywhere.config.json
 */

import chalkModule from 'chalk';
const chalk = chalkModule;
import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';
import { validateConfig, getDefaultConfig } from '../../config/schema.js';
import { ConfigurationError } from '../../types/index.js';
import type { CcanywhereConfig } from '../../types/index.js';
import { Logger } from '../../utils/logger.js';

interface ConfigUserOptions {
  init?: boolean;
  show?: boolean;
  edit?: boolean;
  path?: boolean;
}

interface ConfigSetOptions {
  value: string;
}

/**
 * Get user config file path
 */
function getUserConfigPath(): string {
  return path.join(os.homedir(), '.claude', 'ccanywhere.config.json');
}

/**
 * Ensure user config directory exists
 */
async function ensureUserConfigDir(): Promise<void> {
  const configDir = path.dirname(getUserConfigPath());
  await fs.ensureDir(configDir);
}

/**
 * Read user configuration
 */
async function readUserConfig(): Promise<Partial<CcanywhereConfig> | null> {
  const configPath = getUserConfigPath();
  if (!(await fs.pathExists(configPath))) {
    return null;
  }
  
  try {
    const content = await fs.readFile(configPath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    throw new ConfigurationError(
      `Failed to read user config: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Write user configuration
 */
async function writeUserConfig(config: Partial<CcanywhereConfig>): Promise<void> {
  await ensureUserConfigDir();
  const configPath = getUserConfigPath();
  await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf8');
}

/**
 * Initialize user configuration
 */
async function initUserConfig(): Promise<void> {
  const configPath = getUserConfigPath();
  
  if (await fs.pathExists(configPath)) {
    console.log(chalk.yellow(`⚠️  User config already exists at: ${configPath}`));
    console.log(chalk.gray('Use --edit to modify it or delete it to reinitialize'));
    return;
  }
  
  await ensureUserConfigDir();
  
  // Create a sample configuration
  const sampleConfig: Partial<CcanywhereConfig> = {
    notifications: {
      channels: ['telegram'],
      telegram: {
        botToken: 'YOUR_BOT_TOKEN',
        chatId: 'YOUR_CHAT_ID'
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
          bucket: 'my-r2-bucket'
        }
      }
    },
    deployment: 'https://deploy.example.com/api/webhook/deploy'
  };
  
  await writeUserConfig(sampleConfig);
  
  console.log(chalk.green('✅ User configuration initialized successfully!'));
  console.log(chalk.blue(`📁 Config file created at: ${configPath}`));
  console.log();
  console.log(chalk.yellow('⚠️  Please edit the configuration file with your actual values:'));
  console.log(chalk.gray(`   ${configPath}`));
  console.log();
  console.log(chalk.blue('💡 Tip: Use `ccanywhere config-user --edit` to open in your default editor'));
}

/**
 * Show user configuration
 */
async function showUserConfig(): Promise<void> {
  const config = await readUserConfig();
  
  if (!config) {
    console.log(chalk.yellow('⚠️  No user configuration found'));
    console.log(chalk.gray('Run `ccanywhere config-user --init` to create one'));
    return;
  }
  
  console.log(chalk.blue('📊 User Configuration'));
  console.log(chalk.gray('='.repeat(50)));
  console.log();
  console.log(JSON.stringify(config, null, 2));
  console.log();
  console.log(chalk.gray(`Config path: ${getUserConfigPath()}`));
}

/**
 * Edit user configuration
 */
async function editUserConfig(): Promise<void> {
  await ensureUserConfigDir();
  const configPath = getUserConfigPath();
  
  // Create file if it doesn't exist
  if (!(await fs.pathExists(configPath))) {
    await initUserConfig();
  }
  
  // Determine the editor to use
  const editor = process.env.EDITOR || process.env.VISUAL || 'vi';
  
  console.log(chalk.blue(`Opening ${configPath} with ${editor}...`));
  
  // Spawn the editor
  const child = spawn(editor, [configPath], {
    stdio: 'inherit',
    shell: true
  });
  
  child.on('exit', (code) => {
    if (code === 0) {
      console.log(chalk.green('✅ Configuration edited successfully'));
      
      // Validate the configuration
      readUserConfig()
        .then(config => {
          if (config) {
            try {
              // Merge with defaults for validation
              const merged = { ...getDefaultConfig(), ...config };
              validateConfig(merged);
              console.log(chalk.green('✅ Configuration is valid'));
            } catch (error) {
              console.log(chalk.red('❌ Configuration validation failed:'));
              console.log(chalk.red(error instanceof Error ? error.message : String(error)));
            }
          }
        })
        .catch(error => {
          console.log(chalk.red('❌ Failed to read edited configuration:'));
          console.log(chalk.red(error instanceof Error ? error.message : String(error)));
        });
    } else {
      console.log(chalk.yellow(`Editor exited with code ${code}`));
    }
  });
}

/**
 * Get configuration value by path
 */
function getConfigValue(config: any, keyPath: string): any {
  const keys = keyPath.split('.');
  let value = config;
  
  for (const key of keys) {
    if (!key) continue; // Skip empty keys
    if (value && typeof value === 'object' && key in value) {
      value = value[key];
    } else {
      return undefined;
    }
  }
  
  return value;
}

/**
 * Set configuration value by path
 */
function setConfigValue(config: any, keyPath: string, value: any): void {
  const keys = keyPath.split('.');
  let target = config;
  
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!key) continue; // Skip empty keys
    if (!(key in target) || typeof target[key] !== 'object') {
      target[key] = {};
    }
    target = target[key];
  }
  
  const lastKey = keys[keys.length - 1];
  if (lastKey) {
    target[lastKey] = value;
  }
}

/**
 * Parse value string to appropriate type
 */
function parseValue(value: string): any {
  // Try to parse as JSON first
  try {
    return JSON.parse(value);
  } catch {
    // If not valid JSON, return as string
    return value;
  }
}

/**
 * User configuration command handler
 */
export async function configUserCommand(options: ConfigUserOptions): Promise<void> {
  const logger = Logger.getInstance();
  
  try {
    if (options.init) {
      await initUserConfig();
    } else if (options.show) {
      await showUserConfig();
    } else if (options.edit) {
      await editUserConfig();
    } else if (options.path) {
      console.log(getUserConfigPath());
    } else {
      // Default action: show config
      await showUserConfig();
    }
  } catch (error) {
    console.log(chalk.red('❌ Error:'));
    console.log(chalk.red(error instanceof Error ? error.message : String(error)));
    if (process.env.NODE_ENV === 'development') {
      logger.error('Config user error:', error);
    }
    process.exit(1);
  }
}

/**
 * Get configuration value command handler
 */
export async function configUserGetCommand(key: string): Promise<void> {
  try {
    const config = await readUserConfig();
    
    if (!config) {
      console.log(chalk.yellow('⚠️  No user configuration found'));
      process.exit(1);
    }
    
    const value = getConfigValue(config, key);
    
    if (value === undefined) {
      console.log(chalk.yellow(`⚠️  Key "${key}" not found in user configuration`));
      process.exit(1);
    }
    
    if (typeof value === 'object') {
      console.log(JSON.stringify(value, null, 2));
    } else {
      console.log(value);
    }
  } catch (error) {
    console.log(chalk.red('❌ Error:'));
    console.log(chalk.red(error instanceof Error ? error.message : String(error)));
    process.exit(1);
  }
}

/**
 * Set configuration value command handler
 */
export async function configUserSetCommand(key: string, options: ConfigSetOptions): Promise<void> {
  try {
    let config = await readUserConfig();
    
    if (!config) {
      // Create new config if it doesn't exist
      config = {};
    }
    
    const value = parseValue(options.value);
    setConfigValue(config, key, value);
    
    // Validate the configuration
    try {
      const merged = { ...getDefaultConfig(), ...config };
      validateConfig(merged);
    } catch (error) {
      console.log(chalk.red('❌ Configuration validation failed:'));
      console.log(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
    
    await writeUserConfig(config);
    
    console.log(chalk.green(`✅ Set ${key} = ${JSON.stringify(value)}`));
  } catch (error) {
    console.log(chalk.red('❌ Error:'));
    console.log(chalk.red(error instanceof Error ? error.message : String(error)));
    process.exit(1);
  }
}

/**
 * Create the config-user command
 */
export function createConfigUserCommand(): Command {
  const command = new Command('config-user')
    .description('Manage user-level configuration in ~/.claude/')
    .option('--init', 'Initialize user configuration with sample values')
    .option('--show', 'Show current user configuration')
    .option('--edit', 'Open configuration in default editor')
    .option('--path', 'Show configuration file path')
    .action(configUserCommand);
  
  // Add subcommands
  command
    .command('get <key>')
    .description('Get a configuration value (e.g., notifications.telegram.botToken)')
    .action(configUserGetCommand);
  
  command
    .command('set <key>')
    .description('Set a configuration value')
    .requiredOption('--value <value>', 'Value to set (JSON or string)')
    .action(configUserSetCommand);
  
  return command;
}

export default createConfigUserCommand;