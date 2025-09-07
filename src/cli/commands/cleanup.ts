/**
 * Cleanup command - Clean old artifacts and logs
 */

import { resolve } from 'path';
import chalkModule from 'chalk';
const chalk = chalkModule;
import inquirerModule from 'inquirer';
const inquirer = inquirerModule;
import fsExtraModule from 'fs-extra';
const fs = fsExtraModule;
import { createLogger } from '../../core/logger.js';
import { FileLockManager } from '../../core/lock-manager.js';
import type { CliOptions } from '../../types/index.js';

interface CleanupOptions extends CliOptions {
  days?: string;
  force?: boolean;
}

export async function cleanupCommand(options: CleanupOptions): Promise<void> {
  try {
    const days = parseInt(options.days || '7');
    const workDir = process.cwd();
    const artifactsDir = resolve(workDir, '.artifacts');
    const logDir = resolve(workDir, '../logs');

    console.log(chalk.blue('🧹 Cleanup old artifacts, logs, and locks'));
    console.log(chalk.gray(`Keeping files newer than ${days} days`));
    console.log();

    if (!options.force) {
      const { confirm } = await inquirer.prompt([{
        type: 'confirm',
        name: 'confirm',
        message: 'Continue with cleanup?',
        default: false
      }]);

      if (!confirm) {
        console.log(chalk.yellow('Cleanup cancelled.'));
        return;
      }
    }

    // Cleanup logs
    const logger = createLogger({ logDir });
    if ('cleanup' in logger) {
      await (logger as any).cleanup(days);
    }

    // Cleanup artifacts
    await cleanupArtifacts(artifactsDir, days);

    // Cleanup stale locks
    await cleanupLocks();

    console.log(chalk.green('✅ Cleanup completed!'));

  } catch (error) {
    console.error(chalk.red('Cleanup failed:'));
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

async function cleanupArtifacts(artifactsDir: string, daysToKeep: number): Promise<void> {
  if (!(await fs.pathExists(artifactsDir))) {
    console.log(chalk.gray('No artifacts directory found'));
    return;
  }

  const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
  const files = await fs.readdir(artifactsDir);
  let removedCount = 0;

  for (const file of files) {
    const filePath = resolve(artifactsDir, file);
    const stats = await fs.stat(filePath);

    if (stats.mtime.getTime() < cutoffTime) {
      if (stats.isDirectory()) {
        await fs.remove(filePath);
      } else {
        await fs.unlink(filePath);
      }
      removedCount++;
      console.log(chalk.gray(`Removed: ${file}`));
    }
  }

  console.log(`Removed ${removedCount} old artifact(s)`);
}

async function cleanupLocks(): Promise<void> {
  try {
    const lockManager = new FileLockManager();
    const lockDir = '/tmp/ccanywhere-locks';
    
    // Check if lock directory exists
    if (!(await fs.pathExists(lockDir))) {
      console.log(chalk.gray('No locks directory found'));
      return;
    }
    
    // Clean stale locks
    const cleaned = await lockManager.clean(lockDir);
    console.log(chalk.gray(`Cleaned stale locks`));
    
  } catch (error) {
    // Lock cleanup is not critical, so just log a warning
    console.log(chalk.yellow('Warning: Could not clean locks'));
    console.log(chalk.gray(`  ${error instanceof Error ? error.message : String(error)}`));
  }
}