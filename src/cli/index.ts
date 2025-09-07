#!/usr/bin/env node

/**
 * CCanywhere CLI entry point
 */

import { Command } from 'commander';
import chalkModule from 'chalk';
const chalk = chalkModule;
import { getVersion } from '../utils/version.js';
import { initCommand } from './commands/init.js';
import { runCommand } from './commands/run.js';
import { testCommand } from './commands/test-runner.js';
import { infoCommand } from './commands/info.js';
import { cleanupCommand } from './commands/cleanup.js';
import { createRegisterCommand } from './commands/register.js';
import { checkFirstRun } from '../utils/first-run.js';

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
  .option('--send', 'Send test notifications (use with --notifications)')
  .option('--title <title>', 'Custom notification title', '🔔 Test from CCanywhere')
  .option('--message <message>', 'Custom notification message')
  .option('--channels <channels>', 'Comma-separated list of channels to test')
  .action(testCommand);

// Cleanup operations
program
  .command('cleanup')
  .description('Clean up old artifacts, logs, and locks')
  .option('-d, --days <number>', 'Days to keep (default: 7)', '7')
  .option('-f, --force', 'Force cleanup without confirmation')
  .action(cleanupCommand);

// Claude Code integration
program.addCommand(createRegisterCommand());

// Build info command
program.addCommand(infoCommand);

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
    // Check for first run (allow interactive for most commands)
    const command = process.argv[2];
    const skipFirstRunCheck = command === '--help' || command === '-h' || command === '--version' || command === '-V';

    if (!skipFirstRunCheck) {
      // Allow interactive prompt for first run
      await checkFirstRun(false);
    }

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
