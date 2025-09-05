/**
 * Config command - Configuration management
 */

import { Command } from 'commander';
import { join } from 'path';
import fsExtra from 'fs-extra';
const { readFile, writeFile, pathExists } = fsExtra;
import chalkModule from 'chalk';
const chalk = chalkModule;
import { ConfigLoader, validateConfig } from '../../config/index.js';

const configCommand = new Command('config');

configCommand
  .command('show')
  .description('Show current configuration')
  .option('-f, --file <path>', 'Configuration file path')
  .action(async (options) => {
    try {
      const configLoader = ConfigLoader.getInstance();
      const config = await configLoader.loadConfig(options.file);
      
      console.log(chalk.blue('Current Configuration:'));
      console.log(JSON.stringify(config, null, 2));
      
    } catch (error) {
      console.error(chalk.red('Error loading configuration:'));
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

configCommand
  .command('validate')
  .description('Validate configuration file')
  .option('-f, --file <path>', 'Configuration file path')
  .action(async (options) => {
    try {
      const configPath = options.file || 'ccanywhere.config.json';
      
      if (!(await pathExists(configPath))) {
        console.error(chalk.red(`Configuration file not found: ${configPath}`));
        process.exit(1);
      }
      
      const content = await readFile(configPath, 'utf8');
      const configData = JSON.parse(content);
      
      // Validate the configuration
      validateConfig(configData);
      
      console.log(chalk.green('✅ Configuration is valid'));
      
    } catch (error) {
      console.error(chalk.red('❌ Configuration validation failed:'));
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

configCommand
  .command('edit')
  .description('Edit configuration file')
  .option('-f, --file <path>', 'Configuration file path', 'ccanywhere.config.json')
  .action(async (options) => {
    const editor = process.env.EDITOR || 'nano';
    const configPath = options.file;
    
    try {
      const { spawn } = await import('child_process');
      
      const child = spawn(editor, [configPath], {
        stdio: 'inherit'
      });
      
      child.on('exit', (code) => {
        if (code === 0) {
          console.log(chalk.green('Configuration file updated'));
        } else {
          console.log(chalk.yellow('Editor exited with code:', code));
        }
      });
      
    } catch (error) {
      console.error(chalk.red('Failed to open editor:'));
      console.error(error instanceof Error ? error.message : String(error));
      console.log(chalk.gray(`Try setting the EDITOR environment variable: export EDITOR=code`));
      process.exit(1);
    }
  });

configCommand
  .command('init-env')
  .description('Initialize .env file from current configuration')
  .option('-f, --force', 'Overwrite existing .env file')
  .action(async (options) => {
    try {
      const envPath = '.env';
      
      if (await pathExists(envPath) && !options.force) {
        console.log(chalk.yellow('.env file already exists. Use --force to overwrite.'));
        return;
      }
      
      const configLoader = ConfigLoader.getInstance();
      const config = await configLoader.loadConfig();
      
      const envContent = generateEnvFromConfig(config);
      await writeFile(envPath, envContent);
      
      console.log(chalk.green('✅ .env file generated successfully'));
      console.log(chalk.gray('Edit the file to add your actual credentials and tokens'));
      
    } catch (error) {
      console.error(chalk.red('Failed to generate .env file:'));
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

function generateEnvFromConfig(config: any): string {
  const lines = [
    '# CCanywhere Environment Configuration',
    '# Generated from current configuration',
    '',
    '# Repository Configuration',
    `REPO_URL=${config.repo.url}`,
    `REPO_KIND=${config.repo.kind}`,
    `REPO_BRANCH=${config.repo.branch}`,
    '',
    '# Artifacts Configuration',
    `ARTIFACTS_BASE_URL=${config.artifacts?.baseUrl || config.urls?.artifacts || ''}`,
    `ARTIFACTS_RETENTION_DAYS=${config.artifacts?.retentionDays || ''}`,
    `ARTIFACTS_MAX_SIZE=${config.artifacts?.maxSize || ''}`,
    ''
  ];
  
  if (config.deployment) {
    lines.push(
      '# Deployment Configuration',
      `DOKPLOY_WEBHOOK_URL=${config.deployment.webhook}`,
      config.deployment.statusUrl ? `DOKPLOY_STATUS_URL=${config.deployment.statusUrl}` : '# DOKPLOY_STATUS_URL=',
      ''
    );
  }
  
  lines.push(
    '# Notification Configuration',
    `NOTIFY_CHANNELS=${config.notifications.channels.join(',')}`,
    ''
  );
  
  if (config.notifications.channels.includes('telegram')) {
    lines.push(
      '# Telegram Configuration',
      'BOT_TOKEN_TELEGRAM=',
      'CHAT_ID_TELEGRAM=',
      ''
    );
  }
  
  if (config.notifications.channels.includes('dingtalk')) {
    lines.push(
      '# DingTalk Configuration',
      'DINGTALK_WEBHOOK=',
      'DINGTALK_SECRET=',
      ''
    );
  }
  
  if (config.notifications.channels.includes('wecom')) {
    lines.push(
      '# WeCom Configuration',
      'WECOM_WEBHOOK=',
      ''
    );
  }
  
  if (config.notifications.channels.includes('email')) {
    lines.push(
      '# Email Configuration',
      'EMAIL_TO=',
      'EMAIL_FROM=',
      ''
    );
  }
  
  return lines.join('\n');
}

export { configCommand };