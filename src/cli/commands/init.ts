/**
 * Init command - Initialize CCanywhere in a project
 */

import { join } from 'path';
import fsExtra from 'fs-extra';
const { writeFile, pathExists } = fsExtra;
import inquirerModule from 'inquirer';
const inquirer = inquirerModule;
import chalkModule from 'chalk';
const chalk = chalkModule;
import oraModule from 'ora';
const ora = oraModule;
import type { CcanywhereConfig, CliOptions } from '../../types/index.js';
import { detectGitInfo } from '../../utils/git.js';

interface InitOptions extends CliOptions {
  force?: boolean;
  template?: string;
}

export async function initCommand(options: InitOptions): Promise<void> {
  console.log();
  console.log(chalk.blue('╔════════════════════════════════════════╗'));
  console.log(chalk.blue('║     🚀 CCanywhere Initialization      ║'));
  console.log(chalk.blue('╚════════════════════════════════════════╝'));
  console.log();

  try {
    const workDir = process.cwd();
    const configPath = join(workDir, 'ccanywhere.config.json');
    const envPath = join(workDir, '.env');

    // Check if config already exists
    if (await pathExists(configPath) && !options.force) {
      const { overwrite } = await inquirer.prompt([{
        type: 'confirm',
        name: 'overwrite',
        message: 'Configuration already exists. Overwrite?',
        default: false
      }]);

      if (!overwrite) {
        console.log(chalk.yellow('Initialization cancelled.'));
        return;
      }
    }

    // Get template
    let template = options.template;
    if (!template) {
      const { selectedTemplate } = await inquirer.prompt([{
        type: 'list',
        name: 'selectedTemplate',
        message: 'Choose a setup mode:',
        choices: [
          { name: '⚡ Quick - Recommended settings (Telegram pre-selected)', value: 'quick' },
          { name: '📝 Custom - Choose your own settings', value: 'basic' },
          { name: '🔧 Advanced - Full setup with all features', value: 'advanced' }
        ]
      }]);
      template = selectedTemplate;
    }

    // Collect configuration
    const config = await collectConfiguration(template === 'advanced', template === 'quick');

    // Generate files
    const spinner = ora('Generating configuration files...').start();

    await writeFile(configPath, JSON.stringify(config, null, 2));
    spinner.text = 'Generated ccanywhere.config.json';

    // Generate .env template
    if (!(await pathExists(envPath))) {
      const envContent = generateEnvTemplate(config);
      await writeFile(envPath, envContent);
      spinner.text = 'Generated .env file';
    }

    // Generate example files if needed
    if (template === 'advanced' || config.test?.enabled) {
      await generateExampleFiles(workDir, config.test?.enabled);
      spinner.text = 'Generated example files';
    }

    spinner.succeed('Configuration files generated successfully!');

    console.log();
    console.log(chalk.green('✅ CCanywhere initialized successfully!'));
    console.log();
    console.log(chalk.blue('Next steps:'));
    console.log('1. Review the generated configuration in ' + chalk.cyan('ccanywhere.config.json'));
    console.log('2. Test your configuration: ' + chalk.cyan('ccanywhere test'));
    console.log('3. Run your first build: ' + chalk.cyan('ccanywhere run'));
    console.log();
    console.log(chalk.gray('Tips:'));
    console.log(chalk.gray('• Notification channels are already configured and ready to use'));
    console.log(chalk.gray('• Use .env file only if you need to override specific values'));
    console.log(chalk.gray('• Documentation: https://github.com/mylukin/ccanywhere#readme'));

  } catch (error) {
    console.error(chalk.red('Error during initialization:'));
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

async function collectStorageConfiguration(): Promise<any> {
  const storageChoice = await inquirer.prompt([{
    type: 'list',
    name: 'storageType',
    message: 'How do you want to store build artifacts?',
    choices: [
      { name: 'Cloud Storage (S3, R2, OSS)', value: 'cloud' },
      { name: 'Simple URL (I have my own server)', value: 'simple' }
    ],
    default: 'cloud'  // Set cloud as default
  }]);

  if (storageChoice.storageType === 'simple') {
    const simpleAnswers = await inquirer.prompt([{
      type: 'input',
      name: 'artifactsUrl',
      message: 'Artifacts base URL:',
      validate: (input: string) => {
        if (!input.trim()) return 'Artifacts URL is required';
        try {
          new URL(input);
          return true;
        } catch {
          return 'Please enter a valid URL';
        }
      }
    }]);
    
    return {
      useCloudStorage: false,
      artifactsUrl: simpleAnswers.artifactsUrl
    };
  }

  // Cloud storage configuration
  const providerAnswers = await inquirer.prompt([
    {
      type: 'list',
      name: 'storageProvider',
      message: 'Select cloud storage provider:',
      choices: [
        { name: 'AWS S3', value: 's3' },
        { name: 'Cloudflare R2', value: 'r2' },
        { name: 'Alibaba Cloud OSS', value: 'oss' }
      ]
    },
    {
      type: 'input',
      name: 'storageFolder',
      message: 'Storage folder path (optional):',
      default: 'diffs'
    },
    {
      type: 'input',
      name: 'artifactsUrl',
      message: 'Public artifacts URL (CDN or direct access URL):',
      validate: (input: string) => {
        if (!input.trim()) return 'Artifacts URL is required';
        try {
          new URL(input);
          return true;
        } catch {
          return 'Please enter a valid URL';
        }
      }
    }
  ]);

  let providerConfig: any = {};

  // Collect provider-specific configuration
  switch (providerAnswers.storageProvider) {
    case 's3': {
      console.log(chalk.cyan('\nConfiguring AWS S3:'));
      const s3Answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'accessKeyId',
          message: 'Access Key ID:',
          validate: (input: string) => input.trim() !== '' || 'Access Key ID is required'
        },
        {
          type: 'password',
          name: 'secretAccessKey',
          message: 'Secret Access Key:',
          mask: '*',
          validate: (input: string) => input.trim() !== '' || 'Secret Access Key is required'
        },
        {
          type: 'input',
          name: 'region',
          message: 'Region (e.g., us-east-1):',
          default: 'us-east-1',
          validate: (input: string) => input.trim() !== '' || 'Region is required'
        },
        {
          type: 'input',
          name: 'bucket',
          message: 'Bucket name:',
          validate: (input: string) => input.trim() !== '' || 'Bucket name is required'
        },
        {
          type: 'input',
          name: 'endpoint',
          message: 'Custom endpoint (optional, press Enter to skip):'
        }
      ]);
      
      providerConfig = {
        s3Config: {
          accessKeyId: s3Answers.accessKeyId,
          secretAccessKey: s3Answers.secretAccessKey,
          region: s3Answers.region,
          bucket: s3Answers.bucket,
          ...(s3Answers.endpoint ? { endpoint: s3Answers.endpoint } : {})
        }
      };
      break;
    }
    
    case 'r2': {
      console.log(chalk.cyan('\nConfiguring Cloudflare R2:'));
      const r2Answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'accountId',
          message: 'Account ID:',
          validate: (input: string) => input.trim() !== '' || 'Account ID is required'
        },
        {
          type: 'input',
          name: 'accessKeyId',
          message: 'Access Key ID:',
          validate: (input: string) => input.trim() !== '' || 'Access Key ID is required'
        },
        {
          type: 'password',
          name: 'secretAccessKey',
          message: 'Secret Access Key:',
          mask: '*',
          validate: (input: string) => input.trim() !== '' || 'Secret Access Key is required'
        },
        {
          type: 'input',
          name: 'bucket',
          message: 'Bucket name:',
          validate: (input: string) => input.trim() !== '' || 'Bucket name is required'
        }
      ]);
      
      providerConfig = {
        r2Config: {
          accountId: r2Answers.accountId,
          accessKeyId: r2Answers.accessKeyId,
          secretAccessKey: r2Answers.secretAccessKey,
          bucket: r2Answers.bucket
        }
      };
      break;
    }
    
    case 'oss': {
      console.log(chalk.cyan('\nConfiguring Alibaba Cloud OSS:'));
      const ossAnswers = await inquirer.prompt([
        {
          type: 'input',
          name: 'accessKeyId',
          message: 'Access Key ID:',
          validate: (input: string) => input.trim() !== '' || 'Access Key ID is required'
        },
        {
          type: 'password',
          name: 'accessKeySecret',
          message: 'Access Key Secret:',
          mask: '*',
          validate: (input: string) => input.trim() !== '' || 'Access Key Secret is required'
        },
        {
          type: 'input',
          name: 'region',
          message: 'Region (e.g., oss-cn-hangzhou):',
          default: 'oss-cn-hangzhou',
          validate: (input: string) => input.trim() !== '' || 'Region is required'
        },
        {
          type: 'input',
          name: 'bucket',
          message: 'Bucket name:',
          validate: (input: string) => input.trim() !== '' || 'Bucket name is required'
        },
        {
          type: 'input',
          name: 'endpoint',
          message: 'Custom endpoint (optional, press Enter to skip):'
        }
      ]);
      
      providerConfig = {
        ossConfig: {
          accessKeyId: ossAnswers.accessKeyId,
          accessKeySecret: ossAnswers.accessKeySecret,
          region: ossAnswers.region,
          bucket: ossAnswers.bucket,
          ...(ossAnswers.endpoint ? { endpoint: ossAnswers.endpoint } : {})
        }
      };
      break;
    }
  }

  return {
    useCloudStorage: true,
    storageProvider: providerAnswers.storageProvider,
    storageFolder: providerAnswers.storageFolder,
    artifactsUrl: providerAnswers.artifactsUrl,
    ...providerConfig
  };
}

async function collectChannelConfigurations(channels: string[]): Promise<any> {
  const configs: any = {};
  
  for (const channel of channels) {
    console.log(chalk.cyan(`\nConfiguring ${channel.toUpperCase()}:`));
    
    switch (channel) {
      case 'telegram': {
        const telegramAnswers = await inquirer.prompt([
          {
            type: 'input',
            name: 'botToken',
            message: 'Bot Token (format: 123456789:ABCdefGHIjklMNOpqrsTUVwxyz):',
            validate: (input: string) => {
              if (!input.trim()) return 'Bot token is required';
              if (!/^\d+:[\w-]+$/.test(input)) return 'Invalid bot token format';
              return true;
            }
          },
          {
            type: 'input',
            name: 'chatId',
            message: 'Chat ID (e.g., -1001234567890):',
            validate: (input: string) => input.trim() !== '' || 'Chat ID is required'
          }
        ]);
        
        configs.telegram = {
          botToken: telegramAnswers.botToken,
          chatId: telegramAnswers.chatId
        };
        break;
      }
      
      case 'dingtalk': {
        const dingtalkAnswers = await inquirer.prompt([
          {
            type: 'input',
            name: 'url',
            message: 'DingTalk Webhook URL:',
            validate: (input: string) => {
              if (!input.trim()) return 'Webhook URL is required';
              if (!input.includes('oapi.dingtalk.com/robot/send')) {
                return 'Invalid DingTalk webhook URL format';
              }
              return true;
            }
          }
        ]);
        
        configs.dingtalk = dingtalkAnswers.url;
        break;
      }
      
      case 'wecom': {
        const wecomAnswers = await inquirer.prompt([
          {
            type: 'input',
            name: 'url',
            message: 'WeCom Webhook URL:',
            validate: (input: string) => {
              if (!input.trim()) return 'Webhook URL is required';
              if (!input.includes('qyapi.weixin.qq.com/cgi-bin/webhook/send')) {
                return 'Invalid WeCom webhook URL format';
              }
              return true;
            }
          }
        ]);
        
        configs.wecom = wecomAnswers.url;
        break;
      }
      
      case 'email': {
        const emailAnswers = await inquirer.prompt([
          {
            type: 'input',
            name: 'to',
            message: 'Recipient email:',
            validate: (input: string) => {
              if (!input.trim()) return 'Email address is required';
              const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
              if (!emailRegex.test(input)) return 'Invalid email address';
              return true;
            }
          },
          {
            type: 'input',
            name: 'from',
            message: 'Sender email (optional, press Enter for default):',
            default: 'noreply@ccanywhere.local'
          },
          {
            type: 'confirm',
            name: 'configureSMTP',
            message: 'Configure SMTP settings now?',
            default: false
          }
        ]);
        
        configs.email = {
          to: emailAnswers.to,
          from: emailAnswers.from || 'noreply@ccanywhere.local'
        };
        
        if (emailAnswers.configureSMTP) {
          const smtpAnswers = await inquirer.prompt([
            {
              type: 'input',
              name: 'host',
              message: 'SMTP Host (e.g., smtp.gmail.com):',
              validate: (input: string) => input.trim() !== '' || 'SMTP host is required'
            },
            {
              type: 'number',
              name: 'port',
              message: 'SMTP Port (e.g., 587):',
              default: 587,
              validate: (input: number) => (input > 0 && input <= 65535) || 'Invalid port number'
            },
            {
              type: 'input',
              name: 'user',
              message: 'SMTP User (email address):',
              validate: (input: string) => {
                if (!input.trim()) return 'SMTP user is required';
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(input)) return 'Invalid email address';
                return true;
              }
            },
            {
              type: 'password',
              name: 'pass',
              message: 'SMTP Password:',
              mask: '*',
              validate: (input: string) => input.trim() !== '' || 'SMTP password is required'
            }
          ]);
          
          configs.email.smtp = {
            host: smtpAnswers.host,
            port: smtpAnswers.port,
            user: smtpAnswers.user,
            pass: smtpAnswers.pass
          };
        }
        break;
      }
    }
  }
  
  return configs;
}

async function collectConfiguration(advanced: boolean, quick: boolean = false): Promise<CcanywhereConfig> {
  console.log(chalk.blue('📝 Configuration setup'));
  console.log();

  // Auto-detect git information if available
  const gitInfo = await detectGitInfo(process.cwd());
  
  if (gitInfo.repoUrl) {
    console.log(chalk.green('✓ Auto-detected git repository:'));
    console.log(`  URL: ${chalk.cyan(gitInfo.repoUrl)}`);
    console.log(`  Type: ${chalk.cyan(gitInfo.repoKind || 'unknown')}`);
    console.log(`  Branch: ${chalk.cyan(gitInfo.repoBranch || 'unknown')}`);
    console.log();
  }

  // Step 1: Basic repository configuration
  console.log(chalk.cyan('Step 1: Repository Configuration'));
  const repoAnswers = await inquirer.prompt([
    {
      type: 'input',
      name: 'repoUrl',
      message: 'Repository URL:',
      default: gitInfo.repoUrl,
      validate: (input: string) => input.trim() !== '' || 'Repository URL is required'
    },
    {
      type: 'list',
      name: 'repoKind',
      message: 'Repository type:',
      choices: ['github', 'gitlab'],
      default: gitInfo.repoKind || 'github'
    },
    {
      type: 'input',
      name: 'repoBranch',
      message: 'Main branch:',
      default: gitInfo.repoBranch || 'main'
    }
  ]);

  // Step 2: Storage configuration
  console.log();
  console.log(chalk.cyan('Step 2: Storage Configuration'));
  const storageAnswers = await collectStorageConfiguration();

  // Step 3: Notification configuration
  console.log();
  console.log(chalk.cyan('Step 3: Notification Configuration'));
  
  let notificationAnswers: any = {};
  
  if (quick) {
    // In quick mode, use Telegram by default
    console.log(chalk.green('✓ Using Telegram as notification channel (Quick mode)'));
    notificationAnswers.notificationChannels = ['telegram'];
  } else {
    // In custom/advanced mode, let user choose
    console.log(chalk.yellow('📌 Tip: Use SPACE to select/deselect, ENTER to confirm'));
    console.log(chalk.gray('   You can select multiple channels'));
    console.log();
    
    notificationAnswers = await inquirer.prompt([{
      type: 'checkbox',
      name: 'notificationChannels',
      message: 'Select notification channels (use SPACE to select):',
      choices: [
        { name: 'Telegram', value: 'telegram', checked: true },  // Default selection
        { name: 'DingTalk', value: 'dingtalk', checked: false },
        { name: 'WeCom (Enterprise WeChat)', value: 'wecom', checked: false },
        { name: 'Email', value: 'email', checked: false }
      ],
      validate: (input: string[]) => {
        if (input.length === 0) {
          return chalk.red('⚠ Please select at least one channel (use SPACE key to select)');
        }
        return true;
      }
    }]);
  }

  // Step 4: Advanced options (if advanced mode)
  let advancedAnswers: any = {};
  if (advanced) {
    console.log();
    console.log(chalk.cyan('Step 4: Advanced Options'));
    advancedAnswers = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'enableDeployment',
        message: 'Enable automatic deployment?',
        default: false
      },
      {
        type: 'input',
        name: 'deploymentWebhook',
        message: 'Deployment webhook URL:',
        when: (answers: any) => answers.enableDeployment,
        validate: (input: string) => input.trim() !== '' || 'Webhook URL is required'
      },
      {
        type: 'confirm',
        name: 'enablePlaywright',
        message: 'Configure Playwright testing?',
        default: false
      }
    ]);
  }

  // Merge all answers
  const answers = {
    ...repoAnswers,
    ...storageAnswers,
    ...notificationAnswers,
    ...advancedAnswers
  };

  // Build configuration
  const config: CcanywhereConfig = {
    repo: {
      kind: answers.repoKind,
      url: answers.repoUrl,
      branch: answers.repoBranch
    },
    notifications: {
      channels: answers.notificationChannels
    },
    build: {
      base: 'origin/main',
      lockTimeout: 300,
      cleanupDays: 7
    }
  };

  // Add artifacts configuration
  if (answers.useCloudStorage) {
    // Build storage configuration
    const storageConfig: any = {
      provider: answers.storageProvider,
      folder: answers.storageFolder || 'diffs'
    };
    
    // Add provider-specific config
    if (answers.storageProvider === 's3' && answers.s3Config) {
      storageConfig.s3 = answers.s3Config;
    } else if (answers.storageProvider === 'r2' && answers.r2Config) {
      storageConfig.r2 = answers.r2Config;
    } else if (answers.storageProvider === 'oss' && answers.ossConfig) {
      storageConfig.oss = answers.ossConfig;
    }

    // Set artifacts configuration with storage
    config.artifacts = { 
      baseUrl: answers.artifactsUrl,
      storage: storageConfig
    };
  } else {
    // Simple artifacts URL (without cloud storage)
    config.artifacts = {
      baseUrl: answers.artifactsUrl
    };
  }

  // Always include test configuration (disabled by default)
  config.test = {
    enabled: answers.enablePlaywright || false,
    configFile: './playwright.config.ts'
  };

  // Collect channel-specific configurations
  if (answers.notificationChannels && answers.notificationChannels.length > 0) {
    console.log();
    console.log(chalk.blue('📬 Configuring notification channels...'));
    console.log(chalk.gray(`   Selected: ${answers.notificationChannels.join(', ')}`));
    console.log();
    
    // Collect configuration for each selected channel
    const channelConfigs = await collectChannelConfigurations(answers.notificationChannels);
    
    // Merge channel configurations into the main config
    Object.assign(config.notifications!, channelConfigs);
  }

  // Add deployment if enabled
  if (answers.enableDeployment && answers.deploymentWebhook) {
    config.deployment = answers.deploymentWebhook;
  }

  return config;
}

function generateEnvTemplate(config: CcanywhereConfig): string {
  const lines = [
    '# CCanywhere Environment Configuration',
    '# This file can be used to override configuration values from ccanywhere.config.json',
    '# Most configuration is now stored in ccanywhere.config.json',
    ''
  ];

  // Add comments about notification configurations being in config.json
  if (config.notifications && config.notifications.channels.length > 0) {
    lines.push(
      '# ================================================================',
      '# NOTIFICATION CONFIGURATION',
      '# ----------------------------------------------------------------',
      '# Notification channels are configured in ccanywhere.config.json',
      `# Active channels: ${config.notifications.channels.join(', ')}`,
      '# ',
      '# You can override specific values here if needed:',
      ''
    );

    // Add override examples for each configured channel
    if (config.notifications.telegram) {
      lines.push(
        '# Telegram (configured in config.json)',
        '# To override, uncomment and modify:',
        `# BOT_TOKEN_TELEGRAM=${config.notifications.telegram.botToken}`,
        `# CHAT_ID_TELEGRAM=${config.notifications.telegram.chatId}`,
        ''
      );
    }

    if (config.notifications.dingtalk) {
      lines.push(
        '# DingTalk (configured in config.json)',
        '# To override, uncomment and modify:',
        `# DINGTALK_WEBHOOK=${config.notifications.dingtalk}`,
        ''
      );
    }

    if (config.notifications.wecom) {
      lines.push(
        '# WeCom (configured in config.json)',
        '# To override, uncomment and modify:',
        `# WECOM_WEBHOOK=${config.notifications.wecom}`,
        ''
      );
    }

    if (config.notifications.email) {
      lines.push(
        '# Email (configured in config.json)',
        '# To override, uncomment and modify:',
        `# EMAIL_TO=${config.notifications.email.to}`,
        `# EMAIL_FROM=${config.notifications.email.from}`,
        ''
      );
      
      if (config.notifications.email.smtp) {
        lines.push(
          '# SMTP Settings (configured in config.json)',
          `# SMTP_HOST=${config.notifications.email.smtp.host}`,
          `# SMTP_PORT=${config.notifications.email.smtp.port}`,
          `# SMTP_USER=${config.notifications.email.smtp.user}`,
          '# SMTP_PASS=*** (hidden for security)',
          ''
        );
      }
    }
  }

  // Add storage configuration if present in artifacts
  if (config.artifacts?.storage) {
    const storage = config.artifacts.storage;
    lines.push(
      '# ================================================================',
      '# STORAGE CONFIGURATION',
      '# ----------------------------------------------------------------',
      `# Storage provider: ${storage.provider}`,
      '# Storage settings are configured in ccanywhere.config.json',
      '# To override, uncomment and modify:',
      ''
    );

    if (storage.provider === 's3' && storage.s3) {
      lines.push(
        '# AWS S3 Settings (configured in config.json)',
        `# S3_ACCESS_KEY_ID=${storage.s3.accessKeyId}`,
        '# S3_SECRET_ACCESS_KEY=*** (hidden for security)',
        `# S3_REGION=${storage.s3.region}`,
        `# S3_BUCKET=${storage.s3.bucket}`,
        ''
      );
    } else if (storage.provider === 'r2' && storage.r2) {
      lines.push(
        '# Cloudflare R2 Settings (configured in config.json)',
        `# R2_ACCOUNT_ID=${storage.r2.accountId}`,
        `# R2_ACCESS_KEY_ID=${storage.r2.accessKeyId}`,
        '# R2_SECRET_ACCESS_KEY=*** (hidden for security)',
        `# R2_BUCKET=${storage.r2.bucket}`,
        ''
      );
    } else if (storage.provider === 'oss' && storage.oss) {
      lines.push(
        '# Alibaba OSS Settings (configured in config.json)',
        `# OSS_ACCESS_KEY_ID=${storage.oss.accessKeyId}`,
        '# OSS_ACCESS_KEY_SECRET=*** (hidden for security)',
        `# OSS_REGION=${storage.oss.region}`,
        `# OSS_BUCKET=${storage.oss.bucket}`,
        ''
      );
    }
  }

  // Optional overrides section
  lines.push(
    '# ================================================================',
    '# OPTIONAL OVERRIDES',
    '# ----------------------------------------------------------------',
    '# Uncomment and modify any of these to override config.json values:',
    '',
    '# Repository Configuration',
    '# REPO_URL=https://github.com/user/repo',
    '# REPO_KIND=github',
    '# REPO_BRANCH=main',
    '',
    '# Artifacts Configuration',
    `# ARTIFACTS_BASE_URL=${config.artifacts?.baseUrl || 'https://your-artifacts-url.com'}`,
    '# ARTIFACTS_RETENTION_DAYS=7',
    '# ARTIFACTS_MAX_SIZE=100MB',
    '',
    '# Deployment',
    '# DEPLOYMENT_WEBHOOK_URL=https://your-deployment-webhook.com',
    '',
    '# Build Configuration',
    '# BASE=origin/main',
    '# LOCK_TIMEOUT=300',
    '# CLEANUP_DAYS=7',
    '',
    '# Security',
    '# READ_ONLY=false',
    '# LINK_EXPIRY=3600',
    '',
    '# Logging',
    '# LOG_LEVEL=info'
  );

  return lines.join('\n');
}

async function generateExampleFiles(workDir: string, includePlaywright: boolean = true): Promise<void> {
  if (!includePlaywright) {
    return;
  }
  // Generate example playwright config
  const playwrightConfig = `import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { outputFolder: 'playwright-report' }]],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: process.env.CI ? undefined : {
    command: 'npm start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});`;

  const playwrightPath = join(workDir, 'playwright.config.ts');
  if (!(await pathExists(playwrightPath))) {
    await writeFile(playwrightPath, playwrightConfig);
  }

  // Generate example test
  const testDir = join(workDir, 'tests');
  const testPath = join(testDir, 'example.spec.ts');
  if (!(await pathExists(testPath))) {
    const testContent = `import { test, expect } from '@playwright/test';

test('homepage loads correctly', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Home/);
});

test('navigation works', async ({ page }) => {
  await page.goto('/');
  // Add your specific navigation tests here
});`;

    await fsExtra.ensureDir(testDir);
    await writeFile(testPath, testContent);
  }
}