/**
 * Tests for NotificationManager
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

// Mock notification providers
const mockTelegramProvider = {
  send: jest.fn() as jest.Mock,
  test: jest.fn() as jest.Mock
};
const mockEmailProvider = {
  send: jest.fn() as jest.Mock,
  test: jest.fn() as jest.Mock
};
const mockDingTalkProvider = {
  send: jest.fn() as jest.Mock,
  test: jest.fn() as jest.Mock
};
const mockWeComProvider = {
  send: jest.fn() as jest.Mock,
  test: jest.fn() as jest.Mock
};

jest.unstable_mockModule('../telegram.js', () => ({
  TelegramNotificationProvider: jest.fn(() => mockTelegramProvider) as jest.Mock
}));

jest.unstable_mockModule('../email.js', () => ({
  EmailNotificationProvider: jest.fn(() => mockEmailProvider) as jest.Mock
}));

jest.unstable_mockModule('../dingtalk.js', () => ({
  DingTalkNotificationProvider: jest.fn(() => mockDingTalkProvider) as jest.Mock
}));

jest.unstable_mockModule('../wecom.js', () => ({
  WeComNotificationProvider: jest.fn(() => mockWeComProvider) as jest.Mock
}));

// Mock formatter
const mockFormatter = {
  formatMessage: jest.fn() as jest.Mock
};
jest.unstable_mockModule('../formatter.js', () => ({
  NotificationFormatter: jest.fn(() => mockFormatter) as jest.Mock
}));

// Import the module after mocking
const { NotificationManager } = await import('../manager.js');

describe('NotificationManager', () => {
  let manager: any;
  let mockConfig: any;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup mock config
    mockConfig = {
      channels: ['telegram', 'email'],
      telegram: {
        botToken: 'test-token',
        chatId: 'test-chat-id'
      },
      email: {
        to: 'test@example.com',
        from: 'sender@example.com'
      }
    };

    // Setup default mock returns
    mockFormatter.formatMessage.mockReturnValue('Formatted message');
    mockTelegramProvider.send.mockResolvedValue(undefined);
    mockEmailProvider.send.mockResolvedValue(undefined);
    mockTelegramProvider.test.mockResolvedValue({ success: true });
    mockEmailProvider.test.mockResolvedValue({ success: true });
  });

  describe('constructor', () => {
    it('should initialize with valid configuration', () => {
      manager = new NotificationManager(mockConfig);
      expect(manager).toBeDefined();
    });

    it('should throw error for invalid configuration', () => {
      expect(() => {
        new NotificationManager({});
      }).toThrow('Notification channels are required');
    });

    it('should throw error for empty channels', () => {
      expect(() => {
        new NotificationManager({ channels: [] });
      }).toThrow('At least one notification channel must be configured');
    });

    it('should initialize only configured providers', () => {
      manager = new NotificationManager({
        channels: ['telegram'],
        telegram: { botToken: 'test', chatId: 'test' }
      });

      expect(manager).toBeDefined();
      // Only telegram provider should be initialized
    });

    it('should throw error for unsupported channel', () => {
      expect(() => {
        new NotificationManager({
          channels: ['unsupported'],
          unsupported: {}
        });
      }).toThrow('Unsupported notification channel: unsupported');
    });
  });

  describe('send method', () => {
    beforeEach(() => {
      manager = new NotificationManager(mockConfig);
    });

    it('should send message to all configured channels', async () => {
      const message = {
        title: 'Test Message',
        extra: 'Test content',
        timestamp: Date.now(),
        isError: false
      };

      await manager.send(message);

      expect(mockFormatter.formatMessage).toHaveBeenCalledTimes(2); // Once for each channel
      expect(mockTelegramProvider.send).toHaveBeenCalledWith('Formatted message');
      expect(mockEmailProvider.send).toHaveBeenCalledWith('Formatted message');
    });

    it('should send message to specific channels only', async () => {
      const message = {
        title: 'Test Message',
        extra: 'Test content',
        timestamp: Date.now(),
        isError: false
      };

      await manager.send(message, ['telegram']);

      expect(mockTelegramProvider.send).toHaveBeenCalledWith('Formatted message');
      expect(mockEmailProvider.send).not.toHaveBeenCalled();
    });

    it('should handle provider send errors gracefully', async () => {
      mockTelegramProvider.send.mockRejectedValue(new Error('Telegram send failed'));

      const message = {
        title: 'Test Message',
        extra: 'Test content',
        timestamp: Date.now(),
        isError: false
      };

      // Should not throw, just log the error
      await expect(manager.send(message)).resolves.not.toThrow();
      expect(mockEmailProvider.send).toHaveBeenCalled(); // Other channels should still work
    });

    it('should skip unavailable channels silently', async () => {
      const message = {
        title: 'Test Message',
        extra: 'Test content',
        timestamp: Date.now(),
        isError: false
      };

      await manager.send(message, ['telegram', 'dingtalk']);

      expect(mockTelegramProvider.send).toHaveBeenCalled();
      // dingtalk not configured, should be skipped without error
    });

    it('should format messages correctly for each channel', async () => {
      const message = {
        title: 'Test Message',
        extra: 'Test content',
        timestamp: 1672574400000,
        isError: true
      };

      await manager.send(message);

      expect(mockFormatter.formatMessage).toHaveBeenCalledWith(message, 'telegram');
      expect(mockFormatter.formatMessage).toHaveBeenCalledWith(message, 'email');
    });

    it('should handle empty specific channels array', async () => {
      const message = {
        title: 'Test Message',
        extra: 'Test content',
        timestamp: Date.now(),
        isError: false
      };

      await manager.send(message, []);

      // Should send to all configured channels when empty array provided
      expect(mockTelegramProvider.send).toHaveBeenCalled();
      expect(mockEmailProvider.send).toHaveBeenCalled();
    });
  });

  describe('testAllChannels method', () => {
    beforeEach(() => {
      manager = new NotificationManager(mockConfig);
    });

    it('should test all configured channels', async () => {
      const results = await manager.testAllChannels();

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({
        channel: 'telegram',
        success: true
      });
      expect(results[1]).toEqual({
        channel: 'email',
        success: true
      });

      expect(mockTelegramProvider.test).toHaveBeenCalled();
      expect(mockEmailProvider.test).toHaveBeenCalled();
    });

    it('should handle test failures', async () => {
      mockTelegramProvider.test.mockResolvedValue({
        success: false,
        error: 'Invalid token'
      });

      const results = await manager.testAllChannels();

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({
        channel: 'telegram',
        success: false,
        error: 'Invalid token'
      });
      expect(results[1]).toEqual({
        channel: 'email',
        success: true
      });
    });

    it('should handle test exceptions', async () => {
      mockEmailProvider.test.mockRejectedValue(new Error('Test exception'));

      const results = await manager.testAllChannels();

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({
        channel: 'telegram',
        success: true
      });
      expect(results[1]).toEqual({
        channel: 'email',
        success: false,
        error: 'Test exception'
      });
    });

    it('should handle non-Error exceptions', async () => {
      mockTelegramProvider.test.mkRejectedValue('String error');

      const results = await manager.testAllChannels();

      expect(results[0]).toEqual({
        channel: 'telegram',
        success: false,
        error: 'String error'
      });
    });
  });

  describe('channel-specific initialization', () => {
    it('should initialize telegram provider', () => {
      manager = new NotificationManager({
        channels: ['telegram'],
        telegram: { botToken: 'test', chatId: 'test' }
      });

      expect(manager).toBeDefined();
    });

    it('should initialize email provider', () => {
      manager = new NotificationManager({
        channels: ['email'],
        email: { to: 'test@example.com', from: 'sender@example.com' }
      });

      expect(manager).toBeDefined();
    });

    it('should initialize dingtalk provider', () => {
      manager = new NotificationManager({
        channels: ['dingtalk'],
        dingtalk: { webhook: 'https://test.com/webhook' }
      });

      expect(manager).toBeDefined();
    });

    it('should initialize wecom provider', () => {
      manager = new NotificationManager({
        channels: ['wecom'],
        wecom: { webhook: 'https://test.com/webhook' }
      });

      expect(manager).toBeDefined();
    });

    it('should handle missing provider configuration', () => {
      expect(() => {
        new NotificationManager({
          channels: ['telegram']
          // Missing telegram config
        });
      }).toThrow('Configuration for telegram notification provider is missing');
    });
  });

  describe('multiple channels configuration', () => {
    it('should initialize all supported channels', () => {
      const allChannelsConfig = {
        channels: ['telegram', 'email', 'dingtalk', 'wecom'],
        telegram: { botToken: 'test', chatId: 'test' },
        email: { to: 'test@example.com' },
        dingtalk: { webhook: 'https://test.com/webhook' },
        wecom: { webhook: 'https://test.com/webhook' }
      };

      manager = new NotificationManager(allChannelsConfig);
      expect(manager).toBeDefined();
    });

    it('should send to all channels', async () => {
      const allChannelsConfig = {
        channels: ['telegram', 'email', 'dingtalk', 'wecom'],
        telegram: { botToken: 'test', chatId: 'test' },
        email: { to: 'test@example.com' },
        dingtalk: { webhook: 'https://test.com/webhook' },
        wecom: { webhook: 'https://test.com/webhook' }
      };

      manager = new NotificationManager(allChannelsConfig);

      const message = {
        title: 'Test Message',
        extra: 'Test content',
        timestamp: Date.now(),
        isError: false
      };

      await manager.send(message);

      expect(mockTelegramProvider.send).toHaveBeenCalled();
      expect(mockEmailProvider.send).toHaveBeenCalled();
      expect(mockDingTalkProvider.send).toHaveBeenCalled();
      expect(mockWeComProvider.send).toHaveBeenCalled();
    });
  });

  describe('error handling and resilience', () => {
    beforeEach(() => {
      manager = new NotificationManager(mockConfig);
    });

    it('should continue sending to other channels if one fails', async () => {
      mockTelegramProvider.send.mkRejectedValue(new Error('Telegram failed'));

      const message = {
        title: 'Test Message',
        extra: 'Test content',
        timestamp: Date.now(),
        isError: false
      };

      await manager.send(message);

      expect(mockEmailProvider.send).toHaveBeenCalled();
    });

    it('should handle formatter errors gracefully', async () => {
      mockFormatter.formatMessage.mkImplementation(() => {
        throw new Error('Formatting failed');
      });

      const message = {
        title: 'Test Message',
        extra: 'Test content',
        timestamp: Date.now(),
        isError: false
      };

      // Should not throw, just skip the failed formatting
      await expect(manager.send(message)).resolves.not.toThrow();
    });

    it('should handle concurrent send operations', async () => {
      const message = {
        title: 'Test Message',
        extra: 'Test content',
        timestamp: Date.now(),
        isError: false
      };

      // Send multiple messages concurrently
      const promises = [
        manager.send(message),
        manager.send(message),
        manager.send(message)
      ];

      await expect(Promise.all(promises)).resolves.not.toThrow();
      expect(mockTelegramProvider.send).toHaveBeenCalledTimes(3);
      expect(mockEmailProvider.send).toHaveBeenCalledTimes(3);
    });
  });
});