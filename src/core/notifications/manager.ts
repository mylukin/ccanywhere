/**
 * Notification manager - orchestrates multiple notification channels
 */

import type { 
  NotificationSender, 
  NotificationMessage, 
  NotificationChannel,
  CcanywhereConfig
} from '../../types/index.js';
import { BuildError } from '../../types/index.js';
import type { ChannelNotifier, NotificationResult } from './types.js';
import { TelegramNotifier } from './telegram.js';
import { DingTalkNotifier } from './dingtalk.js';
import { WeComNotifier } from './wecom.js';
import { EmailNotifier } from './email.js';
import { MessageFormatter } from './formatter.js';

export class NotificationManager implements NotificationSender {
  private readonly notifiers: Map<NotificationChannel, ChannelNotifier> = new Map();
  private readonly config: CcanywhereConfig['notifications'];

  constructor(config: CcanywhereConfig['notifications']) {
    if (!config) {
      throw new BuildError('Notifications configuration is required');
    }
    this.config = config;
    this.initializeNotifiers();
  }

  /**
   * Initialize notification channels based on configuration
   */
  private initializeNotifiers(): void {
    if (!this.config?.channels) {
      throw new BuildError('No notification channels configured');
    }
    
    for (const channel of this.config.channels) {
      try {
        switch (channel) {
          case 'telegram':
            if (this.config.telegram) {
              this.notifiers.set('telegram', new TelegramNotifier(this.config.telegram));
            }
            break;
          
          case 'dingtalk':
            if (this.config.dingtalk) {
              this.notifiers.set('dingtalk', new DingTalkNotifier(this.config.dingtalk));
            }
            break;
          
          case 'wecom':
            if (this.config.wecom) {
              this.notifiers.set('wecom', new WeComNotifier(this.config.wecom));
            }
            break;
          
          case 'email':
            if (this.config.email) {
              this.notifiers.set('email', new EmailNotifier(this.config.email));
            }
            break;
          
          default:
            console.warn(`Unknown notification channel: ${channel}`);
        }
      } catch (error) {
        console.warn(`Failed to initialize ${channel} notifier: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    if (this.notifiers.size === 0) {
      throw new BuildError('No notification channels could be initialized');
    }
  }

  /**
   * Send notification to all configured channels
   */
  async send(
    message: NotificationMessage, 
    channels?: NotificationChannel[]
  ): Promise<void> {
    const targetChannels = channels || this.config?.channels || [];
    const results: NotificationResult[] = [];

    // Send to all channels in parallel
    const promises = targetChannels.map(async (channel): Promise<NotificationResult> => {
      const timestamp = Date.now();
      const notifier = this.notifiers.get(channel);

      if (!notifier) {
        return {
          channel,
          success: false,
          error: 'Channel not configured',
          timestamp
        };
      }

      try {
        await notifier.send(message);
        return {
          channel,
          success: true,
          timestamp
        };
      } catch (error) {
        return {
          channel,
          success: false,
          error: error instanceof Error ? error.message : String(error),
          timestamp
        };
      }
    });

    const allResults = await Promise.all(promises);
    results.push(...allResults);

    // Log results
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    console.log(`Notifications sent: ${successful.length} successful, ${failed.length} failed`);

    if (failed.length > 0) {
      failed.forEach(result => {
        console.warn(`${result.channel} notification failed: ${result.error}`);
      });
    }

    // Throw error only if all channels failed
    if (successful.length === 0) {
      const errors = failed.map(r => `${r.channel}: ${r.error}`).join('; ');
      throw new BuildError(`All notification channels failed: ${errors}`);
    }
  }

  /**
   * Send notification to a specific channel
   */
  async sendToChannel(
    channel: NotificationChannel,
    message: NotificationMessage
  ): Promise<void> {
    const notifier = this.notifiers.get(channel);
    
    if (!notifier) {
      throw new BuildError(`Notification channel not configured: ${channel}`);
    }

    await notifier.send(message);
  }

  /**
   * Test all configured notification channels
   */
  async testAllChannels(): Promise<NotificationResult[]> {
    const testMessage: NotificationMessage = {
      title: '🔔 CCanywhere Configuration Test',
      extra: `All notification channels are working correctly!\nTest performed at ${new Date().toISOString()}`,
      timestamp: Date.now(),
      isError: false
    };

    const results: NotificationResult[] = [];

    for (const [channel, notifier] of this.notifiers) {
      const timestamp = Date.now();
      
      try {
        await notifier.send(testMessage);
        results.push({
          channel,
          success: true,
          timestamp
        });
      } catch (error) {
        results.push({
          channel,
          success: false,
          error: error instanceof Error ? error.message : String(error),
          timestamp
        });
      }
    }

    return results;
  }

  /**
   * Test a specific channel
   */
  async testChannel(channel: NotificationChannel): Promise<NotificationResult> {
    const notifier = this.notifiers.get(channel);
    const timestamp = Date.now();
    
    if (!notifier) {
      return {
        channel,
        success: false,
        error: 'Channel not configured',
        timestamp
      };
    }

    const testMessage: NotificationMessage = {
      title: `🔔 ${channel.toUpperCase()} Test from CCanywhere`,
      extra: `Test performed at ${new Date().toISOString()}`,
      timestamp,
      isError: false
    };

    try {
      await notifier.send(testMessage);
      return {
        channel,
        success: true,
        timestamp
      };
    } catch (error) {
      return {
        channel,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp
      };
    }
  }

  /**
   * Get list of configured channels
   */
  getConfiguredChannels(): NotificationChannel[] {
    return Array.from(this.notifiers.keys());
  }

  /**
   * Get list of available but not configured channels
   */
  getUnconfiguredChannels(): NotificationChannel[] {
    const allChannels: NotificationChannel[] = ['telegram', 'dingtalk', 'wecom', 'email'];
    return allChannels.filter(channel => !this.notifiers.has(channel));
  }

  /**
   * Create success notification
   */
  createSuccessNotification(
    revision: string,
    diffUrl?: string,
    previewUrl?: string,
    reportUrl?: string,
    extra?: string
  ): NotificationMessage {
    const emoji = MessageFormatter.getStatusEmoji(false, 'success');
    
    return {
      title: `${emoji} Build Success #${revision.substring(0, 7)}`,
      diffUrl,
      previewUrl,
      reportUrl,
      extra,
      timestamp: Date.now(),
      isError: false
    };
  }

  /**
   * Create error notification
   */
  createErrorNotification(
    revision: string,
    error: string,
    step?: string
  ): NotificationMessage {
    const emoji = MessageFormatter.getStatusEmoji(true, 'error');
    const extra = step ? `Failed at step: ${step}\nError: ${error}` : `Error: ${error}`;
    
    return {
      title: `${emoji} Build Failed #${revision.substring(0, 7)}`,
      extra,
      timestamp: Date.now(),
      isError: true
    };
  }
}