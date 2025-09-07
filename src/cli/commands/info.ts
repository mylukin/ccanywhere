/**
 * Info command - Show system and configuration information
 */

import { Command } from 'commander';
import chalkModule from 'chalk';
const chalk = chalkModule;
import { ConfigLoader } from '../../config/index.js';
import { getVersion } from '../../utils/version.js';
import { detectGitInfo } from '../../utils/git.js';
import { FileLockManager } from '../../core/lock-manager.js';
import Table from 'cli-table3';

const infoCommand = new Command('info');

infoCommand
  .description('Show build, system, and configuration information')
  .option('-j, --json', 'Output configuration in JSON format')
  .option('-s, --simple', 'Show simplified information only')
  .option('-f, --file <path>', 'Configuration file path')
  .action(async (options) => {
    try {
      const configLoader = ConfigLoader.getInstance();
      const config = await configLoader.loadConfig(options.file);
      
      // Filter out deprecated fields for display
      const displayConfig = { ...config };
      delete (displayConfig as any).storage;
      if (displayConfig.artifacts?.baseUrl && displayConfig.urls) {
        delete displayConfig.urls;
      }
      
      if (options.json) {
        console.log(JSON.stringify(displayConfig, null, 2));
        return;
      }
      
      // System Information
      if (!options.simple) {
        console.log(chalk.blue.bold('🖥️  System Information'));
        console.log(chalk.gray('='.repeat(60)));
        
        const systemTable = new Table({
          chars: { 'mid': '', 'left-mid': '', 'mid-mid': '', 'right-mid': '' }
        });
        
        systemTable.push(
          ['CCanywhere Version', chalk.green(getVersion())],
          ['Node.js Version', chalk.green(process.version)],
          ['Platform', chalk.green(`${process.platform} (${process.arch})`)],
          ['Working Directory', chalk.green(process.cwd())],
          ['Config Files', chalk.gray('ccanywhere.config.json, ~/.claude/ccanywhere.config.json')]
        );
        
        console.log(systemTable.toString());
        console.log();
      }
      
      // Git Information
      const gitInfo = await detectGitInfo('.');
      if (gitInfo.repoUrl) {
        console.log(chalk.blue.bold('📦 Repository Information'));
        console.log(chalk.gray('='.repeat(60)));
        
        const repoTable = new Table({
          chars: { 'mid': '', 'left-mid': '', 'mid-mid': '', 'right-mid': '' }
        });
        
        repoTable.push(
          ['Repository URL', chalk.green(config.repo?.url || gitInfo.repoUrl || 'Not detected')],
          ['Repository Type', chalk.green(config.repo?.kind || gitInfo.repoKind || 'github')],
          ['Branch', chalk.green(config.repo?.branch || gitInfo.repoBranch || 'main')],
          ['Base Reference', chalk.green(config.build?.base || 'origin/main')]
        );
        
        console.log(repoTable.toString());
        console.log();
      }
      
      // Artifacts & Storage
      if (config.artifacts?.baseUrl || config.artifacts?.storage) {
        console.log(chalk.blue.bold('☁️  Artifacts & Storage'));
        console.log(chalk.gray('='.repeat(60)));
        
        const storageTable = new Table({
          chars: { 'mid': '', 'left-mid': '', 'mid-mid': '', 'right-mid': '' }
        });
        
        if (config.artifacts?.baseUrl) {
          storageTable.push(['Artifacts URL', chalk.green(config.artifacts.baseUrl)]);
        }
        
        if (config.artifacts?.storage) {
          storageTable.push(
            ['Storage Provider', chalk.green(config.artifacts.storage.provider.toUpperCase())],
            ['Storage Folder', chalk.green(config.artifacts.storage.folder || 'diffs')]
          );
          
          // Provider-specific info
          const storage = config.artifacts.storage;
          if (storage.provider === 'r2' && storage.r2) {
            storageTable.push(
              ['R2 Bucket', chalk.green(storage.r2.bucket)],
              ['R2 Account ID', chalk.gray(storage.r2.accountId.substring(0, 8) + '...')],
            );
          } else if (storage.provider === 's3' && storage.s3) {
            storageTable.push(
              ['S3 Bucket', chalk.green(storage.s3.bucket)],
              ['S3 Region', chalk.green(storage.s3.region)]
            );
          } else if (storage.provider === 'oss' && storage.oss) {
            storageTable.push(
              ['OSS Bucket', chalk.green(storage.oss.bucket)],
              ['OSS Region', chalk.green(storage.oss.region)]
            );
          }
        }
        
        console.log(storageTable.toString());
        console.log();
      }
      
      // Notifications
      console.log(chalk.blue.bold('🔔 Notifications'));
      console.log(chalk.gray('='.repeat(60)));
      
      const notifyTable = new Table({
        chars: { 'mid': '', 'left-mid': '', 'mid-mid': '', 'right-mid': '' }
      });
      
      const channels = config.notifications?.channels || [];
      if (channels.length > 0) {
        notifyTable.push(['Enabled Channels', chalk.green(channels.join(', '))]);
        
        channels.forEach(channel => {
          if (channel === 'telegram' && config.notifications?.telegram) {
            notifyTable.push(
              ['Telegram Bot', chalk.green('✅ Configured')],
              ['Telegram Chat ID', chalk.gray(config.notifications.telegram.chatId)]
            );
          } else if (channel === 'dingtalk' && config.notifications?.dingtalk) {
            notifyTable.push(['DingTalk', chalk.green('✅ Configured')]);
          } else if (channel === 'wecom' && config.notifications?.wecom) {
            notifyTable.push(['WeCom', chalk.green('✅ Configured')]);
          } else if (channel === 'email' && config.notifications?.email) {
            notifyTable.push(
              ['Email To', chalk.green(config.notifications.email.to)],
              ['Email From', chalk.green(config.notifications.email.from || 'Default')]
            );
          }
        });
      } else {
        notifyTable.push(['Status', chalk.yellow('No channels configured')]);
      }
      
      console.log(notifyTable.toString());
      console.log();
      
      // Deployment Configuration
      if (config.deployment) {
        console.log(chalk.blue.bold('🚀 Deployment'));
        console.log(chalk.gray('='.repeat(60)));
        
        const deployTable = new Table({
          chars: { 'mid': '', 'left-mid': '', 'mid-mid': '', 'right-mid': '' }
        });
        
        const webhookUrl = typeof config.deployment === 'string' 
          ? config.deployment 
          : config.deployment.webhook;
        
        deployTable.push(['Webhook URL', chalk.green(webhookUrl)]);
        
        console.log(deployTable.toString());
        console.log();
      }
      
      // Build & Test Settings
      console.log(chalk.blue.bold('⚙️  Build & Test Settings'));
      console.log(chalk.gray('='.repeat(60)));
      
      const buildTable = new Table({
        chars: { 'mid': '', 'left-mid': '', 'mid-mid': '', 'right-mid': '' }
      });
      
      buildTable.push(
        ['Lock Timeout', chalk.green(`${config.build?.lockTimeout || 300} seconds`)],
        ['Cleanup Days', chalk.green(`${config.build?.cleanupDays || 7} days`)],
        ['Tests Enabled', config.test?.enabled ? chalk.green('Yes') : chalk.yellow('No')],
        ['Security Mode', config.security?.readOnly ? chalk.yellow('Read-Only') : chalk.green('Full Access')]
      );
      
      console.log(buildTable.toString());
      console.log();
      
      // Lock Status
      if (!options.simple) {
        console.log(chalk.blue.bold('🔒 Lock Status'));
        console.log(chalk.gray('='.repeat(60)));
        
        const lockTable = new Table({
          chars: { 'mid': '', 'left-mid': '', 'mid-mid': '', 'right-mid': '' }
        });
        
        try {
          const lockManager = new FileLockManager();
          const lockFile = '/tmp/ccanywhere-locks/main.lock';
          const isLocked = await lockManager.isLocked(lockFile);
          
          if (isLocked) {
            const lockInfo = await lockManager.getLockInfo(lockFile);
            lockTable.push(
              ['Status', chalk.yellow('🔒 Locked')],
              ['PID', chalk.yellow(lockInfo?.pid || 'Unknown')],
              ['Since', chalk.yellow(lockInfo ? new Date(lockInfo.timestamp).toLocaleString() : 'Unknown')]
            );
            if (lockInfo?.revision) {
              lockTable.push(['Revision', chalk.gray(lockInfo.revision)]);
            }
          } else {
            lockTable.push(['Status', chalk.green('🔓 Unlocked')]);
          }
        } catch (error) {
          lockTable.push(['Status', chalk.gray('Unable to check lock status')]);
        }
        
        console.log(lockTable.toString());
        console.log();
      }
      
      // Configuration Status Summary
      console.log(chalk.blue.bold('📊 Configuration Status'));
      console.log(chalk.gray('='.repeat(60)));
      
      const requiredConfigs = [
        { name: 'Repository', value: config.repo?.url, required: true },
        { name: 'Artifacts URL', value: config.artifacts?.baseUrl, required: true },
        { name: 'Storage Provider', value: config.artifacts?.storage?.provider, required: true },
        { name: 'Notifications', value: channels.length > 0, required: true },
        { name: 'Deployment', value: !!config.deployment, required: false }
      ];
      
      const missing = requiredConfigs.filter(c => c.required && !c.value);
      
      if (missing.length === 0) {
        console.log(chalk.green('✅ All required configurations are set!'));
      } else {
        console.log(chalk.yellow(`⚠️  Missing ${missing.length} required configuration(s):`));
        missing.forEach(m => {
          console.log(chalk.red(`   • ${m.name}`));
        });
        console.log();
        console.log(chalk.gray('Run "ccanywhere init" to set up missing configurations'));
      }
      
    } catch (error) {
      console.error(chalk.red('Error loading information:'));
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

export { infoCommand };