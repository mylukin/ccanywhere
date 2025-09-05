/**
 * Configuration schema validation using Zod
 */

import { z } from 'zod';
import type { CcanywhereConfig } from '../types/index.js';

export const RepoKindSchema = z.enum(['github', 'gitlab', 'bitbucket', 'gitee']);

export const StorageProviderSchema = z.enum(['s3', 'r2', 'oss']);

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
    artifacts: z.string().url('Artifacts URL must be a valid URL').optional()
  })
  .optional();

export const DeploymentConfigSchema = z
  .union([
    z.string().url('Deployment webhook must be a valid URL'),
    z.object({
      webhook: z.string().url('Deployment webhook must be a valid URL')
    })
  ])
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
    channels: z.array(NotificationChannelSchema).min(1, 'At least one notification channel is required'),
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
  cleanupDays: z.number().min(1).max(365).default(7),
  excludePaths: z.array(z.string()).default(['.artifacts']).optional()
});

export const TestConfigSchema = z
  .object({
    enabled: z.boolean().default(true),
    configFile: z.string().optional(),
    reporter: z.string().optional(),
    timeout: z.number().min(1000).max(300000).optional(),
    workers: z.number().min(1).max(10).optional()
  })
  .optional();

export const SecurityConfigSchema = z
  .object({
    readOnly: z.boolean().default(false),
    linkExpiry: z.number().min(60).max(86400).optional()
  })
  .optional();

export const S3ConfigSchema = z.object({
  accessKeyId: z.string().min(1, 'S3 access key ID is required'),
  secretAccessKey: z.string().min(1, 'S3 secret access key is required'),
  region: z.string().min(1, 'S3 region is required'),
  bucket: z.string().min(1, 'S3 bucket is required'),
  endpoint: z.string().url().optional()
});

export const R2ConfigSchema = z.object({
  accountId: z.string().min(1, 'Cloudflare R2 account ID is required'),
  accessKeyId: z.string().min(1, 'R2 access key ID is required'),
  secretAccessKey: z.string().min(1, 'R2 secret access key is required'),
  bucket: z.string().min(1, 'R2 bucket is required')
});

export const OSSConfigSchema = z.object({
  accessKeyId: z.string().min(1, 'OSS access key ID is required'),
  accessKeySecret: z.string().min(1, 'OSS access key secret is required'),
  region: z.string().min(1, 'OSS region is required'),
  bucket: z.string().min(1, 'OSS bucket is required'),
  endpoint: z.string().url().optional()
});

export const StorageConfigSchema = z
  .object({
    provider: StorageProviderSchema,
    folder: z.string().optional(),
    s3: S3ConfigSchema.optional(),
    r2: R2ConfigSchema.optional(),
    oss: OSSConfigSchema.optional()
  })
  .refine(data => {
    // Validate that required config exists for the selected provider
    if (data.provider === 's3' && !data.s3) {
      throw new Error('S3 configuration is required when s3 provider is selected');
    }
    if (data.provider === 'r2' && !data.r2) {
      throw new Error('R2 configuration is required when r2 provider is selected');
    }
    if (data.provider === 'oss' && !data.oss) {
      throw new Error('OSS configuration is required when oss provider is selected');
    }
    return true;
  })
  .optional();

// New artifacts configuration schema
export const ArtifactsConfigSchema = z
  .object({
    baseUrl: z.string().url('Artifacts base URL must be a valid URL').optional(),
    retentionDays: z.number().min(1).max(365).default(7).optional(),
    maxSize: z
      .string()
      .regex(/^\d+(B|KB|MB|GB)$/, 'Max size must be in format like "100MB"')
      .default('100MB')
      .optional(),
    storage: StorageConfigSchema.optional()
  })
  .optional();

export const CcanywhereConfigSchema = z.object({
  repo: RepoConfigSchema,
  urls: UrlsConfigSchema, // Deprecated - kept for backward compatibility
  deployment: DeploymentConfigSchema,
  notifications: NotificationsConfigSchema.optional(),
  build: BuildConfigSchema.optional(),
  test: TestConfigSchema,
  security: SecurityConfigSchema,
  artifacts: ArtifactsConfigSchema,
  storage: StorageConfigSchema // Deprecated - kept for backward compatibility
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
