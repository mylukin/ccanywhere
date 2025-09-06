/**
 * Tests for claude-register command
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

// Mock chalk
const mockChalk = {
  blue: jest.fn((text: string) => text) as jest.Mock,
  green: jest.fn((text: string) => text) as jest.Mock,
  yellow: jest.fn((text: string) => text) as jest.Mock,
  red: jest.fn((text: string) => text) as jest.Mock,
  gray: jest.fn((text: string) => text) as jest.Mock,
  cyan: jest.fn((text: string) => text) as jest.Mock
};
jest.unstable_mockModule('chalk', () => ({
  default: mockChalk
}));

// Mock Logger
const mockLogger = {
  info: jest.fn() as any,
  warn: jest.fn() as any,
  error: jest.fn() as any,
  debug: jest.fn() as any
};
const mockLoggerGetInstance = jest.fn(() => mockLogger) as jest.Mock;

jest.unstable_mockModule('@/utils/logger', () => ({
  Logger: {
    getInstance: mockLoggerGetInstance
  }
}));

// Mock ClaudeCodeDetector
const mockClaudeCodeDetector = {
  detectEnvironment: jest.fn() as any,
  getClaudeCodePaths: jest.fn() as any,
  isClaudeCodeAvailable: jest.fn() as any,
  ensureConfigDirectory: jest.fn() as any
};

jest.unstable_mockModule('@/utils/claude-detector', () => ({
  ClaudeCodeDetector: mockClaudeCodeDetector
}));

// Mock HookInjector
const mockHookInjector = {
  injectHooks: jest.fn() as any,
  removeHooks: jest.fn() as any,
  restoreFromBackup: jest.fn() as any,
  listBackups: jest.fn() as any,
  areHooksInjected: jest.fn() as any
};

jest.unstable_mockModule('@/utils/hook-injector', () => ({
  HookInjector: mockHookInjector
}));

// Import the module after mocking
const { claudeRegisterCommand } = await import('../claude-register.js');

describe('claudeRegisterCommand', () => {
  let originalConsole: any;
  let originalExit: any;

  beforeEach(() => {
    // Mock console methods
    originalConsole = { ...console };
    console.log = jest.fn();
    console.error = jest.fn();

    // Mock process.exit
    originalExit = process.exit;
    process.exit = jest.fn() as any;

    // Reset all mocks
    jest.clearAllMocks();

    // Setup default mock returns
    mockClaudeCodeDetector.detectEnvironment.mockResolvedValue({
      isClaudeCode: true,
      configDir: '/mock/config',
      hooksConfigPath: '/mock/config/hooks.js',
      version: '1.0.0',
      installationType: 'user'
    });
    
    mockClaudeCodeDetector.getClaudeCodePaths.mockResolvedValue({
      configDir: '/mock/config',
      hooksConfig: '/mock/config/hooks.js',
      backup: '/mock/config/hooks.backup'
    });

    mockHookInjector.areHooksInjected.mockResolvedValue(false);
    mockHookInjector.listBackups.mockResolvedValue([]);
  });

  afterEach(() => {
    // Restore console and process
    console.log = originalConsole.log;
    console.error = originalConsole.error;
    process.exit = originalExit;
  });

  describe('status option', () => {
    it('should show hook status', async () => {
      mockHookInjector.areHooksInjected.mockResolvedValue(true);
      mockHookInjector.listBackups.mockResolvedValue(['/backup1.backup', '/backup2.backup']);

      await claudeRegisterCommand({ status: true });

      expect(mockClaudeCodeDetector.detectEnvironment).toHaveBeenCalled();
      expect(mockHookInjector.areHooksInjected).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('CCanywhere Claude Code Hook Status'));
    });

    it('should handle status check errors', async () => {
      mockClaudeCodeDetector.detectEnvironment.mockRejectedValue(new Error('Status check failed'));

      await claudeRegisterCommand({ status: true });

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Error checking status'));
    });
  });

  describe('remove option', () => {
    it('should remove hooks', async () => {
      mockHookInjector.removeHooks.mockResolvedValue({ 
        success: true, 
        message: 'Removed 2 hooks',
        hooksAdded: ['Stop'], 
        hooksSkipped: [] 
      });

      await claudeRegisterCommand({ remove: true });

      expect(mockHookInjector.removeHooks).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Successfully removed'));
    });

    it('should handle remove with warning message', async () => {
      mockHookInjector.removeHooks.mockResolvedValue({ 
        success: false, 
        message: 'No hooks found',
        hooksAdded: [], 
        hooksSkipped: [] 
      });

      await claudeRegisterCommand({ remove: true });

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('No hooks found'));
    });

    it('should handle remove errors', async () => {
      mockHookInjector.removeHooks.mockRejectedValue(new Error('Remove failed'));

      await claudeRegisterCommand({ remove: true });

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Failed to remove hooks'));
    });
  });

  describe('Claude Code detection', () => {
    it('should detect Claude Code environment', async () => {
      mockHookInjector.injectHooks.mockResolvedValue({
        success: true,
        message: 'Success',
        hooksAdded: ['Stop'],
        hooksSkipped: []
      });

      await claudeRegisterCommand({});

      expect(mockClaudeCodeDetector.detectEnvironment).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Claude Code detected'));
    });

    it('should handle non-Claude Code environment', async () => {
      mockClaudeCodeDetector.detectEnvironment.mockResolvedValue({
        isClaudeCode: false
      });

      await claudeRegisterCommand({});

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Claude Code environment not detected'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Please ensure Claude Code is installed'));
    });

    it('should show environment details when detected', async () => {
      mockClaudeCodeDetector.detectEnvironment.mockResolvedValue({
        isClaudeCode: true,
        configDir: '/mock/config',
        hooksConfigPath: '/mock/config/hooks.js',
        version: '2.0.0',
        installationType: 'user'
      });
      mockHookInjector.injectHooks.mockResolvedValue({
        success: true,
        message: 'Success',
        hooksAdded: ['Stop'],
        hooksSkipped: []
      });

      await claudeRegisterCommand({});

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Version: 2.0.0'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Config: /mock/config'));
    });
  });

  describe('hook installation', () => {
    it('should install Stop hook', async () => {
      mockHookInjector.injectHooks.mockResolvedValue({ 
        success: true,
        message: 'Success',
        hooksAdded: ['Stop'], 
        hooksSkipped: [],
        backupPath: '/backup/path'
      });

      await claudeRegisterCommand({});

      expect(mockHookInjector.injectHooks).toHaveBeenCalledWith(
        expect.objectContaining({
          enableStop: true,
          createBackup: true,
          force: undefined
        })
      );
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Successfully registered'));
    });

    it('should handle installation with force flag', async () => {
      mockHookInjector.injectHooks.mockResolvedValue({ 
        success: true,
        message: 'Success',
        hooksAdded: ['Stop'], 
        hooksSkipped: []
      });

      await claudeRegisterCommand({ 
        force: true
      });

      expect(mockHookInjector.injectHooks).toHaveBeenCalledWith(
        expect.objectContaining({
          force: true
        })
      );
    });

    it('should handle installation failures', async () => {
      mockHookInjector.injectHooks.mockResolvedValue({ 
        success: false,
        message: 'Failed to inject hooks',
        hooksAdded: [], 
        hooksSkipped: []
      });

      await claudeRegisterCommand({});

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Failed to register hooks'));
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should handle injection exceptions', async () => {
      mockHookInjector.injectHooks.mockRejectedValue(new Error('Injection failed'));

      await claudeRegisterCommand({});

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Registration failed'));
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });

  describe('backup functionality', () => {
    it('should create backup when hooks are injected', async () => {
      mockHookInjector.injectHooks.mockResolvedValue({ 
        success: true,
        message: 'Success',
        hooksAdded: ['Stop'], 
        hooksSkipped: [],
        backupPath: '/backup/path/hooks.backup'
      });

      await claudeRegisterCommand({});

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Backup created'));
    });

    it('should handle hooks already registered', async () => {
      mockHookInjector.areHooksInjected.mockResolvedValue(true);

      await claudeRegisterCommand({});

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('hooks are already registered'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Use --force to overwrite'));
    });
  });

  describe('error handling', () => {
    it('should handle non-Error objects', async () => {
      mockHookInjector.injectHooks.mockRejectedValue('String error');

      await claudeRegisterCommand({});

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Registration failed'));
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });
});