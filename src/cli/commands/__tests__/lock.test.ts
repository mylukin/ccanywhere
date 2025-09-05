/**
 * Tests for lock command
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

// Mock chalk
const mockChalk = {
  yellow: jest.fn((text: string) => text) as jest.Mock,
  green: jest.fn((text: string) => text) as jest.Mock,
  red: jest.fn((text: string) => text) as jest.Mock,
  gray: jest.fn((text: string) => text) as jest.Mock
};
jest.unstable_mockModule('chalk', () => ({
  default: mockChalk
}));

// Mock FileLockManager
const mockLockManager = {
  isLocked: jest.fn() as any,
  getLockInfo: jest.fn() as any,
  clean: jest.fn() as any,
  forceRelease: jest.fn() as any
};
const mockFileLockManager = jest.fn(() => mockLockManager) as jest.Mock;

jest.unstable_mockModule('@/core/lock-manager', () => ({
  FileLockManager: mockFileLockManager
}));

// Import the module after mocking
const { lockCommand } = await import('../lock.js');

describe('lock command', () => {
  let originalConsole: any;
  let originalExit: any;

  beforeEach(() => {
    // Mock console methods
    originalConsole = { ...console };
    console.log = jest.fn() as any;
    console.error = jest.fn() as any;

    // Mock process.exit
    originalExit = process.exit;
    process.exit = jest.fn() as any;

    // Reset all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Restore console and process
    console.log = originalConsole.log;
    console.error = originalConsole.error;
    process.exit = originalExit;
  });

  describe('status subcommand', () => {
    it('should show unlocked status', async () => {
      mockLockManager.isLocked.mockResolvedValue(false);

      const command = lockCommand.commands.find(cmd => cmd.name() === 'status');
      await command?.parseAsync(['status'], { from: 'user' });

      expect(mockFileLockManager).toHaveBeenCalled();
      expect(mockLockManager.isLocked).toHaveBeenCalledWith('/tmp/ccanywhere-locks/main.lock');
      expect(console.log).toHaveBeenCalledWith('🔓 Build is not locked');
    });

    it('should show locked status with info', async () => {
      const mockLockInfo = {
        pid: 12345,
        revision: 'abc123',
        timestamp: 1672574400000
      };

      mockLockManager.isLocked.mockResolvedValue(true);
      mockLockManager.getLockInfo.mockResolvedValue(mockLockInfo);

      const command = lockCommand.commands.find(cmd => cmd.name() === 'status');
      await command?.parseAsync(['status'], { from: 'user' });

      expect(mockLockManager.getLockInfo).toHaveBeenCalledWith('/tmp/ccanywhere-locks/main.lock');
      expect(console.log).toHaveBeenCalledWith('🔒 Build is currently locked');
      expect(console.log).toHaveBeenCalledWith('  PID: 12345');
      expect(console.log).toHaveBeenCalledWith('  Revision: abc123');
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('  Since: 2023-01-01T12:00:00.000Z'));
    });

    it('should show locked status without info', async () => {
      mockLockManager.isLocked.mockResolvedValue(true);
      mockLockManager.getLockInfo.mockResolvedValue(null);

      const command = lockCommand.commands.find(cmd => cmd.name() === 'status');
      await command?.parseAsync(['status'], { from: 'user' });

      expect(console.log).toHaveBeenCalledWith('🔒 Build is currently locked');
      expect(console.log).not.toHaveBeenCalledWith(expect.stringContaining('PID:'));
    });

    it('should use custom lock file path', async () => {
      mockLockManager.isLocked.mockResolvedValue(false);

      const command = lockCommand.commands.find(cmd => cmd.name() === 'status');
      await command?.parseAsync(['status', '-f', '/custom/path.lock'], { from: 'user' });

      expect(mockLockManager.isLocked).toHaveBeenCalledWith('/custom/path.lock');
    });

    it('should handle isLocked errors', async () => {
      mockLockManager.isLocked.mockRejectedValue(new Error('Lock check failed'));

      const command = lockCommand.commands.find(cmd => cmd.name() === 'status');
      await command?.parseAsync(['status'], { from: 'user' });

      expect(console.error).toHaveBeenCalledWith('Error checking lock status:');
      expect(console.error).toHaveBeenCalledWith('Lock check failed');
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should handle getLockInfo errors', async () => {
      mockLockManager.isLocked.mockResolvedValue(true);
      mockLockManager.getLockInfo.mockRejectedValue(new Error('Cannot read lock info'));

      const command = lockCommand.commands.find(cmd => cmd.name() === 'status');
      await command?.parseAsync(['status'], { from: 'user' });

      expect(console.error).toHaveBeenCalledWith('Error checking lock status:');
      expect(console.error).toHaveBeenCalledWith('Cannot read lock info');
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });

  describe('clean subcommand', () => {
    it('should clean stale locks', async () => {
      mockLockManager.clean.mockResolvedValue(undefined);

      const command = lockCommand.commands.find(cmd => cmd.name() === 'clean');
      await command?.parseAsync(['clean'], { from: 'user' });

      expect(mockLockManager.clean).toHaveBeenCalledWith('/tmp/ccanywhere-locks');
      expect(console.log).toHaveBeenCalledWith('✅ Lock cleanup completed');
    });

    it('should use custom lock directory', async () => {
      mockLockManager.clean.mockResolvedValue(undefined);

      const command = lockCommand.commands.find(cmd => cmd.name() === 'clean');
      await command?.parseAsync(['clean', '-d', '/custom/locks'], { from: 'user' });

      expect(mockLockManager.clean).toHaveBeenCalledWith('/custom/locks');
    });

    it('should handle clean errors', async () => {
      mockLockManager.clean.mockRejectedValue(new Error('Cleanup failed'));

      const command = lockCommand.commands.find(cmd => cmd.name() === 'clean');
      await command?.parseAsync(['clean'], { from: 'user' });

      expect(console.error).toHaveBeenCalledWith('Lock cleanup failed:');
      expect(console.error).toHaveBeenCalledWith('Cleanup failed');
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });

  describe('force-release subcommand', () => {
    it('should force release lock', async () => {
      mockLockManager.forceRelease.mockResolvedValue(undefined);

      const command = lockCommand.commands.find(cmd => cmd.name() === 'force-release');
      await command?.parseAsync(['force-release'], { from: 'user' });

      expect(mockLockManager.forceRelease).toHaveBeenCalledWith('/tmp/ccanywhere-locks/main.lock');
      expect(console.log).toHaveBeenCalledWith('✅ Lock force released');
    });

    it('should use custom lock file path', async () => {
      mockLockManager.forceRelease.mockResolvedValue(undefined);

      const command = lockCommand.commands.find(cmd => cmd.name() === 'force-release');
      await command?.parseAsync(['force-release', '-f', '/custom/path.lock'], { from: 'user' });

      expect(mockLockManager.forceRelease).toHaveBeenCalledWith('/custom/path.lock');
    });

    it('should handle force release errors', async () => {
      mockLockManager.forceRelease.mockRejectedValue(new Error('Force release failed'));

      const command = lockCommand.commands.find(cmd => cmd.name() === 'force-release');
      await command?.parseAsync(['force-release'], { from: 'user' });

      expect(console.error).toHaveBeenCalledWith('Force release failed:');
      expect(console.error).toHaveBeenCalledWith('Force release failed');
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });

  describe('error handling', () => {
    it('should handle non-Error objects in status', async () => {
      mockLockManager.isLocked.mockRejectedValue('String error');

      const command = lockCommand.commands.find(cmd => cmd.name() === 'status');
      await command?.parseAsync(['status'], { from: 'user' });

      expect(console.error).toHaveBeenCalledWith('Error checking lock status:');
      expect(console.error).toHaveBeenCalledWith('String error');
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should handle non-Error objects in clean', async () => {
      mockLockManager.clean.mockRejectedValue('String error');

      const command = lockCommand.commands.find(cmd => cmd.name() === 'clean');
      await command?.parseAsync(['clean'], { from: 'user' });

      expect(console.error).toHaveBeenCalledWith('Lock cleanup failed:');
      expect(console.error).toHaveBeenCalledWith('String error');
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should handle non-Error objects in force-release', async () => {
      mockLockManager.forceRelease.mockRejectedValue('String error');

      const command = lockCommand.commands.find(cmd => cmd.name() === 'force-release');
      await command?.parseAsync(['force-release'], { from: 'user' });

      expect(console.error).toHaveBeenCalledWith('Force release failed:');
      expect(console.error).toHaveBeenCalledWith('String error');
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });
});