/**
 * Tests for test-runner command
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

// Mock ora
const mockOra = jest.fn(() => ({
  start: jest.fn().mockReturnThis() as jest.Mock,
  succeed: jest.fn().mockReturnThis() as jest.Mock,
  fail: jest.fn().mockReturnThis() as jest.Mock
})) as jest.Mock;
jest.unstable_mockModule('ora', () => ({
  default: mockOra
}));

// Mock ConfigLoader
const mockConfigLoader = {
  loadConfig: jest.fn() as any
};
const mockGetInstance = jest.fn(() => mockConfigLoader) as jest.Mock;

jest.unstable_mockModule('@/config/index', () => ({
  ConfigLoader: {
    getInstance: mockGetInstance
  }
}));

// Mock NotificationManager
const mockNotificationManager = {
  testAllChannels: jest.fn() as any
};
const mockNotificationManagerConstructor = jest.fn(() => mockNotificationManager) as any;

jest.unstable_mockModule('@/core/notifications/manager', () => ({
  NotificationManager: mockNotificationManagerConstructor
}));

// Mock deployment trigger
const mockCreateDeploymentTrigger = jest.fn() as any;
jest.unstable_mockModule('@/core/deployment-trigger', () => ({
  createDeploymentTrigger: mockCreateDeploymentTrigger
}));

// Mock test runner
const mockCreateTestRunner = jest.fn() as any;
jest.unstable_mockModule('@/core/test-runner', () => ({
  createTestRunner: mockCreateTestRunner
}));

// Mock dynamic imports
const mockFs = {
  pathExists: jest.fn() as any
};
const mockPath = {
  join: jest.fn((...args: string[]) => args.join('/')) as jest.Mock
};
const mockExeca = jest.fn() as any;
const mockGlob = jest.fn() as any;

// Mock fs-extra
jest.unstable_mockModule('fs-extra', () => mockFs);

// Mock path
jest.unstable_mockModule('path', () => mockPath);

// Mock execa
jest.unstable_mockModule('execa', () => ({ execa: mockExeca }));

// Mock glob
jest.unstable_mockModule('glob', () => ({ glob: mockGlob }));

// Import the module after mocking
const { testCommand } = await import('../test-runner.js');

describe('testCommand', () => {
  let originalConsole: any;
  let originalCwd: any;
  let originalExit: any;

  beforeEach(() => {
    // Mock console methods
    originalConsole = { ...console };
    console.log = jest.fn() as any;
    console.error = jest.fn() as any;

    // Mock process.cwd and process.exit
    originalCwd = process.cwd;
    originalExit = process.exit;
    process.cwd = jest.fn(() => '/test/project') as any;
    process.exit = jest.fn() as any;

    // Reset all mocks
    jest.clearAllMocks();

    // Reset constructor mock to return the mocked manager
    mockNotificationManagerConstructor.mockReturnValue(mockNotificationManager);
    mockCreateTestRunner.mockReturnValue({});
    mockCreateDeploymentTrigger.mockReturnValue({});

    // Setup default mock returns
    mockConfigLoader.loadConfig.mockResolvedValue({
      notifications: {
        channels: ['telegram'],
        telegram: { botToken: 'test-token', chatId: 'test-chat' }
      },
      deployment: {
        webhook: 'https://deploy.test.com/webhook'
      }
    });

    mockNotificationManager.testAllChannels.mockResolvedValue([
      { channel: 'telegram', success: true }
    ]);

    mockFs.pathExists.mockResolvedValue(true);
    mockExeca.mockResolvedValue({ stdout: 'Playwright version 1.0.0' });
    mockGlob.mockResolvedValue(['tests/example.spec.ts']);
  });

  afterEach(() => {
    // Restore everything
    console.log = originalConsole.log;
    console.error = originalConsole.error;
    process.cwd = originalCwd;
    process.exit = originalExit;
  });

  describe('successful tests', () => {
    it('should run all tests when no specific options provided', async () => {
      await testCommand({});

      expect(console.log).toHaveBeenCalledWith('🧪 Testing CCanywhere Configuration');
      expect(console.log).toHaveBeenCalledWith('📬 Testing notification channels...');
      expect(console.log).toHaveBeenCalledWith('✅ All tests passed! CCanywhere is ready to use.');
    });

    it('should run all tests with --all flag', async () => {
      await testCommand({ all: true });

      expect(console.log).toHaveBeenCalledWith('📬 Testing notification channels...');
      expect(console.log).toHaveBeenCalledWith('🚀 Testing deployment configuration...');
      expect(console.log).toHaveBeenCalledWith('🎭 Testing Playwright setup...');
      expect(console.log).toHaveBeenCalledWith('✅ All tests passed! CCanywhere is ready to use.');
    });

    it('should run only notification tests', async () => {
      await testCommand({ notifications: true });

      expect(console.log).toHaveBeenCalledWith('📬 Testing notification channels...');
      expect(console.log).not.toHaveBeenCalledWith('🚀 Testing deployment configuration...');
      expect(console.log).not.toHaveBeenCalledWith('🎭 Testing Playwright setup...');
    });

    it('should run only deployment tests', async () => {
      await testCommand({ deployment: true });

      expect(console.log).not.toHaveBeenCalledWith('📬 Testing notification channels...');
      expect(console.log).toHaveBeenCalledWith('🚀 Testing deployment configuration...');
      expect(console.log).not.toHaveBeenCalledWith('🎭 Testing Playwright setup...');
    });

    it('should run only Playwright tests', async () => {
      await testCommand({ tests: true });

      expect(console.log).not.toHaveBeenCalledWith('📬 Testing notification channels...');
      expect(console.log).not.toHaveBeenCalledWith('🚀 Testing deployment configuration...');
      expect(console.log).toHaveBeenCalledWith('🎭 Testing Playwright setup...');
    });
  });

  describe('notification tests', () => {
    it('should show successful notification test results', async () => {
      mockNotificationManager.testAllChannels.mockResolvedValue([
        { channel: 'telegram', success: true },
        { channel: 'email', success: true }
      ]);

      await testCommand({ notifications: true });

      expect(console.log).toHaveBeenCalledWith('  ✅ telegram: OK');
      expect(console.log).toHaveBeenCalledWith('  ✅ email: OK');
    });

    it('should show failed notification test results', async () => {
      mockNotificationManager.testAllChannels.mockResolvedValue([
        { channel: 'telegram', success: true },
        { channel: 'email', success: false, error: 'Invalid credentials' }
      ]);

      await testCommand({ notifications: true });

      expect(console.log).toHaveBeenCalledWith('  ✅ telegram: OK');
      expect(console.log).toHaveBeenCalledWith('  ❌ email: FAILED');
      expect(console.log).toHaveBeenCalledWith('    Error: Invalid credentials');
      expect(console.log).toHaveBeenCalledWith('❌ Some tests failed. Please check your configuration.');
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should handle notification manager initialization errors', async () => {
      mockNotificationManagerConstructor.mockImplementation(() => {
        throw new Error('Invalid notification config');
      });

      await testCommand({ notifications: true });

      expect(console.log).toHaveBeenCalledWith('  ❌ Failed to initialize notification system');
      expect(console.log).toHaveBeenCalledWith('  Error: Invalid notification config');
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should handle testAllChannels errors', async () => {
      // Reset to normal constructor but make testAllChannels fail
      mockNotificationManagerConstructor.mockReturnValue(mockNotificationManager);
      mockNotificationManager.testAllChannels.mockRejectedValue(new Error('Test failed'));

      await testCommand({ notifications: true });

      expect(console.log).toHaveBeenCalledWith('  ❌ Failed to initialize notification system');
      expect(console.log).toHaveBeenCalledWith('  Error: Test failed');
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });

  describe('deployment tests', () => {
    it('should validate webhook URL format', async () => {
      await testCommand({ deployment: true });

      expect(console.log).toHaveBeenCalledWith('  ✅ Webhook URL format: OK');
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Webhook functionality will be tested during actual builds'));
    });

    it('should validate status URL format when provided', async () => {
      mockConfigLoader.loadConfig.mockResolvedValue({
        deployment: {
          webhook: 'https://deploy.test.com/webhook',
          statusUrl: 'https://deploy.test.com/status'
        }
      });

      await testCommand({ deployment: true });

      expect(console.log).toHaveBeenCalledWith('  ✅ Webhook URL format: OK');
      expect(console.log).toHaveBeenCalledWith('  ✅ Status URL format: OK');
    });

    it('should handle invalid webhook URL', async () => {
      mockConfigLoader.loadConfig.mockResolvedValue({
        deployment: {
          webhook: 'invalid-url'
        }
      });

      await testCommand({ deployment: true });

      expect(console.log).toHaveBeenCalledWith('  ❌ Webhook URL format: INVALID');
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should handle invalid status URL', async () => {
      mockConfigLoader.loadConfig.mockResolvedValue({
        deployment: {
          webhook: 'https://deploy.test.com/webhook',
          statusUrl: 'invalid-url'
        }
      });

      await testCommand({ deployment: true });

      expect(console.log).toHaveBeenCalledWith('  ✅ Webhook URL format: OK');
      expect(console.log).toHaveBeenCalledWith('  ❌ Status URL format: INVALID');
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should skip when deployment not configured', async () => {
      mockConfigLoader.loadConfig.mockResolvedValue({
        notifications: { channels: ['telegram'] }
        // No deployment config
      });

      await testCommand({ deployment: true });

      expect(console.log).toHaveBeenCalledWith('  ⏭️  Deployment not configured, skipping');
      expect(console.log).toHaveBeenCalledWith('✅ All tests passed! CCanywhere is ready to use.');
    });
  });

  describe('Playwright tests', () => {
    it('should detect Playwright configuration file', async () => {
      mockFs.pathExists.mockImplementation((path: string) => {
        return Promise.resolve(path.includes('playwright.config.ts'));
      });

      await testCommand({ tests: true });

      expect(console.log).toHaveBeenCalledWith('  ✅ Configuration file: playwright.config.ts');
    });

    it('should check multiple config file formats', async () => {
      mockFs.pathExists.mockImplementation((path: string) => {
        return Promise.resolve(path.includes('playwright.config.mjs'));
      });

      await testCommand({ tests: true });

      expect(console.log).toHaveBeenCalledWith('  ✅ Configuration file: playwright.config.mjs');
    });

    it('should handle missing configuration file', async () => {
      mockFs.pathExists.mockResolvedValue(false);

      await testCommand({ tests: true });

      expect(console.log).toHaveBeenCalledWith('  ❌ Playwright configuration file not found');
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Expected: playwright.config.js'));
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should check Playwright installation', async () => {
      await testCommand({ tests: true });

      expect(mockExeca).toHaveBeenCalledWith('npx', ['playwright', '--version'], {
        cwd: '/test/project',
        timeout: 10000
      });
      expect(console.log).toHaveBeenCalledWith('  ✅ Playwright installation: OK');
    });

    it('should handle missing Playwright installation', async () => {
      mockExeca.mockRejectedValue(new Error('Command not found'));

      await testCommand({ tests: true });

      expect(console.log).toHaveBeenCalledWith('  ❌ Playwright installation: NOT FOUND');
      expect(console.log).toHaveBeenCalledWith('    Run: npm install -D @playwright/test');
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should find test files', async () => {
      mockGlob.mockResolvedValue(['tests/example.spec.ts', 'tests/home.test.ts']);

      await testCommand({ tests: true });

      expect(console.log).toHaveBeenCalledWith('  ✅ Test files: 2 found');
    });

    it('should handle no test files', async () => {
      mockGlob.mockResolvedValue([]);

      await testCommand({ tests: true });

      expect(console.log).toHaveBeenCalledWith('  ⚠️  No test files found');
      expect(console.log).toHaveBeenCalledWith('    Create test files with .spec.ts or .test.ts extensions');
    });

    it('should handle Playwright setup errors', async () => {
      mockCreateTestRunner.mockImplementation(() => {
        throw new Error('Test runner creation failed');
      });

      await testCommand({ tests: true });

      expect(console.log).toHaveBeenCalledWith('  ❌ Playwright setup error');
      expect(console.log).toHaveBeenCalledWith('  Error: Test runner creation failed');
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });

  describe('error handling', () => {
    it('should handle configuration load errors', async () => {
      mockConfigLoader.loadConfig.mockRejectedValue(new Error('Config not found'));

      await testCommand({});

      expect(console.error).toHaveBeenCalledWith('Error during testing:');
      expect(console.error).toHaveBeenCalledWith('Config not found');
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should handle non-Error objects', async () => {
      mockConfigLoader.loadConfig.mockRejectedValue('String error');

      await testCommand({});

      expect(console.error).toHaveBeenCalledWith('Error during testing:');
      expect(console.error).toHaveBeenCalledWith('String error');
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });

  describe('mixed test results', () => {
    it('should exit with error if any test fails', async () => {
      mockNotificationManager.testAllChannels.mockResolvedValue([
        { channel: 'telegram', success: false, error: 'Failed to connect' }
      ]);

      await testCommand({ all: true });

      expect(console.log).toHaveBeenCalledWith('❌ Some tests failed. Please check your configuration.');
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should pass if all individual tests pass', async () => {
      mockNotificationManager.testAllChannels.mockResolvedValue([
        { channel: 'telegram', success: true }
      ]);

      await testCommand({ all: true });

      expect(console.log).toHaveBeenCalledWith('✅ All tests passed! CCanywhere is ready to use.');
      expect(process.exit).not.toHaveBeenCalled();
    });
  });
});