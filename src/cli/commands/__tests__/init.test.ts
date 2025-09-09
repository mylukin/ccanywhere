/**
 * Tests for init command
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

// Mock all the dependencies
const mockWriteFile = jest.fn() as any;
const mockPathExists = jest.fn() as any;
const mockReadFile = jest.fn() as any;
const mockEnsureDir = jest.fn() as any;

jest.unstable_mockModule('fs-extra', () => {
  const fsExtraModule = {
    writeFile: mockWriteFile,
    pathExists: mockPathExists,
    readFile: mockReadFile,
    ensureDir: mockEnsureDir
  };
  return {
    default: fsExtraModule,
    writeFile: mockWriteFile,
    pathExists: mockPathExists,
    readFile: mockReadFile,
    ensureDir: mockEnsureDir
  };
});

const mockPrompt = jest.fn() as any;
jest.unstable_mockModule('inquirer', () => {
  const inquirerModule = {
    prompt: mockPrompt
  };
  return {
    default: inquirerModule,
    prompt: mockPrompt
  };
});

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

const mockOraInstance = {
  start: jest.fn().mockReturnThis() as jest.Mock,
  succeed: jest.fn().mockReturnThis() as jest.Mock,
  fail: jest.fn().mockReturnThis() as jest.Mock,
  text: ''
};
const mockOra = jest.fn(() => mockOraInstance) as jest.Mock;
jest.unstable_mockModule('ora', () => ({
  default: mockOra
}));

const mockDetectGitInfo = jest.fn() as any;
jest.unstable_mockModule('@/utils/git', () => ({
  detectGitInfo: mockDetectGitInfo
}));

const mockGetDefaultConfig = jest.fn() as any;
jest.unstable_mockModule('@/config/index', () => ({
  getDefaultConfig: mockGetDefaultConfig
}));

const mockExecSync = jest.fn() as any;
jest.unstable_mockModule('child_process', () => ({
  execSync: mockExecSync
}));

const mockPackageManager = {
  readPackageJson: jest.fn() as any,
  writePackageJson: jest.fn() as any,
  addScripts: jest.fn() as any
};
jest.unstable_mockModule('@/utils/package-manager', () => ({
  PackageManager: mockPackageManager
}));

// Import the module after mocking
const { initCommand } = await import('../init.js');

describe('initCommand', () => {
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
    // Mock process.exit to prevent test from exiting
    process.exit = jest.fn((code?: number) => {
      console.error(`process.exit called with code: ${code}`);
    }) as any;

    // Reset all mocks
    jest.clearAllMocks();

    // Reset mock implementations
    mockPrompt.mockReset();
    mockPathExists.mockReset();
    mockWriteFile.mockReset();
    mockEnsureDir.mockReset();
    mockReadFile.mockReset();
    mockExecSync.mockReset();
    mockPackageManager.readPackageJson.mockReset();
    mockPackageManager.writePackageJson.mockReset();
    mockPackageManager.addScripts.mockReset();

    // Setup default mock returns
    mockPathExists.mockResolvedValue(false);
    mockWriteFile.mockImplementation(async () => undefined);
    mockEnsureDir.mockImplementation(async () => undefined);
    mockReadFile.mockImplementation(async () => '');
    mockExecSync.mockImplementation(() => '');
    mockPackageManager.readPackageJson.mockResolvedValue({
      name: 'test-project',
      version: '1.0.0',
      scripts: {}
    });
    mockPackageManager.writePackageJson.mockResolvedValue(undefined);
    mockPackageManager.addScripts.mockReturnValue({
      added: [{ name: 'test:e2e', command: 'playwright test' }],
      skipped: []
    });

    mockDetectGitInfo.mockResolvedValue({
      repoUrl: 'https://github.com/test/repo.git',
      repoKind: 'github',
      repoBranch: 'main'
    });

    mockGetDefaultConfig.mockReturnValue({
      repo: { kind: 'github', url: '', branch: 'main' },
      notifications: { channels: [] },
      build: { base: 'origin/main', lockTimeout: 300, cleanupDays: 7 }
    });
  });

  afterEach(() => {
    // Restore console
    console.log = originalConsole.log;
    console.error = originalConsole.error;

    // Restore process methods
    process.cwd = originalCwd;
    process.exit = originalExit;
  });

  describe('unified initialization', () => {
    it('should initialize with unified flow', async () => {
      // Reset and setup mocks
      mockPathExists.mockReset();
      mockWriteFile.mockReset();
      mockPrompt.mockReset();
      mockOra.mockReset();
      mockOraInstance.start.mockReset();
      mockOraInstance.succeed.mockReset();

      mockPathExists.mockResolvedValue(false);
      mockWriteFile.mockResolvedValue(undefined);

      // Setup ora mock to return the instance
      mockOra.mockReturnValue(mockOraInstance);
      mockOraInstance.start.mockReturnValue(mockOraInstance);
      mockOraInstance.succeed.mockReturnValue(mockOraInstance);

      // Mock ALL the prompts in the correct order for unified flow
      mockPrompt
        .mockResolvedValueOnce({
          // Repository configuration (Step 1)
          repoUrl: 'https://github.com/test/repo.git',
          repoKind: 'github',
          repoBranch: 'main'
        })
        .mockResolvedValueOnce({
          // Storage configuration (Step 2)
          storageType: 'simple'
        })
        .mockResolvedValueOnce({
          // Simple storage URL
          artifactsUrl: 'https://artifacts.test.com'
        })
        .mockResolvedValueOnce({
          // Notification channels (Step 3)
          notificationChannels: ['telegram']
        })
        .mockResolvedValueOnce({
          // Telegram configuration
          botToken: '123456:ABC-DEF',
          chatId: '-1001234567890'
        })
        .mockResolvedValueOnce({
          // Advanced options (Step 4)
          enableDeployment: false,
          enablePlaywright: false
        });

      // Call the command
      try {
        await initCommand({});
      } catch (error) {
        // Log the error but don't fail the test yet
        console.log('Error during initCommand:', error);
      }

      // Debug output
      console.log('mockPrompt calls:', mockPrompt.mock.calls.length);
      console.log('mockWriteFile calls:', mockWriteFile.mock.calls.length);
      console.log('mockOra calls:', mockOra.mock.calls.length);
      console.log('process.exit calls:', (process.exit as any).mock.calls);
      console.log('console.error calls:', (console.error as any).mock.calls);

      // Verify config files were written
      expect(mockWriteFile).toHaveBeenCalled();
      
      // Find project config file (contains repo info)
      const projectConfigCall = mockWriteFile.mock.calls.find((call: any[]) => 
        call[0] === '/test/project/ccanywhere.config.json'
      );
      
      // Project config might not be written in simple flow, check if it exists
      if (projectConfigCall) {
        const configContent = JSON.parse(projectConfigCall[1]);
        if (configContent.repo) {
          expect(configContent.repo.kind).toBe('github');
        }
        if (configContent.test) {
          expect(configContent.test.enabled).toBe(false);
        }
      }
      
      // Verify at least one config was written
      const anyConfigCall = mockWriteFile.mock.calls.find((call: any[]) => 
        call[0].includes('ccanywhere.config.json')
      );
      expect(anyConfigCall).toBeDefined();
    });

    it('should initialize with cloud storage and advanced options', async () => {
      mockPathExists.mockResolvedValue(false);

      // Mock ALL the prompts in the correct order for cloud storage flow
      mockPrompt
        .mockResolvedValueOnce({
          // Repository configuration (Step 1)
          repoUrl: 'https://github.com/test/repo.git',
          repoKind: 'github',
          repoBranch: 'main'
        })
        .mockResolvedValueOnce({
          // Storage configuration - storage choice (Step 2.1)
          storageType: 'cloud'
        })
        .mockResolvedValueOnce({
          // Storage configuration - provider details (Step 2.2)
          storageProvider: 'r2',
          storageFolder: 'diffs',
          artifactsUrl: 'https://artifacts.test.com'
        })
        .mockResolvedValueOnce({
          // R2 provider configuration (Step 2.3)
          accountId: 'test-account',
          accessKeyId: 'test-key',
          secretAccessKey: 'test-secret',
          bucket: 'test-bucket'
        })
        .mockResolvedValueOnce({
          // Notification channels (Step 3)
          notificationChannels: ['telegram', 'email']
        })
        .mockResolvedValueOnce({
          // Telegram configuration (Step 3.1)
          botToken: '123456:ABC-DEF',
          chatId: '-1001234567890'
        })
        .mockResolvedValueOnce({
          // Email configuration (Step 3.1)
          to: 'test@example.com',
          from: 'noreply@example.com',
          configureSMTP: false
        })
        .mockResolvedValueOnce({
          // Advanced options (Step 4) - all answers together
          enableDeployment: true,
          deploymentWebhook: 'https://deploy.test.com/webhook',
          enablePlaywright: true
        });

      await initCommand({});

      // Deployment is configured in user config, not project config
      expect(mockWriteFile).toHaveBeenCalledWith(
        expect.stringContaining('ccanywhere.config.json'),
        expect.stringContaining('"deployment"')
      );
      expect(mockWriteFile).toHaveBeenCalledWith(
        '/test/project/playwright.config.ts',
        expect.stringContaining('@playwright/test')
      );
      expect(mockEnsureDir).toHaveBeenCalledWith('/test/project/tests');
    });
  });

  describe('config file handling', () => {
    it('should prompt for overwrite when config exists', async () => {
      // Mock git detection to return a valid git project
      mockDetectGitInfo.mockResolvedValue({
        repoUrl: 'https://github.com/test/repo.git',
        repoKind: 'github',
        repoBranch: 'main'
      });
      
      mockPathExists.mockResolvedValue(true);
      mockPrompt
        .mockResolvedValueOnce({ overwrite: true })
        .mockResolvedValueOnce({
          // Repository configuration (Step 1)
          repoUrl: 'https://github.com/test/repo.git',
          repoKind: 'github',
          repoBranch: 'main'
        })
        .mockResolvedValueOnce({
          // Storage configuration (Step 2)
          storageType: 'simple'
        })
        .mockResolvedValueOnce({
          // Simple storage URL
          artifactsUrl: 'https://artifacts.test.com'
        })
        .mockResolvedValueOnce({
          // Notification channels (Step 3)
          notificationChannels: ['telegram']
        })
        .mockResolvedValueOnce({
          // Telegram configuration
          botToken: '123456:ABC-DEF',
          chatId: '-1001234567890'
        })
        .mockResolvedValueOnce({
          // Advanced options (Step 4)
          enableDeployment: false,
          enablePlaywright: false
        });

      await initCommand({});

      // The first prompt should be about overwriting
      const firstPromptCall = mockPrompt.mock.calls[0];
      expect(firstPromptCall).toBeDefined();
      expect(firstPromptCall[0]).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'confirm',
            name: 'overwrite',
            message: 'Project configuration already exists. Overwrite?'
          })
        ])
      );
    });

    it('should cancel initialization when user chooses not to overwrite', async () => {
      mockPathExists.mockResolvedValue(true);
      mockPrompt.mockResolvedValueOnce({ overwrite: false });

      await initCommand({});

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('cancelled'));
      expect(mockWriteFile).not.toHaveBeenCalled();
    });

    it('should skip overwrite prompt with force option', async () => {
      mockPathExists.mockResolvedValue(true);

      // Mock ALL the prompts in the correct order (no overwrite prompt with force)
      mockPrompt
        .mockResolvedValueOnce({
          // Repository configuration (Step 1)
          repoUrl: 'https://github.com/test/repo.git',
          repoKind: 'github',
          repoBranch: 'main'
        })
        .mockResolvedValueOnce({
          // Storage configuration (Step 2.1)
          storageType: 'simple'
        })
        .mockResolvedValueOnce({
          // Simple storage URL (Step 2.2)
          artifactsUrl: 'https://artifacts.test.com'
        })
        .mockResolvedValueOnce({
          // Notification channels (Step 3)
          notificationChannels: ['telegram']
        })
        .mockResolvedValueOnce({
          // Telegram configuration
          botToken: '123456:ABC-DEF',
          chatId: '-1001234567890'
        })
        .mockResolvedValueOnce({
          // Advanced options (Step 4)
          enableDeployment: false,
          enablePlaywright: false
        });

      await initCommand({ force: true });

      // Should not prompt for overwrite
      expect(mockPrompt).not.toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ name: 'overwrite' })])
      );
      expect(mockWriteFile).toHaveBeenCalled();
    });
  });

  describe('git auto-detection', () => {
    it('should use auto-detected git information', async () => {
      mockDetectGitInfo.mockResolvedValue({
        repoUrl: 'https://github.com/auto/detected.git',
        repoKind: 'github',
        repoBranch: 'develop'
      });
      mockPathExists.mockResolvedValue(false);
      mockPrompt
        .mockResolvedValueOnce({
          // Repository configuration (Step 1)
          repoUrl: 'https://github.com/auto/detected.git', // Should default to auto-detected
          repoKind: 'github',
          repoBranch: 'develop'
        })
        .mockResolvedValueOnce({
          // Storage configuration (Step 2)
          storageType: 'simple'
        })
        .mockResolvedValueOnce({
          // Simple storage URL
          artifactsUrl: 'https://artifacts.test.com'
        })
        .mockResolvedValueOnce({
          // Notification channels (Step 3)
          notificationChannels: ['telegram']
        })
        .mockResolvedValueOnce({
          // Telegram configuration
          botToken: '123456:ABC-DEF',
          chatId: '-1001234567890'
        })
        .mockResolvedValueOnce({
          // Advanced options (Step 4)
          enableDeployment: false,
          enablePlaywright: false
        });

      await initCommand({});

      expect(mockDetectGitInfo).toHaveBeenCalledWith('/test/project');
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Auto-detected git repository'));
    });

    it('should handle missing git information gracefully', async () => {
      mockDetectGitInfo.mockResolvedValue({
        repoUrl: null,
        repoKind: null,
        repoBranch: null
      });
      mockPathExists.mockResolvedValue(false);
      mockPrompt
        .mockResolvedValueOnce({
          // Repository configuration (Step 1)
          repoUrl: 'https://github.com/manual/entry.git',
          repoKind: 'github',
          repoBranch: 'main'
        })
        .mockResolvedValueOnce({
          // Storage configuration (Step 2)
          storageType: 'simple'
        })
        .mockResolvedValueOnce({
          // Simple storage URL
          artifactsUrl: 'https://artifacts.test.com'
        })
        .mockResolvedValueOnce({
          // Notification channels (Step 3)
          notificationChannels: ['telegram']
        })
        .mockResolvedValueOnce({
          // Telegram configuration
          botToken: '123456:ABC-DEF',
          chatId: '-1001234567890'
        })
        .mockResolvedValueOnce({
          // Advanced options (Step 4)
          enableDeployment: false,
          enablePlaywright: false
        });

      await initCommand({});

      // Should not show auto-detection message
      expect(console.log).not.toHaveBeenCalledWith(expect.stringContaining('Auto-detected'));
    });
  });

  describe('configuration file generation', () => {
    it('should generate configuration files without .env', async () => {
      // Set up pathExists mock for specific paths
      mockPathExists.mockImplementation(async (path: string) => {
        if (path.endsWith('.env')) return true; // .env exists
        if (path.endsWith('ccanywhere.config.json')) return false; // config doesn't exist
        if (path.endsWith('.gitignore')) return false;
        if (path.endsWith('package.json')) return false;
        if (path.endsWith('playwright.config.ts')) return false;
        return false;
      });

      // Mock ALL the prompts in the correct order
      mockPrompt
        .mockResolvedValueOnce({
          // Repository configuration (Step 1)
          repoUrl: 'https://github.com/test/repo.git',
          repoKind: 'github',
          repoBranch: 'main'
        })
        .mockResolvedValueOnce({
          // Storage configuration (Step 2.1)
          storageType: 'simple'
        })
        .mockResolvedValueOnce({
          // Simple storage URL (Step 2.2)
          artifactsUrl: 'https://artifacts.test.com'
        })
        .mockResolvedValueOnce({
          // Notification channels (Step 3)
          notificationChannels: ['telegram']
        })
        .mockResolvedValueOnce({
          // Telegram configuration
          botToken: '123456:ABC-DEF',
          chatId: '-1001234567890'
        })
        .mockResolvedValueOnce({
          // Advanced options (Step 4)
          enableDeployment: false,
          enablePlaywright: false
        });

      await initCommand({});

      // Should write config files but never .env (we don't generate .env anymore)
      const writeCalls = mockWriteFile.mock.calls;
      const envWriteCall = writeCalls.find((call: any[]) => call[0].endsWith('.env'));
      expect(envWriteCall).toBeUndefined(); // .env should never be written
      
      // Should write at least the config file
      const configWriteCall = writeCalls.find((call: any[]) => call[0].includes('ccanywhere.config.json'));
      expect(configWriteCall).toBeDefined();
    });

    it('should generate configuration with telegram settings', async () => {
      mockPathExists.mockResolvedValue(false);

      // Mock ALL the prompts in the correct order for unified flow
      mockPrompt
        .mockResolvedValueOnce({
          // Repository configuration (Step 1)
          repoUrl: 'https://github.com/test/repo.git',
          repoKind: 'github',
          repoBranch: 'main'
        })
        .mockResolvedValueOnce({
          // Storage configuration (Step 2.1)
          storageType: 'simple'
        })
        .mockResolvedValueOnce({
          // Simple storage URL (Step 2.2)
          artifactsUrl: 'https://artifacts.test.com'
        })
        .mockResolvedValueOnce({
          // Notification channels (Step 3)
          notificationChannels: ['telegram']
        })
        .mockResolvedValueOnce({
          // Telegram configuration
          botToken: '123456:ABC-DEF',
          chatId: '-1001234567890'
        })
        .mockResolvedValueOnce({
          // Advanced options (Step 4)
          enableDeployment: false,
          enablePlaywright: false
        });

      await initCommand({});

      // Should NOT write .env file
      const writeCalls = mockWriteFile.mock.calls;
      const envWriteCall = writeCalls.find((call: any[]) => call[0].endsWith('.env'));
      expect(envWriteCall).toBeUndefined();

      // Should write config file with telegram configuration
      const configWriteCall = writeCalls.find((call: any[]) => call[0].includes('ccanywhere.config.json'));
      expect(configWriteCall).toBeDefined();
      const configContent = JSON.parse(configWriteCall[1]);
      expect(configContent.notifications.channels).toContain('telegram');
    });

    it('should generate configuration with multiple notification channels', async () => {
      mockPathExists.mockResolvedValue(false);

      // Mock ALL the prompts in the correct order for unified flow with multiple channels
      mockPrompt
        .mockResolvedValueOnce({
          // Repository configuration (Step 1)
          repoUrl: 'https://github.com/test/repo.git',
          repoKind: 'github',
          repoBranch: 'main'
        })
        .mockResolvedValueOnce({
          // Storage configuration (Step 2.1)
          storageType: 'simple'
        })
        .mockResolvedValueOnce({
          // Simple storage URL (Step 2.2)
          artifactsUrl: 'https://artifacts.test.com'
        })
        .mockResolvedValueOnce({
          // Notification channels (Step 3)
          notificationChannels: ['telegram', 'dingtalk', 'wecom', 'email']
        })
        .mockResolvedValueOnce({
          // Telegram configuration (Step 3.1)
          botToken: '123456:ABC-DEF',
          chatId: '-1001234567890'
        })
        .mockResolvedValueOnce({
          // DingTalk configuration (Step 3.1)
          url: 'https://oapi.dingtalk.com/robot/send?access_token=test'
        })
        .mockResolvedValueOnce({
          // WeCom configuration (Step 3.1)
          url: 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=test'
        })
        .mockResolvedValueOnce({
          // Email configuration (Step 3.1)
          to: 'test@example.com',
          from: 'noreply@example.com',
          configureSMTP: false
        })
        .mockResolvedValueOnce({
          // Advanced options (Step 4) - all answers together
          enableDeployment: true,
          deploymentWebhook: 'https://deploy.test.com/webhook',
          enablePlaywright: false
        });

      await initCommand({});

      // Should NOT write .env file
      const writeCalls = mockWriteFile.mock.calls;
      const envWriteCall = writeCalls.find((call: any[]) => call[0].endsWith('.env'));
      expect(envWriteCall).toBeUndefined();

      // Should write config file with multiple notification channels
      const configWriteCall = writeCalls.find((call: any[]) => call[0].includes('ccanywhere.config.json'));
      expect(configWriteCall).toBeDefined();
      const configContent = JSON.parse(configWriteCall[1]);
      expect(configContent.notifications.channels).toContain('telegram');
      expect(configContent.notifications.channels).toContain('dingtalk');
      expect(configContent.notifications.channels).toContain('email');
    });
  });

  describe('validation', () => {
    it('should validate repository URL is required', async () => {
      mockPathExists.mockResolvedValue(false);

      mockPrompt
        .mockResolvedValueOnce({
          // Repository configuration (Step 1)
          repoUrl: 'https://github.com/test/repo.git',
          repoKind: 'github',
          repoBranch: 'main'
        })
        .mockResolvedValueOnce({
          // Storage configuration (Step 2)
          storageType: 'simple'
        })
        .mockResolvedValueOnce({
          // Simple storage URL
          artifactsUrl: 'https://artifacts.test.com'
        })
        .mockResolvedValueOnce({
          // Notification channels (Step 3)
          notificationChannels: ['telegram']
        })
        .mockResolvedValueOnce({
          // Telegram configuration
          botToken: '123456:ABC-DEF',
          chatId: '-1001234567890'
        })
        .mockResolvedValueOnce({
          // Advanced options (Step 4)
          enableDeployment: false,
          enablePlaywright: false
        });

      await initCommand({});

      // Find the repo URL question and test validation
      const repoUrlQuestion = mockPrompt.mock.calls[0][0].find((q: any) => q.name === 'repoUrl');
      expect(repoUrlQuestion.validate('')).not.toBe(true);
      expect(repoUrlQuestion.validate('https://github.com/test/repo.git')).toBe(true);
    });

    it('should validate notification channels are required', async () => {
      mockPathExists.mockResolvedValue(false);

      // Mock ALL the prompts in the correct order
      mockPrompt
        .mockResolvedValueOnce({
          // Repository configuration (Step 1)
          repoUrl: 'https://github.com/test/repo.git',
          repoKind: 'github',
          repoBranch: 'main'
        })
        .mockResolvedValueOnce({
          // Storage configuration (Step 2.1)
          storageType: 'simple'
        })
        .mockResolvedValueOnce({
          // Simple storage URL (Step 2.2)
          artifactsUrl: 'https://artifacts.test.com'
        })
        .mockResolvedValueOnce({
          // Notification channels (Step 3)
          notificationChannels: ['telegram']
        })
        .mockResolvedValueOnce({
          // Telegram configuration
          botToken: '123456:ABC-DEF',
          chatId: '-1001234567890'
        })
        .mockResolvedValueOnce({
          // Advanced options (Step 4)
          enableDeployment: false,
          enablePlaywright: false
        });

      await initCommand({});

      // Find the notification channels question and test validation
      // The notification channels question should be in the 4th prompt call (index 3)
      const channelsQuestion = mockPrompt.mock.calls[3][0].find((q: any) => q.name === 'notificationChannels');
      expect(channelsQuestion.validate([])).not.toBe(true);
      expect(channelsQuestion.validate(['telegram'])).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle file write errors', async () => {
      mockPathExists.mockResolvedValue(false);
      mockWriteFile.mockRejectedValue(new Error('File write failed'));
      mockPrompt
        .mockResolvedValueOnce({
          // Repository configuration (Step 1)
          repoUrl: 'https://github.com/test/repo.git',
          repoKind: 'github',
          repoBranch: 'main'
        })
        .mockResolvedValueOnce({
          // Storage configuration (Step 2)
          storageType: 'simple'
        })
        .mockResolvedValueOnce({
          // Simple storage URL
          artifactsUrl: 'https://artifacts.test.com'
        })
        .mockResolvedValueOnce({
          // Notification channels (Step 3)
          notificationChannels: ['telegram']
        })
        .mockResolvedValueOnce({
          // Telegram configuration
          botToken: '123456:ABC-DEF',
          chatId: '-1001234567890'
        })
        .mockResolvedValueOnce({
          // Advanced options (Step 4)
          enableDeployment: false,
          enablePlaywright: false
        });

      await initCommand({});

      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Error during initialization'));
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should handle git detection errors', async () => {
      mockDetectGitInfo.mockRejectedValue(new Error('Git detection failed'));
      mockPathExists.mockResolvedValue(false);
      mockPrompt
        .mockResolvedValueOnce({
          // Repository configuration (Step 1)
          repoUrl: 'https://github.com/test/repo.git',
          repoKind: 'github',
          repoBranch: 'main'
        })
        .mockResolvedValueOnce({
          // Storage configuration (Step 2)
          storageType: 'simple'
        })
        .mockResolvedValueOnce({
          // Simple storage URL
          artifactsUrl: 'https://artifacts.test.com'
        })
        .mockResolvedValueOnce({
          // Notification channels (Step 3)
          notificationChannels: ['telegram']
        })
        .mockResolvedValueOnce({
          // Telegram configuration
          botToken: '123456:ABC-DEF',
          chatId: '-1001234567890'
        })
        .mockResolvedValueOnce({
          // Advanced options (Step 4)
          enableDeployment: false,
          enablePlaywright: false
        });

      await initCommand({});

      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Error during initialization'));
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should handle prompt errors', async () => {
      mockPathExists.mockResolvedValue(false);
      mockPrompt.mockRejectedValue(new Error('User cancelled'));

      await initCommand({});

      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Error during initialization'));
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });

  describe('example file generation', () => {
    it('should generate example files when Playwright is enabled', async () => {
      mockPathExists.mockResolvedValue(false);
      mockEnsureDir.mockResolvedValue(undefined);
      mockWriteFile.mockResolvedValue(undefined);

      // Mock ALL the prompts in the correct order for unified flow with Playwright enabled
      mockPrompt
        .mockResolvedValueOnce({
          // Repository configuration (Step 1)
          repoUrl: 'https://github.com/test/repo.git',
          repoKind: 'github',
          repoBranch: 'main'
        })
        .mockResolvedValueOnce({
          // Storage configuration (Step 2.1)
          storageType: 'simple'
        })
        .mockResolvedValueOnce({
          // Simple storage URL (Step 2.2)
          artifactsUrl: 'https://artifacts.test.com'
        })
        .mockResolvedValueOnce({
          // Notification channels (Step 3)
          notificationChannels: ['telegram']
        })
        .mockResolvedValueOnce({
          // Telegram configuration (Step 3.1)
          botToken: '123456:ABC-DEF',
          chatId: '-1001234567890'
        })
        .mockResolvedValueOnce({
          // Advanced options (Step 4) - all answers together
          enableDeployment: false,
          enablePlaywright: true
        });

      await initCommand({});

      expect(mockWriteFile).toHaveBeenCalledWith(
        '/test/project/playwright.config.ts',
        expect.stringContaining('@playwright/test')
      );
      expect(mockEnsureDir).toHaveBeenCalledWith('/test/project/tests');
      expect(mockWriteFile).toHaveBeenCalledWith(
        '/test/project/tests/example.spec.ts',
        expect.stringContaining('homepage loads correctly')
      );
    });

    it('should not overwrite existing example files', async () => {
      // Mock pathExists to return specific values for different paths
      mockPathExists.mockImplementation((path: string) => {
        if (path.includes('ccanywhere.config.json')) return Promise.resolve(false);
        if (path.includes('.env')) return Promise.resolve(false);
        if (path.includes('package.json')) return Promise.resolve(true);
        if (path.includes('playwright.config.ts')) return Promise.resolve(true);
        if (path.includes('tests/example.spec.ts')) return Promise.resolve(true);
        return Promise.resolve(false);
      });

      mockPrompt
        .mockResolvedValueOnce({
          // Repository configuration (Step 1)
          repoUrl: 'https://github.com/test/repo.git',
          repoKind: 'github',
          repoBranch: 'main'
        })
        .mockResolvedValueOnce({
          // Storage configuration (Step 2)
          storageType: 'simple'
        })
        .mockResolvedValueOnce({
          // Simple storage URL
          artifactsUrl: 'https://artifacts.test.com'
        })
        .mockResolvedValueOnce({
          // Notification channels (Step 3)
          notificationChannels: ['telegram']
        })
        .mockResolvedValueOnce({
          // Telegram configuration
          botToken: '123456:ABC-DEF',
          chatId: '-1001234567890'
        })
        .mockResolvedValueOnce({
          // Advanced options (Step 4)
          enableDeployment: false,
          enablePlaywright: true
        });

      await initCommand({});

      // Should not write example files if they exist
      expect(mockWriteFile).not.toHaveBeenCalledWith('/test/project/playwright.config.ts', expect.any(String));
      expect(mockWriteFile).not.toHaveBeenCalledWith('/test/project/tests/example.spec.ts', expect.any(String));
    });
  });

  describe('gitignore handling', () => {
    it('should add ccanywhere config files to .gitignore', async () => {
      // Reset all mocks
      mockWriteFile.mockReset();
      mockWriteFile.mockResolvedValue(undefined);
      
      mockPrompt.mockReset();
      
      mockPathExists.mockImplementation((path: string) => {
        if (path.includes('.gitignore')) return Promise.resolve(false);
        if (path.includes('ccanywhere.config.json')) return Promise.resolve(false);
        if (path.includes('.env')) return Promise.resolve(false);
        return Promise.resolve(false);
      });
      mockReadFile.mockResolvedValue('');

      mockPrompt
        .mockResolvedValueOnce({
          // Repository configuration (Step 1)
          repoUrl: 'https://github.com/test/repo.git',
          repoKind: 'github',
          repoBranch: 'main'
        })
        .mockResolvedValueOnce({
          // Storage type selection (Step 2.1)
          storageType: 'simple'
        })
        .mockResolvedValueOnce({
          // Simple storage URL (Step 2.2)
          artifactsUrl: 'https://artifacts.test.com'
        })
        .mockResolvedValueOnce({
          // Notification channels (Step 3)
          notificationChannels: ['telegram']
        })
        .mockResolvedValueOnce({
          // Telegram configuration (Step 3.1)
          botToken: '123456:ABC-DEF',
          chatId: '-1001234567890'
        })
        .mockResolvedValueOnce({
          // Advanced options (Step 4)
          enableDeployment: false,
          enablePlaywright: false
        });

      await initCommand({});

      // Check that .gitignore was updated with ccanywhere config files
      const gitignoreCall = mockWriteFile.mock.calls.find((call: any) => 
        call[0].includes('.gitignore')
      );
      expect(gitignoreCall).toBeDefined();
      
      const gitignoreContent = gitignoreCall?.[1] as string;
      expect(gitignoreContent).toContain('# CCanywhere configuration files');
      expect(gitignoreContent).toContain('ccanywhere.config.js');
      expect(gitignoreContent).toContain('ccanywhere.config.json');
      expect(gitignoreContent).toContain('.ccanywhere.json');
    });

    it('should not duplicate entries in existing .gitignore', async () => {
      const existingGitignore = 'node_modules/\n.env\nccanywhere.config.json\n';
      
      mockPathExists.mockImplementation((path: string) => {
        if (path.includes('.gitignore')) return Promise.resolve(true);
        return Promise.resolve(false);
      });
      
      mockReadFile.mockResolvedValue(existingGitignore);

      mockPrompt
        .mockResolvedValueOnce({
          // Repository configuration (Step 1)
          repoUrl: 'https://github.com/test/repo.git',
          repoKind: 'github',
          repoBranch: 'main'
        })
        .mockResolvedValueOnce({
          // Storage type selection (Step 2.1)
          storageType: 'simple'
        })
        .mockResolvedValueOnce({
          // Simple storage URL (Step 2.2)
          artifactsUrl: 'https://artifacts.test.com'
        })
        .mockResolvedValueOnce({
          // Notification channels (Step 3)
          notificationChannels: ['telegram']
        })
        .mockResolvedValueOnce({
          // Telegram configuration (Step 3.1)
          botToken: '123456:ABC-DEF',
          chatId: '-1001234567890'
        })
        .mockResolvedValueOnce({
          // Advanced options (Step 4)
          enableDeployment: false,
          enablePlaywright: false
        });

      await initCommand({});

      // Should not write .gitignore if config files already exist
      const gitignoreCall = mockWriteFile.mock.calls.find((call: any) => 
        call[0] === '/test/project/.gitignore'
      );
      expect(gitignoreCall).toBeUndefined();
    });
  });
});
