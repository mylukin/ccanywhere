/**
 * Notify command - Send test notifications
 */

import chalkModule from 'chalk';
const chalk = chalkModule;
import { ConfigLoader } from '../../config/index.js';
import { NotificationManager } from '../../core/notifications/manager.js';
import type { NotificationChannel, CliOptions } from '../../types/index.js';

interface NotifyOptions extends CliOptions {
  channels?: string;
  title?: string;
  message?: string;
}

export async function notifyCommand(options: NotifyOptions): Promise<void> {
  try {
    const configLoader = ConfigLoader.getInstance();
    const config = await configLoader.loadConfig(options.config);
    
    if (!config.notifications) {
      throw new Error('Notifications configuration is not defined');
    }
    
    const notificationManager = new NotificationManager(config.notifications);
    
    // Parse channels
    let channels: NotificationChannel[] | undefined;
    if (options.channels) {
      channels = options.channels.split(',').map(c => c.trim()) as NotificationChannel[];
    }
    
    // Create test message
    const message = {
      title: options.title || '🔔 Test from CCanywhere',
      extra: options.message || `Test notification sent at ${new Date().toISOString()}`,
      timestamp: Date.now(),
      isError: false
    };
    
    console.log(chalk.blue('📬 Sending test notification...'));
    
    if (channels) {
      console.log(chalk.gray(`Channels: ${channels.join(', ')}`));
    } else {
      console.log(chalk.gray(`Channels: ${config.notifications?.channels?.join(', ') || 'none'}`));
    }
    
    await notificationManager.send(message, channels);
    
    console.log(chalk.green('✅ Notification sent successfully!'));
    
  } catch (error) {
    console.error(chalk.red('Failed to send notification:'));
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}