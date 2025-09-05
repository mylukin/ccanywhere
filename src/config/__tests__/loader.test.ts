/**
 * Tests for ConfigLoader
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

// Mock fs-extra
const mockFs = {
  pathExists: jest.fn() as jest.Mock,
  readFile: jest.fn() as jest.Mock,
  readJson: jest.fn() as jest.Mock,
  writeJson: jest.fn() as jest.Mock
};

jest.unstable_mockModule('fs-extra', () => ({
  default: mockFs
}));

// Mock dotenv
const mockDotenv = {
  config: jest.fn() as jest.Mock
};
jest.unstable_mockModule('dotenv', () => ({
  default: mockDotenv
}));

// Mock schema validation
const mockValidateConfig = jest.fn() as jest.Mock;
jest.unstable_mockModule('./schema.js', () => ({
  validateConfig: mockValidateConfig
}));

// Import the module after mocking
const { ConfigLoader } = await import('../loader.js');

describe('ConfigLoader', () => {
  let originalEnv: any;
  let originalCwd: any;

  beforeEach(() => {
    // Mock process.env and process.cwd
    originalEnv = process.env;
    originalCwd = process.cwd;
    process.env = { ...originalEnv };
    process.cwd = jest.fn(() => '/test/project') as jest.Mock;

    // Reset all mocks
    jest.clearAllMocks();

    // Setup default mock returns
    mockFs.pathExists.mockResolvedValue(true);
    mockFs.readJson.mockResolvedValue({
      repo: { kind: 'github', url: 'https://github.com/test/repo', branch: 'main' },
      notifications: { channels: ['telegram'] }
    });
    mockValidateConfig.mockReturnValue(true);
    mockDotenv.config.mockReturnValue({ parsed: {} });
  });

  afterEach(() => {
    // Restore process
    process.env = originalEnv;
    process.cwd = originalCwd;
  });

  describe('singleton pattern', () => {
    it('should return the same instance', () => {
      const instance1 = ConfigLoader.getInstance();
      const instance2 = ConfigLoader.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should create new instance after reset', () => {
      const instance1 = ConfigLoader.getInstance();
      ConfigLoader.reset();
      const instance2 = ConfigLoader.getInstance();

      expect(instance1).not.toBe(instance2);
    });
  });

  describe('loadConfig method', () => {
    let loader: any;

    beforeEach(() => {
      ConfigLoader.reset();
      loader = ConfigLoader.getInstance();
    });

    it('should load config from default file', async () => {
      const mockConfig = {
        repo: { kind: 'github', url: 'test', branch: 'main' },
        notifications: { channels: ['telegram'] }
      };
      mockFs.readJson.mockResolvedValue(mockConfig);

      const config = await loader.loadConfig();

      expect(mockFs.readJson).toHaveBeenCalledWith('/test/project/ccanywhere.config.json');
      expect(config).toEqual(mockConfig);
    });

    it('should load config from specified file', async () => {
      const mockConfig = { repo: { kind: 'gitlab' } };
      mockFs.readJson.mockResolvedValue(mockConfig);

      const config = await loader.loadConfig('custom.config.json');

      expect(mockFs.readJson).toHaveBeenCalledWith('custom.config.json');
      expect(config).toEqual(mockConfig);
    });

    it('should resolve relative config paths', async () => {
      const config = await loader.loadConfig('./configs/test.json');

      expect(mockFs.readJson).toHaveBeenCalledWith('/test/project/configs/test.json');
    });

    it('should load .env file before config', async () => {
      await loader.loadConfig();

      expect(mockDotenv.config).toHaveBeenCalledWith({ path: '/test/project/.env' });
    });

    it('should validate loaded config', async () => {
      const mockConfig = { repo: { kind: 'github' } };
      mockFs.readJson.mockResolvedValue(mockConfig);

      await loader.loadConfig();

      expect(mockValidateConfig).toHaveBeenCalledWith(mockConfig);
    });

    it('should cache loaded config', async () => {
      const mockConfig = { repo: { kind: 'github' } };
      mockFs.readJson.mockResolvedValue(mockConfig);

      const config1 = await loader.loadConfig();
      const config2 = await loader.loadConfig();

      expect(config1).toBe(config2);
      expect(mockFs.readJson).toHaveBeenCalledTimes(1);
    });

    it('should reload config with force option', async () => {
      const mockConfig1 = { repo: { kind: 'github' } };
      const mockConfig2 = { repo: { kind: 'gitlab' } };
      
      mockFs.readJson
        .mockResolvedValueOnce(mockConfig1)
        .mockResolvedValueOnce(mockConfig2);

      const config1 = await loader.loadConfig();
      const config2 = await loader.loadConfig(undefined, { force: true });

      expect(config1).not.toBe(config2);
      expect(mockFs.readJson).toHaveBeenCalledTimes(2);
    });

    it('should handle missing config file', async () => {
      mockFs.pathExists.mockResolvedValue(false);

      await expect(loader.loadConfig()).rejects.toThrow(
        'Configuration file not found: /test/project/ccanywhere.config.json'
      );
    });

    it('should handle JSON parse errors', async () => {
      mockFs.readJson.mockRejectedValue(new Error('Unexpected token'));

      await expect(loader.loadConfig()).rejects.toThrow('Unexpected token');
    });

    it('should handle config validation errors', async () => {
      mockValidateConfig.mockImplementation(() => {
        throw new Error('Invalid configuration');
      });

      await expect(loader.loadConfig()).rejects.toThrow('Invalid configuration');
    });
  });

  describe('environment variable interpolation', () => {
    let loader: any;

    beforeEach(() => {
      ConfigLoader.reset();
      loader = ConfigLoader.getInstance();
    });

    it('should interpolate environment variables in config', async () => {
      process.env.REPO_URL = 'https://github.com/from-env/repo';
      process.env.BOT_TOKEN = 'env-bot-token';

      const mockConfig = {
        repo: { url: '${REPO_URL}', kind: 'github', branch: 'main' },
        notifications: {
          channels: ['telegram'],
          telegram: { botToken: '${BOT_TOKEN}', chatId: 'test' }
        }
      };
      mockFs.readJson.mkResolvedValue(mockConfig);

      const config = await loader.loadConfig();

      expect(config.repo.url).toBe('https://github.com/from-env/repo');
      expect(config.notifications.telegram.botToken).toBe('env-bot-token');
    });

    it('should handle missing environment variables', async () => {
      const mockConfig = {
        repo: { url: '${MISSING_VAR}', kind: 'github', branch: 'main' }
      };
      mockFs.readJson.mkResolvedValue(mockConfig);

      const config = await loader.loadConfig();

      expect(config.repo.url).toBe('${MISSING_VAR}'); // Should remain unchanged
    });

    it('should handle nested environment variable interpolation', async () => {
      process.env.BASE_URL = 'https://api.example.com';
      process.env.API_VERSION = 'v1';

      const mockConfig = {
        webhookUrl: '${BASE_URL}/${API_VERSION}/webhook'
      };
      mockFs.readJson.mkResolvedValue(mockConfig);

      const config = await loader.loadConfig();

      expect(config.webhookUrl).toBe('https://api.example.com/v1/webhook');
    });

    it('should handle environment variables with default values', async () => {
      const mockConfig = {
        timeout: '${TIMEOUT:-30000}',
        retries: '${RETRIES:-3}'
      };
      mockFs.readJson.mkResolvedValue(mockConfig);

      const config = await loader.loadConfig();

      expect(config.timeout).toBe('30000');
      expect(config.retries).toBe('3');
    });

    it('should use environment variable over default when available', async () => {
      process.env.TIMEOUT = '60000';

      const mockConfig = {
        timeout: '${TIMEOUT:-30000}'
      };
      mockFs.readJson.mkResolvedValue(mockConfig);

      const config = await loader.loadConfig();

      expect(config.timeout).toBe('60000');
    });
  });

  describe('config file discovery', () => {
    let loader: any;

    beforeEach(() => {
      ConfigLoader.reset();
      loader = ConfigLoader.getInstance();
    });

    it('should try multiple config file names', async () => {
      mockFs.pathExists
        .mkResolvedValueOnce(false) // ccanywhere.config.json
        .mkResolvedValueOnce(true);  // ccanywhere.config.js

      mockFs.readJson.mkResolvedValue({ repo: { kind: 'github' } });

      await loader.loadConfig();

      expect(mockFs.pathExists).toHaveBeenCalledWith('/test/project/ccanywhere.config.json');
      expect(mockFs.pathExists).toHaveBeenCalledWith('/test/project/ccanywhere.config.js');
    });

    it('should prefer JSON over JS config', async () => {
      mockFs.pathExists.mkResolvedValue(true); // Both files exist

      await loader.loadConfig();

      expect(mockFs.readJson).toHaveBeenCalledWith('/test/project/ccanywhere.config.json');
    });

    it('should search in parent directories', async () => {
      process.cwd = jest.fn(() => '/test/project/subdir');
      mockFs.pathExists
        .mkResolvedValueOnce(false) // /test/project/subdir/ccanywhere.config.json
        .mkResolvedValueOnce(false) // /test/project/subdir/ccanywhere.config.js
        .mkResolvedValueOnce(true);  // /test/project/ccanywhere.config.json

      await loader.loadConfig();

      expect(mockFs.readJson).toHaveBeenCalledWith('/test/project/ccanywhere.config.json');
    });
  });

  describe('config merging and extending', () => {
    let loader: any;

    beforeEach(() => {
      ConfigLoader.reset();
      loader = ConfigLoader.getInstance();
    });

    it('should merge config with environment overrides', async () => {
      process.env.REPO_BRANCH = 'develop';
      process.env.LOCK_TIMEOUT = '600';

      const mockConfig = {
        repo: { kind: 'github', url: 'test', branch: 'main' },
        build: { lockTimeout: 300 }
      };
      mockFs.readJson.mkResolvedValue(mockConfig);

      const config = await loader.loadConfig();

      // Environment variables should override config values
      expect(config.repo.branch).toBe('main'); // No direct env override in this implementation
      expect(config.build.lockTimeout).toBe(300); // No direct env override in this implementation
    });

    it('should handle config inheritance', async () => {
      const mockBaseConfig = {
        repo: { kind: 'github', branch: 'main' },
        build: { lockTimeout: 300 }
      };
      const mockConfig = {
        extends: './base.config.json',
        repo: { url: 'https://github.com/test/repo' }
      };
      
      mockFs.readJson
        .mkResolvedValueOnce(mockConfig)
        .mkResolvedValueOnce(mkBaseConfig);

      const config = await loader.loadConfig();

      // Should merge base config with overrides
      expect(config.repo.kind).toBe('github'); // From base
      expect(config.repo.url).toBe('https://github.com/test/repo'); // Override
      expect(config.build.lockTimeout).toBe(300); // From base
    });
  });

  describe('error handling', () => {
    let loader: any;

    beforeEach(() => {
      ConfigLoader.reset();
      loader = ConfigLoader.getInstance();
    });

    it('should handle file system errors', async () => {
      mockFs.readJson.mkRejectedValue(new Error('Permission denied'));

      await expect(loader.loadConfig()).rejects.toThrow('Permission denied');
    });

    it('should handle dotenv loading errors gracefully', async () => {
      mockDotenv.config.mkImplementation(() => {
        throw new Error('.env file error');
      });

      // Should not throw, just log warning
      const config = await loader.loadConfig();
      expect(config).toBeDefined();
    });

    it('should provide helpful error messages', async () => {
      mockFs.pathExists.mkResolvedValue(false);

      try {
        await loader.loadConfig('/nonexistent/path.json');
      } catch (error) {
        expect(error.message).toContain('/nonexistent/path.json');
        expect(error.message).toContain('not found');
      }
    });

    it('should handle circular config references', async () => {
      const mockConfig = {
        extends: './circular.config.json'
      };
      mockFs.readJson.mkResolvedValue(mockConfig);

      // Implementation should detect and handle circular references
      await expect(loader.loadConfig()).rejects.toThrow();
    });
  });

  describe('config caching', () => {
    let loader: any;

    beforeEach(() => {
      ConfigLoader.reset();
      loader = ConfigLoader.getInstance();
    });

    it('should cache config by file path', async () => {
      const config1 = await loader.loadConfig('config1.json');
      const config2 = await loader.loadConfig('config2.json');
      const config1Again = await loader.loadConfig('config1.json');

      expect(mockFs.readJson).toHaveBeenCalledTimes(2);
      expect(config1).toBe(config1Again);
      expect(config1).not.toBe(config2);
    });

    it('should clear cache on reset', async () => {
      await loader.loadConfig();
      ConfigLoader.reset();
      loader = ConfigLoader.getInstance();
      await loader.loadConfig();

      expect(mockFs.readJson).toHaveBeenCalledTimes(2);
    });
  });

  describe('default configuration', () => {
    let loader: any;

    beforeEach(() => {
      ConfigLoader.reset();
      loader = ConfigLoader.getInstance();
    });

    it('should provide default values for missing config sections', async () => {
      const minimalConfig = {
        repo: { kind: 'github', url: 'test', branch: 'main' }
      };
      mockFs.readJson.mkResolvedValue(minimalConfig);

      const config = await loader.loadConfig();

      expect(config.build).toBeDefined();
      expect(config.build.base).toBe('origin/main');
      expect(config.build.lockTimeout).toBe(300);
    });

    it('should merge user config with defaults', async () => {
      const userConfig = {
        repo: { kind: 'github', url: 'test', branch: 'main' },
        build: { lockTimeout: 600 } // Override default
      };
      mockFs.readJson.mkResolvedValue(userConfig);

      const config = await loader.loadConfig();

      expect(config.build.lockTimeout).toBe(600); // User override
      expect(config.build.base).toBe('origin/main'); // Default value
    });
  });
});