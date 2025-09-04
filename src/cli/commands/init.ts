/**
 * Init command - Initialize CCanywhere in a project
 */

import { join, resolve } from 'path';
import fsExtra from 'fs-extra';
const { writeFile, pathExists, readFile } = fsExtra;
import inquirerModule from 'inquirer';
const inquirer = inquirerModule;
import chalkModule from 'chalk';
const chalk = chalkModule;
import oraModule from 'ora';
const ora = oraModule;
import { getDefaultConfig } from '../../config/index.js';
import type { CcanywhereConfig, CliOptions } from '../../types/index.js';
import { detectGitInfo } from '../../utils/git.js';

interface InitOptions extends CliOptions {
  force?: boolean;
  template?: string;
}

export async function initCommand(options: InitOptions): Promise<void> {
  console.log(chalk.blue('🚀 Initializing CCanywhere...'));
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
        message: 'Choose a template:',
        choices: [
          { name: 'Basic - Simple setup with essential features', value: 'basic' },
          { name: 'Advanced - Full setup with all features', value: 'advanced' }
        ]
      }]);
      template = selectedTemplate;
    }

    // Collect configuration
    const config = await collectConfiguration(template === 'advanced');

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
    if (template === 'advanced') {
      await generateExampleFiles(workDir);
      spinner.text = 'Generated example files';
    }

    spinner.succeed('Configuration files generated successfully!');

    console.log();
    console.log(chalk.green('✅ CCanywhere initialized successfully!'));
    console.log();
    console.log(chalk.blue('Next steps:'));
    console.log('1. Edit the configuration files to match your setup');
    console.log('2. Configure your notification channels in .env');
    console.log('3. Test your configuration: ' + chalk.cyan('ccanywhere test'));
    console.log('4. Run your first build: ' + chalk.cyan('ccanywhere run'));
    console.log();
    console.log(chalk.gray('Documentation: https://github.com/mylukin/ccanywhere#readme'));

  } catch (error) {
    console.error(chalk.red('Error during initialization:'));
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

async function collectConfiguration(advanced: boolean): Promise<CcanywhereConfig> {
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

  const questions: any[] = [
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
    },
    {
      type: 'input',
      name: 'artifactsUrl',
      message: 'Artifacts server URL:',
      validate: (input: string) => input.trim() !== '' || 'Artifacts URL is required'
    },
    {
      type: 'input',
      name: 'stagingUrl',
      message: 'Staging server URL:',
      validate: (input: string) => input.trim() !== '' || 'Staging URL is required'
    }
  ];

  if (advanced) {
    questions.push(
      {
        type: 'confirm',
        name: 'enableDeployment',
        message: 'Enable automatic deployment?',
        default: true
      },
      {
        type: 'input',
        name: 'deploymentWebhook',
        message: 'Deployment webhook URL:',
        when: (answers: any) => answers.enableDeployment,
        validate: (input: string) => input.trim() !== '' || 'Webhook URL is required'
      }
    );
  }

  questions.push({
    type: 'checkbox',
    name: 'notificationChannels',
    message: 'Notification channels:',
    choices: [
      { name: 'Telegram', value: 'telegram' },
      { name: 'DingTalk', value: 'dingtalk' },
      { name: 'WeCom (Enterprise WeChat)', value: 'wecom' },
      { name: 'Email', value: 'email' }
    ],
    validate: (input: string[]) => input.length > 0 || 'At least one notification channel is required'
  });

  const answers = await inquirer.prompt(questions);

  // Build configuration
  const config: CcanywhereConfig = {
    repo: {
      kind: answers.repoKind,
      url: answers.repoUrl,
      branch: answers.repoBranch
    },
    urls: {
      artifacts: answers.artifactsUrl,
      staging: answers.stagingUrl
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

  // Add deployment if enabled
  if (answers.enableDeployment) {
    config.deployment = {
      webhook: answers.deploymentWebhook,
      maxWait: 300,
      pollInterval: 5
    };
  }

  return config;
}

function generateEnvTemplate(config: CcanywhereConfig): string {
  const lines = [
    '# CCanywhere Environment Configuration',
    '# Copy this file and fill in your actual values',
    ''
  ];

  // Repository Configuration (optional)
  if (config.repo) {
    lines.push(
      '# Repository Configuration (Auto-detected from .git if not specified)',
      `REPO_URL=${config.repo.url || ''}`,
      `REPO_KIND=${config.repo.kind || 'github'}`,
      `REPO_BRANCH=${config.repo.branch || 'main'}`,
      ''
    );
  }

  // Server URLs (optional)
  if (config.urls) {
    lines.push(
      '# Server URLs',
      `ARTIFACTS_URL=${config.urls.artifacts || ''}`,
      `STAGING_URL=${config.urls.staging || ''}`,
      ''
    );
  }

  if (config.deployment) {
    lines.push(
      '# Deployment Configuration',
      `DOKPLOY_WEBHOOK_URL=${config.deployment.webhook}`,
      '# DOKPLOY_STATUS_URL=https://dokploy.example.com/api/status',
      ''
    );
  }

  if (config.notifications) {
    lines.push(
      '# Notification Configuration',
      `NOTIFY_CHANNELS=${config.notifications.channels.join(',')}`,
      ''
    );

    if (config.notifications.channels.includes('telegram')) {
    lines.push(
      '# Telegram Configuration',
      'BOT_TOKEN_TELEGRAM=123456789:ABCdefGHIjklMNOpqrsTUVwxyz',
      'CHAT_ID_TELEGRAM=-1001234567890',
      ''
    );
    }

    if (config.notifications.channels.includes('dingtalk')) {
    lines.push(
      '# DingTalk Configuration',
      'DINGTALK_WEBHOOK=https://oapi.dingtalk.com/robot/send?access_token=xxx',
      'DINGTALK_SECRET=SECxxx',
      ''
    );
    }

    if (config.notifications.channels.includes('wecom')) {
    lines.push(
      '# WeCom Configuration',
      'WECOM_WEBHOOK=https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxx',
      ''
    );
    }

    if (config.notifications.channels.includes('email')) {
    lines.push(
      '# Email Configuration',
      'EMAIL_TO=admin@example.com',
      'EMAIL_FROM=noreply@ccanywhere.local',
      '# SMTP_HOST=smtp.gmail.com',
      '# SMTP_PORT=587',
      '# SMTP_USER=your-email@gmail.com',
      '# SMTP_PASS=your-app-password',
      ''
    );
    }
  }

  lines.push(
    '# Build Configuration',
    'BASE=origin/main',
    'LOCK_TIMEOUT=300',
    'CLEANUP_DAYS=7',
    '',
    '# Security (Optional)',
    'READ_ONLY=false',
    'LINK_EXPIRY=3600'
  );

  return lines.join('\n');
}

async function generateExampleFiles(workDir: string): Promise<void> {
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
    baseURL: process.env.STAGING_URL || 'http://localhost:3000',
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