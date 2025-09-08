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

// Remove the initializeUserConfig function as we'll use init command instead

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

    // Check if hooks are already registered
    const alreadyInjected = await HookInjector.areHooksInjected();
    if (alreadyInjected) {
      console.log(chalk.green('   ✅ Claude Code hooks already registered'));
      return;
    }

    console.log(chalk.gray('   Registering Stop-hook for Claude Code...'));

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
    // Log error but don't break the flow
    console.log(chalk.yellow('   ⚠️  Could not register hooks (optional)'));
    if (process.env.CCANYWHERE_DEBUG) {
      console.error('Hook registration error:', error);
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
  console.log(chalk.yellow('First-time setup required'));
  console.log();

  // Check if we should skip prompt (for certain commands or non-interactive)
  const command = process.argv[2];
  const isInitCommand = command === 'init' || command === 'init-user';

  // If running init command, don't prompt (avoid recursion)
  if (isInitCommand) {
    return;
  }

  // If skip prompt or non-interactive, show instructions
  if (skipPrompt || !process.stdin.isTTY) {
    console.log(chalk.yellow('📝 To complete setup, run:'));
    console.log(chalk.cyan('   ccanywhere init'));
    console.log();
    console.log(chalk.gray('Or to skip this message:'));
    console.log(chalk.cyan('   mkdir -p ~/.claude && touch ~/.claude/.ccanywhere-initialized'));
    console.log();
    return;
  }

  // Interactive mode - Step 1: Register Claude Code hooks first
  console.log(chalk.blue('🔗 Step 1: Registering Claude Code hooks...'));
  console.log();

  try {
    await registerClaudeHooks();
  } catch (error) {
    // Log error but continue - hooks are optional
    if (process.env.CCANYWHERE_DEBUG) {
      console.error('Hook registration error:', error);
    }
  }

  // Step 2: Prompt for configuration setup
  console.log();
  console.log(chalk.blue('📝 Step 2: Configuration Setup'));
  console.log();

  const { shouldInitialize } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'shouldInitialize',
      message: 'Would you like to configure CCanywhere now?',
      default: true
    }
  ]);

  if (!shouldInitialize) {
    console.log();
    console.log(chalk.gray('You can configure later by running:'));
    console.log(chalk.cyan('   ccanywhere init'));
    console.log();
    // Create marker to prevent repeated prompts
    await createFirstRunMarker();
    return;
  }

  // Run the init command directly
  console.log();
  console.log(chalk.blue('Starting interactive configuration...'));
  console.log();

  try {
    // Dynamic import to avoid circular dependency
    const { initCommand } = await import('../cli/commands/init.js');

    // Run init command with first-run flag
    await initCommand({ firstRun: true });

    // Create marker after successful init
    await createFirstRunMarker();
  } catch (error) {
    console.error(chalk.red('Error during configuration:'));
    console.error(error instanceof Error ? error.message : String(error));
    console.log();
    console.log(chalk.gray('You can try again by running:'));
    console.log(chalk.cyan('   ccanywhere init'));
    console.log();
    // Still create marker to avoid repeated prompts
    await createFirstRunMarker();
  }
}
