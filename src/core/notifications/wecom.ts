/**
 * WeCom (Enterprise WeChat) notification channel
 */

import axios, { AxiosError } from 'axios';
import type { CcanywhereConfig } from '../../types/index.js';
import type { ChannelNotifier, NotificationMessage } from './types.js';
import { BuildError } from '../../types/index.js';
import { MessageFormatter } from './formatter.js';

export class WeComNotifier implements ChannelNotifier {
  readonly channel = 'wecom' as const;
  
  private readonly webhook: string;

  constructor(config: NonNullable<NonNullable<CcanywhereConfig['notifications']>['wecom']>) {
    this.webhook = config.webhook;
  }

  async send(message: NotificationMessage): Promise<void> {
    try {
      const formatted = MessageFormatter.format(message, 'markdown');
      
      const payload = {
        msgtype: 'markdown',
        markdown: {
          content: formatted.content
        }
      };

      const response = await axios.post(this.webhook, payload, {
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      // WeCom returns { "errcode": 0, "errmsg": "ok" } on success
      if (response.data.errcode !== 0) {
        throw new BuildError(`WeCom API error: ${response.data.errmsg || 'Unknown error'}`);
      }

    } catch (error) {
      if (error instanceof AxiosError) {
        const errorMsg = error.response?.data?.errmsg || error.message;
        throw new BuildError(`Failed to send WeCom notification: ${errorMsg}`);
      }
      
      if (error instanceof BuildError) {
        throw error;
      }

      throw new BuildError(`Failed to send WeCom notification: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Send a test message
   */
  async sendTest(): Promise<void> {
    const testMessage: NotificationMessage = {
      title: '🔔 Test Notification from CCanywhere',
      extra: `Sent at ${new Date().toISOString()}`,
      timestamp: Date.now(),
      isError: false
    };

    await this.send(testMessage);
  }

  /**
   * Test the webhook configuration
   */
  async test(): Promise<boolean> {
    try {
      await this.sendTest();
      return true;
    } catch (error) {
      return false;
    }
  }
}