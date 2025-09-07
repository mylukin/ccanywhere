/**
 * Test command - Test CCanywhere configuration and services
 */

import chalkModule from 'chalk';
const chalk = chalkModule;
import oraModule from 'ora';
const ora = oraModule;
import { ConfigLoader } from '../../config/index.js';
import { NotificationManager } from '../../core/notifications/manager.js';
import { createDeploymentTrigger } from '../../core/deployment-trigger.js';
import { createTestRunner } from '../../core/test-runner.js';
import type { CliOptions } from '../../types/index.js';

interface TestOptions extends CliOptions {
  all?: boolean;
  notifications?: boolean;
  deployment?: boolean;
  tests?: boolean;
  send?: boolean;
  title?: string;
  message?: string;
  channels?: string;
}

export async function testCommand(options: TestOptions): Promise<void> {
  try {
    // Load configuration
    const configLoader = ConfigLoader.getInstance();
    const config = await configLoader.loadConfig(options.config);

    console.log(chalk.blue('🧪 Testing CCanywhere Configuration'));
    console.log();

    let hasErrors = false;

    // Test notifications
    if (options.all || options.notifications || (!options.deployment && !options.tests)) {
      hasErrors = (await testNotifications(config, options)) || hasErrors;
    }

    // Test deployment
    if (options.all || options.deployment) {
      hasErrors = (await testDeployment(config)) || hasErrors;
    }

    // Test Playwright setup
    if (options.all || options.tests) {
      hasErrors = (await testPlaywrightSetup()) || hasErrors;
    }

    console.log();
    if (hasErrors) {
      console.log(chalk.red('❌ Some tests failed. Please check your configuration.'));
      process.exit(1);
    } else {
      console.log(chalk.green('✅ All tests passed! CCanywhere is ready to use.'));
    }

  } catch (error) {
    console.error(chalk.red('Error during testing:'));
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

async function testNotifications(config: any, options: TestOptions): Promise<boolean> {
  const action = options.send ? 'Testing and sending notifications' : 'Testing notification channels';
  console.log(chalk.blue(`📬 ${action}...`));
  
  let hasErrors = false;

  try {
    const notificationManager = new NotificationManager(config.notifications);
    
    if (options.send) {
      // Parse channels if specified
      let channels: any[] | undefined;
      if (options.channels) {
        channels = options.channels.split(',').map(c => c.trim());
      }
      
      // Create test message
      const message = {
        title: options.title || '🔔 Test from CCanywhere',
        extra: options.message || `Test notification sent at ${new Date().toISOString()}`,
        timestamp: Date.now(),
        isError: false
      };
      
      if (channels) {
        console.log(chalk.gray(`  Channels: ${channels.join(', ')}`));
      } else {
        console.log(chalk.gray(`  Channels: ${config.notifications?.channels?.join(', ') || 'none'}`));
      }
      
      // Send notification
      await notificationManager.send(message, channels);
      console.log('  ✅ Test notification sent successfully!');
      
    } else {
      // Just test configuration without sending
      const results = await notificationManager.testAllChannels();

      for (const result of results) {
        const emoji = result.success ? '✅' : '❌';
        const status = result.success ? chalk.green('OK') : chalk.red('FAILED');
        
        console.log(`  ${emoji} ${result.channel}: ${status}`);
        
        if (!result.success) {
          console.log(chalk.gray(`    Error: ${result.error}`));
          hasErrors = true;
        }
      }
    }

  } catch (error) {
    console.log(chalk.red('  ❌ Failed to test notification system'));
    console.log(chalk.gray(`  Error: ${error instanceof Error ? error.message : String(error)}`));
    hasErrors = true;
  }

  return hasErrors;
}

async function testDeployment(config: any): Promise<boolean> {
  console.log(chalk.blue('🚀 Testing deployment configuration...'));
  
  let hasErrors = false;

  try {
    if (!config.deployment?.webhook) {
      console.log(chalk.yellow('  ⏭️  Deployment not configured, skipping'));
      return false;
    }

    // Test webhook URL format
    try {
      new URL(config.deployment.webhook);
      console.log('  ✅ Webhook URL format: OK');
    } catch (error) {
      console.log('  ❌ Webhook URL format: INVALID');
      hasErrors = true;
    }

    // Test status URL format if provided
    if (config.deployment.statusUrl) {
      try {
        new URL(config.deployment.statusUrl);
        console.log('  ✅ Status URL format: OK');
      } catch (error) {
        console.log('  ❌ Status URL format: INVALID');
        hasErrors = true;
      }
    }

    console.log(chalk.gray('  Note: Webhook functionality will be tested during actual builds'));

  } catch (error) {
    console.log(chalk.red('  ❌ Deployment configuration error'));
    console.log(chalk.gray(`  Error: ${error instanceof Error ? error.message : String(error)}`));
    hasErrors = true;
  }

  return hasErrors;
}

async function testPlaywrightSetup(): Promise<boolean> {
  console.log(chalk.blue('🎭 Testing Playwright setup...'));
  
  let hasErrors = false;

  try {
    const testRunner = createTestRunner();
    
    // Check if Playwright config exists
    const fs = await import('fs-extra');
    const path = await import('path');
    
    const configFiles = [
      'playwright.config.js',
      'playwright.config.ts',
      'playwright.config.mjs'
    ];
    
    let configExists = false;
    for (const configFile of configFiles) {
      if (await fs.pathExists(path.join(process.cwd(), configFile))) {
        console.log(`  ✅ Configuration file: ${configFile}`);
        configExists = true;
        break;
      }
    }
    
    if (!configExists) {
      console.log('  ❌ Playwright configuration file not found');
      console.log(chalk.gray('    Expected: playwright.config.js, playwright.config.ts, or playwright.config.mjs'));
      hasErrors = true;
    }

    // Check if Playwright is installed
    try {
      const { execa } = await import('execa');
      await execa('npx', ['playwright', '--version'], { 
        cwd: process.cwd(),
        timeout: 10000
      });
      console.log('  ✅ Playwright installation: OK');
    } catch (error) {
      console.log('  ❌ Playwright installation: NOT FOUND');
      console.log(chalk.gray('    Run: npm install -D @playwright/test'));
      hasErrors = true;
    }

    // Check for test files
    const { glob } = await import('glob');
    const testFiles = await glob('**/*.{spec,test}.{js,ts,mjs}', {
      cwd: process.cwd(),
      ignore: ['node_modules/**', 'dist/**', 'build/**']
    });

    if (testFiles.length > 0) {
      console.log(`  ✅ Test files: ${testFiles.length} found`);
    } else {
      console.log('  ⚠️  No test files found');
      console.log(chalk.gray('    Create test files with .spec.ts or .test.ts extensions'));
    }

  } catch (error) {
    console.log(chalk.red('  ❌ Playwright setup error'));
    console.log(chalk.gray(`  Error: ${error instanceof Error ? error.message : String(error)}`));
    hasErrors = true;
  }

  return hasErrors;
}