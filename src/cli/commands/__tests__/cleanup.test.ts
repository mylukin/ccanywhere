/**
 * Tests for cleanup command
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

// Mock chalk
const mockChalk = {
  blue: jest.fn((text: string) => text) as jest.Mock,
  green: jest.fn((text: string) => text) as jest.Mock,
  yellow: jest.fn((text: string) => text) as jest.Mock,
  red: jest.fn((text: string) => text) as jest.Mock,
  gray: jest.fn((text: string) => text) as jest.Mock
};
jest.unstable_mockModule('chalk', () => ({
  default: mockChalk
}));

// Mock inquirer
const mockPrompt = jest.fn() as any;
jest.unstable_mockModule('inquirer', () => ({
  default: {
    prompt: mockPrompt
  }
}));

// Mock logger
const mockLogger = {
  cleanup: jest.fn() as any
};
const mockCreateLogger = jest.fn(() => mockLogger) as jest.Mock;
jest.unstable_mockModule('@/core/logger', () => ({
  createLogger: mockCreateLogger
}));

// Mock fs-extra
const mockFs = {
  pathExists: jest.fn() as any,
  readdir: jest.fn() as any,
  stat: jest.fn() as any,
  remove: jest.fn() as any,
  unlink: jest.fn() as any
};

jest.unstable_mockModule('fs-extra', () => ({
  default: mockFs
}));

// Import the module after mocking
const { cleanupCommand } = await import('../cleanup.js');

describe('cleanupCommand', () => {
  let originalConsole: any;
  let originalCwd: any;
  let originalExit: any;
  let originalDate: any;

  beforeEach(() => {
    // Mock console methods
    originalConsole = { ...console };
    console.log = jest.fn();
    console.error = jest.fn();

    // Mock process.cwd and process.exit
    originalCwd = process.cwd;
    originalExit = process.exit;
    process.cwd = jest.fn(() => '/test/project');
    process.exit = jest.fn() as any;

    // Mock Date.now
    originalDate = Date.now;
    Date.now = jest.fn(() => 1672574400000); // Fixed timestamp

    // Mock dynamic import
    jest.doMock('fs-extra', () => mockFs);

    // Reset all mocks
    jest.clearAllMocks();

    // Setup default mock returns
    mockPrompt.mockResolvedValue({ confirm: true });
    mockFs.pathExists.mockResolvedValue(false);
    mockFs.readdir.mockResolvedValue([]);
    mockFs.stat.mockResolvedValue({ mtime: new Date(Date.now()), isDirectory: () => false });
    mockFs.unlink.mockResolvedValue(undefined);
    mockFs.remove.mockResolvedValue(undefined);
    mockCreateLogger.mockReturnValue(mockLogger);
    mockLogger.cleanup.mockResolvedValue(undefined);
  });

  afterEach(() => {
    // Restore everything
    console.log = originalConsole.log;
    console.error = originalConsole.error;
    process.cwd = originalCwd;
    process.exit = originalExit;
    Date.now = originalDate;
  });

  describe('successful cleanup', () => {
    it('should run cleanup with default settings', async () => {
      await cleanupCommand({});

      expect(console.log).toHaveBeenCalledWith('🧹 Cleanup old artifacts, logs, and locks');
      expect(console.log).toHaveBeenCalledWith('Keeping files newer than 7 days');
      expect(mockPrompt).toHaveBeenCalledWith([
        expect.objectContaining({
          type: 'confirm',
          name: 'confirm',
          message: 'Continue with cleanup?',
          default: false
        })
      ]);
      expect(mockCreateLogger).toHaveBeenCalledWith({
        logDir: expect.stringMatching(/logs$/)
      });
      expect(console.log).toHaveBeenCalledWith('✅ Cleanup completed!');
    });

    it('should run cleanup with custom days', async () => {
      await cleanupCommand({ days: '14' });

      expect(console.log).toHaveBeenCalledWith('Keeping files newer than 14 days');
      expect(mockLogger.cleanup).toHaveBeenCalledWith(14);
    });

    it('should skip confirmation with force flag', async () => {
      await cleanupCommand({ force: true });

      expect(mockPrompt).not.toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith('✅ Cleanup completed!');
    });

    it('should cancel cleanup when user declines', async () => {
      mockPrompt.mockResolvedValue({ confirm: false });

      await cleanupCommand({});

      expect(console.log).toHaveBeenCalledWith('Cleanup cancelled.');
      expect(mockLogger.cleanup).not.toHaveBeenCalled();
    });

    it('should handle missing logger cleanup method', async () => {
      const loggerWithoutCleanup = {};
      mockCreateLogger.mockReturnValue(loggerWithoutCleanup);

      await cleanupCommand({});

      // Should not fail, just skip logger cleanup
      expect(console.log).toHaveBeenCalledWith('✅ Cleanup completed!');
    });
  });

  describe('artifact cleanup', () => {
    it('should clean old artifacts', async () => {
      // Mock artifacts directory exists
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readdir.mockResolvedValue(['old-file.txt', 'new-file.txt']);
      
      const oldDate = new Date('2022-01-01');
      const newDate = new Date('2024-01-01');
      
      mockFs.stat.mockImplementation((filePath: string) => {
        if (filePath.includes('old-file')) {
          return Promise.resolve({ 
            mtime: oldDate, 
            isDirectory: () => false 
          });
        } else {
          return Promise.resolve({ 
            mtime: newDate, 
            isDirectory: () => false 
          });
        }
      });

      await cleanupCommand({});

      expect(mockFs.unlink).toHaveBeenCalledWith(expect.stringContaining('old-file.txt'));
      expect(mockFs.unlink).not.toHaveBeenCalledWith(expect.stringContaining('new-file.txt'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Removed: old-file.txt'));
      expect(console.log).toHaveBeenCalledWith('Removed 1 old artifact(s)');
    });

    it('should remove old directories', async () => {
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readdir.mockResolvedValue(['old-dir']);
      
      const oldDate = new Date('2022-01-01');
      mockFs.stat.mockResolvedValue({ 
        mtime: oldDate, 
        isDirectory: () => true 
      });

      await cleanupCommand({});

      expect(mockFs.remove).toHaveBeenCalledWith(expect.stringContaining('old-dir'));
      expect(console.log).toHaveBeenCalledWith('Removed 1 old artifact(s)');
    });

    it('should handle missing artifacts directory', async () => {
      mockFs.pathExists.mockResolvedValue(false);

      await cleanupCommand({});

      expect(console.log).toHaveBeenCalledWith('No artifacts directory found');
      expect(mockFs.readdir).not.toHaveBeenCalled();
    });

    it('should handle empty artifacts directory', async () => {
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readdir.mockResolvedValue([]);

      await cleanupCommand({});

      expect(console.log).toHaveBeenCalledWith('Removed 0 old artifact(s)');
    });
  });

  describe('error handling', () => {
    it('should handle prompt errors', async () => {
      mockPrompt.mockRejectedValue(new Error('Prompt failed'));

      await cleanupCommand({});

      expect(console.error).toHaveBeenCalledWith('Cleanup failed:');
      expect(console.error).toHaveBeenCalledWith('Prompt failed');
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should handle logger creation errors', async () => {
      mockCreateLogger.mockImplementation(() => {
        throw new Error('Logger creation failed');
      });

      await cleanupCommand({});

      expect(console.error).toHaveBeenCalledWith('Cleanup failed:');
      expect(console.error).toHaveBeenCalledWith('Logger creation failed');
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should handle artifacts cleanup errors', async () => {
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readdir.mockRejectedValue(new Error('Cannot read directory'));

      await cleanupCommand({});

      expect(console.error).toHaveBeenCalledWith('Cleanup failed:');
      expect(console.error).toHaveBeenCalledWith('Cannot read directory');
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should handle file stat errors', async () => {
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readdir.mockResolvedValue(['test-file.txt']);
      mockFs.stat.mockRejectedValue(new Error('Cannot stat file'));

      await cleanupCommand({});

      expect(console.error).toHaveBeenCalledWith('Cleanup failed:');
      expect(console.error).toHaveBeenCalledWith('Cannot stat file');
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should handle file removal errors', async () => {
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readdir.mockResolvedValue(['old-file.txt']);
      mockFs.stat.mockResolvedValue({
        mtime: new Date('2022-01-01'),
        isDirectory: () => false
      });
      mockFs.unlink.mockRejectedValue(new Error('Cannot remove file'));

      await cleanupCommand({});

      expect(console.error).toHaveBeenCalledWith('Cleanup failed:');
      expect(console.error).toHaveBeenCalledWith('Cannot remove file');
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should handle non-Error objects', async () => {
      mockFs.pathExists.mockRejectedValue('String error');

      await cleanupCommand({});

      expect(console.error).toHaveBeenCalledWith('Cleanup failed:');
      expect(console.error).toHaveBeenCalledWith('String error');
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });

  describe('days parsing', () => {
    it('should handle invalid days input', async () => {
      await cleanupCommand({ days: 'invalid' });

      expect(console.log).toHaveBeenCalledWith('Keeping files newer than NaN days');
      // Should still attempt to run (NaN will be passed to cleanup functions)
    });

    it('should handle zero days', async () => {
      await cleanupCommand({ days: '0' });

      expect(console.log).toHaveBeenCalledWith('Keeping files newer than 0 days');
      expect(mockLogger.cleanup).toHaveBeenCalledWith(0);
    });

    it('should handle negative days', async () => {
      await cleanupCommand({ days: '-5' });

      expect(console.log).toHaveBeenCalledWith('Keeping files newer than -5 days');
      expect(mockLogger.cleanup).toHaveBeenCalledWith(-5);
    });
  });

  describe('cutoff time calculation', () => {
    it('should calculate correct cutoff time', async () => {
      const fixedNow = 1672574400000; // 2023-01-01T12:00:00.000Z
      Date.now = jest.fn(() => fixedNow);

      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readdir.mockResolvedValue(['test-file.txt']);
      
      // File older than 7 days should be removed
      const oldFileTime = fixedNow - (8 * 24 * 60 * 60 * 1000);
      mockFs.stat.mockResolvedValue({
        mtime: new Date(oldFileTime),
        isDirectory: () => false
      });

      await cleanupCommand({ days: '7' });

      expect(mockFs.unlink).toHaveBeenCalledWith(expect.stringContaining('test-file.txt'));
    });
  });
});