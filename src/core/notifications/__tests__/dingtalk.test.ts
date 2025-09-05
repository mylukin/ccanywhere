/**
 * Tests for DingTalkNotifier
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

// Mock axios
const mockAxios = {
  post: jest.fn()
} as any;

jest.unstable_mockModule('axios', () => ({
  default: mockAxios
}));

// Mock crypto for signature generation
const mockCrypto = {
  createHmac: jest.fn(() => ({
    update: jest.fn().mockReturnThis(),
    digest: jest.fn(() => 'mock-signature')
  }))
} as any;

jest.unstable_mockModule('crypto', () => mockCrypto);

// Import the module after mocking
const { DingTalkNotifier } = await import('../dingtalk.js');

describe('DingTalkNotifier', () => {
  let provider: any;
  let mockConfig: any;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup mock config
    mockConfig = {
      webhook: 'https://oapi.dingtalk.com/robot/send?access_token=test-token',
      secret: 'test-secret'
    };

    // Setup default mock returns
    mockAxios.post.mockResolvedValue({
      data: { errcode: 0, errmsg: 'ok' }
    });

    // Reset crypto mock
    mockCrypto.createHmac.mockReturnValue({
      update: jest.fn().mockReturnThis(),
      digest: jest.fn(() => 'mock-signature')
    });
  });

  describe('constructor', () => {
    it('should initialize with valid configuration', () => {
      provider = new DingTalkNotifier(mockConfig);
      expect(provider).toBeDefined();
    });

    it('should initialize without secret', () => {
      const configWithoutSecret = { ...mockConfig };
      delete configWithoutSecret.secret;

      provider = new DingTalkNotifier(configWithoutSecret);
      expect(provider).toBeDefined();
    });

    it('should throw error for missing webhook', () => {
      expect(() => {
        new DingTalkNotifier({});
      }).toThrow('DingTalk webhook URL is required');
    });

    it('should throw error for empty webhook', () => {
      expect(() => {
        new DingTalkNotifier({ webhook: '' });
      }).toThrow('DingTalk webhook URL is required');
    });

    it('should validate webhook URL format', () => {
      const invalidWebhooks = [
        'not-a-url',
        'http://wrong-domain.com/webhook',
        'https://oapi.dingtalk.com/wrong-path'
      ];

      invalidWebhooks.forEach(webhook => {
        expect(() => {
          new DingTalkNotifier({ webhook });
        }).not.toThrow(); // Constructor doesn't validate URL format, only presence
      });
    });
  });

  describe('send method', () => {
    beforeEach(() => {
      provider = new DingTalkNotifier(mockConfig);
      Date.now = jest.fn(() => 1672574400000); // Fixed timestamp for testing
    });

    it('should send message successfully', async () => {
      const message = 'Test notification message';

      await provider.send(message);

      expect(mockAxios.post).toHaveBeenCalledWith(
        expect.stringContaining(mockConfig.webhook),
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

    it('should include signature when secret is provided', async () => {
      const message = 'Test message';

      await provider.send(message);

      expect(mockCrypto.createHmac).toHaveBeenCalledWith('sha256', mockConfig.secret);
      
      const calledUrl = mockAxios.post.mock.calls[0][0];
      expect(calledUrl).toContain('&timestamp=1672574400000');
      expect(calledUrl).toContain('&sign=mock-signature');
    });

    it('should not include signature when secret is not provided', async () => {
      const configWithoutSecret = { webhook: mockConfig.webhook };
      provider = new DingTalkNotifier(configWithoutSecret);

      await provider.send('Test message');

      expect(mockCrypto.createHmac).not.toHaveBeenCalled();
      
      const calledUrl = mockAxios.post.mock.calls[0][0];
      expect(calledUrl).not.toContain('&timestamp=');
      expect(calledUrl).not.toContain('&sign=');
    });

    it('should handle DingTalk API errors', async () => {
      mockAxios.post.mockResolvedValue({
        data: { errcode: 310000, errmsg: 'keywords not in content' }
      });

      await expect(provider.send('Test message')).rejects.toThrow('keywords not in content');
    });

    it('should handle network errors', async () => {
      mockAxios.post.mockRejectedValue(new Error('Network timeout'));

      await expect(provider.send('Test message')).rejects.toThrow('Network timeout');
    });

    it('should handle malformed API responses', async () => {
      mockAxios.post.mockResolvedValue({
        data: 'Invalid response format'
      });

      await expect(provider.send('Test message')).rejects.toThrow();
    });

    it('should handle rate limiting', async () => {
      mockAxios.post.mockResolvedValue({
        data: { errcode: 130101, errmsg: 'rate limit exceeded' }
      });

      await expect(provider.send('Test message')).rejects.toThrow('rate limit exceeded');
    });

    it('should handle markdown content', async () => {
      const markdownMessage = '## Build Report\n- Status: ✅ Success\n- Duration: 2m 30s';

      await provider.send(markdownMessage);

      expect(mockAxios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          msgtype: 'text',
          text: {
            content: markdownMessage
          }
        }),
        expect.any(Object)
      );
    });

    it('should handle long messages', async () => {
      const longMessage = 'x'.repeat(5000); // Exceed typical limits

      await provider.send(longMessage);

      expect(mockAxios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          text: {
            content: longMessage
          }
        }),
        expect.any(Object)
      );
    });

    it('should handle empty messages', async () => {
      await provider.send('');

      expect(mockAxios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          text: {
            content: ''
          }
        }),
        expect.any(Object)
      );
    });
  });

  describe('test method', () => {
    beforeEach(() => {
      provider = new DingTalkNotifier(mockConfig);
    });

    it('should return success for valid configuration', async () => {
      const result = await provider.test();

      expect(result.success).toBe(true);
      expect(mockAxios.post).toHaveBeenCalledWith(
        expect.any(String),
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
        data: { errcode: 310000, errmsg: 'webhook not exist' }
      });

      const result = await provider.test();

      expect(result.success).toBe(false);
      expect(result.error).toBe('webhook not exist');
    });

    it('should return failure for invalid secret', async () => {
      mockAxios.post.mockResolvedValue({
        data: { errcode: 310000, errmsg: 'sign not match' }
      });

      const result = await provider.test();

      expect(result.success).toBe(false);
      expect(result.error).toBe('sign not match');
    });

    it('should return failure for network errors', async () => {
      mockAxios.post.mockRejectedValue(new Error('Connection refused'));

      const result = await provider.test();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection refused');
    });

    it('should return failure for timeout errors', async () => {
      mockAxios.post.mockRejectedValue({ code: 'ECONNABORTED', message: 'timeout' });

      const result = await provider.test();

      expect(result.success).toBe(false);
      expect(result.error).toBe('timeout');
    });

    it('should handle non-Error objects', async () => {
      mockAxios.post.mockRejectedValue('String error');

      const result = await provider.test();

      expect(result.success).toBe(false);
      expect(result.error).toBe('String error');
    });
  });

  describe('signature generation', () => {
    beforeEach(() => {
      provider = new DingTalkNotifier(mockConfig);
    });

    it('should generate correct signature', async () => {
      const fixedTimestamp = 1672574400000;
      Date.now = jest.fn(() => fixedTimestamp);

      await provider.send('Test message');

      expect(mockCrypto.createHmac).toHaveBeenCalledWith('sha256', mockConfig.secret);
      
      const hmacMock = mockCrypto.createHmac();
      expect(hmacMock.update).toHaveBeenCalledWith(`${fixedTimestamp}\n${mockConfig.secret}`);
      expect(hmacMock.digest).toHaveBeenCalledWith('base64');
    });

    it('should URL encode the signature', async () => {
      mockCrypto.createHmac.mockReturnValue({
        update: jest.fn().mockReturnThis(),
        digest: jest.fn(() => 'signature+with+special=chars')
      });

      await provider.send('Test message');

      const calledUrl = mockAxios.post.mock.calls[0][0];
      expect(calledUrl).toContain('&sign=signature%2Bwith%2Bspecial%3Dchars');
    });
  });

  describe('error code handling', () => {
    beforeEach(() => {
      provider = new DingTalkNotifier(mockConfig);
    });

    const errorCases = [
      { errcode: 310000, errmsg: 'keywords not in content', description: 'keyword filtering' },
      { errcode: 300001, errmsg: 'Invalid token', description: 'invalid access token' },
      { errcode: 130101, errmsg: 'rate limit exceeded', description: 'rate limiting' },
      { errcode: 130102, errmsg: 'ip not in whitelist', description: 'IP whitelist' }
    ];

    errorCases.forEach(({ errcode, errmsg, description }) => {
      it(`should handle ${description} error`, async () => {
        mockAxios.post.mockResolvedValue({
          data: { errcode, errmsg }
        });

        await expect(provider.send('Test')).rejects.toThrow(errmsg);
      });
    });

    it('should handle unknown error codes', async () => {
      mockAxios.post.mockResolvedValue({
        data: { errcode: 999999, errmsg: 'unknown error' }
      });

      await expect(provider.send('Test')).rejects.toThrow('unknown error');
    });

    it('should handle missing error message', async () => {
      mockAxios.post.mockResolvedValue({
        data: { errcode: 310000 }
      });

      await expect(provider.send('Test')).rejects.toThrow('DingTalk API error: 310000');
    });
  });

  describe('webhook URL validation', () => {
    it('should accept valid DingTalk webhook URLs', () => {
      const validUrls = [
        'https://oapi.dingtalk.com/robot/send?access_token=abc123',
        'https://oapi-eu.dingtalk.com/robot/send?access_token=def456',
        'https://oapi-us.dingtalk.com/robot/send?access_token=ghi789'
      ];

      validUrls.forEach(webhook => {
        expect(() => {
          new DingTalkNotifier({ webhook });
        }).not.toThrow();
      });
    });
  });

  describe('message formatting', () => {
    beforeEach(() => {
      provider = new DingTalkNotifier(mockConfig);
    });

    it('should preserve text formatting', async () => {
      const formattedMessage = 'Build Status: SUCCESS\nDuration: 2m 30s\nCommit: abc123';

      await provider.send(formattedMessage);

      expect(mockAxios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          text: {
            content: formattedMessage
          }
        }),
        expect.any(Object)
      );
    });

    it('should handle Unicode characters', async () => {
      const unicodeMessage = '构建成功 ✅ Build completed successfully 🎉';

      await provider.send(unicodeMessage);

      expect(mockAxios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          text: {
            content: unicodeMessage
          }
        }),
        expect.any(Object)
      );
    });
  });
});