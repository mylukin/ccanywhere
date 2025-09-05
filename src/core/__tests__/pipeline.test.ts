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
  generateDiff: jest.fn() as any,
  uploadArtifacts: jest.fn() as any
};
const mockHtmlDiffGenerator = jest.fn(() => mockDiffGenerator) as jest.Mock;

jest.unstable_mockModule('./diff-generator', () => ({
  HtmlDiffGenerator: mockHtmlDiffGenerator
}));

// Mock deployment trigger
const mockDeploymentTrigger = {
  trigger: jest.fn() as any,
  getStatus: jest.fn() as any
};
const mockCreateDeploymentTrigger = jest.fn(() => mockDeploymentTrigger) as jest.Mock;
const mockHasDeploymentConfig = jest.fn() as any;

jest.unstable_mockModule('./deployment-trigger', () => ({
  createDeploymentTrigger: mockCreateDeploymentTrigger,
  hasDeploymentConfig: mockHasDeploymentConfig
}));

// Mock test runner
const mockTestRunner = {
  runTests: jest.fn() as any
};
const mockCreateTestRunner = jest.fn(() => mockTestRunner) as jest.Mock;

jest.unstable_mockModule('./test-runner', () => ({
  createTestRunner: mockCreateTestRunner
}));

// Mock NotificationManager
const mockNotificationManager = {
  send: jest.fn() as any
};
const mockNotificationManagerConstructor = jest.fn(() => mockNotificationManager) as jest.Mock;

jest.unstable_mockModule('./notifications/manager', () => ({
  NotificationManager: mockNotificationManagerConstructor
}));

// Mock FileLockManager
const mockLockManager = {
  acquireLock: jest.fn() as any,
  releaseLock: jest.fn() as any,
  isLocked: jest.fn() as any
};
const mockFileLockManager = jest.fn(() => mockLockManager) as jest.Mock;

jest.unstable_mockModule('./lock-manager', () => ({
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
      debug: jest.fn()
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
    mockExeca.mockResolvedValue({ stdout: 'abc123\nmain\nTest commit' });
    mockLockManager.acquireLock.mockResolvedValue(undefined);
    mockLockManager.releaseLock.mockResolvedValue(undefined);
    mockLockManager.isLocked.mockResolvedValue(false);
    mockDiffGenerator.generateDiff.mockResolvedValue({
      added: 10,
      removed: 5,
      modified: 3,
      htmlPath: '/path/to/diff.html'
    });
    mockDiffGenerator.uploadArtifacts.mockResolvedValue([
      { type: 'diff', url: 'https://artifacts.test.com/diff.html' }
    ]);
    mockTestRunner.runTests.mockResolvedValue({
      status: 'passed',
      passed: 25,
      failed: 0,
      skipped: 2,
      reportUrl: 'https://test.com/report.html'
    });
    mockDeploymentTrigger.trigger.mockResolvedValue({
      status: 'success',
      deploymentId: 'deploy-123'
    });
    mockHasDeploymentConfig.mockReturnValue(false);
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
      expect(result.duration).toBeGreaterThan(0);
      expect(result.artifacts).toEqual([
        { type: 'diff', url: 'https://artifacts.test.com/diff.html' }
      ]);
      expect(result.testResults).toEqual({
        status: 'passed',
        passed: 25,
        failed: 0,
        skipped: 2,
        reportUrl: 'https://test.com/report.html'
      });
    });

    it('should run pipeline with custom base and head', async () => {
      const result = await pipeline.run('origin/develop', 'feature-branch');

      expect(mockDiffGenerator.generateDiff).toHaveBeenCalledWith(
        expect.objectContaining({
          base: 'origin/develop',
          head: 'feature-branch'
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

      expect(mockLockManager.acquireLock).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          timeout: 300000,
          pid: process.pid,
          revision: expect.any(String)
        })
      );
      expect(mockLockManager.releaseLock).toHaveBeenCalled();
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

    it('should handle lock acquisition failure', async () => {
      mockLockManager.acquireLock.mockRejectedValue(new Error('Lock acquisition failed'));

      const result = await pipeline.run();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Lock acquisition failed');
    });

    it('should handle diff generation failure', async () => {
      mockDiffGenerator.generateDiff.mockRejectedValue(new Error('Diff generation failed'));

      const result = await pipeline.run();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Diff generation failed');
    });

    it('should handle test runner failure', async () => {
      mockTestRunner.runTests.mockRejectedValue(new Error('Tests failed'));

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
      expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Deployment failed'));
    });

    it('should send error notification on failure', async () => {
      mockDiffGenerator.generateDiff.mockRejectedValue(new Error('Build failed'));

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
      mockDiffGenerator.generateDiff.mockRejectedValue(new Error('Build failed'));

      await pipeline.run();

      expect(mockLockManager.releaseLock).toHaveBeenCalled();
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
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('dry-run'));
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
      mockExeca.mockRejectedValue(new Error('Git command failed'));

      const result = await pipeline.run();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Git command failed');
    });

    it('should handle notification send failures', async () => {
      mockNotificationManager.send.mockRejectedValue(new Error('Notification failed'));

      // Pipeline should still complete successfully even if notification fails
      const result = await pipeline.run();

      expect(result.success).toBe(true);
      expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to send notification'));
    });

    it('should handle artifact upload failures', async () => {
      mockDiffGenerator.uploadArtifacts.mockRejectedValue(new Error('Upload failed'));

      const result = await pipeline.run();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Upload failed');
    });

    it('should handle unexpected errors', async () => {
      mockLockManager.acquireLock.mockRejectedValue('String error');

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
      expect(mockDiffGenerator.generateDiff).toHaveBeenCalledWith(
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
      (mockExeca as any).mockResolvedValue({ stdout: 'abc123\nfeature-branch\nAdd new feature\nJohn Doe' });

      const result = await pipeline.run();

      expect(result.commitInfo).toEqual({
        author: 'John Doe',
        message: 'Add new feature'
      });
    });

    it('should handle partial commit info', async () => {
      (mockExeca as any).mockResolvedValue({ stdout: 'abc123\nmain\n' });

      const result = await pipeline.run();

      expect(result.commitInfo).toEqual({
        author: 'Unknown',
        message: 'No commit message'
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
      mockDiffGenerator.uploadArtifacts.mockResolvedValue([
        { type: 'diff', url: 'https://artifacts.test.com/diff.html' },
        { type: 'report', url: 'https://artifacts.test.com/report.html' }
      ]);

      const result = await pipeline.run();

      expect(result.artifacts).toHaveLength(2);
      expect(result.artifacts).toContainEqual({ type: 'diff', url: 'https://artifacts.test.com/diff.html' });
      expect(result.artifacts).toContainEqual({ type: 'report', url: 'https://artifacts.test.com/report.html' });
    });

    it('should handle empty artifacts', async () => {
      mockDiffGenerator.uploadArtifacts.mockResolvedValue([]);

      const result = await pipeline.run();

      expect(result.artifacts).toEqual([]);
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
      const startTime = Date.now();
      const result = await pipeline.run();
      const endTime = Date.now();

      expect(result.duration).toBeGreaterThan(0);
      expect(result.duration).toBeLessThan(endTime - startTime + 100); // Allow some margin
    });

    it('should set timestamps', async () => {
      const result = await pipeline.run();

      expect(result.timestamp).toBeGreaterThan(0);
      expect(result.timestamp).toBeLessThanOrEqual(Date.now());
    });
  });
});