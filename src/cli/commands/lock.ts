/**
 * Lock command - Manage build locks
 */

import { Command } from 'commander';
import chalkModule from 'chalk';
const chalk = chalkModule;
import { FileLockManager } from '../../core/lock-manager.js';

const lockCommand = new Command('lock');

lockCommand
  .command('status')
  .description('Show lock status')
  .option('-f, --file <path>', 'Lock file path', '/tmp/ccanywhere-locks/main.lock')
  .action(async (options) => {
    try {
      const lockManager = new FileLockManager();
      const isLocked = await lockManager.isLocked(options.file);
      
      if (isLocked) {
        const lockInfo = await lockManager.getLockInfo(options.file);
        console.log(chalk.yellow('🔒 Build is currently locked'));
        if (lockInfo) {
          console.log(chalk.gray(`  PID: ${lockInfo.pid}`));
          console.log(chalk.gray(`  Revision: ${lockInfo.revision}`));
          console.log(chalk.gray(`  Since: ${new Date(lockInfo.timestamp).toISOString()}`));
        }
      } else {
        console.log(chalk.green('🔓 Build is not locked'));
      }
      
    } catch (error) {
      console.error(chalk.red('Error checking lock status:'));
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

lockCommand
  .command('clean')
  .description('Clean stale locks')
  .option('-d, --directory <path>', 'Lock directory', '/tmp/ccanywhere-locks')
  .action(async (options) => {
    try {
      const lockManager = new FileLockManager();
      await lockManager.clean(options.directory);
      console.log(chalk.green('✅ Lock cleanup completed'));
      
    } catch (error) {
      console.error(chalk.red('Lock cleanup failed:'));
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

lockCommand
  .command('force-release')
  .description('Force release a lock (use with caution)')
  .option('-f, --file <path>', 'Lock file path', '/tmp/ccanywhere-locks/main.lock')
  .action(async (options) => {
    try {
      const lockManager = new FileLockManager();
      await lockManager.forceRelease(options.file);
      console.log(chalk.green('✅ Lock force released'));
      
    } catch (error) {
      console.error(chalk.red('Force release failed:'));
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

export { lockCommand };