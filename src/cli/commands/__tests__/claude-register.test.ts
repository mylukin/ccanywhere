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

// Mock inquirer
const mockPrompt = jest.fn() as jest.Mock;
jest.unstable_mockModule('inquirer', () => ({
  default: {
    prompt: mockPrompt
  }
}));

// Mock Logger
const mockLogger = {
  info: jest.fn() as jest.Mock,
  warn: jest.fn() as jest.Mock,
  error: jest.fn() as jest.Mock,
  debug: jest.fn() as jest.Mock
};
const mockLoggerGetInstance = jest.fn(() => mockLogger) as jest.Mock;

jest.unstable_mockModule('../../utils/logger.js', () => ({
  Logger: {
    getInstance: mockLoggerGetInstance
  }
}));

// Mock ClaudeCodeDetector
const mockDetector = {
  isClaudeCodeSession: jest.fn() as jest.Mock,
  getSessionInfo: jest.fn() as jest.Mock,
  validateHookCompatibility: jest.fn() as jest.Mock
};
const mockClaudeCodeDetector = jest.fn(() => mockDetector) as jest.Mock;

jest.unstable_mockModule('../../utils/claude-detector.js', () => ({
  ClaudeCodeDetector: mockClaudeCodeDetector
}));

// Mock HookInjector
const mockHookInjector = {
  inject: jest.fn(),
  remove: jest.fn(),
  status: jest.fn(),
  backup: jest.fn(),
  restore: jest.fn()
};
const mockHookInjectorConstructor = jest.fn(() => mockHookInjector);

jest.unstable_mockModule('../../utils/hook-injector.js', () => ({
  HookInjector: mockHookInjectorConstructor
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
    mockDetector.isClaudeCodeSession.mockReturnValue(true);
    mockDetector.getSessionInfo.mockReturnValue({
      sessionId: 'test-session-123',
      version: '1.0.0',
      capabilities: ['hooks', 'notifications']
    });
    mockDetector.validateHookCompatibility.mockReturnValue(true);

    mockHookInjector.status.mockResolvedValue({
      preCommit: { installed: false, path: null },
      postRun: { installed: false, path: null },
      preTest: { installed: false, path: null },
      postTest: { installed: false, path: null }
    });
  });

  afterEach(() => {
    // Restore console and process
    console.log = originalConsole.log;
    console.error = originalConsole.error;
    process.exit = originalExit;
  });

  describe('status option', () => {
    it('should show hook status', async () => {
      mockHookInjector.status.mockResolvedValue({
        preCommit: { installed: true, path: '/hooks/pre-commit' },
        postRun: { installed: false, path: null },
        preTest: { installed: true, path: '/hooks/pre-test' },
        postTest: { installed: false, path: null }
      });

      await claudeRegisterCommand({ status: true });

      expect(mockHookInjector.status).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Hook Status'));
    });

    it('should handle status check errors', async () => {
      mockHookInjector.status.mockRejectedValue(new Error('Status check failed'));

      await claudeRegisterCommand({ status: true });

      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Failed to check hook status'));
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });

  describe('restore option', () => {
    it('should restore from backup', async () => {
      mockHookInjector.restore.mockResolvedValue({ restored: 2, errors: [] });

      await claudeRegisterCommand({ restore: '/backup/path' });

      expect(mockHookInjector.restore).toHaveBeenCalledWith('/backup/path');
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('restored'));
    });

    it('should handle restore errors', async () => {
      mockHookInjector.restore.mockRejectedValue(new Error('Restore failed'));

      await claudeRegisterCommand({ restore: '/backup/path' });

      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Failed to restore from backup'));
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });

  describe('remove option', () => {
    it('should remove hooks', async () => {
      mockPrompt.mockResolvedValue({ confirm: true });
      mockHookInjector.remove.mockResolvedValue({ removed: 2, errors: [] });

      await claudeRegisterCommand({ remove: true });

      expect(mockPrompt).toHaveBeenCalledWith([
        expect.objectContaining({
          type: 'confirm',
          name: 'confirm',
          message: expect.stringContaining('remove all CCanywhere hooks')
        })
      ]);
      expect(mockHookInjector.remove).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('removed'));
    });

    it('should cancel removal when user declines', async () => {
      mockPrompt.mockResolvedValue({ confirm: false });

      await claudeRegisterCommand({ remove: true });

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('cancelled'));
      expect(mockHookInjector.remove).not.toHaveBeenCalled();
    });

    it('should handle remove errors', async () => {
      mockPrompt.mockResolvedValue({ confirm: true });
      mockHookInjector.remove.mockRejectedValue(new Error('Remove failed'));

      await claudeRegisterCommand({ remove: true });

      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Failed to remove hooks'));
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });

  describe('Claude Code detection', () => {
    it('should detect Claude Code session', async () => {
      mockPrompt.mockResolvedValue({ hooks: ['preCommit'] });

      await claudeRegisterCommand({ interactive: true });

      expect(mockDetector.isClaudeCodeSession).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Claude Code session detected'));
    });

    it('should handle non-Claude Code environment', async () => {
      mockDetector.isClaudeCodeSession.mockReturnValue(false);

      await claudeRegisterCommand({ interactive: true });

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Not running in Claude Code'));
      // Should still allow manual installation
    });

    it('should validate hook compatibility', async () => {
      mockDetector.validateHookCompatibility.mockReturnValue(false);

      await claudeRegisterCommand({ preCommit: true });

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('compatibility issues detected'));
    });
  });

  describe('hook installation', () => {
    it('should install specific hooks', async () => {
      mockHookInjector.inject.mockResolvedValue({ installed: 1, skipped: 0, errors: [] });

      await claudeRegisterCommand({ 
        preCommit: true,
        backup: true
      });

      expect(mockHookInjector.inject).toHaveBeenCalledWith(
        expect.objectContaining({
          hooks: ['preCommit'],
          backup: true,
          force: false
        })
      );
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('successfully installed'));
    });

    it('should install multiple hooks', async () => {
      mockHookInjector.inject.mockResolvedValue({ installed: 3, skipped: 0, errors: [] });

      await claudeRegisterCommand({ 
        preCommit: true,
        postRun: true,
        preTest: true
      });

      expect(mockHookInjector.inject).toHaveBeenCalledWith(
        expect.objectContaining({
          hooks: ['preCommit', 'postRun', 'preTest']
        })
      );
    });

    it('should handle installation with force flag', async () => {
      mockHookInjector.inject.mockResolvedValue({ installed: 1, skipped: 0, errors: [] });

      await claudeRegisterCommand({ 
        preCommit: true,
        force: true
      });

      expect(mockHookInjector.inject).toHaveBeenCalledWith(
        expect.objectContaining({
          force: true
        })
      );
    });

    it('should handle installation errors', async () => {
      mockHookInjector.inject.mockResolvedValue({ 
        installed: 0, 
        skipped: 0, 
        errors: ['Failed to install pre-commit hook'] 
      });

      await claudeRegisterCommand({ preCommit: true });

      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Installation errors'));
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should handle injection exceptions', async () => {
      mockHookInjector.inject.mockRejectedValue(new Error('Injection failed'));

      await claudeRegisterCommand({ preCommit: true });

      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Failed to install hooks'));
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });

  describe('interactive mode', () => {
    it('should prompt for hook selection', async () => {
      mockPrompt.mockResolvedValue({ 
        hooks: ['preCommit', 'postRun'],
        backup: true,
        force: false
      });
      mockHookInjector.inject.mockResolvedValue({ installed: 2, skipped: 0, errors: [] });

      await claudeRegisterCommand({ interactive: true });

      expect(mockPrompt).toHaveBeenCalledWith([
        expect.objectContaining({
          type: 'checkbox',
          name: 'hooks',
          message: expect.stringContaining('Select hooks to install')
        }),
        expect.objectContaining({
          type: 'confirm',
          name: 'backup',
          message: expect.stringContaining('Create backup')
        }),
        expect.objectContaining({
          type: 'confirm',
          name: 'force',
          message: expect.stringContaining('Force overwrite')
        })
      ]);
    });

    it('should handle empty hook selection', async () => {
      mockPrompt.mockResolvedValue({ hooks: [] });

      await claudeRegisterCommand({ interactive: true });

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('No hooks selected'));
      expect(mockHookInjector.inject).not.toHaveBeenCalled();
    });

    it('should handle prompt errors', async () => {
      mockPrompt.mkRejectedValue(new Error('Prompt failed'));

      await claudeRegisterCommand({ interactive: true });

      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Interactive selection failed'));
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });

  describe('backup functionality', () => {
    it('should create backup when requested', async () => {
      mockHookInjector.backup.mockResolvedValue('/backup/path/hooks.backup');
      mockHookInjector.inject.mockResolvedValue({ installed: 1, skipped: 0, errors: [] });

      await claudeRegisterCommand({ 
        preCommit: true,
        backup: true
      });

      expect(mockHookInjector.backup).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Backup created'));
    });

    it('should handle backup errors', async () => {
      mockHookInjector.backup.mockRejectedValue(new Error('Backup failed'));

      await claudeRegisterCommand({ 
        preCommit: true,
        backup: true
      });

      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Failed to create backup'));
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });

  describe('session info display', () => {
    it('should display Claude Code session info when available', async () => {
      mockDetector.getSessionInfo.mockReturnValue({
        sessionId: 'session-123',
        version: '2.0.0',
        capabilities: ['hooks', 'notifications', 'deployment'],
        workspaceRoot: '/workspace/root'
      });

      await claudeRegisterCommand({ preCommit: true });

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Session ID: session-123'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Version: 2.0.0'));
    });

    it('should handle missing session info', async () => {
      mockDetector.getSessionInfo.mockReturnValue(null);

      await claudeRegisterCommand({ preCommit: true });

      expect(console.log).not.toHaveBeenCalledWith(expect.stringContaining('Session ID'));
    });
  });

  describe('error handling', () => {
    it('should handle detector initialization errors', async () => {
      mockClaudeCodeDetector.mockImplementation(() => {
        throw new Error('Detector initialization failed');
      });

      await claudeRegisterCommand({ preCommit: true });

      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Failed to initialize'));
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should handle hook injector initialization errors', async () => {
      mockHookInjectorConstructor.mockImplementation(() => {
        throw new Error('HookInjector initialization failed');
      });

      await claudeRegisterCommand({ preCommit: true });

      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Failed to initialize'));
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should handle non-Error objects', async () => {
      mockHookInjector.inject.mkRejectedValue('String error');

      await claudeRegisterCommand({ preCommit: true });

      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Failed to install hooks'));
      expect(console.error).toHaveBeenCalledWith('String error');
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });

  describe('no options provided', () => {
    it('should default to interactive mode when no options provided', async () => {
      mockPrompt.mockResolvedValue({ hooks: ['preCommit'] });
      mockHookInjector.inject.mockResolvedValue({ installed: 1, skipped: 0, errors: [] });

      await claudeRegisterCommand({});

      expect(mockPrompt).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Interactive hook installation'));
    });
  });
});