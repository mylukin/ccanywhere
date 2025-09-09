/**
 * Init command - Initialize CCanywhere in a project
 */

import { join } from 'path';
import { homedir } from 'os';
import fsExtra from 'fs-extra';
const { writeFile, pathExists, readFile } = fsExtra;
import inquirerModule from 'inquirer';
const inquirer = inquirerModule;
import chalkModule from 'chalk';
const chalk = chalkModule;
import oraModule from 'ora';
const ora = oraModule;
import { execSync } from 'child_process';
import type { CcanywhereConfig, CliOptions } from '../../types/index.js';
import { detectGitInfo, type GitInfo } from '../../utils/git.js';
import { PackageManager } from '../../utils/package-manager.js';

interface InitOptions extends CliOptions {
  force?: boolean;
  firstRun?: boolean;  // Flag to indicate this is called from first-run check
}

export async function initCommand(options: InitOptions): Promise<void> {
  // Only show header if not called from first-run
  if (!options.firstRun) {
    console.log();
    console.log(chalk.blue('╔════════════════════════════════════════╗'));
    console.log(chalk.blue('║     🚀 CCanywhere Initialization      ║'));
    console.log(chalk.blue('╚════════════════════════════════════════╝'));
    console.log();
  }

  try {
    const workDir = process.cwd();
    const userConfigDir = join(homedir(), '.claude');
    const userConfigPath = join(userConfigDir, 'ccanywhere.config.json');
    const projectConfigPath = join(workDir, 'ccanywhere.config.json');

    // Detect if we're in a git project
    // In first-run mode, we focus on user config regardless of git status
    const gitInfo = await detectGitInfo(workDir);
    const isInGitProject = options.firstRun ? false : !!gitInfo.repoUrl;

    // Ensure user config directory exists
    await fsExtra.ensureDir(userConfigDir);

    // Check if configs exist
    const userConfigExists = await pathExists(userConfigPath);
    const projectConfigExists = await pathExists(projectConfigPath);
    
    // Load existing user config if available
    let existingUserConfig: Partial<CcanywhereConfig> = {};
    if (userConfigExists) {
      try {
        existingUserConfig = await fsExtra.readJson(userConfigPath);
      } catch (error) {
        console.log(chalk.yellow('⚠️  Failed to read user config, will create new one'));
      }
    }
    
    // Only check for project config overwrite if we're in a git project and not first-run
    if (!options.firstRun && isInGitProject && projectConfigExists && !options.force) {
      const { overwrite } = await inquirer.prompt([{
        type: 'confirm',
        name: 'overwrite',
        message: 'Project configuration already exists. Overwrite?',
        default: false
      }]);

      if (!overwrite) {
        console.log(chalk.yellow('Initialization cancelled.'));
        return;
      }
    }

    // Collect configuration based on context
    // In first-run mode, always collect user config
    const { userConfig, projectConfig } = await collectConfiguration(
      options.firstRun || !userConfigExists || options.force,
      isInGitProject,
      gitInfo,
      existingUserConfig
    );

    // Generate files
    const spinner = ora('Generating configuration files...').start();

    // Write user-level configuration if needed
    // Only write if: 1) doesn't exist, 2) force flag, or 3) user chose to reconfigure
    if ((!userConfigExists || options.force) && Object.keys(userConfig).length > 0) {
      await writeFile(userConfigPath, JSON.stringify(userConfig, null, 2));
      spinner.text = 'Generated user configuration in ~/.claude/';
    }
    
    // Write project-level configuration only if in git project
    if (isInGitProject) {
      await writeFile(projectConfigPath, JSON.stringify(projectConfig, null, 2));
      spinner.text = 'Generated project configuration';
    }

    // Only generate project files if in git project
    if (isInGitProject) {
      // Generate example files if needed (when Playwright testing is enabled)
      if (projectConfig.test?.enabled) {
        await generateExampleFiles(workDir, projectConfig.test?.enabled);
        spinner.text = 'Generated example files';
      }

      // Update .gitignore
      await updateGitignore(workDir);
      spinner.text = 'Updated .gitignore';
    }

    spinner.succeed('Configuration files generated successfully!');

    // Create initialization marker
    const markerPath = join(userConfigDir, '.ccanywhere-initialized');
    await writeFile(markerPath, new Date().toISOString(), 'utf8');

    console.log();
    console.log(chalk.green('✅ CCanywhere initialized successfully!'));
    console.log();
    
    if (options.firstRun) {
      // First-run mode - focus on what was configured
      console.log(chalk.blue('Configuration saved:'));
      console.log('  User config: ' + chalk.cyan(userConfigPath));
      console.log();
      console.log(chalk.blue('Next steps:'));
      console.log('1. Navigate to your project: ' + chalk.cyan('cd your-project'));
      console.log('2. Initialize project config: ' + chalk.cyan('ccanywhere init'));
      console.log('3. Test your configuration: ' + chalk.cyan('ccanywhere test'));
      console.log();
      console.log(chalk.gray('📚 Documentation: https://github.com/mylukin/ccanywhere'));
    } else if (isInGitProject) {
      // Full initialization (user + project)
      console.log(chalk.blue('Configuration saved:'));
      if ((!userConfigExists || options.force) && Object.keys(userConfig).length > 0) {
        console.log('  User config: ' + chalk.cyan(userConfigPath));
      } else if (userConfigExists) {
        console.log('  User config: ' + chalk.cyan(userConfigPath) + chalk.gray(' (existing)'));
      }
      console.log('  Project config: ' + chalk.cyan(projectConfigPath));
      console.log();
      console.log(chalk.blue('Next steps:'));
      console.log('1. Test your configuration: ' + chalk.cyan('ccanywhere test'));
      console.log('2. Run your first build: ' + chalk.cyan('ccanywhere run'));
      console.log();
      console.log(chalk.gray('Tips:'));
      if (userConfigExists && existingUserConfig && Object.keys(existingUserConfig).length > 0) {
        console.log(chalk.gray('• Using shared settings from ~/.claude/'));
      } else {
        console.log(chalk.gray('• Shared settings (notifications, storage) are in ~/.claude/'));
      }
      console.log(chalk.gray('• Project-specific settings (repo, test) are in this directory'));
      console.log(chalk.gray('• Use environment variables for sensitive values or temporary overrides'));
    } else {
      // User-only initialization
      console.log(chalk.blue('User configuration saved:'));
      console.log('  ' + chalk.cyan(userConfigPath));
      console.log();
      console.log(chalk.blue('What was configured:'));
      console.log('✓ Storage settings (S3, R2, OSS)');
      console.log('✓ Notification channels (Telegram, DingTalk, etc.)');
      if (userConfig.deployment) {
        console.log('✓ Deployment webhook');
      }
      console.log();
      console.log(chalk.blue('Next steps:'));
      console.log('1. Navigate to a git project: ' + chalk.cyan('cd your-project'));
      console.log('2. Run init again to configure project: ' + chalk.cyan('ccanywhere init'));
      console.log();
      console.log(chalk.gray('Tips:'));
      console.log(chalk.gray('• Your settings are now available for all projects'));
      console.log(chalk.gray('• Each project will have its own repo and test configuration'));
    }
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
    },
    {
      type: 'input',
      name: 'storageFolder',
      message: 'Storage folder path (optional):',
      default: 'diffs'
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

async function collectConfiguration(
  collectUserConfig: boolean = true,
  isInGitProject: boolean = true,
  gitInfo: GitInfo = {},
  existingUserConfig: Partial<CcanywhereConfig> = {}
): Promise<{ userConfig: Partial<CcanywhereConfig>, projectConfig: Partial<CcanywhereConfig> }> {
  console.log(chalk.blue('📝 Configuration setup'));
  console.log();

  // Initialize configs
  let userConfig: Partial<CcanywhereConfig> = {};
  const projectConfig: Partial<CcanywhereConfig> = {};

  // Show context
  if (!isInGitProject) {
    console.log(chalk.yellow('📦 Not in a git project'));
    console.log(chalk.gray('Configuring user-level settings only (shared across all projects)'));
    console.log();
  } else {
    if (gitInfo.repoUrl) {
      console.log(chalk.green('✓ Auto-detected git repository:'));
      console.log(`  URL: ${chalk.cyan(gitInfo.repoUrl)}`);
      console.log(`  Type: ${chalk.cyan(gitInfo.repoKind || 'unknown')}`);
      console.log(`  Branch: ${chalk.cyan(gitInfo.repoBranch || 'unknown')}`);
      console.log();
    }
    
    // Show existing user config if available and we're in a project
    if (existingUserConfig && Object.keys(existingUserConfig).length > 0) {
      console.log(chalk.green('✓ Found existing user configuration:'));
      
      // Display summary of existing config
      if (existingUserConfig.artifacts?.baseUrl) {
        console.log(`  Storage: ${chalk.cyan(existingUserConfig.artifacts.baseUrl)}`);
        if (existingUserConfig.artifacts.storage?.provider) {
          console.log(`  Provider: ${chalk.cyan(existingUserConfig.artifacts.storage.provider.toUpperCase())}`);
        }
      }
      if (existingUserConfig.notifications?.channels) {
        console.log(`  Notifications: ${chalk.cyan(existingUserConfig.notifications.channels.join(', '))}`);
      }
      if (existingUserConfig.deployment) {
        console.log(`  Deployment: ${chalk.cyan('Configured')}`);
      }
      console.log();
      
      // Ask if user wants to use existing config
      const { useExistingConfig } = await inquirer.prompt([{
        type: 'confirm',
        name: 'useExistingConfig',
        message: 'Use existing user configuration for this project?',
        default: true
      }]);
      
      if (useExistingConfig) {
        userConfig = existingUserConfig;
        console.log(chalk.green('✓ Using existing user configuration'));
        console.log();
        // Skip user config collection
        collectUserConfig = false;
      } else {
        console.log(chalk.yellow('Configuring new settings for this project'));
        console.log();
      }
    }
  }

  // Only collect project config if in git project
  if (isInGitProject) {
    // Step 1: Basic repository configuration (PROJECT-LEVEL)
    console.log(chalk.cyan('Step 1: Repository Configuration (Project-specific)'));
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

    // Store repo config in project config
    projectConfig.repo = {
      kind: repoAnswers.repoKind,
      url: repoAnswers.repoUrl,
      branch: repoAnswers.repoBranch
    };
  }

  // Only collect user-level configs if needed
  if (collectUserConfig) {
    // Adjust step numbering based on context
    const stepNumber = isInGitProject ? 2 : 1;
    
    // Storage configuration (USER-LEVEL)
    console.log();
    console.log(chalk.cyan(`Step ${stepNumber}: Storage Configuration (Shared across projects)`));
    const storageAnswers = await collectStorageConfiguration();

    // Notification configuration (USER-LEVEL)
    const notificationStepNumber = isInGitProject ? 3 : 2;
    console.log();
    console.log(chalk.cyan(`Step ${notificationStepNumber}: Notification Configuration (Shared across projects)`));
    
    let notificationAnswers: any = {};
    let channelConfigs: any = {};
    
    // Show channel selection
    console.log(chalk.yellow('📌 Tip: Use SPACE to select/deselect, ENTER to confirm'));
    console.log(chalk.gray('   You can select multiple channels'));
    console.log(chalk.green('   ✓ Telegram is pre-selected (recommended)'));
    console.log();
    
    notificationAnswers = await inquirer.prompt([{
      type: 'checkbox',
      name: 'notificationChannels',
      message: 'Select notification channels:',
      choices: [
        { name: 'Telegram', value: 'telegram', checked: true },  // Default selected
        { name: 'DingTalk', value: 'dingtalk' },
        { name: 'WeCom (Enterprise WeChat)', value: 'wecom' },
        { name: 'Email', value: 'email' }
      ],
      validate: (input: string[]) => {
        if (input.length === 0) {
          return chalk.red('⚠ Please select at least one channel (use SPACE key to select)');
        }
        return true;
      }
    }]);
    
    // Step 3.1: Configure selected notification channels immediately
    if (notificationAnswers.notificationChannels && notificationAnswers.notificationChannels.length > 0) {
      console.log();
      console.log(chalk.blue('📬 Configuring notification channels...'));
      console.log(chalk.gray(`   Selected: ${notificationAnswers.notificationChannels.join(', ')}`));
      console.log();
      
      // Collect configuration for each selected channel
      channelConfigs = await collectChannelConfigurations(notificationAnswers.notificationChannels);
    }

    // Store storage and notification config in user config
    if (storageAnswers.useCloudStorage) {
      const storageConfig: any = {
        provider: storageAnswers.storageProvider,
        folder: storageAnswers.storageFolder || 'diffs'
      };
      
      if (storageAnswers.storageProvider === 's3' && storageAnswers.s3Config) {
        storageConfig.s3 = storageAnswers.s3Config;
      } else if (storageAnswers.storageProvider === 'r2' && storageAnswers.r2Config) {
        storageConfig.r2 = storageAnswers.r2Config;
      } else if (storageAnswers.storageProvider === 'oss' && storageAnswers.ossConfig) {
        storageConfig.oss = storageAnswers.ossConfig;
      }

      userConfig.artifacts = { 
        baseUrl: storageAnswers.artifactsUrl,
        storage: storageConfig
      };
    } else {
      userConfig.artifacts = {
        baseUrl: storageAnswers.artifactsUrl
      };
    }

    userConfig.notifications = {
      channels: notificationAnswers.notificationChannels,
      ...channelConfigs
    };
  }

  // Advanced options - only if in git project or configuring user for deployment
  const advancedStepNumber = isInGitProject ? 4 : 3;
  console.log();
  console.log(chalk.cyan(`Step ${advancedStepNumber}: Advanced Options`));
  
  const advancedQuestions: any[] = [];
  
  // Deployment is always available (can be user or project level)
  advancedQuestions.push(
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
    }
  );
  
  // Playwright testing only if in git project
  if (isInGitProject) {
    advancedQuestions.push({
      type: 'confirm',
      name: 'enablePlaywright',
      message: 'Configure Playwright testing?',
      default: false
    });
  }
  
  const advancedAnswers = await inquirer.prompt(advancedQuestions);

  // Only add project-level configs if in git project
  if (isInGitProject) {
    // Test configuration (PROJECT-LEVEL)
    projectConfig.test = {
      enabled: advancedAnswers.enablePlaywright || false,
      configFile: './playwright.config.ts'
    };

    // Build configuration (PROJECT-LEVEL)
    projectConfig.build = {
      base: 'origin/main',
      lockTimeout: 300,
      cleanupDays: 7
    };
  }

  // Deployment configuration
  if (advancedAnswers.enableDeployment && advancedAnswers.deploymentWebhook) {
    // If not in git project, always put in user config
    // If in git project and collecting user config, put in user config
    // Otherwise put in project config
    if (!isInGitProject || collectUserConfig) {
      userConfig.deployment = advancedAnswers.deploymentWebhook;
    } else {
      projectConfig.deployment = advancedAnswers.deploymentWebhook;
    }
  }

  return { userConfig, projectConfig };
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

  // Check if package.json exists
  const packageJsonPath = join(workDir, 'package.json');
  const hasPackageJson = await pathExists(packageJsonPath);
  
  const spinner = ora();
  
  try {
    // Initialize package.json if it doesn't exist
    if (!hasPackageJson) {
      spinner.start('Initializing package.json...');
      try {
        execSync('npm init -y', { 
          cwd: workDir, 
          stdio: 'pipe',
          encoding: 'utf8' 
        });
        spinner.succeed('Initialized package.json');
      } catch (error) {
        spinner.fail('Failed to initialize package.json');
        console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
        console.log(chalk.yellow('Please run "npm init" manually and re-run this command'));
        return;
      }
    }

    // Install Playwright dependencies
    spinner.start('Installing Playwright dependencies...');
    try {
      // Check if Playwright is already installed
      const packageJson = await PackageManager.readPackageJson(packageJsonPath);
      const hasPlaywright = 
        (packageJson.devDependencies && packageJson.devDependencies['@playwright/test']) ||
        (packageJson.dependencies && packageJson.dependencies['@playwright/test']);
      
      if (!hasPlaywright) {
        // Install Playwright
        execSync('npm install --save-dev @playwright/test', {
          cwd: workDir,
          stdio: 'pipe',
          encoding: 'utf8'
        });
        
        // Install Playwright browsers
        execSync('npx playwright install', {
          cwd: workDir,
          stdio: 'pipe',
          encoding: 'utf8'
        });
        
        spinner.succeed('Installed Playwright dependencies');
      } else {
        spinner.succeed('Playwright is already installed');
      }
    } catch (error) {
      spinner.fail('Failed to install Playwright dependencies');
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
      console.log(chalk.yellow('Please install Playwright manually: npm install --save-dev @playwright/test'));
    }
  } catch (error) {
    if (spinner.isSpinning) {
      spinner.fail('An error occurred');
    }
    console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
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

  // Add Playwright scripts to package.json
  try {
    const packageJson = await PackageManager.readPackageJson(packageJsonPath);
    const scriptsToAdd = [
      {
        name: 'test:e2e',
        command: 'playwright test',
        description: 'Run Playwright E2E tests'
      },
      {
        name: 'test:e2e:ui',
        command: 'playwright test --ui',
        description: 'Run Playwright tests with UI'
      },
      {
        name: 'test:e2e:debug',
        command: 'playwright test --debug',
        description: 'Debug Playwright tests'
      }
    ];
    
    const result = PackageManager.addScripts(packageJson, scriptsToAdd);
    
    if (result.added.length > 0) {
      await PackageManager.writePackageJson(packageJsonPath, packageJson);
      console.log(chalk.green('✓ Added Playwright test scripts to package.json'));
      result.added.forEach(script => {
        console.log(chalk.gray(`  - npm run ${script.name}`));
      });
    }
  } catch (error) {
    console.log(chalk.yellow('Could not add Playwright scripts to package.json'));
  }
}

async function updateGitignore(workDir: string): Promise<void> {
  const gitignorePath = join(workDir, '.gitignore');
  const configPatterns = [
    '# CCanywhere configuration files',
    'ccanywhere.config.js',
    'ccanywhere.config.json',
    '.ccanywhere.json',
    ''
  ];
  
  try {
    let content = '';
    
    // Read existing .gitignore if it exists
    if (await pathExists(gitignorePath)) {
      content = await readFile(gitignorePath, 'utf8');
    }
    
    // Check if ccanywhere config files are already in .gitignore
    const hasConfigFiles = configPatterns.slice(1, -1).some(pattern => 
      content.includes(pattern)
    );
    
    if (!hasConfigFiles) {
      // Add a newline if file exists and doesn't end with one
      if (content && !content.endsWith('\n')) {
        content += '\n';
      }
      
      // Add another newline to separate from existing content
      if (content) {
        content += '\n';
      }
      
      // Add the config patterns
      content += configPatterns.join('\n');
      
      // Write the updated .gitignore
      await writeFile(gitignorePath, content);
    }
  } catch (error) {
    // Log error for debugging but don't fail the init process
    console.log(chalk.yellow('Note: Could not update .gitignore file'));
    console.error('Gitignore update error:', error);
  }
}