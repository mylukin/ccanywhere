/**
 * Claude Code registration command
 * Handles manual registration of CCanywhere hooks with Claude Code
 */

import chalkModule from 'chalk';
const chalk = chalkModule;
import inquirer from 'inquirer';
import { Command } from 'commander';
import { Logger } from '../../utils/logger.js';
import { ClaudeCodeDetector } from '../../utils/claude-detector.js';
import { HookInjector, HookInjectionOptions } from '../../utils/hook-injector.js';

interface ClaudeRegisterOptions {
  preCommit?: boolean;
  postRun?: boolean;
  preTest?: boolean;
  postTest?: boolean;
  force?: boolean;
  backup?: boolean;
  remove?: boolean;
  status?: boolean;
  restore?: string;
  interactive?: boolean;
}

/**
 * Claude Code registration command handler
 */
export async function claudeRegisterCommand(options: ClaudeRegisterOptions): Promise<void> {
  const logger = Logger.getInstance();

  try {
    // Show status if requested
    if (options.status) {
      await showHookStatus();
      return;
    }

    // Restore from backup if requested
    if (options.restore) {
      await restoreFromBackup(options.restore);
      return;
    }

    // Remove hooks if requested
    if (options.remove) {
      await removeHooks();
      return;
    }

    // Detect Claude Code environment
    console.log(chalk.blue('🔍 Detecting Claude Code environment...'));
    const environment = await ClaudeCodeDetector.detectEnvironment();
    
    if (!environment.isClaudeCode) {
      console.log(chalk.red('❌ Claude Code environment not detected'));
      console.log(chalk.yellow('Please ensure Claude Code is installed and configured.'));
      console.log();
      console.log(chalk.gray('Common Claude Code installation locations:'));
      console.log(chalk.gray('  • ~/.config/claude-code'));
      console.log(chalk.gray('  • ~/.claude'));
      console.log(chalk.gray('  • ~/Library/Application Support/claude-code (macOS)'));
      console.log(chalk.gray('  • %APPDATA%/claude-code (Windows)'));
      return;
    }

    console.log(chalk.green('✅ Claude Code detected'));
    console.log(chalk.gray(`   Config: ${environment.configDir}`));
    console.log(chalk.gray(`   Hooks: ${environment.hooksConfigPath || 'Not configured'}`));
    if (environment.version) {
      console.log(chalk.gray(`   Version: ${environment.version}`));
    }
    console.log();

    // Check if hooks are already injected
    const alreadyInjected = await HookInjector.areHooksInjected();
    if (alreadyInjected && !options.force) {
      console.log(chalk.yellow('⚠️  CCanywhere hooks are already registered with Claude Code'));
      console.log(chalk.gray('Use --force to overwrite existing hooks'));
      return;
    }

    // Interactive mode or use provided options
    let injectionOptions: HookInjectionOptions;
    
    if (options.interactive !== false && !hasHookOptions(options)) {
      injectionOptions = await promptForHookOptions();
    } else {
      injectionOptions = {
        enablePreCommit: options.preCommit ?? true,
        enablePostRun: options.postRun ?? true,
        enablePreTest: options.preTest ?? false,
        enablePostTest: options.postTest ?? false,
        createBackup: options.backup !== false,
        force: options.force
      };
    }

    // Perform injection
    console.log(chalk.blue('🔧 Registering CCanywhere hooks with Claude Code...'));
    const result = await HookInjector.injectHooks(injectionOptions);

    if (result.success) {
      console.log(chalk.green('✅ Successfully registered CCanywhere hooks!'));
      
      if (result.backupPath) {
        console.log(chalk.gray(`   Backup created: ${result.backupPath}`));
      }
      
      if (result.hooksAdded.length > 0) {
        console.log(chalk.cyan('   Added hooks:'));
        for (const hook of result.hooksAdded) {
          console.log(chalk.cyan(`     • ${hook}`));
        }
      }
      
      if (result.hooksSkipped.length > 0) {
        console.log(chalk.yellow('   Skipped hooks (already exist):'));
        for (const hook of result.hooksSkipped) {
          console.log(chalk.yellow(`     • ${hook}`));
        }
      }

      console.log();
      console.log(chalk.blue('🎉 CCanywhere is now integrated with Claude Code!'));
      console.log(chalk.gray('Your workflows will automatically trigger CCanywhere when you:'));
      if (result.hooksAdded.includes('preCommit')) {
        console.log(chalk.gray('  • Make git commits (pre-commit analysis)'));
      }
      if (result.hooksAdded.includes('postRun')) {
        console.log(chalk.gray('  • Run Claude Code operations (full pipeline)'));
      }
      if (result.hooksAdded.includes('preTest')) {
        console.log(chalk.gray('  • Execute tests (environment setup)'));
      }
      if (result.hooksAdded.includes('postTest')) {
        console.log(chalk.gray('  • Complete test runs (notifications)'));
      }
      
    } else {
      console.log(chalk.red('❌ Failed to register hooks:'));
      console.log(chalk.red(`   ${result.message}`));
      process.exit(1);
    }

  } catch (error) {
    console.log(chalk.red('❌ Registration failed:'));
    console.log(chalk.red(error instanceof Error ? error.message : String(error)));
    
    if (process.env.NODE_ENV === 'development') {
      console.log(chalk.gray((error as Error).stack));
    }
    
    process.exit(1);
  }
}

/**
 * Show current hook status
 */
async function showHookStatus(): Promise<void> {
  console.log(chalk.blue('📊 CCanywhere Claude Code Hook Status'));
  console.log(chalk.gray('='.repeat(50)));

  try {
    const environment = await ClaudeCodeDetector.detectEnvironment();
    
    if (!environment.isClaudeCode) {
      console.log(chalk.red('❌ Claude Code not detected'));
      return;
    }

    console.log(chalk.green('✅ Claude Code detected'));
    console.log(`   Config Directory: ${chalk.cyan(environment.configDir || 'Unknown')}`);
    console.log(`   Hooks Config: ${chalk.cyan(environment.hooksConfigPath || 'Not found')}`);
    console.log(`   Installation: ${chalk.cyan(environment.installationType || 'Unknown')}`);
    if (environment.version) {
      console.log(`   Version: ${chalk.cyan(environment.version)}`);
    }
    console.log();

    const hooksInjected = await HookInjector.areHooksInjected();
    if (hooksInjected) {
      console.log(chalk.green('✅ CCanywhere hooks are registered'));
    } else {
      console.log(chalk.yellow('⚠️  CCanywhere hooks are not registered'));
    }

    // List backups
    const backups = await HookInjector.listBackups();
    if (backups.length > 0) {
      console.log();
      console.log(chalk.blue('📁 Available backups:'));
      for (const backup of backups) {
        console.log(`   ${chalk.gray(backup)}`);
      }
    }

  } catch (error) {
    console.log(chalk.red('❌ Error checking status:'));
    console.log(chalk.red(error instanceof Error ? error.message : String(error)));
  }
}

/**
 * Remove CCanywhere hooks
 */
async function removeHooks(): Promise<void> {
  console.log(chalk.blue('🗑️  Removing CCanywhere hooks from Claude Code...'));

  try {
    const result = await HookInjector.removeHooks();
    
    if (result.success) {
      console.log(chalk.green('✅ Successfully removed CCanywhere hooks'));
      if (result.hooksAdded.length > 0) { // Using hooksAdded to track removed hooks
        console.log(chalk.cyan('   Removed hooks:'));
        for (const hook of result.hooksAdded) {
          console.log(chalk.cyan(`     • ${hook}`));
        }
      }
    } else {
      console.log(chalk.yellow(`⚠️  ${result.message}`));
    }
  } catch (error) {
    console.log(chalk.red('❌ Failed to remove hooks:'));
    console.log(chalk.red(error instanceof Error ? error.message : String(error)));
  }
}

/**
 * Restore from backup
 */
async function restoreFromBackup(backupPath: string): Promise<void> {
  console.log(chalk.blue(`🔄 Restoring hooks configuration from backup...`));

  try {
    const success = await HookInjector.restoreFromBackup(backupPath);
    
    if (success) {
      console.log(chalk.green('✅ Successfully restored configuration from backup'));
    } else {
      console.log(chalk.red('❌ Failed to restore from backup'));
      console.log(chalk.gray('Please check that the backup file exists and is valid'));
    }
  } catch (error) {
    console.log(chalk.red('❌ Restore failed:'));
    console.log(chalk.red(error instanceof Error ? error.message : String(error)));
  }
}

/**
 * Prompt user for hook configuration options
 */
async function promptForHookOptions(): Promise<HookInjectionOptions> {
  console.log(chalk.blue('🔧 Hook Configuration'));
  console.log(chalk.gray('Select which hooks to enable:'));
  console.log();

  const answers = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'hooks',
      message: 'Which hooks would you like to enable?',
      choices: [
        {
          name: 'Pre-commit (analyze changes before commits)',
          value: 'preCommit',
          checked: true
        },
        {
          name: 'Post-run (full pipeline after Claude Code operations)', 
          value: 'postRun',
          checked: true
        },
        {
          name: 'Pre-test (setup before test execution)',
          value: 'preTest',
          checked: false
        },
        {
          name: 'Post-test (notifications after tests complete)',
          value: 'postTest',
          checked: false
        }
      ]
    },
    {
      type: 'confirm',
      name: 'backup',
      message: 'Create backup of existing configuration?',
      default: true
    },
    {
      type: 'confirm',
      name: 'force',
      message: 'Overwrite existing hooks if they exist?',
      default: false,
      when: async () => {
        return await HookInjector.areHooksInjected();
      }
    }
  ]);

  return {
    enablePreCommit: answers.hooks.includes('preCommit'),
    enablePostRun: answers.hooks.includes('postRun'),
    enablePreTest: answers.hooks.includes('preTest'),
    enablePostTest: answers.hooks.includes('postTest'),
    createBackup: answers.backup,
    force: answers.force
  };
}

/**
 * Check if hook options are provided
 */
function hasHookOptions(options: ClaudeRegisterOptions): boolean {
  return !!(
    options.preCommit !== undefined ||
    options.postRun !== undefined ||
    options.preTest !== undefined ||
    options.postTest !== undefined
  );
}

/**
 * Create the claude-register command
 */
export function createClaudeRegisterCommand(): Command {
  return new Command('claude-register')
    .description('Register CCanywhere hooks with Claude Code')
    .option('--pre-commit', 'Enable pre-commit hook')
    .option('--post-run', 'Enable post-run hook') 
    .option('--pre-test', 'Enable pre-test hook')
    .option('--post-test', 'Enable post-test hook')
    .option('--no-backup', 'Skip creating backup of existing configuration')
    .option('-f, --force', 'Overwrite existing hooks')
    .option('--remove', 'Remove CCanywhere hooks from Claude Code')
    .option('--status', 'Show current hook registration status')
    .option('--restore <path>', 'Restore configuration from backup file')
    .option('--no-interactive', 'Skip interactive prompts')
    .action(claudeRegisterCommand);
}

export default createClaudeRegisterCommand;