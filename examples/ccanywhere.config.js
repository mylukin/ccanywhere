/**
 * CCanywhere Configuration (JavaScript)
 * 
 * This example shows how to use JavaScript configuration file
 * which allows for dynamic values and environment-specific settings.
 * 
 * Storage paths will be organized as: {folder}/{project-name}/{filename}
 * Example: diffs/mylukin/my-project/diff-7531080.html
 */

export default {
  // Repository configuration (Optional - Auto-detected from .git)
  // If your project is a Git repository, this section can be omitted
  // The project name is extracted from URL for storage organization
  repo: {
    kind: process.env.REPO_KIND || 'github',
    url: process.env.REPO_URL || 'https://github.com/mylukin/my-project',
    branch: process.env.REPO_BRANCH || 'main'
  },


  // Deployment configuration
  deployment: process.env.DEPLOYMENT_WEBHOOK_URL || 'https://deploy.example.com/api/webhook/deploy',

  // Notification configuration
  notifications: {
    channels: (process.env.NOTIFY_CHANNELS || 'telegram').split(','),
    
    // Telegram
    telegram: {
      botToken: process.env.BOT_TOKEN_TELEGRAM || 'YOUR_BOT_TOKEN',
      chatId: process.env.CHAT_ID_TELEGRAM || 'YOUR_CHAT_ID'
    },
    
    // Email (optional)
    email: {
      to: process.env.EMAIL_TO || 'admin@example.com',
      from: process.env.EMAIL_FROM || 'noreply@example.com',
      smtp: process.env.SMTP_HOST ? {
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER || 'your-email@gmail.com',
          pass: process.env.SMTP_PASS || 'your-app-password'
        }
      } : undefined
    },
    
    // DingTalk (optional)
    dingtalk: process.env.DINGTALK_WEBHOOK || 'https://oapi.dingtalk.com/robot/send?access_token=YOUR_TOKEN',
    
    // WeCom (optional)
    wecom: process.env.WECOM_WEBHOOK || 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=YOUR_KEY'
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
    enabled: process.env.TEST_ENABLED === 'true',  // Default to false, explicitly enable with TEST_ENABLED=true
    configFile: process.env.PLAYWRIGHT_CONFIG || './playwright.config.ts'
  },

  // Artifacts configuration
  artifacts: {
    baseUrl: process.env.ARTIFACTS_BASE_URL || 'https://artifacts.example.com',
    retentionDays: parseInt(process.env.ARTIFACTS_RETENTION_DAYS || '7'),
    maxSize: process.env.ARTIFACTS_MAX_SIZE || '100MB',
    storage: {
      provider: process.env.STORAGE_PROVIDER || 'r2',
      folder: process.env.STORAGE_FOLDER || 'diffs',  // Storage folder path (files organized as: folder/project-name/filename)
      s3: process.env.S3_ACCESS_KEY_ID ? {
        accessKeyId: process.env.S3_ACCESS_KEY_ID || 'YOUR_AWS_ACCESS_KEY_ID',
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || 'YOUR_AWS_SECRET_ACCESS_KEY',
        region: process.env.S3_REGION || 'us-east-1',
        bucket: process.env.S3_BUCKET || 'my-artifacts-bucket'
      } : {
        accessKeyId: 'YOUR_AWS_ACCESS_KEY_ID',
        secretAccessKey: 'YOUR_AWS_SECRET_ACCESS_KEY',
        region: 'us-east-1',
        bucket: 'my-artifacts-bucket'
      },
      r2: process.env.R2_ACCESS_KEY_ID ? {
        accountId: process.env.R2_ACCOUNT_ID || 'YOUR_CLOUDFLARE_ACCOUNT_ID',
        accessKeyId: process.env.R2_ACCESS_KEY_ID || 'YOUR_R2_ACCESS_KEY_ID',
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || 'YOUR_R2_SECRET_ACCESS_KEY',
        bucket: process.env.R2_BUCKET || 'my-r2-bucket'
      } : {
        accountId: 'YOUR_CLOUDFLARE_ACCOUNT_ID',
        accessKeyId: 'YOUR_R2_ACCESS_KEY_ID',
        secretAccessKey: 'YOUR_R2_SECRET_ACCESS_KEY',
        bucket: 'my-r2-bucket'
      },
      oss: process.env.OSS_ACCESS_KEY_ID ? {
        accessKeyId: process.env.OSS_ACCESS_KEY_ID || 'YOUR_ALIYUN_ACCESS_KEY_ID',
        accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET || 'YOUR_ALIYUN_ACCESS_KEY_SECRET',
        region: process.env.OSS_REGION || 'oss-cn-hangzhou',
        bucket: process.env.OSS_BUCKET || 'my-oss-bucket'
      } : {
        accessKeyId: 'YOUR_ALIYUN_ACCESS_KEY_ID',
        accessKeySecret: 'YOUR_ALIYUN_ACCESS_KEY_SECRET',
        region: 'oss-cn-hangzhou',
        bucket: 'my-oss-bucket'
      }
    }
  }
};