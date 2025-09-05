/**
 * Tests for run command
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

// Mock ora
const mockOra = jest.fn(() => ({
  start: jest.fn().mockReturnThis() as jest.Mock,
  succeed: jest.fn().mockReturnThis() as jest.Mock,
  fail: jest.fn().mockReturnThis() as jest.Mock
})) as jest.Mock;
jest.unstable_mockModule('ora', () => ({
  default: mockOra
}));

// Mock chalk
const mockChalk = {
  blue: jest.fn((text: string) => text) as jest.Mock,
  green: jest.fn((text: string) => text) as jest.Mock,
  yellow: jest.fn((text: string) => text) as jest.Mock,
  red: jest.fn((text: string) => text) as jest.Mock,
  cyan: jest.fn((text: string) => text) as jest.Mock,
  gray: jest.fn((text: string) => text) as jest.Mock
};
jest.unstable_mockModule('chalk', () => ({
  default: mockChalk
}));

// Mock ConfigLoader
const mockConfigLoader = {
  loadConfig: jest.fn() as jest.Mock
};
const mockGetInstance = jest.fn(() => mockConfigLoader) as jest.Mock;

jest.unstable_mockModule('../../config/index.js', () => ({
  ConfigLoader: {
    getInstance: mockGetInstance
  }
}));

// Mock logger
const mockLogger = {
  info: jest.fn() as jest.Mock,
  error: jest.fn() as jest.Mock,
  debug: jest.fn() as jest.Mock
};
const mockCreateLogger = jest.fn(() => mockLogger) as jest.Mock;

jest.unstable_mockModule('../../core/logger.js', () => ({
  createLogger: mockCreateLogger
}));

// Mock BuildPipeline
const mockPipeline = {
  run: jest.fn() as jest.Mock
};
const mockBuildPipeline = jest.fn(() => mockPipeline) as jest.Mock;

jest.unstable_mockModule('../../core/pipeline.js', () => ({
  BuildPipeline: mockBuildPipeline
}));

// Import the module after mocking
const { runCommand } = await import('../run.js');

describe('runCommand', () => {
  let originalConsole: any;
  let originalCwd: any;
  let originalExit: any;

  beforeEach(() => {
    // Mock console methods
    originalConsole = { ...console };
    console.log = jest.fn() as jest.Mock;
    console.error = jest.fn() as jest.Mock;

    // Mock process.cwd and process.exit
    originalCwd = process.cwd;
    originalExit = process.exit;
    process.cwd = jest.fn(() => '/test/project') as jest.Mock;
    process.exit = jest.fn() as any;

    // Reset all mocks
    jest.clearAllMocks();

    // Setup default mock returns
    mockConfigLoader.loadConfig.mockResolvedValue({
      repo: { kind: 'github', url: 'https://github.com/test/repo', branch: 'main' },
      build: { base: 'origin/main', lockTimeout: 300, cleanupDays: 7 },
      notifications: { channels: ['telegram'] }
    });
  });

  afterEach(() => {
    // Restore console and process
    console.log = originalConsole.log;
    console.error = originalConsole.error;
    process.cwd = originalCwd;
    process.exit = originalExit;
  });

  describe('successful build', () => {
    it('should run build pipeline successfully', async () => {
      const mockResult = {
        success: true,
        duration: 5000,
        revision: 'abc123',
        branch: 'main',
        artifacts: [],
        deploymentUrl: null,
        testResults: null,
        commitInfo: null
      };

      mockPipeline.run.mockResolvedValue(mockResult);

      await runCommand({});

      expect(mockConfigLoader.loadConfig).toHaveBeenCalledWith(undefined);
      expect(mockCreateLogger).toHaveBeenCalledWith({
        logDir: expect.stringMatching(/logs$/),
        level: 'info',
        console: true
      });
      expect(mockBuildPipeline).toHaveBeenCalledWith({
        workDir: expect.any(String),
        config: expect.any(Object),
        logger: mockLogger,
        dryRun: undefined
      });
      expect(mockPipeline.run).toHaveBeenCalledWith(undefined, undefined);
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Build completed successfully'));
    });

    it('should display artifacts when available', async () => {
      const mockResult = {
        success: true,
        duration: 3000,
        revision: 'abc123',
        branch: 'main',
        artifacts: [
          { type: 'diff', url: 'https://artifacts.test.com/diff.html' },
          { type: 'report', url: 'https://artifacts.test.com/report.html' }
        ],
        deploymentUrl: null,
        testResults: null,
        commitInfo: null
      };

      mockPipeline.run.mockResolvedValue(mockResult);

      await runCommand({});

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Generated artifacts:'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('📝 diff:'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('📊 report:'));
    });

    it('should display deployment URL when available', async () => {
      const mockResult = {
        success: true,
        duration: 4000,
        revision: 'abc123',
        branch: 'main',
        artifacts: [],
        deploymentUrl: 'https://deploy.test.com/abc123',
        testResults: null,
        commitInfo: null
      };

      mockPipeline.run.mockResolvedValue(mockResult);

      await runCommand({});

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Deployment URL:'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('https://deploy.test.com/abc123'));
    });

    it('should display test results when available', async () => {
      const mockResult = {
        success: true,
        duration: 6000,
        revision: 'abc123',
        branch: 'main',
        artifacts: [],
        deploymentUrl: null,
        testResults: {
          status: 'passed',
          passed: 25,
          failed: 0,
          skipped: 2,
          reportUrl: 'https://test.com/report.html'
        },
        commitInfo: null
      };

      mockPipeline.run.mockResolvedValue(mockResult);

      await runCommand({});

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Test results:'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Status: ✅ passed'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Passed: 25'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Failed: 0'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Skipped: 2'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Report: https://test.com/report.html'));
    });

    it('should display commit info when available', async () => {
      const mockResult = {
        success: true,
        duration: 2000,
        revision: 'abc123',
        branch: 'main',
        artifacts: [],
        deploymentUrl: null,
        testResults: null,
        commitInfo: {
          author: 'John Doe',
          message: 'Add new feature'
        }
      };

      mockPipeline.run.mockResolvedValue(mockResult);

      await runCommand({});

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Commit info:'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Author: John Doe'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Message: Add new feature'));
    });
  });

  describe('failed build', () => {
    it('should handle build failure', async () => {
      const mockResult = {
        success: false,
        duration: 1000,
        revision: 'abc123',
        branch: 'main',
        error: 'Build script failed',
        artifacts: [],
        deploymentUrl: null,
        testResults: null,
        commitInfo: null
      };

      mockPipeline.run.mockResolvedValue(mockResult);

      await runCommand({});

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Build failed!'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Duration: 1s'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Error details:'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Build script failed'));
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should handle failed test results', async () => {
      const mockResult = {
        success: false,
        duration: 3000,
        revision: 'abc123',
        branch: 'main',
        testResults: {
          status: 'failed',
          passed: 15,
          failed: 3,
          skipped: 1,
          reportUrl: 'https://test.com/report.html'
        },
        artifacts: [],
        deploymentUrl: null,
        commitInfo: null,
        error: 'Tests failed'
      };

      mockPipeline.run.mockResolvedValue(mockResult);

      await runCommand({});

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Status: ❌ failed'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Failed: 3'));
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });

  describe('options handling', () => {
    it('should handle custom base and head options', async () => {
      const mockResult = {
        success: true,
        duration: 2000,
        revision: 'def456',
        branch: 'feature',
        artifacts: [],
        deploymentUrl: null,
        testResults: null,
        commitInfo: null
      };

      mockPipeline.run.mockResolvedValue(mockResult);

      await runCommand({
        base: 'origin/develop',
        head: 'feature-branch'
      });

      expect(mockPipeline.run).toHaveBeenCalledWith('origin/develop', 'feature-branch');
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Base: origin/develop'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Head: feature-branch'));
    });

    it('should handle custom working directory', async () => {
      const mockResult = {
        success: true,
        duration: 1500,
        revision: 'ghi789',
        branch: 'main',
        artifacts: [],
        deploymentUrl: null,
        testResults: null,
        commitInfo: null
      };

      mockPipeline.run.mockResolvedValue(mockResult);

      await runCommand({
        workDir: '/custom/work/dir'
      });

      expect(mockBuildPipeline).toHaveBeenCalledWith(
        expect.objectContaining({
          workDir: expect.stringContaining('/custom/work/dir')
        })
      );
    });

    it('should handle dry-run mode', async () => {
      const mockResult = {
        success: true,
        duration: 500,
        revision: 'jkl012',
        branch: 'main',
        artifacts: [],
        deploymentUrl: null,
        testResults: null,
        commitInfo: null
      };

      mockPipeline.run.mockResolvedValue(mockResult);

      await runCommand({ dryRun: true });

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Running in dry-run mode'));
      expect(mockBuildPipeline).toHaveBeenCalledWith(
        expect.objectContaining({
          dryRun: true
        })
      );
    });

    it('should handle verbose mode', async () => {
      const mockResult = {
        success: true,
        duration: 2500,
        revision: 'mno345',
        branch: 'main',
        artifacts: [],
        deploymentUrl: null,
        testResults: null,
        commitInfo: null
      };

      mockPipeline.run.mockResolvedValue(mockResult);

      await runCommand({ verbose: true });

      expect(mockCreateLogger).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'debug'
        })
      );
    });

    it('should handle custom config file', async () => {
      const mockResult = {
        success: true,
        duration: 1800,
        revision: 'pqr678',
        branch: 'main',
        artifacts: [],
        deploymentUrl: null,
        testResults: null,
        commitInfo: null
      };

      mockPipeline.run.mockResolvedValue(mockResult);

      await runCommand({ config: 'custom.config.json' });

      expect(mockConfigLoader.loadConfig).toHaveBeenCalledWith('custom.config.json');
    });
  });

  describe('error handling', () => {
    it('should handle configuration load errors', async () => {
      mockConfigLoader.loadConfig.mockRejectedValue(new Error('Config not found'));

      await runCommand({});

      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Error:'), 'Config not found');
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should handle pipeline creation errors', async () => {
      mockBuildPipeline.mockImplementation(() => {
        throw new Error('Pipeline creation failed');
      });

      await runCommand({});

      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Error:'), 'Pipeline creation failed');
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should handle pipeline run errors', async () => {
      mockPipeline.run.mockRejectedValue(new Error('Pipeline execution failed'));

      await runCommand({});

      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Error:'), 'Pipeline execution failed');
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should show stack trace in verbose mode', async () => {
      const error = new Error('Test error');
      error.stack = 'Error stack trace';
      mockPipeline.run.mockRejectedValue(error);

      await runCommand({ verbose: true });

      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Error:'), 'Test error');
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Error stack trace'));
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should handle non-Error objects', async () => {
      mockPipeline.run.mockRejectedValue('String error');

      await runCommand({});

      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Error:'), 'String error');
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });

  describe('utility functions', () => {
    it('should display correct artifact emojis', async () => {
      const mockResult = {
        success: true,
        duration: 2000,
        revision: 'abc123',
        branch: 'main',
        artifacts: [
          { type: 'diff', url: 'test1.html' },
          { type: 'report', url: 'test2.html' },
          { type: 'trace', url: 'test3.html' },
          { type: 'unknown', url: 'test4.html' }
        ],
        deploymentUrl: null,
        testResults: null,
        commitInfo: null
      };

      mockPipeline.run.mockResolvedValue(mockResult);

      await runCommand({});

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('📝 diff:'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('📊 report:'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('🔍 trace:'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('📦 unknown:'));
    });

    it('should display correct test status emojis', async () => {
      const testCases = [
        { status: 'passed', emoji: '✅' },
        { status: 'failed', emoji: '❌' },
        { status: 'skipped', emoji: '⏭️' },
        { status: 'running', emoji: '🔄' }
      ];

      for (const testCase of testCases) {
        jest.clearAllMocks();

        const mockResult = {
          success: true,
          duration: 2000,
          revision: 'abc123',
          branch: 'main',
          artifacts: [],
          deploymentUrl: null,
          testResults: {
            status: testCase.status,
            passed: 10,
            failed: 0,
            skipped: 0,
            reportUrl: null
          },
          commitInfo: null
        };

        mockPipeline.run.mockResolvedValue(mockResult);

        await runCommand({});

        expect(console.log).toHaveBeenCalledWith(expect.stringContaining(`Status: ${testCase.emoji} ${testCase.status}`));
      }
    });
  });
});