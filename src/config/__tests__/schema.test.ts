/**
 * Configuration schema tests
 */

import { describe, it, expect } from '@jest/globals';
import { validateConfig, getDefaultConfig } from '../schema.js';

describe('Configuration Schema', () => {
  describe('validateConfig', () => {
    it('should validate a valid configuration', () => {
      const config = {
        repo: {
          kind: 'github',
          url: 'https://github.com/test/repo',
          branch: 'main'
        },
        artifacts: {
          baseUrl: 'https://artifacts.test.com',
          retentionDays: 7,
          maxSize: '100MB'
        },
        notifications: {
          channels: ['telegram'],
          telegram: {
            botToken: '123456789:test-token',
            chatId: '-1001234567890'
          }
        },
        build: {
          base: 'origin/main',
          lockTimeout: 300,
          cleanupDays: 7
        }
      };

      expect(() => validateConfig(config)).not.toThrow();
    });

    it('should reject invalid repository URL', () => {
      const config = {
        repo: {
          kind: 'github',
          url: 'not-a-url',
          branch: 'main'
        },
        artifacts: {
          baseUrl: 'https://artifacts.test.com',
          retentionDays: 7,
          maxSize: '100MB'
        },
        notifications: {
          channels: ['telegram'],
          telegram: {
            botToken: '123456789:test-token',
            chatId: '-1001234567890'
          }
        }
      };

      expect(() => validateConfig(config)).toThrow('Repository URL must be a valid URL');
    });

    it('should reject empty notification channels', () => {
      const config = {
        repo: {
          kind: 'github',
          url: 'https://github.com/test/repo',
          branch: 'main'
        },
        artifacts: {
          baseUrl: 'https://artifacts.test.com',
          retentionDays: 7,
          maxSize: '100MB'
        },
        notifications: {
          channels: []
        }
      };

      expect(() => validateConfig(config)).toThrow('At least one notification channel is required');
    });

    it('should require telegram config when telegram channel is enabled', () => {
      const config = {
        repo: {
          kind: 'github',
          url: 'https://github.com/test/repo',
          branch: 'main'
        },
        artifacts: {
          baseUrl: 'https://artifacts.test.com',
          retentionDays: 7,
          maxSize: '100MB'
        },
        notifications: {
          channels: ['telegram']
        }
      };

      expect(() => validateConfig(config)).toThrow('Telegram configuration is required');
    });

    it('should reject invalid telegram bot token', () => {
      const config = {
        repo: {
          kind: 'github',
          url: 'https://github.com/test/repo',
          branch: 'main'
        },
        artifacts: {
          baseUrl: 'https://artifacts.test.com',
          retentionDays: 7,
          maxSize: '100MB'
        },
        notifications: {
          channels: ['telegram'],
          telegram: {
            botToken: 'invalid-token',
            chatId: '-1001234567890'
          }
        }
      };

      expect(() => validateConfig(config)).toThrow('Invalid Telegram bot token format');
    });
  });

  describe('getDefaultConfig', () => {
    it('should return default configuration', () => {
      const config = getDefaultConfig();
      expect(config.repo?.kind).toBe('github');
      expect(config.repo?.branch).toBe('main');
      expect(config.notifications?.channels).toEqual(['telegram']);
      expect(config.build?.base).toBe('origin/main');
      expect(config.build?.lockTimeout).toBe(300);
      expect(config.build?.cleanupDays).toBe(7);
      expect(config.security?.readOnly).toBe(false);
    });
  });
});
