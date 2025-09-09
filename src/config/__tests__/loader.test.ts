/**
 * Tests for ConfigLoader
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

// Mock fs-extra
const mockFs = {
  readFile: jest.fn() as any,
  pathExists: jest.fn() as any
};
jest.unstable_mockModule('fs-extra', () => ({
  default: mockFs
}));

// Mock path
jest.unstable_mockModule('path', () => ({
  resolve: jest.fn((p: string) => `/resolved/${p}`) as any,
  join: jest.fn((...paths: string[]) => paths.join('/')) as any
}));

// Mock os
jest.unstable_mockModule('os', () => ({
  homedir: jest.fn(() => '/home/user') as any
}));

// Mock schema
const mockValidateConfig = jest.fn() as any;
const mockGetDefaultConfig = jest.fn() as any;
jest.unstable_mockModule('@/config/schema', () => ({
  validateConfig: mockValidateConfig,
  getDefaultConfig: mockGetDefaultConfig
}));

// Mock git utils
const mockDetectGitInfo = jest.fn() as any;
jest.unstable_mockModule('@/utils/git', () => ({
  detectGitInfo: mockDetectGitInfo
}));

// Mock logger
const mockLogger = {
  debug: jest.fn() as any,
  info: jest.fn() as any,
  error: jest.fn() as any
};
jest.unstable_mockModule('@/utils/logger', () => ({
  Logger: {
    getInstance: jest.fn(() => mockLogger) as any
  }
}));

// Import the actual ConfigLoader after mocking
const { ConfigLoader } = await import('../loader');

describe('ConfigLoader', () => {
  let originalEnv: any;

  beforeEach(() => {
    // Reset the singleton
    ConfigLoader.reset();
    
    // Store original env
    originalEnv = process.env;
    process.env = { ...originalEnv };

    // Clear all mocks
    jest.clearAllMocks();
    
    // Setup default mocks
    mockGetDefaultConfig.mockReturnValue({
      repo: { kind: 'github', url: '', branch: 'main' },
      build: { base: 'origin/main', lockTimeout: 300 },
      artifacts: {}
    });
    
    mockValidateConfig.mockImplementation((config: any) => config);
    mockDetectGitInfo.mockResolvedValue({
      repoUrl: 'https://github.com/test/auto-repo',
      repoKind: 'github',
      repoBranch: 'main'
    });
    
    mockFs.pathExists.mockResolvedValue(false);
  });

  afterEach(() => {
    // Restore environment
    process.env = originalEnv;
  });

  describe('singleton pattern', () => {
    it('should return the same instance', () => {
      const instance1 = ConfigLoader.getInstance();
      const instance2 = ConfigLoader.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should reset instance', () => {
      const instance1 = ConfigLoader.getInstance();
      ConfigLoader.reset();
      const instance2 = ConfigLoader.getInstance();

      expect(instance1).not.toBe(instance2);
    });
  });

  describe('loadConfig method', () => {
    it('should load default config when no file exists', async () => {
      const loader = ConfigLoader.getInstance();
      const config = await loader.loadConfig();

      expect(mockGetDefaultConfig).toHaveBeenCalled();
      expect(mockValidateConfig).toHaveBeenCalled();
      expect(config).toBeDefined();
    });

    it('should load config from JSON file', async () => {
      const jsonConfig = {
        repo: { kind: 'gitlab', url: 'https://gitlab.com/test/repo', branch: 'develop' },
        notifications: { channels: ['email'] }
      };

      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readFile.mockResolvedValue(JSON.stringify(jsonConfig));

      const loader = ConfigLoader.getInstance();
      await loader.loadConfig('/test/config.json');

      expect(mockFs.readFile).toHaveBeenCalledWith('/resolved//test/config.json', 'utf8');
      expect(mockValidateConfig).toHaveBeenCalled();
    });

    it('should auto-detect git information', async () => {
      const loader = ConfigLoader.getInstance();
      await loader.loadConfig();

      expect(mockDetectGitInfo).toHaveBeenCalledWith('.');
    });

    it('should use cached config on subsequent calls', async () => {
      const loader = ConfigLoader.getInstance();
      
      await loader.loadConfig();
      await loader.loadConfig();

      // Should only call validation once due to caching
      expect(mockValidateConfig).toHaveBeenCalledTimes(1);
    });

    it('should load from environment variables', async () => {
      process.env.REPO_URL = 'https://github.com/env/repo';
      process.env.REPO_KIND = 'github';
      process.env.NOTIFY_CHANNELS = 'telegram,email';
      process.env.BOT_TOKEN_TELEGRAM = 'test-token';
      process.env.CHAT_ID_TELEGRAM = 'test-chat';

      const loader = ConfigLoader.getInstance();
      await loader.loadConfig();

      expect(mockValidateConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          repo: expect.objectContaining({
            url: 'https://github.com/env/repo',
            kind: 'github'
          }),
          notifications: expect.objectContaining({
            channels: ['telegram', 'email'],
            telegram: {
              botToken: 'test-token',
              chatId: 'test-chat'
            }
          })
        })
      );
    });

    it('should apply backward compatibility', async () => {
      mockGetDefaultConfig.mockReturnValue({
        urls: { artifacts: 'https://old-artifacts.com' },
        storage: { provider: 's3' }
      });

      const loader = ConfigLoader.getInstance();
      await loader.loadConfig();

      expect(mockValidateConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          artifacts: expect.objectContaining({
            baseUrl: 'https://old-artifacts.com',
            storage: { provider: 's3' }
          })
        })
      );
    });
  });

  describe('error handling', () => {
    it('should handle file read errors', async () => {
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readFile.mockRejectedValue(new Error('File read failed'));

      const loader = ConfigLoader.getInstance();

      await expect(loader.loadConfig('/test/config.json')).rejects.toThrow('Failed to load config file');
    });

    it('should handle unsupported file formats', async () => {
      mockFs.pathExists.mockResolvedValue(true);

      const loader = ConfigLoader.getInstance();

      await expect(loader.loadConfig('/test/config.yaml')).rejects.toThrow('Unsupported config file format');
    });
  });

  describe('cache management', () => {
    it('should clear cache', async () => {
      const loader = ConfigLoader.getInstance();
      
      await loader.loadConfig();
      loader.clearCache();
      await loader.loadConfig();

      expect(mockValidateConfig).toHaveBeenCalledTimes(2);
    });

    it('should get current config after loading', async () => {
      const loader = ConfigLoader.getInstance();
      await loader.loadConfig();
      
      const currentConfig = loader.getCurrentConfig();
      expect(currentConfig).toBeDefined();
    });

    it('should throw error when getting config before loading', () => {
      const loader = ConfigLoader.getInstance();
      
      expect(() => loader.getCurrentConfig()).toThrow('Configuration not loaded');
    });
  });
});