import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import chalkModule from 'chalk';
const chalk = chalkModule;
import inquirer from 'inquirer';
import { ClaudeCodeDetector } from './claude-detector.js';
import { HookInjector } from './hook-injector.js';
import type { CcanywhereConfig } from '../types/index.js';

/**
 * Check if user configuration exists
 */
export async function hasUserConfig(): Promise<boolean> {
  const userConfigDir = path.join(os.homedir(), '.claude');
  const configPaths = [
    path.join(userConfigDir, 'ccanywhere.config.json'),
    path.join(userConfigDir, 'ccanywhere.config.js'),
    path.join(userConfigDir, '.ccanywhere.json'),
    path.join(userConfigDir, '.ccanywhere.js')
  ];

  for (const configPath of configPaths) {
    if (await fs.pathExists(configPath)) {
      return true;
    }
  }
  return false;
}

/**
 * Check if this appears to be a global installation
 */
export function isGlobalInstall(): boolean {
  // Check if running from global node_modules
  const scriptPath = process.argv[1];
  if (!scriptPath) return false;

  return (
    scriptPath.includes('/node_modules/ccanywhere') ||
    scriptPath.includes('\\node_modules\\ccanywhere') ||
    scriptPath.includes('.nvm/') ||
    scriptPath.includes('.nvm\\') ||
    scriptPath.includes('yarn/global') ||
    scriptPath.includes('pnpm-global') ||
    scriptPath.includes('npm/lib/node_modules')
  );
}

/**
 * Create marker file to indicate first run is complete
 */
async function createFirstRunMarker(): Promise<void> {
  const markerPath = path.join(os.homedir(), '.claude', '.ccanywhere-initialized');
  await fs.ensureDir(path.dirname(markerPath));
  await fs.writeFile(markerPath, new Date().toISOString(), 'utf8');
}

/**
 * Check if first run marker exists
 */
async function hasFirstRunMarker(): Promise<boolean> {
  const markerPath = path.join(os.homedir(), '.claude', '.ccanywhere-initialized');
  return fs.pathExists(markerPath);
}

/**
 * Initialize user configuration
 */
async function initializeUserConfig(): Promise<void> {
  const configPath = path.join(os.homedir(), '.claude', 'ccanywhere.config.json');
  const configDir = path.dirname(configPath);

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
}

/**
 * Register Claude Code hooks
 */
async function registerClaudeHooks(): Promise<void> {
  try {
    // Detect Claude Code environment
    const environment = await ClaudeCodeDetector.detectEnvironment();

    if (!environment.isClaudeCode) {
      console.log(chalk.gray('   Claude Code not detected - skipping hook registration'));
      return;
    }

    console.log(chalk.blue('   Registering Claude Code hooks...'));

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
      console.log(chalk.green('   ✅ Claude Code hooks registered successfully!'));
    } else {
      console.log(chalk.yellow(`   ⚠️  Could not register hooks: ${result.message}`));
    }
  } catch (error) {
    // Silently fail - don't break the CLI
    if (process.env.DEBUG) {
      console.error('Error registering hooks:', error);
    }
  }
}

/**
 * Check for first run and prompt for initialization if needed
 */
export async function checkFirstRun(skipPrompt = false): Promise<void> {
  // Only check for global installations
  if (!isGlobalInstall()) {
    return;
  }

  // Check if already initialized
  if (await hasFirstRunMarker()) {
    return;
  }

  // Check if user config already exists
  if (await hasUserConfig()) {
    // Config exists but no marker, create marker
    await createFirstRunMarker();
    return;
  }

  // First run detected - show welcome message
  console.log();
  console.log(chalk.blue('🚀 Welcome to CCanywhere!'));
  console.log(chalk.gray('='.repeat(50)));
  console.log(chalk.yellow('This appears to be your first time using CCanywhere.'));
  console.log(chalk.gray('CCanywhere requires initial setup to configure:'));
  console.log(chalk.gray('  • User configuration in ~/.claude/'));
  console.log(chalk.gray('  • Claude Code hook integration (if available)'));
  console.log();

  // Check if we should skip prompt (for certain commands or non-interactive)
  const command = process.argv[2];
  const isInitCommand = command === 'init-user';

  // If running init-user command, don't prompt (avoid recursion)
  if (isInitCommand) {
    return;
  }

  // If skip prompt or non-interactive, show instructions
  if (skipPrompt || !process.stdin.isTTY) {
    console.log(chalk.yellow('📝 To complete setup, run:'));
    console.log(chalk.cyan('   ccanywhere init-user'));
    console.log();
    console.log(chalk.gray('Or to skip this message, create an empty config:'));
    console.log(chalk.cyan('   mkdir -p ~/.claude && touch ~/.claude/.ccanywhere-initialized'));
    console.log();
    return;
  }

  // Interactive mode - prompt user
  const { shouldInitialize } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'shouldInitialize',
      message: 'Would you like to initialize CCanywhere now?',
      default: true
    }
  ]);

  if (!shouldInitialize) {
    console.log();
    console.log(chalk.gray('You can initialize later by running:'));
    console.log(chalk.cyan('   ccanywhere init-user'));
    console.log();
    // Create marker to prevent repeated prompts
    await createFirstRunMarker();
    return;
  }

  // Perform initialization
  console.log();
  console.log(chalk.blue('Initializing CCanywhere...'));
  console.log();

  try {
    // Initialize user configuration
    await initializeUserConfig();

    // Register Claude Code hooks
    await registerClaudeHooks();

    // Create marker
    await createFirstRunMarker();

    // Show next steps
    console.log();
    console.log(chalk.green('✨ Setup complete!'));
    console.log();
    console.log(chalk.yellow('📝 Next steps:'));
    console.log(chalk.gray('   1. Edit your user configuration:'));
    console.log(chalk.cyan('      ccanywhere config-user --edit'));
    console.log(chalk.gray('   2. Or set specific values:'));
    console.log(chalk.cyan('      ccanywhere config-user set notifications.telegram.botToken --value "YOUR_TOKEN"'));
    console.log(chalk.gray('   3. Initialize a project:'));
    console.log(chalk.cyan('      cd your-project && ccanywhere init'));
    console.log();
    console.log(chalk.gray('📚 Documentation: https://github.com/mylukin/ccanywhere'));
    console.log();
  } catch (error) {
    console.error(chalk.red('Error during initialization:'));
    console.error(error instanceof Error ? error.message : String(error));
    console.log();
    console.log(chalk.gray('You can try again by running:'));
    console.log(chalk.cyan('   ccanywhere init-user'));
    console.log();
  }
}
