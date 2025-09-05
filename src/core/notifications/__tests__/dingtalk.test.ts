/**
 * Tests for DingTalkNotifier
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

// Mock axios
const mockAxios = {
  post: jest.fn()
} as any;

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

// Mock crypto for signature generation
const mockCrypto = {
  createHmac: jest.fn(() => ({
    update: jest.fn().mockReturnThis(),
    digest: jest.fn(() => 'mock-signature')
  }))
} as any;

jest.unstable_mockModule('crypto', () => mockCrypto);

// Mock MessageFormatter
const mockMessageFormatter = {
  format: jest.fn() as any
};

jest.unstable_mockModule('@/core/notifications/formatter', () => ({
  MessageFormatter: mockMessageFormatter
}));

// Import the module after mocking
const { DingTalkNotifier } = await import('../dingtalk');

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

    // Mock MessageFormatter
    mockMessageFormatter.format.mockReturnValue({
      title: 'Test Title',
      content: '**Test Title**\n\nTest content',
      format: 'markdown'
    });

    // Mock Date.now for consistent timestamps
    Date.now = jest.fn(() => 1672574400000);
  });

  describe('constructor', () => {
    it('should initialize with valid configuration', () => {
      provider = new DingTalkNotifier(mockConfig);
      expect(provider).toBeDefined();
      expect(provider.channel).toBe('dingtalk');
    });

    it('should initialize without secret', () => {
      const configWithoutSecret = { webhook: mockConfig.webhook };

      provider = new DingTalkNotifier(configWithoutSecret);
      expect(provider).toBeDefined();
      expect(provider.channel).toBe('dingtalk');
    });

    it('should accept various webhook URLs', () => {
      const validWebhooks = [
        'https://oapi.dingtalk.com/robot/send?access_token=abc123',
        'https://oapi-eu.dingtalk.com/robot/send?access_token=def456',
        'https://oapi-us.dingtalk.com/robot/send?access_token=ghi789'
      ];

      validWebhooks.forEach(webhook => {
        expect(() => {
          new DingTalkNotifier({ webhook });
        }).not.toThrow();
      });
    });
  });

  describe('send method', () => {
    beforeEach(() => {
      provider = new DingTalkNotifier(mockConfig);
    });

    it('should send notification message successfully', async () => {
      const message = {
        title: 'Build Success',
        extra: 'Test completed successfully',
        timestamp: Date.now(),
        isError: false
      };

      await provider.send(message);

      expect(mockMessageFormatter.format).toHaveBeenCalledWith(message, 'markdown');
      expect(mockAxios.post).toHaveBeenCalledWith(
        expect.stringContaining(mockConfig.webhook),
        {
          msgtype: 'markdown',
          markdown: {
            title: 'Test Title',
            text: '**Test Title**\n\nTest content'
          }
        },
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );
    });

    it('should include signature when secret is provided', async () => {
      const message = {
        title: 'Test',
        extra: 'Message',
        timestamp: Date.now(),
        isError: false
      };

      await provider.send(message);

      expect(mockCrypto.createHmac).toHaveBeenCalledWith('sha256', mockConfig.secret);
      
      const calledUrl = mockAxios.post.mock.calls[0][0];
      expect(calledUrl).toContain('&timestamp=1672574400000');
      expect(calledUrl).toContain('&sign=mock-signature');
    });

    it('should not include signature when secret is not provided', async () => {
      const configWithoutSecret = { webhook: mockConfig.webhook };
      provider = new DingTalkNotifier(configWithoutSecret);

      const message = {
        title: 'Test',
        extra: 'Message',
        timestamp: Date.now(),
        isError: false
      };

      await provider.send(message);

      expect(mockCrypto.createHmac).not.toHaveBeenCalled();
      
      const calledUrl = mockAxios.post.mock.calls[0][0];
      expect(calledUrl).toBe(mockConfig.webhook);
    });

    it('should handle DingTalk API errors', async () => {
      mockAxios.post.mockResolvedValue({
        data: { errcode: 310000, errmsg: 'keywords not in content' }
      });

      const message = { title: 'Test', extra: 'Message', timestamp: Date.now(), isError: false };

      await expect(provider.send(message)).rejects.toThrow('DingTalk API error: keywords not in content');
    });

    it('should handle network errors', async () => {
      mockAxios.post.mockRejectedValue(new Error('Network timeout'));

      const message = { title: 'Test', extra: 'Message', timestamp: Date.now(), isError: false };

      await expect(provider.send(message)).rejects.toThrow('Failed to send DingTalk notification: Network timeout');
    });

    it('should handle unknown API errors', async () => {
      mockAxios.post.mockResolvedValue({
        data: { errcode: 310000 } // No errmsg
      });

      const message = { title: 'Test', extra: 'Message', timestamp: Date.now(), isError: false };

      await expect(provider.send(message)).rejects.toThrow('DingTalk API error: Unknown error');
    });

    it('should handle rate limiting', async () => {
      mockAxios.post.mockResolvedValue({
        data: { errcode: 130101, errmsg: 'rate limit exceeded' }
      });

      const message = { title: 'Test', extra: 'Message', timestamp: Date.now(), isError: false };

      await expect(provider.send(message)).rejects.toThrow('DingTalk API error: rate limit exceeded');
    });

    it('should use markdown formatting', async () => {
      const message = {
        title: 'Build Report',
        extra: 'Status: ✅ Success\nDuration: 2m 30s',
        timestamp: Date.now(),
        isError: false
      };

      await provider.send(message);

      expect(mockMessageFormatter.format).toHaveBeenCalledWith(message, 'markdown');
      expect(mockAxios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          msgtype: 'markdown',
          markdown: {
            title: 'Test Title',
            text: '**Test Title**\n\nTest content'
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

    it('should return true for valid configuration', async () => {
      const result = await provider.test();

      expect(result).toBe(true);
      expect(mockAxios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          msgtype: 'markdown',
          markdown: {
            title: 'Test Title',
            text: '**Test Title**\n\nTest content'
          }
        }),
        expect.any(Object)
      );
    });

    it('should return false for API errors', async () => {
      mockAxios.post.mockResolvedValue({
        data: { errcode: 310000, errmsg: 'webhook not exist' }
      });

      const result = await provider.test();

      expect(result).toBe(false);
    });

    it('should return false for network errors', async () => {
      mockAxios.post.mockRejectedValue(new Error('Connection refused'));

      const result = await provider.test();

      expect(result).toBe(false);
    });

    it('should return false for any errors', async () => {
      mockAxios.post.mockRejectedValue('String error');

      const result = await provider.test();

      expect(result).toBe(false);
    });
  });

  describe('signature generation', () => {
    beforeEach(() => {
      provider = new DingTalkNotifier(mockConfig);
    });

    it('should generate correct signature', async () => {
      const fixedTimestamp = 1672574400000;
      Date.now = jest.fn(() => fixedTimestamp);

      const message = { title: 'Test', extra: 'Message', timestamp: Date.now(), isError: false };
      await provider.send(message);

      expect(mockCrypto.createHmac).toHaveBeenCalledWith('sha256', mockConfig.secret);
      
      const hmacMock = mockCrypto.createHmac();
      expect(hmacMock.update).toHaveBeenCalledWith(`${fixedTimestamp}\n${mockConfig.secret}`, 'utf8');
      expect(hmacMock.digest).toHaveBeenCalledWith('base64');
    });

    it('should URL encode the signature', async () => {
      mockCrypto.createHmac.mockReturnValue({
        update: jest.fn().mockReturnThis(),
        digest: jest.fn(() => 'signature+with+special=chars')
      });

      const message = { title: 'Test', extra: 'Message', timestamp: Date.now(), isError: false };
      await provider.send(message);

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

        const message = { title: 'Test', extra: 'Message', timestamp: Date.now(), isError: false };
        await expect(provider.send(message)).rejects.toThrow(`DingTalk API error: ${errmsg}`);
      });
    });

    it('should handle unknown error codes', async () => {
      mockAxios.post.mockResolvedValue({
        data: { errcode: 999999, errmsg: 'unknown error' }
      });

      const message = { title: 'Test', extra: 'Message', timestamp: Date.now(), isError: false };
      await expect(provider.send(message)).rejects.toThrow('DingTalk API error: unknown error');
    });

    it('should handle missing error message', async () => {
      mockAxios.post.mockResolvedValue({
        data: { errcode: 310000 }
      });

      const message = { title: 'Test', extra: 'Message', timestamp: Date.now(), isError: false };
      await expect(provider.send(message)).rejects.toThrow('DingTalk API error: Unknown error');
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

    it('should format complex messages', async () => {
      const message = {
        title: 'Build Status: SUCCESS',
        extra: 'Duration: 2m 30s\nCommit: abc123',
        timestamp: Date.now(),
        isError: false,
        diffUrl: 'https://example.com/diff',
        previewUrl: 'https://preview.example.com'
      };

      await provider.send(message);

      expect(mockMessageFormatter.format).toHaveBeenCalledWith(message, 'markdown');
      expect(mockAxios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          msgtype: 'markdown',
          markdown: {
            title: 'Test Title',
            text: '**Test Title**\n\nTest content'
          }
        }),
        expect.any(Object)
      );
    });

    it('should handle Unicode characters in messages', async () => {
      const message = {
        title: '构建成功 ✅ Build completed successfully 🎉',
        extra: 'Everything is working fine',
        timestamp: Date.now(),
        isError: false
      };

      await provider.send(message);

      expect(mockMessageFormatter.format).toHaveBeenCalledWith(message, 'markdown');
    });
  });
});