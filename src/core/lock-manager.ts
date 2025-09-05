/**
 * File-based lock mechanism for concurrency control
 */

import { hostname } from 'os';
import fsExtra from 'fs-extra';
const { readFile, unlink, ensureDir, pathExists, readdir, outputFile } = fsExtra;
import { dirname, join } from 'path';
import { execa } from 'execa';
import type { LockManager, LockInfo } from '../types/index.js';
import { LockError } from '../types/index.js';

export class FileLockManager implements LockManager {
  private readonly defaultTimeout: number = 300; // 5 minutes
  private readonly pollInterval: number = 1000; // 1 second

  /**
   * Acquire a file lock
   */
  async acquire(lockFile: string, timeout?: number): Promise<LockInfo> {
    const maxTimeout = (timeout || this.defaultTimeout) * 1000; // Convert to milliseconds
    const startTime = Date.now();
    const currentPid = process.pid;

    // Ensure lock directory exists
    await ensureDir(dirname(lockFile));

    while (Date.now() - startTime < maxTimeout) {
      try {
        // Try to create lock file atomically using O_EXCL
        const lockContent = JSON.stringify(
          {
            pid: currentPid,
            timestamp: Date.now(),
            revision: process.env.REVISION || 'unknown',
            hostname: process.env.HOSTNAME || hostname()
          },
          null,
          2
        );

        // Check if file exists first to emulate exclusive write
        if (await pathExists(lockFile)) {
          throw { code: 'EEXIST' };
        }

        // Write the lock file
        await outputFile(lockFile, lockContent);

        const lockInfo: LockInfo = {
          pid: currentPid,
          timestamp: Date.now(),
          revision: process.env.REVISION || 'unknown',
          acquired: true
        };

        return lockInfo;
      } catch (error: any) {
        // If file already exists, check if the process is still running
        if (error.code === 'EEXIST') {
          const shouldContinueWaiting = await this.handleExistingLock(lockFile);

          if (!shouldContinueWaiting) {
            // The lock was stale and removed, try again immediately
            continue;
          }

          // Wait before retrying
          await this.sleep(this.pollInterval);
          continue;
        }

        throw new LockError(`Failed to acquire lock: ${error.message}`);
      }
    }

    throw new LockError(`Lock acquisition timed out after ${maxTimeout / 1000}s`);
  }

  /**
   * Release a file lock
   */
  async release(lockFile: string): Promise<void> {
    try {
      if (await pathExists(lockFile)) {
        // Verify we own the lock before releasing
        const lockInfo = await this.readLockInfo(lockFile);

        if (lockInfo && lockInfo.pid !== process.pid) {
          console.warn(`Warning: Releasing lock owned by different process (${lockInfo.pid})`);
        }

        await unlink(lockFile);
      }
    } catch (error) {
      // Don't throw on release failures - just log
      console.warn(`Failed to release lock ${lockFile}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Check if a lock file exists and is active
   */
  async isLocked(lockFile: string): Promise<boolean> {
    if (!(await pathExists(lockFile))) {
      return false;
    }

    const lockInfo = await this.readLockInfo(lockFile);

    if (!lockInfo) {
      return false;
    }

    // Check if the process is still running
    return await this.isProcessRunning(lockInfo.pid);
  }

  /**
   * Clean up stale locks in a directory
   */
  async clean(lockDir: string): Promise<void> {
    try {
      if (!(await pathExists(lockDir))) {
        return;
      }

      const files = await readdir(lockDir);
      const lockFiles = files.filter(file => file.endsWith('.lock'));

      let removedCount = 0;

      for (const lockFile of lockFiles) {
        const fullPath = join(lockDir, lockFile);

        try {
          const lockInfo = await this.readLockInfo(fullPath);

          if (!lockInfo) {
            // Malformed lock file
            await unlink(fullPath);
            removedCount++;
            continue;
          }

          // Check if process is still running
          const isRunning = await this.isProcessRunning(lockInfo.pid);

          if (!isRunning) {
            // Process is dead, remove stale lock
            await unlink(fullPath);
            removedCount++;
            console.log(`Removed stale lock: ${lockFile} (PID ${lockInfo.pid})`);
          }

          // Also check timestamp - remove very old locks (older than 1 hour)
          const lockAge = Date.now() - lockInfo.timestamp;
          if (lockAge > 3600000) {
            // 1 hour
            await unlink(fullPath);
            removedCount++;
            console.log(`Removed old lock: ${lockFile} (age: ${Math.round(lockAge / 60000)}m)`);
          }
        } catch (error) {
          console.warn(
            `Failed to process lock file ${lockFile}: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }

      if (removedCount > 0) {
        console.log(`Cleaned up ${removedCount} stale lock(s)`);
      }
    } catch (error) {
      throw new LockError(`Failed to clean lock directory: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Handle existing lock file
   */
  private async handleExistingLock(lockFile: string): Promise<boolean> {
    const lockInfo = await this.readLockInfo(lockFile);

    if (!lockInfo) {
      // Malformed lock file, remove it
      try {
        await unlink(lockFile);
        return false; // Don't wait, try again immediately
      } catch (error) {
        return true; // Failed to remove, continue waiting
      }
    }

    // Check if the process is still running
    const isRunning = await this.isProcessRunning(lockInfo.pid);

    if (!isRunning) {
      // Process is dead, remove stale lock
      try {
        await unlink(lockFile);
        console.log(`Removed stale lock from dead process ${lockInfo.pid}`);
        return false; // Don't wait, try again immediately
      } catch (error) {
        console.warn(`Failed to remove stale lock: ${error instanceof Error ? error.message : String(error)}`);
        return true; // Continue waiting
      }
    }

    // Process is still running, continue waiting
    return true;
  }

  /**
   * Read lock information from file
   */
  private async readLockInfo(lockFile: string): Promise<LockInfo | null> {
    try {
      const content = await readFile(lockFile, 'utf8');
      const data = JSON.parse(content);

      return {
        pid: data.pid,
        timestamp: data.timestamp,
        revision: data.revision || 'unknown',
        acquired: true
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Check if a process is still running
   */
  private async isProcessRunning(pid: number): Promise<boolean> {
    try {
      // On Unix-like systems, use kill -0 to check process existence
      if (process.platform !== 'win32') {
        process.kill(pid, 0);
        return true;
      } else {
        // On Windows, use tasklist command
        const result = await execa('tasklist', ['/FI', `PID eq ${pid}`, '/FO', 'CSV'], {
          timeout: 5000,
          reject: false
        });

        return result.stdout.includes(pid.toString());
      }
    } catch (error: any) {
      // ESRCH means the process doesn't exist
      if (error.code === 'ESRCH') {
        return false;
      }

      // For other errors, assume the process is running to be safe
      return true;
    }
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get lock information if exists
   */
  async getLockInfo(lockFile: string): Promise<LockInfo | null> {
    if (!(await pathExists(lockFile))) {
      return null;
    }

    return await this.readLockInfo(lockFile);
  }

  /**
   * Force release a lock (dangerous - use with caution)
   */
  async forceRelease(lockFile: string): Promise<void> {
    if (await pathExists(lockFile)) {
      await unlink(lockFile);
      console.log(`Force released lock: ${lockFile}`);
    }
  }

  /**
   * Wait for lock to be available
   */
  async waitForLock(lockFile: string, timeout?: number): Promise<void> {
    const maxTimeout = (timeout || this.defaultTimeout) * 1000;
    const startTime = Date.now();

    while (Date.now() - startTime < maxTimeout) {
      if (!(await this.isLocked(lockFile))) {
        return;
      }

      await this.sleep(this.pollInterval);
    }

    throw new LockError(`Timeout waiting for lock to be released: ${lockFile}`);
  }
}
