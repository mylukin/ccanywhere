/**
 * Lock manager tests
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { tmpdir } from 'os';
import { join } from 'path';
import fsExtra from 'fs-extra';
const { ensureDir, remove, pathExists } = fsExtra;
import { FileLockManager } from '../lock-manager.js';

describe('FileLockManager', () => {
  let lockManager: FileLockManager;
  let testDir: string;
  let lockFile: string;

  beforeEach(async () => {
    lockManager = new FileLockManager();
    testDir = join(tmpdir(), `ccanywhere-test-${Date.now()}`);
    lockFile = join(testDir, 'test.lock');
    await ensureDir(testDir);
  });

  afterEach(async () => {
    try {
      await remove(testDir);
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('acquire', () => {
    it('should acquire a lock successfully', async () => {
      const lockInfo = await lockManager.acquire(lockFile);
      expect(lockInfo.acquired).toBe(true);
      expect(lockInfo.pid).toBe(process.pid);
      expect(typeof lockInfo.timestamp).toBe('number');
      expect(await pathExists(lockFile)).toBe(true);
      // Clean up
      await lockManager.release(lockFile);
    });

    it('should fail to acquire lock when already locked', async () => {
      // First lock should succeed
      const lockInfo1 = await lockManager.acquire(lockFile, 1); // 1 second timeout
      expect(lockInfo1.acquired).toBe(true);

      // Second lock should timeout
      await expect(lockManager.acquire(lockFile, 1)).rejects.toThrow('Lock acquisition timed out');
      // Clean up
      await lockManager.release(lockFile);
    });

    it('should create lock directory if it does not exist', async () => {
      const nestedLockFile = join(testDir, 'nested', 'deep', 'test.lock');
      const lockInfo = await lockManager.acquire(nestedLockFile);
      expect(lockInfo.acquired).toBe(true);
      expect(await pathExists(nestedLockFile)).toBe(true);
      // Clean up
      await lockManager.release(nestedLockFile);
    });
  });

  describe('release', () => {
    it('should release a lock successfully', async () => {
      await lockManager.acquire(lockFile);
      await lockManager.release(lockFile);
      expect(await pathExists(lockFile)).toBe(false);
    });

    it('should not throw when releasing non-existent lock', async () => {
      await expect(lockManager.release(lockFile)).resolves.not.toThrow();
    });
  });

  describe('isLocked', () => {
    it('should return false for non-existent lock', async () => {
      const isLocked = await lockManager.isLocked(lockFile);
      expect(isLocked).toBe(false);
    });

    it('should return true for active lock', async () => {
      await lockManager.acquire(lockFile);
      const isLocked = await lockManager.isLocked(lockFile);
      expect(isLocked).toBe(true);
      // Clean up
      await lockManager.release(lockFile);
    });

    it('should return false for stale lock (dead process)', async () => {
      // Create a fake lock with a non-existent PID
      const fakeLockContent = JSON.stringify({
        pid: 999999, // Very unlikely to be a real PID
        timestamp: Date.now(),
        revision: 'test'
      });
      await fsExtra.writeFile(lockFile, fakeLockContent);
      const isLocked = await lockManager.isLocked(lockFile);
      expect(isLocked).toBe(false);
    });
  });

  describe('clean', () => {
    it('should clean up stale locks', async () => {
      // Create some test locks
      const lock1 = join(testDir, 'lock1.lock');
      const lock2 = join(testDir, 'lock2.lock');
      // Create a stale lock (non-existent PID)
      await fsExtra.writeFile(
        lock1,
        JSON.stringify({
          pid: 999999,
          timestamp: Date.now(),
          revision: 'test'
        })
      );
      // Create an active lock
      await lockManager.acquire(lock2);
      // Clean should remove stale lock but keep active one
      await lockManager.clean(testDir);
      expect(await pathExists(lock1)).toBe(false);
      expect(await pathExists(lock2)).toBe(true);
      // Clean up
      await lockManager.release(lock2);
    });

    it('should clean up very old locks', async () => {
      const oldLock = join(testDir, 'old.lock');
      // Create a very old lock (2 hours ago)
      await fsExtra.writeFile(
        oldLock,
        JSON.stringify({
          pid: process.pid,
          timestamp: Date.now() - 2 * 60 * 60 * 1000, // 2 hours ago
          revision: 'test'
        })
      );
      await lockManager.clean(testDir);
      expect(await pathExists(oldLock)).toBe(false);
    });
  });

  describe('getLockInfo', () => {
    it('should return lock info for existing lock', async () => {
      await lockManager.acquire(lockFile);
      const lockInfo = await lockManager.getLockInfo(lockFile);
      expect(lockInfo).not.toBeNull();
      expect(lockInfo?.pid).toBe(process.pid);
      expect(lockInfo?.acquired).toBe(true);
      // Clean up
      await lockManager.release(lockFile);
    });

    it('should return null for non-existent lock', async () => {
      const lockInfo = await lockManager.getLockInfo(lockFile);
      expect(lockInfo).toBeNull();
    });
  });
});
