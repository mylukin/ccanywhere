/**
 * Tests for notify command
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

// Mock chalk
const mockChalk = {
  blue: jest.fn((text: string) => text) as jest.Mock,
  green: jest.fn((text: string) => text) as jest.Mock,
  red: jest.fn((text: string) => text) as jest.Mock,
  gray: jest.fn((text: string) => text) as jest.Mock
};
jest.unstable_mockModule('chalk', () => ({
  default: mockChalk
}));

// Mock ConfigLoader
const mockConfigLoader = {
  loadConfig: jest.fn() as jest.Mock
};
const mockGetInstance = jest.fn(() => mockConfigLoader) as jest.Mock;

jest.unstable_mockModule('../../config/index.js', () => ({
  ConfigLoader: {
    getInstance: mockGetInstance
  }
}));

// Mock NotificationManager
const mockNotificationManager = {
  send: jest.fn() as jest.Mock
};
const mockNotificationManagerConstructor = jest.fn(() => mockNotificationManager) as jest.Mock;

jest.unstable_mockModule('../../core/notifications/manager.js', () => ({
  NotificationManager: mockNotificationManagerConstructor
}));

// Import the module after mocking
const { notifyCommand } = await import('../notify.js');

describe('notifyCommand', () => {
  let originalConsole: any;
  let originalExit: any;
  let originalDate: any;

  beforeEach(() => {
    // Mock console methods
    originalConsole = { ...console };
    console.log = jest.fn() as jest.Mock;
    console.error = jest.fn() as jest.Mock;

    // Mock process.exit
    originalExit = process.exit;
    process.exit = jest.fn() as any;

    // Mock Date
    originalDate = Date;
    global.Date = jest.fn(() => ({
      toISOString: jest.fn(() => '2023-01-01T12:00:00.000Z')
    })) as any;
    global.Date.now = jest.fn(() => 1672574400000);

    // Reset all mocks
    jest.clearAllMocks();

    // Setup default mock returns
    mockConfigLoader.loadConfig.mockResolvedValue({
      notifications: {
        channels: ['telegram', 'email'],
        telegram: { botToken: 'test-token', chatId: 'test-chat' },
        email: { to: 'test@example.com' }
      }
    });
  });

  afterEach(() => {
    // Restore console, process, and Date
    console.log = originalConsole.log;
    console.error = originalConsole.error;
    process.exit = originalExit;
    global.Date = originalDate;
  });

  describe('successful notifications', () => {
    it('should send test notification with default message', async () => {
      await notifyCommand({});

      expect(mockConfigLoader.loadConfig).toHaveBeenCalledWith(undefined);
      expect(mockNotificationManagerConstructor).toHaveBeenCalledWith({
        channels: ['telegram', 'email'],
        telegram: { botToken: 'test-token', chatId: 'test-chat' },
        email: { to: 'test@example.com' }
      });

      expect(mockNotificationManager.send).toHaveBeenCalledWith(
        {
          title: '🔔 Test from CCanywhere',
          extra: 'Test notification sent at 2023-01-01T12:00:00.000Z',
          timestamp: 1672574400000,
          isError: false
        },
        undefined
      );

      expect(console.log).toHaveBeenCalledWith('📬 Sending test notification...');
      expect(console.log).toHaveBeenCalledWith('Channels: telegram, email');
      expect(console.log).toHaveBeenCalledWith('✅ Notification sent successfully!');
    });

    it('should send notification with custom title and message', async () => {
      await notifyCommand({
        title: 'Custom Test Title',
        message: 'Custom test message content'
      });

      expect(mockNotificationManager.send).toHaveBeenCalledWith(
        {
          title: 'Custom Test Title',
          extra: 'Custom test message content',
          timestamp: 1672574400000,
          isError: false
        },
        undefined
      );
    });

    it('should send notification to specific channels', async () => {
      await notifyCommand({
        channels: 'telegram,dingtalk'
      });

      expect(mockNotificationManager.send).toHaveBeenCalledWith(
        expect.any(Object),
        ['telegram', 'dingtalk']
      );

      expect(console.log).toHaveBeenCalledWith('Channels: telegram, dingtalk');
    });

    it('should handle channels with spaces', async () => {
      await notifyCommand({
        channels: 'telegram, email , dingtalk'
      });

      expect(mockNotificationManager.send).toHaveBeenCalledWith(
        expect.any(Object),
        ['telegram', 'email', 'dingtalk']
      );

      expect(console.log).toHaveBeenCalledWith('Channels: telegram, email, dingtalk');
    });

    it('should use custom config file', async () => {
      const customConfig = {
        notifications: {
          channels: ['dingtalk'],
          dingtalk: { webhook: 'test-webhook' }
        }
      };

      mockConfigLoader.loadConfig.mockResolvedValue(customConfig);

      await notifyCommand({ config: 'custom.config.json' });

      expect(mockConfigLoader.loadConfig).toHaveBeenCalledWith('custom.config.json');
      expect(mockNotificationManagerConstructor).toHaveBeenCalledWith(customConfig.notifications);
    });
  });

  describe('configuration validation', () => {
    it('should handle missing notifications configuration', async () => {
      mockConfigLoader.loadConfig.mockResolvedValue({
        repo: { kind: 'github', url: 'test' }
        // No notifications config
      });

      await notifyCommand({});

      expect(console.error).toHaveBeenCalledWith('Failed to send notification:');
      expect(console.error).toHaveBeenCalledWith('Notifications configuration is not defined');
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should handle empty notifications channels', async () => {
      mockConfigLoader.loadConfig.mockResolvedValue({
        notifications: {
          channels: []
        }
      });

      await notifyCommand({});

      expect(mockNotificationManagerConstructor).toHaveBeenCalledWith({
        channels: []
      });
      expect(console.log).toHaveBeenCalledWith('Channels: none');
    });

    it('should handle undefined notifications channels', async () => {
      mockConfigLoader.loadConfig.mockResolvedValue({
        notifications: {
          // No channels property
        }
      });

      await notifyCommand({});

      expect(console.log).toHaveBeenCalledWith('Channels: none');
    });
  });

  describe('error handling', () => {
    it('should handle configuration load errors', async () => {
      mockConfigLoader.loadConfig.mockRejectedValue(new Error('Config file not found'));

      await notifyCommand({});

      expect(console.error).toHaveBeenCalledWith('Failed to send notification:');
      expect(console.error).toHaveBeenCalledWith('Config file not found');
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should handle notification manager creation errors', async () => {
      mockNotificationManagerConstructor.mockImplementation(() => {
        throw new Error('Invalid notification config');
      });

      await notifyCommand({});

      expect(console.error).toHaveBeenCalledWith('Failed to send notification:');
      expect(console.error).toHaveBeenCalledWith('Invalid notification config');
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should handle notification send errors', async () => {
      mockNotificationManager.send.mockRejectedValue(new Error('Failed to send to Telegram'));

      await notifyCommand({});

      expect(console.error).toHaveBeenCalledWith('Failed to send notification:');
      expect(console.error).toHaveBeenCalledWith('Failed to send to Telegram');
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should handle non-Error objects', async () => {
      mockNotificationManager.send.mockRejectedValue('String error');

      await notifyCommand({});

      expect(console.error).toHaveBeenCalledWith('Failed to send notification:');
      expect(console.error).toHaveBeenCalledWith('String error');
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });

  describe('message format', () => {
    it('should create proper message structure', async () => {
      await notifyCommand({
        title: 'Test Title',
        message: 'Test Message'
      });

      expect(mockNotificationManager.send).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Test Title',
          extra: 'Test Message',
          timestamp: expect.any(Number),
          isError: false
        }),
        undefined
      );
    });

    it('should set timestamp correctly', async () => {
      const mockTimestamp = 1234567890000;
      global.Date.now = jest.fn(() => mockTimestamp);

      await notifyCommand({});

      expect(mockNotificationManager.send).toHaveBeenCalledWith(
        expect.objectContaining({
          timestamp: mockTimestamp
        }),
        undefined
      );
    });

    it('should set isError to false for test notifications', async () => {
      await notifyCommand({});

      expect(mockNotificationManager.send).toHaveBeenCalledWith(
        expect.objectContaining({
          isError: false
        }),
        undefined
      );
    });
  });

  describe('channel parsing', () => {
    it('should parse single channel', async () => {
      await notifyCommand({
        channels: 'telegram'
      });

      expect(mockNotificationManager.send).toHaveBeenCalledWith(
        expect.any(Object),
        ['telegram']
      );
    });

    it('should parse multiple channels', async () => {
      await notifyCommand({
        channels: 'telegram,email,dingtalk'
      });

      expect(mockNotificationManager.send).toHaveBeenCalledWith(
        expect.any(Object),
        ['telegram', 'email', 'dingtalk']
      );
    });

    it('should handle empty channel string', async () => {
      await notifyCommand({
        channels: ''
      });

      expect(mockNotificationManager.send).toHaveBeenCalledWith(
        expect.any(Object),
        ['']
      );
    });

    it('should trim whitespace from channels', async () => {
      await notifyCommand({
        channels: '  telegram  ,  email  ,  dingtalk  '
      });

      expect(mockNotificationManager.send).toHaveBeenCalledWith(
        expect.any(Object),
        ['telegram', 'email', 'dingtalk']
      );
    });
  });
});