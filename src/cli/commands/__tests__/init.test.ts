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

jest.unstable_mockModule('fs-extra', () => ({
  default: {
    writeFile: mockWriteFile,
    pathExists: mockPathExists,
    readFile: mockReadFile,
    ensureDir: mockEnsureDir
  }
}));

const mockPrompt = jest.fn() as any;
jest.unstable_mockModule('inquirer', () => ({
  default: {
    prompt: mockPrompt
  }
}));

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

const mockOra = jest.fn(() => ({
  start: jest.fn().mockReturnThis() as jest.Mock,
  succeed: jest.fn().mockReturnThis() as jest.Mock,
  text: ''
})) as jest.Mock;
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
    process.exit = jest.fn() as any;

    // Reset all mocks
    jest.clearAllMocks();

    // Setup default mock returns
    mockPathExists.mockResolvedValue(false);
    mockWriteFile.mockResolvedValue(undefined);
    mockEnsureDir.mockResolvedValue(undefined);
    
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

      await initCommand({ template: undefined });

      expect(mockWriteFile).toHaveBeenCalledWith(
        '/test/project/ccanywhere.config.json',
        expect.stringContaining('"kind": "github"')
      );
      expect(mockWriteFile).toHaveBeenCalledWith(
        '/test/project/.env',
        expect.stringContaining('CCanywhere Environment Configuration')
      );
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('initialized successfully'));
    });

    it('should initialize with advanced template', async () => {
      mockPathExists.mockResolvedValue(false);
      mockPrompt.mockResolvedValueOnce({
        repoUrl: 'https://github.com/test/repo.git',
        repoKind: 'github',
        repoBranch: 'main',
        artifactsUrl: 'https://artifacts.test.com',
        enableDeployment: true,
        deploymentWebhook: 'https://deploy.test.com/webhook',
        notificationChannels: ['telegram', 'email']
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
      mockPrompt.mockResolvedValueOnce({
        repoUrl: 'https://github.com/test/repo.git',
        repoKind: 'github',
        repoBranch: 'main',
        artifactsUrl: 'https://artifacts.test.com',
        notificationChannels: ['telegram']
      });

      await initCommand({ template: 'basic' });

      // Should not prompt for template selection
      expect(mockPrompt).toHaveBeenCalledTimes(1);
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
          artifactsUrl: 'https://artifacts.test.com',
          notificationChannels: ['telegram']
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
      mockPrompt
        .mockResolvedValueOnce({ selectedTemplate: 'basic' })
        .mockResolvedValueOnce({
          repoUrl: 'https://github.com/test/repo.git',
          repoKind: 'github',
          repoBranch: 'main',
          artifactsUrl: 'https://artifacts.test.com',
          notificationChannels: ['telegram']
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

      // Should only write config file, not .env
      expect(mockWriteFile).toHaveBeenCalledTimes(1);
      expect(mockWriteFile).toHaveBeenCalledWith(
        '/test/project/ccanywhere.config.json',
        expect.any(String)
      );
    });

    it('should generate .env with telegram configuration', async () => {
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

      expect(mockWriteFile).toHaveBeenCalledWith(
        '/test/project/.env',
        expect.stringContaining('BOT_TOKEN_TELEGRAM')
      );
    });

    it('should generate .env with multiple notification channels', async () => {
      mockPathExists.mockResolvedValue(false);
      mockPrompt
        .mockResolvedValueOnce({ selectedTemplate: 'advanced' })
        .mockResolvedValueOnce({
          repoUrl: 'https://github.com/test/repo.git',
          repoKind: 'github',
          repoBranch: 'main',
          artifactsUrl: 'https://artifacts.test.com',
          enableDeployment: true,
          deploymentWebhook: 'https://deploy.test.com/webhook',
          notificationChannels: ['telegram', 'dingtalk', 'wecom', 'email']
        });

      await initCommand({});

      const envContent = mockWriteFile.mock.calls.find(
        (call: any) => call[0] === '/test/project/.env'
      )?.[1] as string;

      expect(envContent).toContain('BOT_TOKEN_TELEGRAM');
      expect(envContent).toContain('DINGTALK_WEBHOOK');
      expect(envContent).toContain('WECOM_WEBHOOK');
      expect(envContent).toContain('EMAIL_TO');
      expect(envContent).toContain('DEPLOYMENT_WEBHOOK_URL');
    });
  });

  describe('validation', () => {
    it('should validate repository URL is required', async () => {
      mockPathExists.mockResolvedValue(false);
      
      const questions = [
        expect.objectContaining({
          name: 'repoUrl',
          validate: expect.any(Function)
        })
      ];

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

      // Find the notification channels question and test validation
      const channelsQuestion = mockPrompt.mock.calls[1][0].find(
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
      mockPrompt.mockRejectedValue(new Error('User cancelled'));

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