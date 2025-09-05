/**
 * Tests for TelegramNotifier
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import type { NotificationMessage } from '../types.js';

// Mock axios
const mockAxios = {
  post: jest.fn(),
  get: jest.fn()
};

jest.unstable_mockModule('axios', () => ({
  default: mockAxios
}));

// Mock BuildError
jest.unstable_mockModule('../../../types/index.js', () => ({
  BuildError: class BuildError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'BuildError';
    }
  }
}));

// Import the module after mocking
const { TelegramNotifier } = await import('../telegram.js');

describe('TelegramNotifier', () => {
  let notifier: TelegramNotifier;
  let mockConfig: any;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup mock config
    mockConfig = {
      botToken: '123456789:ABCdefGHIjklMNOpqrsTUVwxyz',
      chatId: '-1001234567890'
    };

    // Setup default mock returns
    mockAxios.post.mockResolvedValue({ data: { ok: true, result: { message_id: 123 } } });
    mockAxios.get.mockResolvedValue({ data: { ok: true, result: { id: 123, first_name: 'Test Bot' } } });
  });

  describe('constructor', () => {
    it('should initialize with valid configuration', () => {
      notifier = new TelegramNotifier(mockConfig);
      
      expect(notifier).toBeDefined();
      expect(notifier.channel).toBe('telegram');
    });
  });

  describe('send method', () => {
    beforeEach(() => {
      notifier = new TelegramNotifier(mockConfig);
    });

    it('should send message successfully', async () => {
      const message: NotificationMessage = {
        title: 'Test Notification',
        extra: 'Test content',
        timestamp: Date.now(),
        isError: false
      };

      await notifier.send(message);

      expect(mockAxios.post).toHaveBeenCalledWith(
        `https://api.telegram.org/bot${mockConfig.botToken}/sendMessage`,
        {
          chat_id: mockConfig.chatId,
          text: expect.stringContaining('Test Notification'),
          parse_mode: 'Markdown',
          disable_web_page_preview: false,
          disable_notification: false
        },
        {
          timeout: 30000,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
    });

    it('should send error message successfully', async () => {
      const message: NotificationMessage = {
        title: 'Error Notification',
        extra: 'Something went wrong',
        timestamp: Date.now(),
        isError: true
      };

      await notifier.send(message);

      expect(mockAxios.post).toHaveBeenCalledWith(
        `https://api.telegram.org/bot${mockConfig.botToken}/sendMessage`,
        expect.objectContaining({
          chat_id: mockConfig.chatId,
          text: expect.stringContaining('Error Notification'),
          parse_mode: 'Markdown'
        }),
        expect.any(Object)
      );
    });

    it('should handle API error response', async () => {
      const message: NotificationMessage = {
        title: 'Test',
        timestamp: Date.now()
      };

      mockAxios.post.mockResolvedValue({ data: { ok: false, description: 'Bot was blocked by the user' } });

      await expect(notifier.send(message)).rejects.toThrow('Telegram API error: Bot was blocked by the user');
    });

    it('should handle axios errors', async () => {
      const message: NotificationMessage = {
        title: 'Test',
        timestamp: Date.now()
      };

      const axiosError = {
        isAxiosError: true,
        response: {
          data: {
            description: 'Unauthorized'
          }
        },
        message: 'Request failed'
      };
      
      mockAxios.post.mockRejectedValue(axiosError);

      await expect(notifier.send(message)).rejects.toThrow('Failed to send Telegram notification: Unauthorized');
    });

    it('should handle network errors', async () => {
      const message: NotificationMessage = {
        title: 'Test',
        timestamp: Date.now()
      };

      mockAxios.post.mockRejectedValue(new Error('Network error'));

      await expect(notifier.send(message)).rejects.toThrow('Failed to send Telegram notification: Network error');
    });

    it('should handle generic errors', async () => {
      const message: NotificationMessage = {
        title: 'Test',
        timestamp: Date.now()
      };

      mockAxios.post.mockRejectedValue('String error');

      await expect(notifier.send(message)).rejects.toThrow('Failed to send Telegram notification: String error');
    });

  });

  describe('test method', () => {
    beforeEach(() => {
      notifier = new TelegramNotifier(mockConfig);
    });

    it('should return true for valid bot', async () => {
      mockAxios.get.mockResolvedValue({ data: { ok: true } });

      const result = await notifier.test();

      expect(result).toBe(true);
      expect(mockAxios.get).toHaveBeenCalledWith(
        `https://api.telegram.org/bot${mockConfig.botToken}/getMe`,
        { timeout: 10000 }
      );
    });

    it('should return false for invalid bot', async () => {
      mockAxios.get.mockRejectedValue(new Error('Unauthorized'));

      const result = await notifier.test();

      expect(result).toBe(false);
    });
  });

  });

  describe('getBotInfo method', () => {
    beforeEach(() => {
      notifier = new TelegramNotifier(mockConfig);
    });

    it('should get bot info successfully', async () => {
      const botInfo = { id: 123, first_name: 'Test Bot' };
      mockAxios.get.mockResolvedValue({ data: { result: botInfo } });

      const result = await notifier.getBotInfo();

      expect(result).toEqual(botInfo);
      expect(mockAxios.get).toHaveBeenCalledWith(
        `https://api.telegram.org/bot${mockConfig.botToken}/getMe`,
        { timeout: 10000 }
      );
    });

    it('should handle errors', async () => {
      mockAxios.get.mockRejectedValue(new Error('Network error'));

      await expect(notifier.getBotInfo()).rejects.toThrow('Failed to get bot info: Network error');
    });

  });

  describe('getChatInfo method', () => {
    beforeEach(() => {
      notifier = new TelegramNotifier(mockConfig);
    });

    it('should get chat info successfully', async () => {
      const chatInfo = { id: -1001234567890, title: 'Test Chat' };
      mockAxios.get.mockResolvedValue({ data: { result: chatInfo } });

      const result = await notifier.getChatInfo();

      expect(result).toEqual(chatInfo);
      expect(mockAxios.get).toHaveBeenCalledWith(
        `https://api.telegram.org/bot${mockConfig.botToken}/getChat`,
        {
          params: { chat_id: mockConfig.chatId },
          timeout: 10000
        }
      );
    });

    it('should handle errors', async () => {
      mockAxios.get.mockRejectedValue(new Error('Chat not found'));

      await expect(notifier.getChatInfo()).rejects.toThrow('Failed to get chat info: Chat not found');
    });

  });

  describe('sendTest method', () => {
    beforeEach(() => {
      notifier = new TelegramNotifier(mockConfig);
    });

    it('should send test message successfully', async () => {
      await notifier.sendTest();

      expect(mockAxios.post).toHaveBeenCalledWith(
        `https://api.telegram.org/bot${mockConfig.botToken}/sendMessage`,
        expect.objectContaining({
          chat_id: mockConfig.chatId,
          text: expect.stringContaining('Test Notification from CCanywhere'),
          parse_mode: 'Markdown'
        }),
        expect.any(Object)
      );
    });
  });

  });


});