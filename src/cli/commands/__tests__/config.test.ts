/**
 * Tests for config command
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

// Mock fs-extra
const mockReadFile = jest.fn() as jest.Mock;
const mockWriteFile = jest.fn() as jest.Mock;
const mockPathExists = jest.fn() as jest.Mock;

jest.unstable_mockModule('fs-extra', () => ({
  default: {
    readFile: mockReadFile,
    writeFile: mockWriteFile,
    pathExists: mockPathExists
  }
}));

// Mock chalk
const mockChalk = {
  blue: jest.fn((text: string) => text),
  green: jest.fn((text: string) => text),
  yellow: jest.fn((text: string) => text),
  red: jest.fn((text: string) => text),
  gray: jest.fn((text: string) => text)
};
jest.unstable_mockModule('chalk', () => ({
  default: mockChalk
}));

// Mock ConfigLoader
const mockConfigLoader = {
  loadConfig: jest.fn() as jest.Mock
};
const mockGetInstance = jest.fn(() => mockConfigLoader) as jest.Mock;
const mockValidateConfig = jest.fn() as jest.Mock;

jest.unstable_mockModule('../../config/index.js', () => ({
  ConfigLoader: {
    getInstance: mockGetInstance
  },
  validateConfig: mockValidateConfig
}));

// Mock child_process
const mockSpawn = jest.fn() as jest.Mock;
jest.unstable_mockModule('child_process', () => ({
  spawn: mockSpawn
}));

// Import the module after mocking
const { configCommand } = await import('../config.js');

describe('config command', () => {
  let originalConsole: any;
  let originalExit: any;
  let originalEnv: any;

  beforeEach(() => {
    // Mock console methods
    originalConsole = { ...console };
    console.log = jest.fn() as jest.Mock;
    console.error = jest.fn() as jest.Mock;

    // Mock process.exit
    originalExit = process.exit;
    process.exit = jest.fn() as any;

    // Mock environment
    originalEnv = process.env;
    process.env = { ...originalEnv };

    // Reset all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Restore console
    console.log = originalConsole.log;
    console.error = originalConsole.error;

    // Restore process
    process.exit = originalExit;
    process.env = originalEnv;
  });

  describe('show subcommand', () => {
    it('should show current configuration', async () => {
      const mockConfig = {
        repo: { kind: 'github', url: 'https://github.com/test/repo', branch: 'main' },
        notifications: { channels: ['telegram'] }
      };
      mockConfigLoader.loadConfig.mockResolvedValue(mockConfig);

      // Execute the show command
      const command = configCommand.commands.find(cmd => cmd.name() === 'show');
      await command?.parseAsync(['show'], { from: 'user' });

      expect(mockConfigLoader.loadConfig).toHaveBeenCalledWith(undefined);
      expect(console.log).toHaveBeenCalledWith('Current Configuration:');
      expect(console.log).toHaveBeenCalledWith(JSON.stringify(mockConfig, null, 2));
    });

    it('should show configuration from specified file', async () => {
      const mockConfig = { repo: { kind: 'gitlab' } };
      mockConfigLoader.loadConfig.mockResolvedValue(mockConfig);

      const command = configCommand.commands.find(cmd => cmd.name() === 'show');
      await command?.parseAsync(['show', '-f', 'custom.config.json'], { from: 'user' });

      expect(mockConfigLoader.loadConfig).toHaveBeenCalledWith('custom.config.json');
    });

    it('should handle configuration load errors', async () => {
      mockConfigLoader.loadConfig.mockRejectedValue(new Error('Config not found'));

      const command = configCommand.commands.find(cmd => cmd.name() === 'show');
      await command?.parseAsync(['show'], { from: 'user' });

      expect(console.error).toHaveBeenCalledWith('Error loading configuration:');
      expect(console.error).toHaveBeenCalledWith('Config not found');
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });

  describe('validate subcommand', () => {
    it('should validate configuration file', async () => {
      const mockConfig = { repo: { kind: 'github', url: 'test', branch: 'main' } };
      mockPathExists.mockResolvedValue(true);
      mockReadFile.mockResolvedValue(JSON.stringify(mockConfig));
      mockValidateConfig.mockReturnValue(true);

      const command = configCommand.commands.find(cmd => cmd.name() === 'validate');
      await command?.parseAsync(['validate'], { from: 'user' });

      expect(mockPathExists).toHaveBeenCalledWith('ccanywhere.config.json');
      expect(mockReadFile).toHaveBeenCalledWith('ccanywhere.config.json', 'utf8');
      expect(mockValidateConfig).toHaveBeenCalledWith(mockConfig);
      expect(console.log).toHaveBeenCalledWith('✅ Configuration is valid');
    });

    it('should validate custom configuration file', async () => {
      const mockConfig = { repo: { kind: 'gitlab' } };
      mockPathExists.mockResolvedValue(true);
      mockReadFile.mockResolvedValue(JSON.stringify(mockConfig));
      mockValidateConfig.mockReturnValue(true);

      const command = configCommand.commands.find(cmd => cmd.name() === 'validate');
      await command?.parseAsync(['validate', '-f', 'custom.config.json'], { from: 'user' });

      expect(mockPathExists).toHaveBeenCalledWith('custom.config.json');
      expect(mockReadFile).toHaveBeenCalledWith('custom.config.json', 'utf8');
    });

    it('should handle missing configuration file', async () => {
      mockPathExists.mockResolvedValue(false);

      const command = configCommand.commands.find(cmd => cmd.name() === 'validate');
      await command?.parseAsync(['validate'], { from: 'user' });

      expect(console.error).toHaveBeenCalledWith('Configuration file not found: ccanywhere.config.json');
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should handle invalid JSON', async () => {
      mockPathExists.mockResolvedValue(true);
      mockReadFile.mockResolvedValue('{ invalid json }');

      const command = configCommand.commands.find(cmd => cmd.name() === 'validate');
      await command?.parseAsync(['validate'], { from: 'user' });

      expect(console.error).toHaveBeenCalledWith('❌ Configuration validation failed:');
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should handle validation errors', async () => {
      const mockConfig = { invalid: 'config' };
      mockPathExists.mockResolvedValue(true);
      mockReadFile.mockResolvedValue(JSON.stringify(mockConfig));
      mockValidateConfig.mockImplementation(() => {
        throw new Error('Invalid configuration');
      });

      const command = configCommand.commands.find(cmd => cmd.name() === 'validate');
      await command?.parseAsync(['validate'], { from: 'user' });

      expect(console.error).toHaveBeenCalledWith('❌ Configuration validation failed:');
      expect(console.error).toHaveBeenCalledWith('Invalid configuration');
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });

  describe('edit subcommand', () => {
    it('should open configuration file in default editor', async () => {
      const mockChild = {
        on: jest.fn((event, callback) => {
          if (event === 'exit') {
            callback(0); // Simulate successful exit
          }
        })
      };
      mockSpawn.mockReturnValue(mockChild);
      process.env.EDITOR = 'nano';

      const command = configCommand.commands.find(cmd => cmd.name() === 'edit');
      await command?.parseAsync(['edit'], { from: 'user' });

      expect(mockSpawn).toHaveBeenCalledWith('nano', ['ccanywhere.config.json'], {
        stdio: 'inherit'
      });
      expect(console.log).toHaveBeenCalledWith('Configuration file updated');
    });

    it('should use custom configuration file path', async () => {
      const mockChild = {
        on: jest.fn((event, callback) => {
          if (event === 'exit') callback(0);
        })
      };
      mockSpawn.mockReturnValue(mockChild);
      process.env.EDITOR = 'code';

      const command = configCommand.commands.find(cmd => cmd.name() === 'edit');
      await command?.parseAsync(['edit', '-f', 'custom.config.json'], { from: 'user' });

      expect(mockSpawn).toHaveBeenCalledWith('code', ['custom.config.json'], {
        stdio: 'inherit'
      });
    });

    it('should handle editor exit with non-zero code', async () => {
      const mockChild = {
        on: jest.fn((event, callback) => {
          if (event === 'exit') {
            callback(1); // Simulate editor error
          }
        })
      };
      mockSpawn.mockReturnValue(mockChild);
      delete process.env.EDITOR; // Use default nano

      const command = configCommand.commands.find(cmd => cmd.name() === 'edit');
      await command?.parseAsync(['edit'], { from: 'user' });

      expect(mockSpawn).toHaveBeenCalledWith('nano', ['ccanywhere.config.json'], {
        stdio: 'inherit'
      });
      expect(console.log).toHaveBeenCalledWith('Editor exited with code:', 1);
    });

    it('should handle spawn errors', async () => {
      mockSpawn.mockImplementation(() => {
        throw new Error('Editor not found');
      });

      const command = configCommand.commands.find(cmd => cmd.name() === 'edit');
      await command?.parseAsync(['edit'], { from: 'user' });

      expect(console.error).toHaveBeenCalledWith('Failed to open editor:');
      expect(console.error).toHaveBeenCalledWith('Editor not found');
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('EDITOR environment variable'));
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });

  describe('init-env subcommand', () => {
    it('should generate .env file from configuration', async () => {
      const mockConfig = {
        repo: {
          kind: 'github',
          url: 'https://github.com/test/repo',
          branch: 'main'
        },
        urls: {
          artifacts: 'https://artifacts.test.com'
        },
        notifications: {
          channels: ['telegram', 'email']
        },
        deployment: 'https://deploy.test.com/webhook'
      };

      mockPathExists.mockResolvedValue(false);
      mockConfigLoader.loadConfig.mockResolvedValue(mockConfig);

      const command = configCommand.commands.find(cmd => cmd.name() === 'init-env');
      await command?.parseAsync(['init-env'], { from: 'user' });

      expect(mockPathExists).toHaveBeenCalledWith('.env');
      expect(mockConfigLoader.loadConfig).toHaveBeenCalled();
      expect(mockWriteFile).toHaveBeenCalledWith(
        '.env',
        expect.stringContaining('CCanywhere Environment Configuration')
      );

      const envContent = mockWriteFile.mock.calls[0][1] as string;
      expect(envContent).toContain('REPO_URL=https://github.com/test/repo');
      expect(envContent).toContain('REPO_KIND=github');
      expect(envContent).toContain('REPO_BRANCH=main');
      expect(envContent).toContain('ARTIFACTS_BASE_URL=https://artifacts.test.com');
      expect(envContent).toContain('DEPLOYMENT_WEBHOOK_URL=https://deploy.test.com/webhook');
      expect(envContent).toContain('NOTIFY_CHANNELS=telegram,email');
      expect(envContent).toContain('BOT_TOKEN_TELEGRAM=');
      expect(envContent).toContain('EMAIL_TO=');

      expect(console.log).toHaveBeenCalledWith('✅ .env file generated successfully');
    });

    it('should not overwrite existing .env file without force', async () => {
      mockPathExists.mockResolvedValue(true);

      const command = configCommand.commands.find(cmd => cmd.name() === 'init-env');
      await command?.parseAsync(['init-env'], { from: 'user' });

      expect(console.log).toHaveBeenCalledWith('.env file already exists. Use --force to overwrite.');
      expect(mockWriteFile).not.toHaveBeenCalled();
    });

    it('should overwrite existing .env file with force flag', async () => {
      const mockConfig = {
        repo: { kind: 'github', url: 'test', branch: 'main' },
        notifications: { channels: ['telegram'] }
      };

      mockPathExists.mockResolvedValue(true);
      mockConfigLoader.loadConfig.mockResolvedValue(mockConfig);

      const command = configCommand.commands.find(cmd => cmd.name() === 'init-env');
      await command?.parseAsync(['init-env', '--force'], { from: 'user' });

      expect(mockWriteFile).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith('✅ .env file generated successfully');
    });

    it('should handle object deployment configuration', async () => {
      const mockConfig = {
        repo: { kind: 'github', url: 'test', branch: 'main' },
        notifications: { channels: ['telegram'] },
        deployment: {
          webhook: 'https://deploy.test.com/webhook'
        }
      };

      mockPathExists.mockResolvedValue(false);
      mockConfigLoader.loadConfig.mockResolvedValue(mockConfig);

      const command = configCommand.commands.find(cmd => cmd.name() === 'init-env');
      await command?.parseAsync(['init-env'], { from: 'user' });

      const envContent = mockWriteFile.mock.calls[0][1] as string;
      expect(envContent).toContain('DEPLOYMENT_WEBHOOK_URL=https://deploy.test.com/webhook');
    });

    it('should generate env for all notification channels', async () => {
      const mockConfig = {
        repo: { kind: 'github', url: 'test', branch: 'main' },
        notifications: {
          channels: ['telegram', 'dingtalk', 'wecom', 'email']
        }
      };

      mockPathExists.mockResolvedValue(false);
      mockConfigLoader.loadConfig.mockResolvedValue(mockConfig);

      const command = configCommand.commands.find(cmd => cmd.name() === 'init-env');
      await command?.parseAsync(['init-env'], { from: 'user' });

      const envContent = mockWriteFile.mock.calls[0][1] as string;
      expect(envContent).toContain('BOT_TOKEN_TELEGRAM=');
      expect(envContent).toContain('DINGTALK_WEBHOOK=');
      expect(envContent).toContain('WECOM_WEBHOOK=');
      expect(envContent).toContain('EMAIL_TO=');
    });

    it('should handle configuration load errors', async () => {
      mockPathExists.mockResolvedValue(false);
      mockConfigLoader.loadConfig.mockRejectedValue(new Error('Config not found'));

      const command = configCommand.commands.find(cmd => cmd.name() === 'init-env');
      await command?.parseAsync(['init-env'], { from: 'user' });

      expect(console.error).toHaveBeenCalledWith('Failed to generate .env file:');
      expect(console.error).toHaveBeenCalledWith('Config not found');
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should handle file write errors', async () => {
      const mockConfig = {
        repo: { kind: 'github', url: 'test', branch: 'main' },
        notifications: { channels: ['telegram'] }
      };

      mockPathExists.mockResolvedValue(false);
      mockConfigLoader.loadConfig.mockResolvedValue(mockConfig);
      mockWriteFile.mockRejectedValue(new Error('Write failed'));

      const command = configCommand.commands.find(cmd => cmd.name() === 'init-env');
      await command?.parseAsync(['init-env'], { from: 'user' });

      expect(console.error).toHaveBeenCalledWith('Failed to generate .env file:');
      expect(console.error).toHaveBeenCalledWith('Write failed');
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });
});