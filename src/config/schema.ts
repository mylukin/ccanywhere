/**
 * Configuration schema validation using Zod
 */

import { z } from 'zod';
import type { CcanywhereConfig } from '../types/index.js';

export const RepoKindSchema = z.enum(['github', 'gitlab', 'bitbucket', 'gitee']);

export const NotificationChannelSchema = z.enum(['telegram', 'dingtalk', 'wecom', 'email']);

export const RepoConfigSchema = z
  .object({
    kind: RepoKindSchema.optional(),
    url: z.string().url('Repository URL must be a valid URL').optional(),
    branch: z.string().min(1).default('main').optional()
  })
  .optional();

export const UrlsConfigSchema = z
  .object({
    artifacts: z.string().url('Artifacts URL must be a valid URL').optional(),
    staging: z.string().url('Staging URL must be a valid URL').optional()
  })
  .optional();

export const DeploymentConfigSchema = z
  .object({
    webhook: z.string().url('Deployment webhook must be a valid URL'),
    statusUrl: z.string().url('Status URL must be a valid URL').optional(),
    maxWait: z.number().min(1).max(3600).default(300),
    pollInterval: z.number().min(1).max(60).default(5)
  })
  .optional();

export const TelegramConfigSchema = z.object({
  botToken: z.string().regex(/^\d+:[\w-]+$/, 'Invalid Telegram bot token format'),
  chatId: z.string().min(1, 'Telegram chat ID is required')
});

export const DingTalkConfigSchema = z.object({
  webhook: z.string().url('DingTalk webhook must be a valid URL'),
  secret: z.string().min(1).optional()
});

export const WeComConfigSchema = z.object({
  webhook: z.string().url('WeCom webhook must be a valid URL')
});

export const SmtpConfigSchema = z.object({
  host: z.string().min(1, 'SMTP host is required'),
  port: z.number().min(1).max(65535),
  user: z.string().email('SMTP user must be a valid email'),
  pass: z.string().min(1, 'SMTP password is required')
});

export const EmailConfigSchema = z.object({
  to: z.string().email('Email recipient must be a valid email'),
  from: z.string().email('Email sender must be a valid email').optional(),
  smtp: SmtpConfigSchema.optional()
});

export const NotificationsConfigSchema = z
  .object({
    channels: z
      .array(NotificationChannelSchema)
      .min(1, 'At least one notification channel is required'),
    telegram: TelegramConfigSchema.optional(),
    dingtalk: DingTalkConfigSchema.optional(),
    wecom: WeComConfigSchema.optional(),
    email: EmailConfigSchema.optional()
  })
  .refine(data => {
    // Validate that required config exists for each enabled channel
    const errors: string[] = [];

    if (data.channels && data.channels.length > 0) {
      data.channels.forEach(channel => {
        switch (channel) {
          case 'telegram':
            if (!data.telegram) {
              errors.push('Telegram configuration is required when telegram channel is enabled');
            }
            break;
          case 'dingtalk':
            if (!data.dingtalk) {
              errors.push('DingTalk configuration is required when dingtalk channel is enabled');
            }
            break;
          case 'wecom':
            if (!data.wecom) {
              errors.push('WeCom configuration is required when wecom channel is enabled');
            }
            break;
          case 'email':
            if (!data.email) {
              errors.push('Email configuration is required when email channel is enabled');
            }
            break;
        }
      });
    }

    if (errors.length > 0) {
      throw new Error(errors.join('; '));
    }

    return true;
  });

export const BuildConfigSchema = z.object({
  base: z.string().min(1).default('origin/main'),
  lockTimeout: z.number().min(1).max(3600).default(300),
  cleanupDays: z.number().min(1).max(365).default(7)
});

export const TestConfigSchema = z.object({
  enabled: z.boolean().default(true),
  configFile: z.string().optional(),
  reporter: z.string().optional(),
  timeout: z.number().min(1000).max(300000).optional(),
  workers: z.number().min(1).max(10).optional()
}).optional();

export const SecurityConfigSchema = z
  .object({
    readOnly: z.boolean().default(false),
    linkExpiry: z.number().min(60).max(86400).optional()
  })
  .optional();

export const CcanywhereConfigSchema = z.object({
  repo: RepoConfigSchema,
  urls: UrlsConfigSchema,
  deployment: DeploymentConfigSchema,
  notifications: NotificationsConfigSchema.optional(),
  build: BuildConfigSchema.optional(),
  test: TestConfigSchema,
  security: SecurityConfigSchema
});

/**
 * Validate configuration object
 */
export function validateConfig(config: unknown): CcanywhereConfig {
  try {
    return CcanywhereConfigSchema.parse(config);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const messages = error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
      throw new Error(`Configuration validation failed:\n${messages.join('\n')}`);
    }
    throw error;
  }
}

/**
 * Get default configuration
 */
export function getDefaultConfig(): Partial<CcanywhereConfig> {
  return {
    repo: {
      kind: 'github',
      branch: 'main'
    },
    notifications: {
      channels: ['telegram']
    },
    build: {
      base: 'origin/main',
      lockTimeout: 300,
      cleanupDays: 7
    },
    test: {
      enabled: true
    },
    security: {
      readOnly: false
    }
  };
}
