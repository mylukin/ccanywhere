/**
 * Tests for EmailNotifier
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import type { NotificationMessage } from '../types.js';

// Mock nodemailer
const mockTransporter = {
  sendMail: jest.fn() as any,
  verify: jest.fn() as any
};

const mockNodemailer = {
  createTransport: jest.fn(() => mockTransporter)
};

jest.unstable_mockModule('nodemailer', () => ({
  createTransport: mockNodemailer.createTransport
}));

// Mock execa
const mockExeca = jest.fn() as any;
jest.unstable_mockModule('execa', () => ({
  execa: mockExeca
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
const { EmailNotifier } = await import('../email.js');

describe('EmailNotifier', () => {
  let notifier: any;
  let mockConfig: any;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup default mock returns
    (mockTransporter.sendMail as any).mockResolvedValue({
      messageId: 'test-message-id',
      response: '250 OK'
    });
    (mockExeca as any).mockResolvedValue({});
  });

  describe('constructor', () => {
    it('should initialize with SMTP configuration', () => {
      mockConfig = {
        to: 'recipient@example.com',
        from: 'sender@example.com',
        smtp: {
          host: 'smtp.example.com',
          port: 587,
          user: 'user@example.com',
          pass: 'password'
        }
      };

      notifier = new EmailNotifier(mockConfig);
      
      expect(notifier).toBeDefined();
      expect(notifier.channel).toBe('email');
    });

    it('should initialize without SMTP configuration', () => {
      mockConfig = {
        to: 'recipient@example.com',
        from: 'sender@example.com'
      };

      notifier = new EmailNotifier(mockConfig);
      expect(notifier).toBeDefined();
    });
  });

  describe('send method with SMTP', () => {
    beforeEach(() => {
      mockConfig = {
        to: 'recipient@example.com',
        from: 'sender@example.com',
        smtp: {
          host: 'smtp.example.com',
          port: 587,
          user: 'user@example.com',
          pass: 'password'
        }
      };
      notifier = new EmailNotifier(mockConfig);
    });

    it('should send email via SMTP successfully', async () => {
      const message: NotificationMessage = {
        title: 'Test Notification',
        extra: 'Test content',
        timestamp: Date.now(),
        isError: false
      };

      await notifier.send(message);

      expect(mockNodemailer.createTransport).toHaveBeenCalledWith({
        host: mockConfig.smtp.host,
        port: mockConfig.smtp.port,
        secure: false,
        auth: {
          user: mockConfig.smtp.user,
          pass: mockConfig.smtp.pass
        }
      });

      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        from: mockConfig.from,
        to: mockConfig.to,
        subject: expect.stringContaining('Test Notification'),
        html: expect.any(String),
        text: expect.any(String)
      });
    });

    it('should use secure connection for port 465', async () => {
      const secureConfig = {
        ...mockConfig,
        smtp: { ...mockConfig.smtp, port: 465 }
      };
      notifier = new EmailNotifier(secureConfig);

      const message: NotificationMessage = {
        title: 'Test',
        timestamp: Date.now()
      };

      await notifier.send(message);

      expect(mockNodemailer.createTransport).toHaveBeenCalledWith({
        host: secureConfig.smtp.host,
        port: 465,
        secure: true,
        auth: {
          user: secureConfig.smtp.user,
          pass: secureConfig.smtp.pass
        }
      });
    });

    it('should use SMTP user as sender if no from address provided', async () => {
      const configWithoutFrom = {
        to: 'recipient@example.com',
        smtp: {
          host: 'smtp.example.com',
          port: 587,
          user: 'user@example.com',
          pass: 'password'
        }
      };
      notifier = new EmailNotifier(configWithoutFrom);

      const message: NotificationMessage = {
        title: 'Test',
        timestamp: Date.now()
      };

      await notifier.send(message);

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: configWithoutFrom.smtp.user
        })
      );
    });

    it('should handle SMTP errors', async () => {
      const message: NotificationMessage = {
        title: 'Test',
        timestamp: Date.now()
      };

      (mockTransporter.sendMail as any).mockRejectedValue(new Error('SMTP connection failed'));

      await expect(notifier.send(message)).rejects.toThrow('Failed to send SMTP email: SMTP connection failed');
    });
  });

  describe('send method without SMTP', () => {
    beforeEach(() => {
      mockConfig = {
        to: 'recipient@example.com',
        from: 'sender@example.com'
      };
      notifier = new EmailNotifier(mockConfig);
    });

    it('should send email via mail command successfully', async () => {
      const message: NotificationMessage = {
        title: 'Test Notification',
        extra: 'Test content',
        timestamp: Date.now(),
        isError: false
      };

      await notifier.send(message);

      expect(mockExeca).toHaveBeenCalledWith(
        'mail',
        [
          '-a', 'Content-Type: text/html',
          '-s', expect.stringContaining('Test Notification'),
          mockConfig.to
        ],
        {
          input: expect.any(String),
          timeout: 30000
        }
      );
    });

    it('should fallback to sendmail when mail command fails', async () => {
      const message: NotificationMessage = {
        title: 'Test Notification',
        timestamp: Date.now()
      };

      mockExeca
        .mockRejectedValueOnce(new Error('mail command not found') as any)
        .mockResolvedValueOnce({});

      await notifier.send(message);

      expect(mockExeca).toHaveBeenCalledWith('mail', expect.any(Array), expect.any(Object));
      expect(mockExeca).toHaveBeenCalledWith('sendmail', [mockConfig.to], {
        input: expect.stringContaining('Test Notification'),
        timeout: 30000
      });
    });

    it('should handle local mail errors', async () => {
      const message: NotificationMessage = {
        title: 'Test',
        timestamp: Date.now()
      };

      mockExeca.mockRejectedValue(new Error('Mail command failed'));

      await expect(notifier.send(message)).rejects.toThrow('Failed to send email: Mail command failed');
    });
  });

  describe('test method', () => {
    beforeEach(() => {
      mockConfig = {
        to: 'recipient@example.com',
        smtp: {
          host: 'smtp.example.com',
          port: 587,
          user: 'user@example.com',
          pass: 'password'
        }
      };
      notifier = new EmailNotifier(mockConfig);
    });

    it('should return true for successful test', async () => {
      const result = await notifier.test();

      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalled();
    });

    it('should return false for failed test', async () => {
      mockTransporter.sendMail.mockRejectedValue(new Error('Connection failed'));

      const result = await notifier.test();

      expect(result).toBe(false);
    });
  });

  describe('sendTest method', () => {
    beforeEach(() => {
      mockConfig = {
        to: 'recipient@example.com',
        smtp: {
          host: 'smtp.example.com',
          port: 587,
          user: 'user@example.com',
          pass: 'password'
        }
      };
      notifier = new EmailNotifier(mockConfig);
    });

    it('should send test email successfully', async () => {
      await notifier.sendTest();

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: expect.stringContaining('Test Notification from CCanywhere'),
          html: expect.any(String)
        })
      );
    });
  });

  describe('isLocalMailAvailable static method', () => {
    it('should check for mail and sendmail commands', async () => {
      mockExeca
        .mockResolvedValueOnce({}) // mail command exists
        .mockRejectedValueOnce(new Error('not found')); // sendmail not found

      const result = await EmailNotifier.isLocalMailAvailable();

      expect(result).toEqual({ mail: true, sendmail: false });
      expect(mockExeca).toHaveBeenCalledWith('which', ['mail']);
      expect(mockExeca).toHaveBeenCalledWith('which', ['sendmail']);
    });

    it('should handle command check errors', async () => {
      mockExeca.mockRejectedValue(new Error('Command not found'));

      const result = await EmailNotifier.isLocalMailAvailable();

      expect(result).toEqual({ mail: false, sendmail: false });
    });
  });
});