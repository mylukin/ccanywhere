/**
 * CCanywhere Configuration (JavaScript)
 * 
 * This example shows how to use JavaScript configuration file
 * which allows for dynamic values and environment-specific settings
 */

export default {
  // Repository configuration (Optional - Auto-detected from .git)
  // If your project is a Git repository, this section can be omitted
  // The values below are fallbacks if auto-detection fails
  repo: {
    kind: 'github',
    url: process.env.REPO_URL || 'https://github.com/mylukin/my-project',
    branch: process.env.REPO_BRANCH || 'main'
  },

  // URLs configuration
  urls: {
    artifacts: process.env.ARTIFACTS_URL || 'https://artifacts.example.com'
  },

  // Deployment configuration
  deployment: process.env.DEPLOYMENT_WEBHOOK_URL || 'https://deploy.example.com/api/webhook/deploy',

  // Notification configuration
  notifications: {
    channels: (process.env.NOTIFY_CHANNELS || 'telegram').split(','),
    
    // Telegram
    telegram: {
      botToken: process.env.BOT_TOKEN_TELEGRAM,
      chatId: process.env.CHAT_ID_TELEGRAM
    },
    
    // Email (optional)
    email: process.env.EMAIL_TO ? {
      to: process.env.EMAIL_TO,
      from: process.env.EMAIL_FROM || 'noreply@example.com',
      smtp: process.env.SMTP_HOST ? {
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      } : undefined
    } : undefined,
    
    // DingTalk (optional)
    dingtalk: process.env.DINGTALK_WEBHOOK ? {
      webhook: process.env.DINGTALK_WEBHOOK,
      secret: process.env.DINGTALK_SECRET
    } : undefined,
    
    // WeCom (optional)
    wecom: process.env.WECOM_WEBHOOK ? {
      webhook: process.env.WECOM_WEBHOOK
    } : undefined
  },

  // Build configuration
  build: {
    base: process.env.BASE || 'origin/main',
    lockTimeout: parseInt(process.env.LOCK_TIMEOUT || '300'),
    cleanupDays: parseInt(process.env.CLEANUP_DAYS || '7'),
    excludePaths: (process.env.EXCLUDE_PATHS || '.artifacts').split(',')  // Comma-separated paths to exclude from diff
  },

  // Test configuration
  test: {
    enabled: process.env.TEST_ENABLED !== 'false',
    configFile: process.env.PLAYWRIGHT_CONFIG || './playwright.config.ts'
  },

  // Artifacts configuration
  artifacts: {
    retentionDays: parseInt(process.env.ARTIFACTS_RETENTION_DAYS || '7'),
    maxSize: process.env.ARTIFACTS_MAX_SIZE || '100MB'
  },

  // Environment-specific overrides
  ...(process.env.NODE_ENV === 'production' ? {
    notifications: {
      channels: ['telegram', 'email', 'dingtalk', 'wecom']
    }
  } : {}),

  // Custom hooks (optional)
  hooks: {
    beforeBuild: async (context) => {
      console.log(`Starting build for ${context.revision}`);
    },
    afterBuild: async (context, result) => {
      console.log(`Build ${result.success ? 'succeeded' : 'failed'}`);
    }
  }
};