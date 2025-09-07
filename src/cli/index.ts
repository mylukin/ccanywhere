#!/usr/bin/env node

/**
 * CCanywhere CLI entry point
 */

import { Command } from 'commander';
import chalkModule from 'chalk';
const chalk = chalkModule;
import { ConfigLoader } from '../config/index.js';
import { getVersion } from '../utils/version.js';
import { initCommand } from './commands/init.js';
import { runCommand } from './commands/run.js';
import { testCommand } from './commands/test-runner.js';
import { configCommand } from './commands/config.js';
import { createConfigUserCommand } from './commands/config-user.js';
import { createInitUserCommand } from './commands/init-user.js';
import { cleanupCommand } from './commands/cleanup.js';
import { lockCommand } from './commands/lock.js';
import { notifyCommand } from './commands/notify.js';
import { createClaudeRegisterCommand } from './commands/claude-register.js';

const program = new Command();

program
  .name('ccanywhere')
  .description('Claude Code Anywhere - A TypeScript CI/CD tool for mobile-friendly development workflows')
  .version(getVersion());

// Global options
program
  .option('-c, --config <path>', 'Path to configuration file')
  .option('-v, --verbose', 'Enable verbose logging')
  .option('--dry-run', 'Perform a dry run without making changes')
  .hook('preAction', async thisCommand => {
    // Set global options
    const opts = thisCommand.opts();

    if (opts.verbose) {
      process.env.LOG_LEVEL = 'debug';
    }
  });

// Initialize new project
program
  .command('init')
  .description('Initialize CCanywhere in current directory')
  .option('-f, --force', 'Overwrite existing configuration')
  .action(initCommand);

// Run build pipeline
program
  .command('run')
  .description('Run the complete build pipeline')
  .option('-b, --base <ref>', 'Base git reference for diff', 'origin/main')
  .option('-h, --head <ref>', 'Head git reference for diff', 'HEAD')
  .option('-w, --work-dir <path>', 'Working directory', process.cwd())
  .option('--hook-mode', 'Run in hook mode (skip if no config)', false)
  .action(runCommand);

// Test configuration
program
  .command('test')
  .description('Test CCanywhere configuration and services')
  .option('-a, --all', 'Test all components')
  .option('-n, --notifications', 'Test notification channels only')
  .option('-d, --deployment', 'Test deployment webhook only')
  .option('-t, --tests', 'Test Playwright setup only')
  .action(testCommand);

// Configuration management
program.addCommand(configCommand);

// User configuration management
program.addCommand(createConfigUserCommand());

// Initialize user configuration (for npm link and manual setup)
program.addCommand(createInitUserCommand());

// Cleanup operations
program
  .command('cleanup')
  .description('Clean up old artifacts and logs')
  .option('-d, --days <number>', 'Days to keep (default: 7)', '7')
  .option('-f, --force', 'Force cleanup without confirmation')
  .action(cleanupCommand);

// Lock management
program.addCommand(lockCommand);

// Send test notification
program
  .command('notify')
  .description('Send test notification')
  .option('-c, --channels <channels>', 'Comma-separated list of channels')
  .option('-t, --title <title>', 'Notification title', '🔔 Test from CCanywhere')
  .option('-m, --message <message>', 'Additional message')
  .action(notifyCommand);

// Claude Code integration
program.addCommand(createClaudeRegisterCommand());

// Build info command
program
  .command('info')
  .description('Show build and system information')
  .action(async () => {
    try {
      const configLoader = ConfigLoader.getInstance();
      const config = await configLoader.loadConfig();

      console.log(chalk.blue('CCanywhere Information'));
      console.log(chalk.gray('='.repeat(50)));
      console.log(`Version: ${chalk.green(getVersion())}`);
      console.log(`Node.js: ${chalk.green(process.version)}`);
      console.log(`Platform: ${chalk.green(process.platform)}`);
      console.log(`Working Directory: ${chalk.green(process.cwd())}`);
      console.log();

      console.log(chalk.blue('Configuration'));
      console.log(chalk.gray('-'.repeat(20)));
      console.log(`Repository: ${chalk.green(config.repo?.url || 'Not configured')}`);
      console.log(`Branch: ${chalk.green(config.repo?.branch || 'Not configured')}`);
      console.log(`Artifacts URL: ${chalk.green(config.urls?.artifacts || 'Not configured')}`);
      console.log(`Notification Channels: ${chalk.green(config.notifications?.channels?.join(', ') || 'None')}`);

      if (config.deployment) {
        console.log(`Deployment: ${chalk.green('Configured')}`);
      } else {
        console.log(`Deployment: ${chalk.yellow('Not configured')}`);
      }
    } catch (error) {
      console.error(chalk.red('Error loading configuration:'));
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

// Handle errors
program.exitOverride();

program.configureOutput({
  outputError: (str, write) => {
    write(chalk.red(str));
  }
});

// Parse command line arguments
async function main() {
  try {
    await program.parseAsync(process.argv);
  } catch (error) {
    if (
      error instanceof Error &&
      'code' in error &&
      (error.code === 'commander.helpDisplayed' ||
        error.code === 'commander.help' ||
        error.code === 'commander.version')
    ) {
      // Help or version was displayed, exit normally
      process.exit(0);
    }

    // For commander errors (like unknown commands), don't show "Fatal error:" since commander already shows a clear error
    if (
      error instanceof Error &&
      'code' in error &&
      typeof error.code === 'string' &&
      error.code.startsWith('commander.')
    ) {
      // Commander already displayed the error, just exit
      process.exit(1);
    }

    console.error(chalk.red('Fatal error:'));
    console.error(error instanceof Error ? error.message : String(error));

    if (process.env.NODE_ENV === 'development') {
      console.error(chalk.gray((error as Error).stack));
    }

    process.exit(1);
  }
}

// ES Module entry point - always run main function
main();

export { program };
export default program;
