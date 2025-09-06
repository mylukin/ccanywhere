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
      added: [
        { name: 'test:e2e', command: 'playwright test' }
      ],
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

  describe('basic initialization', () => {
    it('should initialize with basic template', async () => {
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
      
      // Mock ALL the prompts in the correct order
      mockPrompt
        .mockResolvedValueOnce({ selectedTemplate: 'basic' })  // Template selection
        .mockResolvedValueOnce({  // Repository configuration (Step 1)
          repoUrl: 'https://github.com/test/repo.git',
          repoKind: 'github',
          repoBranch: 'main'
        })
        .mockResolvedValueOnce({  // Storage configuration (Step 2) 
          useCloudStorage: false
        })
        .mockResolvedValueOnce({  // Artifacts URL when not using cloud storage
          artifactsUrl: 'https://artifacts.test.com'
        })
        .mockResolvedValueOnce({  // Notification channels (Step 3)
          notificationChannels: ['telegram']
        })
        .mockResolvedValueOnce({  // Telegram configuration
          botToken: '123456:ABC-DEF',
          chatId: '-1001234567890'
        })
        .mockResolvedValueOnce({  // Playwright testing (Step 4)
          enablePlaywright: false
        })
        .mockResolvedValueOnce({  // Deployment webhook (Step 5)
          enableDeployment: false
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

      // Verify config file was written
      expect(mockWriteFile).toHaveBeenCalled();
      const configCall = mockWriteFile.mock.calls.find((call: any[]) => 
        call[0].includes('ccanywhere.config.json')
      );
      expect(configCall).toBeDefined();
      
      const configContent = JSON.parse(configCall[1]);
      expect(configContent.repo.kind).toBe('github');
      expect(configContent.test).toBeDefined();
      expect(configContent.test.enabled).toBe(false);
    });

    it('should initialize with advanced template', async () => {
      mockPathExists.mockResolvedValue(false);
      
      // Mock ALL the prompts in the correct order for advanced template
      mockPrompt
        .mockResolvedValueOnce({  // Repository configuration (Step 1)
          repoUrl: 'https://github.com/test/repo.git',
          repoKind: 'github',
          repoBranch: 'main'
        })
        .mockResolvedValueOnce({  // Storage configuration - storage choice (Step 2.1)
          storageType: 'cloud'
        })
        .mockResolvedValueOnce({  // Storage configuration - provider details (Step 2.2)
          storageProvider: 'r2',
          storageFolder: 'diffs',
          artifactsUrl: 'https://artifacts.test.com'
        })
        .mockResolvedValueOnce({  // R2 provider configuration (Step 2.3)
          accountId: 'test-account',
          accessKeyId: 'test-key',
          secretAccessKey: 'test-secret',
          bucket: 'test-bucket'
        })
        .mockResolvedValueOnce({  // Notification channels (Step 3)
          notificationChannels: ['telegram', 'email']
        })
        .mockResolvedValueOnce({  // Telegram configuration (Step 3.1)
          botToken: '123456:ABC-DEF',
          chatId: '-1001234567890'
        })
        .mockResolvedValueOnce({  // Email configuration (Step 3.1)
          to: 'test@example.com',
          from: 'noreply@example.com',
          configureSMTP: false
        })
        .mockResolvedValueOnce({  // Advanced options (Step 4) - all answers together
          enableDeployment: true,
          deploymentWebhook: 'https://deploy.test.com/webhook',
          enablePlaywright: true
        });

      await initCommand({ template: 'advanced' });

      expect(mockWriteFile).toHaveBeenCalledWith(
        '/test/project/ccanywhere.config.json',
        expect.stringContaining('"deployment"')
      );
      expect(mockWriteFile).toHaveBeenCalledWith(
        '/test/project/playwright.config.ts',
        expect.stringContaining('@playwright/test')
      );
      expect(mockEnsureDir).toHaveBeenCalledWith('/test/project/tests');
    });

    it('should use provided template option', async () => {
      mockPathExists.mockResolvedValue(false);
      mockPrompt
        .mockResolvedValueOnce({
          repoUrl: 'https://github.com/test/repo.git',
          repoKind: 'github',
          repoBranch: 'main',
          useCloudStorage: false,
          artifactsUrl: 'https://artifacts.test.com',
          notificationChannels: ['telegram'],
          enablePlaywright: false,
          enableDeployment: false
        })
        .mockResolvedValueOnce({
          botToken: '123456:ABC-DEF',
          chatId: '-1001234567890'
        });

      await initCommand({ template: 'basic' });

      // Should not prompt for template selection
      expect(mockPrompt).not.toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ name: 'selectedTemplate' })])
      );
    });
  });

  describe('config file handling', () => {
    it('should prompt for overwrite when config exists', async () => {
      mockPathExists.mockResolvedValue(true);
      mockPrompt
        .mockResolvedValueOnce({ overwrite: true })
        .mockResolvedValueOnce({ selectedTemplate: 'basic' })
        .mockResolvedValueOnce({
          repoUrl: 'https://github.com/test/repo.git',
          repoKind: 'github',
          repoBranch: 'main',
          useCloudStorage: false,
          artifactsUrl: 'https://artifacts.test.com',
          notificationChannels: ['telegram'],
          enablePlaywright: false,
          enableDeployment: false
        })
        .mockResolvedValueOnce({
          botToken: '123456:ABC-DEF',
          chatId: '-1001234567890'
        });

      await initCommand({});

      expect(mockPrompt).toHaveBeenCalledWith([
        expect.objectContaining({
          type: 'confirm',
          name: 'overwrite',
          message: 'Configuration already exists. Overwrite?'
        })
      ]);
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
        .mockResolvedValueOnce({ selectedTemplate: 'basic' })  // Template selection
        .mockResolvedValueOnce({  // Repository configuration (Step 1)
          repoUrl: 'https://github.com/test/repo.git',
          repoKind: 'github',
          repoBranch: 'main'
        })
        .mockResolvedValueOnce({  // Storage configuration (Step 2.1)
          storageType: 'simple'
        })
        .mockResolvedValueOnce({  // Simple storage URL (Step 2.2)
          artifactsUrl: 'https://artifacts.test.com'
        })
        .mockResolvedValueOnce({  // Notification channels (Step 3)
          notificationChannels: ['telegram']
        })
        .mockResolvedValueOnce({  // Telegram configuration
          botToken: '123456:ABC-DEF',
          chatId: '-1001234567890'
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
        .mockResolvedValueOnce({ selectedTemplate: 'basic' })
        .mockResolvedValueOnce({
          repoUrl: 'https://github.com/auto/detected.git', // Should default to auto-detected
          repoKind: 'github',
          repoBranch: 'develop',
          artifactsUrl: 'https://artifacts.test.com',
          notificationChannels: ['telegram']
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
        .mockResolvedValueOnce({ selectedTemplate: 'basic' })
        .mockResolvedValueOnce({
          repoUrl: 'https://github.com/manual/entry.git',
          repoKind: 'github',
          repoBranch: 'main',
          artifactsUrl: 'https://artifacts.test.com',
          notificationChannels: ['telegram']
        });

      await initCommand({});

      // Should not show auto-detection message
      expect(console.log).not.toHaveBeenCalledWith(expect.stringContaining('Auto-detected'));
    });
  });

  describe('.env file generation', () => {
    it('should not overwrite existing .env file', async () => {
      mockPathExists
        .mockResolvedValueOnce(false) // config file doesn't exist
        .mockResolvedValueOnce(true); // .env file exists
      
      // Mock ALL the prompts in the correct order
      mockPrompt
        .mockResolvedValueOnce({ selectedTemplate: 'basic' })  // Template selection
        .mockResolvedValueOnce({  // Repository configuration (Step 1)
          repoUrl: 'https://github.com/test/repo.git',
          repoKind: 'github',
          repoBranch: 'main'
        })
        .mockResolvedValueOnce({  // Storage configuration (Step 2.1)
          storageType: 'simple'
        })
        .mockResolvedValueOnce({  // Simple storage URL (Step 2.2)
          artifactsUrl: 'https://artifacts.test.com'
        })
        .mockResolvedValueOnce({  // Notification channels (Step 3)
          notificationChannels: ['telegram']
        })
        .mockResolvedValueOnce({  // Telegram configuration
          botToken: '123456:ABC-DEF',
          chatId: '-1001234567890'
        });

      await initCommand({});

      // Should only write config file, not .env
      expect(mockWriteFile).toHaveBeenCalledTimes(1);
      expect(mockWriteFile).toHaveBeenCalledWith(
        '/test/project/ccanywhere.config.json',
        expect.any(String)
      );
    });

    it('should generate .env with telegram configuration', async () => {
      mockPathExists.mockResolvedValue(false);
      
      // Mock ALL the prompts in the correct order for basic template (no advanced options)
      mockPrompt
        .mockResolvedValueOnce({ selectedTemplate: 'basic' })  // Template selection
        .mockResolvedValueOnce({  // Repository configuration (Step 1)
          repoUrl: 'https://github.com/test/repo.git',
          repoKind: 'github',
          repoBranch: 'main'
        })
        .mockResolvedValueOnce({  // Storage configuration (Step 2.1)
          storageType: 'simple'
        })
        .mockResolvedValueOnce({  // Simple storage URL (Step 2.2)
          artifactsUrl: 'https://artifacts.test.com'
        })
        .mockResolvedValueOnce({  // Notification channels (Step 3)
          notificationChannels: ['telegram']
        })
        .mockResolvedValueOnce({  // Telegram configuration
          botToken: '123456:ABC-DEF',
          chatId: '-1001234567890'
        });

      await initCommand({});

      expect(mockWriteFile).toHaveBeenCalledWith(
        '/test/project/.env',
        expect.stringContaining('# BOT_TOKEN_TELEGRAM')
      );
    });

    it('should generate .env with multiple notification channels', async () => {
      mockPathExists.mockResolvedValue(false);
      
      // Mock ALL the prompts in the correct order for advanced template
      mockPrompt
        .mockResolvedValueOnce({  // Repository configuration (Step 1)
          repoUrl: 'https://github.com/test/repo.git',
          repoKind: 'github',
          repoBranch: 'main'
        })
        .mockResolvedValueOnce({  // Storage configuration (Step 2.1)
          storageType: 'simple'
        })
        .mockResolvedValueOnce({  // Simple storage URL (Step 2.2)
          artifactsUrl: 'https://artifacts.test.com'
        })
        .mockResolvedValueOnce({  // Notification channels (Step 3)
          notificationChannels: ['telegram', 'dingtalk', 'wecom', 'email']
        })
        .mockResolvedValueOnce({  // Telegram configuration (Step 3.1)
          botToken: '123456:ABC-DEF',
          chatId: '-1001234567890'
        })
        .mockResolvedValueOnce({  // DingTalk configuration (Step 3.1)
          url: 'https://oapi.dingtalk.com/robot/send?access_token=test'
        })
        .mockResolvedValueOnce({  // WeCom configuration (Step 3.1)
          url: 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=test'
        })
        .mockResolvedValueOnce({  // Email configuration (Step 3.1)
          to: 'test@example.com',
          from: 'noreply@example.com',
          configureSMTP: false
        })
        .mockResolvedValueOnce({  // Advanced options (Step 4) - all answers together
          enableDeployment: true,
          deploymentWebhook: 'https://deploy.test.com/webhook',
          enablePlaywright: false
        });

      await initCommand({ template: 'advanced' });

      const envContent = mockWriteFile.mock.calls.find(
        (call: any) => call[0] === '/test/project/.env'
      )?.[1] as string;

      expect(envContent).toContain('# BOT_TOKEN_TELEGRAM');
      expect(envContent).toContain('# DINGTALK_WEBHOOK');
      expect(envContent).toContain('# WECOM_WEBHOOK');
      expect(envContent).toContain('# EMAIL_TO');
      expect(envContent).toContain('DEPLOYMENT_WEBHOOK_URL');
    });
  });

  describe('validation', () => {
    it('should validate repository URL is required', async () => {
      mockPathExists.mockResolvedValue(false);

      mockPrompt
        .mockResolvedValueOnce({ selectedTemplate: 'basic' })
        .mockResolvedValueOnce({
          repoUrl: 'https://github.com/test/repo.git',
          repoKind: 'github',
          repoBranch: 'main',
          artifactsUrl: 'https://artifacts.test.com',
          notificationChannels: ['telegram']
        });

      await initCommand({});

      // Find the repo URL question and test validation
      const repoUrlQuestion = mockPrompt.mock.calls[1][0].find(
        (q: any) => q.name === 'repoUrl'
      );
      expect(repoUrlQuestion.validate('')).not.toBe(true);
      expect(repoUrlQuestion.validate('https://github.com/test/repo.git')).toBe(true);
    });

    it('should validate notification channels are required', async () => {
      mockPathExists.mockResolvedValue(false);
      
      // Mock ALL the prompts in the correct order
      mockPrompt
        .mockResolvedValueOnce({ selectedTemplate: 'basic' })  // Template selection
        .mockResolvedValueOnce({  // Repository configuration (Step 1)
          repoUrl: 'https://github.com/test/repo.git',
          repoKind: 'github',
          repoBranch: 'main'
        })
        .mockResolvedValueOnce({  // Storage configuration (Step 2.1)
          storageType: 'simple'
        })
        .mockResolvedValueOnce({  // Simple storage URL (Step 2.2)
          artifactsUrl: 'https://artifacts.test.com'
        })
        .mockResolvedValueOnce({  // Notification channels (Step 3)
          notificationChannels: ['telegram']
        })
        .mockResolvedValueOnce({  // Telegram configuration
          botToken: '123456:ABC-DEF',
          chatId: '-1001234567890'
        });

      await initCommand({});

      // Find the notification channels question and test validation
      // The notification channels question should be in the 5th prompt call (index 4)
      const channelsQuestion = mockPrompt.mock.calls[4][0].find(
        (q: any) => q.name === 'notificationChannels'
      );
      expect(channelsQuestion.validate([])).not.toBe(true);
      expect(channelsQuestion.validate(['telegram'])).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle file write errors', async () => {
      mockPathExists.mockResolvedValue(false);
      mockWriteFile.mockRejectedValue(new Error('File write failed'));
      mockPrompt
        .mockResolvedValueOnce({ selectedTemplate: 'basic' })
        .mockResolvedValueOnce({
          repoUrl: 'https://github.com/test/repo.git',
          repoKind: 'github',
          repoBranch: 'main',
          artifactsUrl: 'https://artifacts.test.com',
          notificationChannels: ['telegram']
        });

      await initCommand({});

      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Error during initialization'));
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should handle git detection errors', async () => {
      mockDetectGitInfo.mockRejectedValue(new Error('Git detection failed'));
      mockPathExists.mockResolvedValue(false);
      mockPrompt
        .mockResolvedValueOnce({ selectedTemplate: 'basic' })
        .mockResolvedValueOnce({
          repoUrl: 'https://github.com/test/repo.git',
          repoKind: 'github',
          repoBranch: 'main',
          artifactsUrl: 'https://artifacts.test.com',
          notificationChannels: ['telegram']
        });

      await initCommand({});

      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Error during initialization'));
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should handle prompt errors', async () => {
      mockPathExists.mockResolvedValue(false);
      mockPrompt.mockResolvedValueOnce({ selectedTemplate: 'basic' }).mockRejectedValue(new Error('User cancelled'));

      await initCommand({});

      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Error during initialization'));
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });

  describe('example file generation', () => {
    it('should generate example files for advanced template', async () => {
      mockPathExists.mockResolvedValue(false);
      mockEnsureDir.mockResolvedValue(undefined);
      mockWriteFile.mockResolvedValue(undefined);
      
      // Mock ALL the prompts in the correct order for advanced template
      mockPrompt
        .mockResolvedValueOnce({  // Repository configuration (Step 1)
          repoUrl: 'https://github.com/test/repo.git',
          repoKind: 'github',
          repoBranch: 'main'
        })
        .mockResolvedValueOnce({  // Storage configuration (Step 2.1)
          storageType: 'simple'
        })
        .mockResolvedValueOnce({  // Simple storage URL (Step 2.2)
          artifactsUrl: 'https://artifacts.test.com'
        })
        .mockResolvedValueOnce({  // Notification channels (Step 3)
          notificationChannels: ['telegram']
        })
        .mockResolvedValueOnce({  // Telegram configuration (Step 3.1)
          botToken: '123456:ABC-DEF',
          chatId: '-1001234567890'
        })
        .mockResolvedValueOnce({  // Advanced options (Step 4) - all answers together
          enableDeployment: false,
          enablePlaywright: true
        });

      await initCommand({ template: 'advanced' });

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
      mockPathExists
        .mockResolvedValueOnce(false) // config file
        .mockResolvedValueOnce(false) // .env file
        .mockResolvedValueOnce(true) // playwright.config.ts exists
        .mockResolvedValueOnce(true); // test file exists
      
      mockPrompt
        .mockResolvedValueOnce({ selectedTemplate: 'advanced' })
        .mockResolvedValueOnce({
          repoUrl: 'https://github.com/test/repo.git',
          repoKind: 'github',
          repoBranch: 'main',
          artifactsUrl: 'https://artifacts.test.com',
          enableDeployment: false,
          notificationChannels: ['telegram']
        });

      await initCommand({});

      // Should not write example files if they exist
      expect(mockWriteFile).not.toHaveBeenCalledWith(
        '/test/project/playwright.config.ts',
        expect.any(String)
      );
      expect(mockWriteFile).not.toHaveBeenCalledWith(
        '/test/project/tests/example.spec.ts',
        expect.any(String)
      );
    });
  });
});