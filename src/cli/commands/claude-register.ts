/**
 * Claude Code registration command
 * Handles registration of CCanywhere hooks with Claude Code
 */

import chalkModule from 'chalk';
const chalk = chalkModule;
import { Command } from 'commander';
import { ClaudeCodeDetector } from '../../utils/claude-detector.js';
import { HookInjector } from '../../utils/hook-injector.js';
import { Logger } from '../../utils/logger.js';

interface ClaudeRegisterOptions {
  force?: boolean;
  remove?: boolean;
  status?: boolean;
  manual?: boolean;
}

/**
 * Claude Code registration command handler
 */
export async function claudeRegisterCommand(options: ClaudeRegisterOptions): Promise<void> {
  const logger = Logger.getInstance();

  try {
    // Handle status option
    if (options.status) {
      console.log(chalk.blue('📊 CCanywhere Claude Code Hook Status'));
      console.log(chalk.gray('='.repeat(50)));

      try {
        const environment = await ClaudeCodeDetector.detectEnvironment();
        const hooksInjected = await HookInjector.areHooksInjected();
        const backups = await HookInjector.listBackups();

        if (environment.isClaudeCode) {
          console.log(chalk.green('✅ Claude Code detected!'));
          console.log(chalk.gray(`   Version: ${environment.version || 'unknown'}`));
          console.log(chalk.gray(`   Config: ${environment.configDir}`));
        } else {
          console.log(chalk.red('❌ Claude Code environment not detected'));
        }

        console.log();
        if (hooksInjected) {
          console.log(chalk.green('✅ CCanywhere hooks are already registered'));
        } else {
          console.log(chalk.yellow('⚠️  CCanywhere hooks are not registered'));
        }

        if (backups.length > 0) {
          console.log();
          console.log(chalk.blue('Available backups:'));
          backups.forEach(backup => {
            console.log(chalk.gray(`   • ${backup}`));
          });
        }
      } catch (error) {
        console.log(chalk.red('❌ Error checking status:'));
        console.log(chalk.red(error instanceof Error ? error.message : String(error)));
      }
      return;
    }

    // Handle manual option
    if (options.manual) {
      showManualInstructions();
      return;
    }

    // Handle remove option
    if (options.remove) {
      try {
        const result = await HookInjector.removeHooks();
        if (result.success) {
          console.log(chalk.green('✅ Successfully removed CCanywhere hooks'));
          if (result.message) {
            console.log(chalk.gray(`   ${result.message}`));
          }
        } else {
          console.log(chalk.yellow(`⚠️  ${result.message}`));
        }
      } catch (error) {
        console.log(chalk.red('❌ Failed to remove hooks:'));
        console.log(chalk.red(error instanceof Error ? error.message : String(error)));
      }
      return;
    }

    // Detect Claude Code environment
    const environment = await ClaudeCodeDetector.detectEnvironment();

    if (!environment.isClaudeCode) {
      console.log(chalk.red('❌ Claude Code environment not detected'));
      console.log(chalk.yellow('Please ensure Claude Code is installed and configured'));
      return;
    }

    console.log(chalk.green('✅ Claude Code detected!'));
    console.log(chalk.gray(`   Version: ${environment.version || 'unknown'}`));
    console.log(chalk.gray(`   Config: ${environment.configDir}`));
    console.log();

    // Check if hooks are already registered
    const alreadyInjected = await HookInjector.areHooksInjected();
    if (alreadyInjected && !options.force) {
      console.log(chalk.yellow('⚠️  CCanywhere hooks are already registered'));
      console.log(chalk.gray('Use --force to overwrite existing hooks'));
      return;
    }

    // Simple Stop hook configuration
    const hookOptions = {
      enableStop: true, // Only use Stop event for Claude Code sessions
      createBackup: true,
      force: options.force
    };

    // Inject hooks
    const result = await HookInjector.injectHooks(hookOptions);

    if (result.success) {
      console.log(chalk.green('✅ Successfully registered CCanywhere hooks!'));
      
      if (result.hooksAdded.length > 0) {
        console.log(chalk.blue('Hooks added:'));
        result.hooksAdded.forEach(hook => {
          console.log(chalk.gray(`   • ${hook}`));
        });
      }

      if (result.hooksSkipped.length > 0) {
        console.log(chalk.yellow('Hooks skipped (already exist):'));
        result.hooksSkipped.forEach(hook => {
          console.log(chalk.gray(`   • ${hook}`));
        });
      }

      if (result.backupPath) {
        console.log();
        console.log(chalk.blue('Backup created at:'));
        console.log(chalk.gray(`   ${result.backupPath}`));
      }
    } else {
      console.log(chalk.red('❌ Failed to register hooks:'));
      console.log(chalk.red(result.message));
      process.exit(1);
    }

  } catch (error) {
    console.log(chalk.red('❌ Registration failed:'));
    console.log(chalk.red(error instanceof Error ? error.message : String(error)));
    if (process.env.NODE_ENV === 'development') {
      logger.error('Registration error:', error);
    }

    process.exit(1);
  }
}

/**
 * Show manual instructions for configuring hooks
 */
function showManualInstructions(): void {
  console.log(chalk.blue('📚 Manual Hook Configuration Instructions'));
  console.log(chalk.gray('='.repeat(50)));
  console.log();
  console.log(chalk.yellow('For Claude Code (Stop event):'));
  console.log(chalk.gray('1. Open your Claude Code settings'));
  console.log(chalk.gray('2. Add this to your hooks configuration:'));
  console.log();
  console.log(
    chalk.cyan(
      JSON.stringify(
        {
          hooks: {
            Stop: [
              {
                matcher: '.*',
                hooks: [
                  {
                    type: 'command',
                    command: 'cd "$CLAUDE_PROJECT_DIR" && npx ccanywhere run --hook-mode'
                  }
                ]
              }
            ]
          }
        },
        null,
        2
      )
    )
  );
  console.log();
  console.log(chalk.yellow('⚠️  Important:'));
  console.log(chalk.gray('   • Use --hook-mode to skip prompts in projects without config'));
  console.log(chalk.gray('   • Using npx ensures ccanywhere is available even without global install'));
}

/**
 * Create the claude-register command
 */
export function createClaudeRegisterCommand(): Command {
  return new Command('claude-register')
    .description('Configure CCanywhere hooks for Claude Code')
    .option('-f, --force', 'Overwrite existing hooks')
    .option('--remove', 'Remove CCanywhere hooks from Claude Code')
    .option('--status', 'Show current hook registration status')
    .option('--manual', 'Show manual configuration instructions')
    .action(claudeRegisterCommand);
}

export default createClaudeRegisterCommand;
