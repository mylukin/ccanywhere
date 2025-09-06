/**
 * Tests for NotificationManager
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

// Mock notification providers
const mockTelegramProvider = {
  send: jest.fn() as any,
  test: jest.fn() as any
};
const mockEmailProvider = {
  send: jest.fn() as any,
  test: jest.fn() as any
};
const mockDingTalkProvider = {
  send: jest.fn() as any,
  test: jest.fn() as any
};
const mockWeComProvider = {
  send: jest.fn() as any,
  test: jest.fn() as any
};

jest.unstable_mockModule('../core/notifications/telegram', () => ({
  TelegramNotifier: jest.fn(() => mockTelegramProvider) as jest.Mock
}));

jest.unstable_mockModule('../core/notifications/email', () => ({
  EmailNotifier: jest.fn(() => mockEmailProvider) as jest.Mock
}));

jest.unstable_mockModule('../core/notifications/dingtalk', () => ({
  DingTalkNotifier: jest.fn(() => mockDingTalkProvider) as jest.Mock
}));

jest.unstable_mockModule('../core/notifications/wecom', () => ({
  WeComNotifier: jest.fn(() => mockWeComProvider) as jest.Mock
}));

// Mock formatter
const mockFormatter = {
  format: jest.fn() as any
};
jest.unstable_mockModule('../core/notifications/formatter', () => ({
  MessageFormatter: mockFormatter
}));

// Import the module after mocking
const { NotificationManager } = await import('../manager');
import type { NotificationChannel } from '../../../types/index.js';

describe('NotificationManager', () => {
  let manager: any;
  let mockConfig: any;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup mock config
    mockConfig = {
      channels: ['telegram', 'email'] as NotificationChannel[],
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
    mockFormatter.format.mockReturnValue({ title: 'Formatted title', content: 'Formatted message' });
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
        new NotificationManager(undefined);
      }).toThrow('Notifications configuration is required');
    });

    it('should throw error for empty channels', () => {
      expect(() => {
        new NotificationManager({ channels: [] });
      }).toThrow('No notification channels could be initialized');
    });

    it('should initialize only configured providers', () => {
      manager = new NotificationManager({
        channels: ['telegram'] as NotificationChannel[],
        telegram: { botToken: 'test', chatId: 'test' }
      });

      expect(manager).toBeDefined();
      // Only telegram provider should be initialized
    });

    it('should throw error for unsupported channel', () => {
      expect(() => {
        new NotificationManager({
          channels: ['unsupported' as any]
        });
      }).toThrow('No notification channels could be initialized');
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

      expect(mockTelegramProvider.send).toHaveBeenCalledWith(message);
      expect(mockEmailProvider.send).toHaveBeenCalledWith(message);
    });

    it('should send message to specific channels only', async () => {
      const message = {
        title: 'Test Message',
        extra: 'Test content',
        timestamp: Date.now(),
        isError: false
      };

      await manager.send(message, ['telegram']);

      expect(mockTelegramProvider.send).toHaveBeenCalledWith(message);
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

    it('should send raw messages to providers', async () => {
      const message = {
        title: 'Test Message',
        extra: 'Test content',
        timestamp: 1672574400000,
        isError: true
      };

      await manager.send(message);

      expect(mockTelegramProvider.send).toHaveBeenCalledWith(message);
      expect(mockEmailProvider.send).toHaveBeenCalledWith(message);
    });

    it('should handle empty specific channels array', async () => {
      const message = {
        title: 'Test Message',
        extra: 'Test content',
        timestamp: Date.now(),
        isError: false
      };

      await manager.send(message, []);

      // Empty array should send to no channels
      expect(mockTelegramProvider.send).not.toHaveBeenCalled();
      expect(mockEmailProvider.send).not.toHaveBeenCalled();
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
        success: true,
        timestamp: expect.any(Number)
      });
      expect(results[1]).toEqual({
        channel: 'email',
        success: true,
        timestamp: expect.any(Number)
      });

      expect(mockTelegramProvider.send).toHaveBeenCalledWith(expect.objectContaining({
        title: expect.stringContaining('CCanywhere Configuration Test')
      }));
      expect(mockEmailProvider.send).toHaveBeenCalledWith(expect.objectContaining({
        title: expect.stringContaining('CCanywhere Configuration Test')
      }));
    });

    it('should handle test failures', async () => {
      mockTelegramProvider.send.mockRejectedValue(new Error('Invalid token'));

      const results = await manager.testAllChannels();

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({
        channel: 'telegram',
        success: false,
        error: 'Invalid token',
        timestamp: expect.any(Number)
      });
      expect(results[1]).toEqual({
        channel: 'email',
        success: true,
        timestamp: expect.any(Number)
      });
    });

    it('should handle test exceptions', async () => {
      mockEmailProvider.send.mockRejectedValue(new Error('Test exception'));

      const results = await manager.testAllChannels();

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({
        channel: 'telegram',
        success: true,
        timestamp: expect.any(Number)
      });
      expect(results[1]).toEqual({
        channel: 'email',
        success: false,
        error: 'Test exception',
        timestamp: expect.any(Number)
      });
    });

    it('should handle non-Error exceptions', async () => {
      mockTelegramProvider.send.mockRejectedValue('String error');

      const results = await manager.testAllChannels();

      expect(results[0]).toEqual({
        channel: 'telegram',
        success: false,
        error: 'String error',
        timestamp: expect.any(Number)
      });
    });
  });

  describe('channel-specific initialization', () => {
    it('should initialize telegram provider', () => {
      manager = new NotificationManager({
        channels: ['telegram'] as NotificationChannel[],
        telegram: { botToken: 'test', chatId: 'test' }
      });

      expect(manager).toBeDefined();
    });

    it('should initialize email provider', () => {
      manager = new NotificationManager({
        channels: ['email'] as NotificationChannel[],
        email: { to: 'test@example.com', from: 'sender@example.com' }
      });

      expect(manager).toBeDefined();
    });

    it('should initialize dingtalk provider', () => {
      manager = new NotificationManager({
        channels: ['dingtalk'] as NotificationChannel[],
        dingtalk: 'https://oapi.dingtalk.com/robot/send?access_token=test'
      });

      expect(manager).toBeDefined();
    });

    it('should initialize wecom provider', () => {
      manager = new NotificationManager({
        channels: ['wecom'] as NotificationChannel[],
        wecom: 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=test'
      });

      expect(manager).toBeDefined();
    });

    it('should handle missing provider configuration', () => {
      expect(() => {
        new NotificationManager({
          channels: ['telegram'] as NotificationChannel[]
          // Missing telegram config
        });
      }).toThrow('No notification channels could be initialized');
    });
  });

  describe('multiple channels configuration', () => {
    it('should initialize all supported channels', () => {
      const allChannelsConfig = {
        channels: ['telegram', 'email', 'dingtalk', 'wecom'] as NotificationChannel[],
        telegram: { botToken: 'test', chatId: 'test' },
        email: { to: 'test@example.com' },
        dingtalk: 'https://oapi.dingtalk.com/robot/send?access_token=test',
        wecom: 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=test'
      };

      manager = new NotificationManager(allChannelsConfig);
      expect(manager).toBeDefined();
    });

    it('should send to all channels', async () => {
      const allChannelsConfig = {
        channels: ['telegram', 'email', 'dingtalk', 'wecom'] as NotificationChannel[],
        telegram: { botToken: 'test', chatId: 'test' },
        email: { to: 'test@example.com' },
        dingtalk: 'https://oapi.dingtalk.com/robot/send?access_token=test',
        wecom: 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=test'
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
      mockTelegramProvider.send.mockRejectedValue(new Error('Telegram failed'));

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
      mockFormatter.format.mockImplementation(() => {
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