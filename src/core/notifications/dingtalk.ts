/**
 * DingTalk notification channel
 */

import axios, { AxiosError } from 'axios';
import type { CcanywhereConfig } from '../../types/index.js';
import type { ChannelNotifier, NotificationMessage } from './types.js';
import { BuildError } from '../../types/index.js';
import { MessageFormatter } from './formatter.js';

export class DingTalkNotifier implements ChannelNotifier {
  readonly channel = 'dingtalk' as const;
  
  private readonly url: string;

  constructor(url: string) {
    this.url = url;
  }

  async send(message: NotificationMessage): Promise<void> {
    try {
      const formatted = MessageFormatter.format(message, 'markdown');

      const payload = {
        msgtype: 'markdown',
        markdown: {
          title: formatted.title,
          text: formatted.content
        }
      };

      const response = await axios.post(this.url, payload, {
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      // DingTalk returns { "errcode": 0, "errmsg": "ok" } on success
      if (response.data.errcode !== 0) {
        throw new BuildError(`DingTalk API error: ${response.data.errmsg || 'Unknown error'}`);
      }

    } catch (error) {
      if (error instanceof AxiosError) {
        const errorMsg = error.response?.data?.errmsg || error.message;
        throw new BuildError(`Failed to send DingTalk notification: ${errorMsg}`);
      }
      
      if (error instanceof BuildError) {
        throw error;
      }

      throw new BuildError(`Failed to send DingTalk notification: ${error instanceof Error ? error.message : String(error)}`);
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