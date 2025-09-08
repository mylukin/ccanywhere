/**
 * Tests for BuildPipeline
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

// Mock fs-extra
const mockEnsureDir = jest.fn() as any;
jest.unstable_mockModule('fs-extra', () => ({
  default: { ensureDir: mockEnsureDir }
}));

// Mock execa
const mockExeca = jest.fn() as any;
jest.unstable_mockModule('execa', () => ({
  execa: mockExeca
}));

// Mock HtmlDiffGenerator
const mockDiffGenerator = {
  generate: jest.fn() as any,
  uploadArtifacts: jest.fn() as any
};
const mockHtmlDiffGenerator = jest.fn(() => mockDiffGenerator) as jest.Mock;

jest.unstable_mockModule('../core/diff-generator', () => ({
  HtmlDiffGenerator: mockHtmlDiffGenerator
}));

// Mock deployment trigger
const mockDeploymentTrigger = {
  trigger: jest.fn() as any,
  getStatus: jest.fn() as any
};
const mockCreateDeploymentTrigger = jest.fn(() => mockDeploymentTrigger) as jest.Mock;
const mockHasDeploymentConfig = jest.fn() as any;

jest.unstable_mockModule('../core/deployment-trigger', () => ({
  createDeploymentTrigger: mockCreateDeploymentTrigger,
  hasDeploymentConfig: mockHasDeploymentConfig
}));

// Mock test runner
const mockTestRunner = {
  run: jest.fn() as any
};
const mockCreateTestRunner = jest.fn(() => mockTestRunner) as jest.Mock;

jest.unstable_mockModule('../core/test-runner', () => ({
  createTestRunner: mockCreateTestRunner
}));

// Mock NotificationManager
const mockNotificationManager = {
  send: jest.fn() as any,
  createSuccessNotification: jest.fn() as any,
  createErrorNotification: jest.fn() as any
};
const mockNotificationManagerConstructor = jest.fn(() => mockNotificationManager) as jest.Mock;

jest.unstable_mockModule('../core/notifications/manager', () => ({
  NotificationManager: mockNotificationManagerConstructor
}));

// Mock FileLockManager
const mockLockManager = {
  acquire: jest.fn() as any,
  release: jest.fn() as any,
  isLocked: jest.fn() as any
};
const mockFileLockManager = jest.fn(() => mockLockManager) as jest.Mock;

jest.unstable_mockModule('../core/lock-manager', () => ({
  FileLockManager: mockFileLockManager
}));

// Import the module after mocking
const { BuildPipeline } = await import('../pipeline.js');
const { BuildError } = await import('../../types/index.js');

describe('BuildPipeline', () => {
  let mockLogger: any;
  let mockConfig: any;
  let pipeline: any;

  beforeEach(() => {
    // Mock logger
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      buildError: jest.fn(),
      buildComplete: jest.fn(),
      buildStart: jest.fn(),
      step: jest.fn()
    };

    // Mock config
    mockConfig = {
      repo: {
        kind: 'github',
        url: 'https://github.com/test/repo',
        branch: 'main'
      },
      notifications: {
        channels: ['telegram'],
        telegram: { botToken: 'test-token', chatId: 'test-chat' }
      },
      build: {
        base: 'origin/main',
        lockTimeout: 300,
        cleanupDays: 7
      }
    };

    // Reset all mocks
    jest.clearAllMocks();

    // Setup default mock returns
    mockEnsureDir.mockResolvedValue(undefined);
    // Mock git commands - rev-parse, symbolic-ref, log, etc.
    mockExeca.mockImplementation((command: any, args: any) => {
      if (args?.[0] === 'rev-parse' && args?.[1] === '--short') {
        return Promise.resolve({ stdout: 'abc123' });
      }
      if (args?.[0] === 'symbolic-ref' && args?.[1] === '--short') {
        return Promise.resolve({ stdout: 'main' });
      }
      if (args?.[0] === 'log' && args?.[1] === '-1') {
        if (args?.[2]?.includes('%an')) {
          return Promise.resolve({ stdout: 'Test Author' });
        }
        if (args?.[2]?.includes('%s')) {
          return Promise.resolve({ stdout: 'Test commit message' });
        }
        if (args?.[2]?.includes('%ct')) {
          return Promise.resolve({ stdout: '1672574400' });
        }
      }
      if (args?.[0] === 'fetch') {
        return Promise.resolve({ stdout: '' });
      }
      return Promise.resolve({ stdout: '' });
    });
    mockLockManager.acquire.mockResolvedValue(undefined);
    mockLockManager.release.mockResolvedValue(undefined);
    mockLockManager.isLocked.mockResolvedValue(false);
    mockDiffGenerator.generate.mockResolvedValue({
      type: 'diff',
      url: 'https://artifacts.test.com/diff.html',
      path: '/path/to/diff.html',
      timestamp: expect.any(Number)
    });
    mockDiffGenerator.uploadArtifacts.mockResolvedValue([
      { type: 'diff', url: 'https://artifacts.test.com/diff.html' }
    ]);
    mockTestRunner.run.mockResolvedValue({
      status: 'passed',
      passed: 25,
      failed: 0,
      skipped: 2,
      reportUrl: 'https://test.com/report.html',
      duration: 5000
    });
    mockDeploymentTrigger.trigger.mockResolvedValue({
      status: 'success',
      url: 'https://deploy.test.com/build-123'
    });
    mockHasDeploymentConfig.mockReturnValue(false);
    
    // Setup notification manager mocks
    mockNotificationManager.createSuccessNotification.mockReturnValue({
      title: 'Build completed',
      isError: false,
      timestamp: expect.any(Number)
    });
    mockNotificationManager.createErrorNotification.mockReturnValue({
      title: 'Build failed',
      isError: true,
      timestamp: expect.any(Number)
    });
    mockNotificationManager.send.mockResolvedValue(undefined);
  });

  describe('constructor', () => {
    it('should initialize pipeline with required components', () => {
      pipeline = new BuildPipeline({
        workDir: '/test/project',
        config: mockConfig,
        logger: mockLogger
      });

      expect(mockFileLockManager).toHaveBeenCalled();
      expect(mockNotificationManagerConstructor).toHaveBeenCalledWith(mockConfig.notifications);
    });

    it('should throw error when notifications config is missing', () => {
      const configWithoutNotifications = { ...mockConfig };
      delete configWithoutNotifications.notifications;

      expect(() => {
        new BuildPipeline({
          workDir: '/test/project',
          config: configWithoutNotifications,
          logger: mockLogger
        });
      }).toThrow('Notifications configuration is required');
    });

    it('should handle dry-run mode', () => {
      pipeline = new BuildPipeline({
        workDir: '/test/project',
        config: mockConfig,
        logger: mockLogger,
        dryRun: true
      });

      expect(pipeline).toBeDefined();
    });
  });

  describe('run method', () => {
    beforeEach(() => {
      pipeline = new BuildPipeline({
        workDir: '/test/project',
        config: mockConfig,
        logger: mockLogger
      });
    });

    it('should run complete pipeline successfully', async () => {
      const result = await pipeline.run();

      expect(result.success).toBe(true);
      expect(result.revision).toBeDefined();
      expect(result.branch).toBeDefined();
      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(result.artifacts).toEqual([
        expect.objectContaining({ type: 'diff', url: 'https://artifacts.test.com/diff.html' }),
        expect.objectContaining({ type: 'report', url: 'https://test.com/report.html' })
      ]);
      expect(result.testResults).toEqual({
        status: 'passed',
        passed: 25,
        failed: 0,
        skipped: 2,
        reportUrl: 'https://test.com/report.html',
        duration: 5000
      });
    });

    it('should run pipeline with custom base and head', async () => {
      const result = await pipeline.run('origin/develop', 'feature-branch');

      expect(mockDiffGenerator.generate).toHaveBeenCalledWith(
        'origin/develop',
        'feature-branch',
        expect.objectContaining({
          workDir: expect.any(String),
          revision: expect.any(String),
          branch: expect.any(String)
        })
      );
      expect(result.success).toBe(true);
    });

    it('should handle deployment when configured', async () => {
      mockHasDeploymentConfig.mockReturnValue(true);
      mockConfig.deployment = 'https://deploy.test.com/webhook';

      const result = await pipeline.run();

      expect(mockCreateDeploymentTrigger).toHaveBeenCalled();
      expect(mockDeploymentTrigger.trigger).toHaveBeenCalled();
      expect(result.deploymentUrl).toBeDefined();
    });

    it('should acquire and release lock', async () => {
      await pipeline.run();

      expect(mockLockManager.acquire).toHaveBeenCalledWith(
        expect.any(String),
        300
      );
      expect(mockLockManager.release).toHaveBeenCalled();
    });

    it('should send success notification', async () => {
      await pipeline.run();

      expect(mockNotificationManager.send).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.stringContaining('Build completed'),
          isError: false
        })
      );
    });

    it('should handle no-changes case gracefully', async () => {
      // Mock diff generator to return empty URL (no changes)
      mockDiffGenerator.generate.mockResolvedValue({
        type: 'diff',
        url: '', // Empty URL indicates no changes
        path: '',
        size: 0,
        timestamp: expect.any(Number)
      });

      const result = await pipeline.run();

      expect(result.success).toBe(true);
      expect(result.message).toBe('No changes detected');
      expect(result.artifacts).toEqual([]);
      
      // Should not send any notifications
      expect(mockNotificationManager.send).not.toHaveBeenCalled();
      
      // Should not trigger deployment
      expect(mockDeploymentTrigger.trigger).not.toHaveBeenCalled();
      
      // Should not run tests
      expect(mockTestRunner.run).not.toHaveBeenCalled();
      
      // Should log appropriate message
      expect(mockLogger.step).toHaveBeenCalledWith('diff', 'No changes detected between base and head');
      expect(mockLogger.buildComplete).toHaveBeenCalledWith(true, expect.any(Number), { message: 'No changes to report' });
    });

    it('should handle lock acquisition failure', async () => {
      mockLockManager.acquire.mockRejectedValue(new Error('Lock acquisition failed'));

      const result = await pipeline.run();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Lock acquisition failed');
    });

    it('should handle diff generation failure', async () => {
      mockDiffGenerator.generate.mockRejectedValue(new Error('Diff generation failed'));

      const result = await pipeline.run();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Diff generation failed');
    });

    it('should handle test runner failure', async () => {
      mockTestRunner.run.mockRejectedValue(new Error('Tests failed'));

      const result = await pipeline.run();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Tests failed');
    });

    it('should handle deployment failure gracefully', async () => {
      mockHasDeploymentConfig.mockReturnValue(true);
      mockDeploymentTrigger.trigger.mockRejectedValue(new Error('Deployment failed'));

      const result = await pipeline.run();

      // Pipeline should still succeed but deployment should be marked as failed
      expect(result.success).toBe(true);
      expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Deployment failed'), expect.any(Object));
    });

    it('should send error notification on failure', async () => {
      mockDiffGenerator.generate.mockRejectedValue(new Error('Build failed'));

      const result = await pipeline.run();

      expect(result.success).toBe(false);
      expect(mockNotificationManager.send).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.stringContaining('Build failed'),
          isError: true
        })
      );
    });

    it('should release lock even on failure', async () => {
      mockDiffGenerator.generate.mockRejectedValue(new Error('Build failed'));

      await pipeline.run();

      expect(mockLockManager.release).toHaveBeenCalled();
    });

    it('should handle dry-run mode', async () => {
      const dryRunPipeline = new BuildPipeline({
        workDir: '/test/project',
        config: mockConfig,
        logger: mockLogger,
        dryRun: true
      });

      const result = await dryRunPipeline.run();

      expect(result.success).toBe(true);
      expect(mockLogger.step).toHaveBeenCalledWith('deploy', expect.stringContaining('dry run'));
    });
  });

  describe('error handling', () => {
    beforeEach(() => {
      pipeline = new BuildPipeline({
        workDir: '/test/project',
        config: mockConfig,
        logger: mockLogger
      });
    });

    it('should handle git command failures', async () => {
      // Override mock to make all git commands fail
      mockExeca.mockRejectedValue(new Error('Git command failed'));

      const result = await pipeline.run();

      // Pipeline should still succeed because git failures are handled gracefully
      expect(result.success).toBe(true);
      expect(mockLogger.warn).toHaveBeenCalledWith('Git fetch failed', expect.any(Object));
    });

    it('should handle notification send failures', async () => {
      mockNotificationManager.send.mockRejectedValue(new Error('Notification failed'));

      // Pipeline should still complete successfully even if notification fails
      const result = await pipeline.run();

      expect(result.success).toBe(true);
      expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to send notification'), expect.any(Object));
    });

    it('should handle artifact upload failures', async () => {
      mockDiffGenerator.generate.mockRejectedValue(new Error('Upload failed'));

      const result = await pipeline.run();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Upload failed');
    });

    it('should handle unexpected errors', async () => {
      mockLockManager.acquire.mockRejectedValue('String error');

      const result = await pipeline.run();

      expect(result.success).toBe(false);
      expect(result.error).toBe('String error');
    });
  });

  describe('context creation', () => {
    beforeEach(() => {
      pipeline = new BuildPipeline({
        workDir: '/test/project',
        config: mockConfig,
        logger: mockLogger
      });
    });

    it('should create proper runtime context', async () => {
      await pipeline.run();

      // Verify context is passed to components
      expect(mockDiffGenerator.generate).toHaveBeenCalledWith(
        'origin/main',
        'HEAD',
        expect.objectContaining({
          config: mockConfig,
          workDir: '/test/project',
          revision: expect.any(String),
          branch: expect.any(String),
          timestamp: expect.any(Number)
        })
      );
    });

    it('should extract commit info properly', async () => {
      // Override the mock implementation for this test
      (mockExeca as any).mockImplementation((command: any, args: any) => {
        if (args?.[0] === 'rev-parse' && args?.[1] === '--short') {
          return Promise.resolve({ stdout: 'abc123' });
        }
        if (args?.[0] === 'symbolic-ref' && args?.[1] === '--short') {
          return Promise.resolve({ stdout: 'feature-branch' });
        }
        if (args?.[0] === 'log' && args?.[1] === '-1') {
          if (args?.[2]?.includes('%an')) {
            return Promise.resolve({ stdout: 'John Doe' });
          }
          if (args?.[2]?.includes('%s')) {
            return Promise.resolve({ stdout: 'Add new feature' });
          }
          if (args?.[2]?.includes('%ct')) {
            return Promise.resolve({ stdout: '1672574400' });
          }
        }
        if (args?.[0] === 'fetch') {
          return Promise.resolve({ stdout: '' });
        }
        return Promise.resolve({ stdout: '' });
      });

      const result = await pipeline.run();

      expect(result.commitInfo).toEqual({
        sha: 'abc123',
        shortSha: 'abc123',
        author: 'John Doe',
        message: 'Add new feature',
        timestamp: 1672574400000
      });
    });

    it('should handle partial commit info', async () => {
      // Override the mock to simulate git command failures
      (mockExeca as any).mockImplementation((command: any, args: any) => {
        if (args?.[0] === 'rev-parse' && args?.[1] === '--short') {
          return Promise.resolve({ stdout: 'abc123' });
        }
        if (args?.[0] === 'symbolic-ref' && args?.[1] === '--short') {
          return Promise.resolve({ stdout: 'main' });
        }
        if (args?.[0] === 'log' && args?.[1] === '-1') {
          // Simulate git log failure
          return Promise.reject(new Error('No commits'));
        }
        if (args?.[0] === 'fetch') {
          return Promise.resolve({ stdout: '' });
        }
        return Promise.resolve({ stdout: '' });
      });

      const result = await pipeline.run();

      expect(result.commitInfo).toEqual({
        sha: 'abc123',
        shortSha: 'abc123',
        author: 'Unknown',
        message: 'No commit message',
        timestamp: expect.any(Number)
      });
    });
  });

  describe('build artifacts', () => {
    beforeEach(() => {
      pipeline = new BuildPipeline({
        workDir: '/test/project',
        config: mockConfig,
        logger: mockLogger
      });
    });

    it('should collect all artifacts', async () => {
      // Mock diff generator to return artifact
      mockDiffGenerator.generate.mockResolvedValue({
        type: 'diff',
        url: 'https://artifacts.test.com/diff.html',
        path: '/path/to/diff.html',
        timestamp: expect.any(Number)
      });
      
      // Mock test runner to return report URL
      mockTestRunner.run.mockResolvedValue({
        status: 'passed',
        passed: 25,
        failed: 0,
        skipped: 2,
        reportUrl: 'https://test.com/report.html',
        duration: 5000
      });

      const result = await pipeline.run();

      expect(result.artifacts).toHaveLength(2);
      expect(result.artifacts).toContainEqual(
        expect.objectContaining({ type: 'diff', url: 'https://artifacts.test.com/diff.html' })
      );
      expect(result.artifacts).toContainEqual(
        expect.objectContaining({ type: 'report', url: 'https://test.com/report.html' })
      );
    });

    it('should handle empty artifacts', async () => {
      // Mock test runner to not return report URL
      mockTestRunner.run.mockResolvedValue({
        status: 'passed',
        passed: 25,
        failed: 0,
        skipped: 2,
        duration: 5000
      });

      const result = await pipeline.run();

      expect(result.artifacts).toHaveLength(1); // Still has diff artifact
      expect(result.artifacts[0]).toEqual(
        expect.objectContaining({ type: 'diff' })
      );
    });
  });

  describe('timing and metrics', () => {
    beforeEach(() => {
      pipeline = new BuildPipeline({
        workDir: '/test/project',
        config: mockConfig,
        logger: mockLogger
      });
    });

    it('should measure build duration', async () => {
      const result = await pipeline.run();

      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(typeof result.duration).toBe('number');
    });

    it('should set timestamps', async () => {
      const result = await pipeline.run();

      expect(result.timestamp).toBeGreaterThan(0);
      expect(result.timestamp).toBeLessThanOrEqual(Date.now());
    });
  });
});