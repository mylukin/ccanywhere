/**
 * Tests for WeComNotifier
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import type { NotificationMessage } from '../types.js';

// Mock axios
const mockAxios = {
  post: jest.fn() as any
};

jest.unstable_mockModule('axios', () => ({
  default: mockAxios,
  AxiosError: class AxiosError extends Error {
    constructor(message: string, response?: any) {
      super(message);
      this.name = 'AxiosError';
      this.isAxiosError = true;
      this.response = response;
    }
    isAxiosError = true;
    response?: any;
  }
}));

// Import BuildError directly without mocking
// jest.unstable_mockModule('../../../types/index.js', () => ({
//   BuildError: class BuildError extends Error {
//     constructor(message: string) {
//       super(message);
//       this.name = 'BuildError';
//     }
//   }
// }));

// Import the module after mocking
const { WeComNotifier } = await import('../wecom');

describe('WeComNotifier', () => {
  let notifier: any;
  let mockConfig: any;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup mock config
    mockConfig = {
      webhook: 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=test-key'
    };

    // Setup default mock returns
    mockAxios.post.mockResolvedValue({
      data: { errcode: 0, errmsg: 'ok' }
    });
  });

  describe('constructor', () => {
    it('should initialize with valid configuration', () => {
      notifier = new WeComNotifier(mockConfig);
      expect(notifier).toBeDefined();
    });

    it('should throw error for missing webhook', () => {
      expect(() => {
        new WeComNotifier({} as any);
      }).toThrow('WeCom webhook URL is required');
    });

    it('should throw error for empty webhook', () => {
      expect(() => {
        new WeComNotifier({ webhook: '' });
      }).toThrow('WeCom webhook URL is required');
    });
  });

  describe('send method', () => {
    beforeEach(() => {
      notifier = new WeComNotifier(mockConfig);
    });

    it('should send text message successfully', async () => {
      const message = 'Test notification message';

      await notifier.send(message);

      expect(mockAxios.post).toHaveBeenCalledWith(
        mockConfig.webhook,
        {
          msgtype: 'text',
          text: {
            content: message
          }
        },
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );
    });

    it('should send markdown message when content has markdown formatting', async () => {
      const markdownMessage = '## Build Report\n**Status:** ✅ Success\n*Duration:* 2m 30s';

      await notifier.send(markdownMessage);

      expect(mockAxios.post).toHaveBeenCalledWith(
        mockConfig.webhook,
        {
          msgtype: 'markdown',
          markdown: {
            content: markdownMessage
          }
        },
        expect.any(Object)
      );
    });

    it('should handle WeCom API errors', async () => {
      mockAxios.post.mockResolvedValue({
        data: { errcode: 93000, errmsg: 'invalid webhook url' }
      });

      await expect(notifier.send('Test message')).rejects.toThrow('invalid webhook url');
    });

    it('should handle network errors', async () => {
      mockAxios.post.mockRejectedValue(new Error('Network timeout'));

      await expect(notifier.send('Test message')).rejects.toThrow('Network timeout');
    });

    it('should handle rate limiting', async () => {
      mockAxios.post.mockResolvedValue({
        data: { errcode: 45009, errmsg: 'reach max message per day' }
      });

      await expect(notifier.send('Test message')).rejects.toThrow('reach max message per day');
    });

    it('should handle message length limits', async () => {
      const longMessage = 'x'.repeat(5000);

      await notifier.send(longMessage);

      expect(mockAxios.post).toHaveBeenCalledWith(
        mockConfig.webhook,
        expect.objectContaining({
          text: {
            content: longMessage
          }
        }),
        expect.any(Object)
      );
    });

    it('should handle empty messages', async () => {
      await notifier.send('');

      expect(mockAxios.post).toHaveBeenCalledWith(
        mockConfig.webhook,
        expect.objectContaining({
          text: {
            content: ''
          }
        }),
        expect.any(Object)
      );
    });

    it('should detect markdown content correctly', async () => {
      const testCases = [
        { input: '**bold text**', expectMarkdown: true },
        { input: '*italic text*', expectMarkdown: true },
        { input: '# Header', expectMarkdown: true },
        { input: '## Subheader', expectMarkdown: true },
        { input: '[link](url)', expectMarkdown: true },
        { input: '`code`', expectMarkdown: true },
        { input: 'plain text', expectMarkdown: false },
        { input: 'text with * asterisk but not bold', expectMarkdown: false }
      ];

      for (const testCase of testCases) {
        jest.clearAllMocks();
        await notifier.send(testCase.input);

        const call = mockAxios.post.mock.calls[0];
        const payload = call[1];

        if (testCase.expectMarkdown) {
          expect(payload.msgtype).toBe('markdown');
          expect(payload.markdown.content).toBe(testCase.input);
        } else {
          expect(payload.msgtype).toBe('text');
          expect(payload.text.content).toBe(testCase.input);
        }
      }
    });
  });

  describe('test method', () => {
    beforeEach(() => {
      notifier = new WeComNotifier(mockConfig);
    });

    it('should return success for valid configuration', async () => {
      const result = await notifier.test();

      expect(result.success).toBe(true);
      expect(mockAxios.post).toHaveBeenCalledWith(
        mockConfig.webhook,
        expect.objectContaining({
          text: {
            content: expect.stringContaining('Test message from CCanywhere')
          }
        }),
        expect.any(Object)
      );
    });

    it('should return failure for invalid webhook', async () => {
      mockAxios.post.mockResolvedValue({
        data: { errcode: 93000, errmsg: 'invalid webhook url' }
      });

      const result = await notifier.test();

      expect(result.success).toBe(false);
      expect(result.error).toBe('invalid webhook url');
    });

    it('should return failure for network errors', async () => {
      mockAxios.post.mockRejectedValue(new Error('Connection refused'));

      const result = await notifier.test();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection refused');
    });

    it('should return failure for timeout errors', async () => {
      const timeoutError = { code: 'ECONNABORTED', message: 'timeout of 10000ms exceeded' };
      mockAxios.post.mockRejectedValue(timeoutError);

      const result = await notifier.test();

      expect(result.success).toBe(false);
      expect(result.error).toBe('timeout of 10000ms exceeded');
    });

    it('should handle non-Error objects', async () => {
      mockAxios.post.mockRejectedValue('String error');

      const result = await notifier.test();

      expect(result.success).toBe(false);
      expect(result.error).toBe('String error');
    });
  });

  describe('error code handling', () => {
    beforeEach(() => {
      notifier = new WeComNotifier(mockConfig);
    });

    const errorCases = [
      { errcode: 93000, errmsg: 'invalid webhook url', description: 'invalid webhook' },
      { errcode: 93004, errmsg: 'webhook disabled by user', description: 'disabled webhook' },
      { errcode: 93008, errmsg: 'ip not in whitelist', description: 'IP restriction' },
      { errcode: 45009, errmsg: 'reach max message per day', description: 'daily limit' },
      { errcode: 45015, errmsg: 'response out of time limit', description: 'timeout' }
    ];

    errorCases.forEach(({ errcode, errmsg, description }) => {
      it(`should handle ${description} error`, async () => {
        mockAxios.post.mockResolvedValue({
          data: { errcode, errmsg }
        });

        await expect(notifier.send('Test')).rejects.toThrow(errmsg);
      });
    });

    it('should handle unknown error codes', async () => {
      mockAxios.post.mockResolvedValue({
        data: { errcode: 999999, errmsg: 'unknown error' }
      });

      await expect(notifier.send('Test')).rejects.toThrow('unknown error');
    });

    it('should handle missing error message', async () => {
      mockAxios.post.mockResolvedValue({
        data: { errcode: 93000 }
      });

      await expect(notifier.send('Test')).rejects.toThrow('WeCom API error: 93000');
    });

    it('should handle malformed responses', async () => {
      mockAxios.post.mockResolvedValue({
        data: 'Invalid response format'
      });

      await expect(notifier.send('Test')).rejects.toThrow();
    });
  });

  describe('webhook URL validation', () => {
    it('should accept valid WeCom webhook URLs', () => {
      const validUrls = [
        'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=abc123',
        'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=def456-ghi789'
      ];

      validUrls.forEach(webhook => {
        expect(() => {
          new WeComNotifier({ webhook });
        }).not.toThrow();
      });
    });
  });

  describe('message type detection', () => {
    beforeEach(() => {
      notifier = new WeComNotifier(mockConfig);
    });

    it('should use text type for simple messages', async () => {
      const simpleMessages = [
        'Simple text message',
        'Build completed successfully',
        'Error: Something went wrong'
      ];

      for (const message of simpleMessages) {
        jest.clearAllMocks();
        await notifier.send(message);

        const payload = mockAxios.post.mock.calls[0][1];
        expect(payload.msgtype).toBe('text');
        expect(payload.text.content).toBe(message);
      }
    });

    it('should use markdown type for formatted messages', async () => {
      const markdownMessages = [
        '**Build Status:** Success',
        '## Build Report\n- Status: OK',
        'Check [this link](https://example.com)',
        'Code: `npm install`',
        '### Summary\n*Duration:* 2m 30s'
      ];

      for (const message of markdownMessages) {
        jest.clearAllMocks();
        await notifier.send(message);

        const payload = mockAxios.post.mock.calls[0][1];
        expect(payload.msgtype).toBe('markdown');
        expect(payload.markdown.content).toBe(message);
      }
    });
  });

  describe('Unicode and special character handling', () => {
    beforeEach(() => {
      notifier = new WeComNotifier(mockConfig);
    });

    it('should handle Chinese characters', async () => {
      const chineseMessage = '构建成功！项目已部署到生产环境。';

      await notifier.send(chineseMessage);

      expect(mockAxios.post).toHaveBeenCalledWith(
        mockConfig.webhook,
        expect.objectContaining({
          text: {
            content: chineseMessage
          }
        }),
        expect.any(Object)
      );
    });

    it('should handle emojis', async () => {
      const emojiMessage = 'Build Status: ✅ Success 🎉 Deployment: 🚀 Complete';

      await notifier.send(emojiMessage);

      expect(mockAxios.post).toHaveBeenCalledWith(
        mockConfig.webhook,
        expect.objectContaining({
          text: {
            content: emojiMessage
          }
        }),
        expect.any(Object)
      );
    });

    it('should handle mixed content', async () => {
      const mixedMessage = '构建完成 ✅\n**Status:** Success\nTime: 2024-01-01 12:00:00';

      await notifier.send(mixedMessage);

      const payload = mockAxios.post.mock.calls[0][1];
      expect(payload.msgtype).toBe('markdown'); // Due to **Status:**
      expect(payload.markdown.content).toBe(mixedMessage);
    });
  });

  describe('error resilience', () => {
    beforeEach(() => {
      notifier = new WeComNotifier(mockConfig);
    });

    it('should handle concurrent requests', async () => {
      const messages = ['Message 1', 'Message 2', 'Message 3'];
      const promises = messages.map(msg => notifier.send(msg));

      await expect(Promise.all(promises)).resolves.not.toThrow();
      expect(mockAxios.post).toHaveBeenCalledTimes(3);
    });

    it('should handle partial failures in concurrent requests', async () => {
      mockAxios.post
        .mockResolvedValueOnce({ data: { errcode: 0, errmsg: 'ok' } })
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ data: { errcode: 0, errmsg: 'ok' } });

      const promises = [
        notifier.send('Success 1'),
        notifier.send('Failure'),
        notifier.send('Success 2')
      ];

      const results = await Promise.allSettled(promises);

      expect(results[0]?.status).toBe('fulfilled');
      expect(results[1]?.status).toBe('rejected');
      expect(results[2]?.status).toBe('fulfilled');
    });
  });
});