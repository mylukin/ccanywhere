/**
 * Telegram notification channel
 */

import axios, { AxiosError } from 'axios';
import type { CcanywhereConfig } from '../../types/index.js';
import type { ChannelNotifier, NotificationMessage } from './types.js';
import { BuildError } from '../../types/index.js';
import { MessageFormatter } from './formatter.js';

export class TelegramNotifier implements ChannelNotifier {
  readonly channel = 'telegram' as const;
  
  private readonly botToken: string;
  private readonly chatId: string;
  private readonly apiUrl: string;

  constructor(config: NonNullable<NonNullable<CcanywhereConfig['notifications']>['telegram']>) {
    this.botToken = config.botToken;
    this.chatId = config.chatId;
    this.apiUrl = `https://api.telegram.org/bot${this.botToken}`;
  }

  async send(message: NotificationMessage): Promise<void> {
    try {
      const formatted = MessageFormatter.format(message, 'markdown');
      
      const payload = {
        chat_id: this.chatId,
        text: formatted.content,
        parse_mode: 'Markdown',
        disable_web_page_preview: false,
        disable_notification: false
      };

      const response = await axios.post(`${this.apiUrl}/sendMessage`, payload, {
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.data.ok) {
        throw new BuildError(`Telegram API error: ${response.data.description || 'Unknown error'}`);
      }

    } catch (error) {
      if (error instanceof AxiosError) {
        const errorMsg = error.response?.data?.description || error.message;
        throw new BuildError(`Failed to send Telegram notification: ${errorMsg}`);
      }
      
      if (error instanceof BuildError) {
        throw error;
      }

      throw new BuildError(`Failed to send Telegram notification: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Test the Telegram bot configuration
   */
  async test(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.apiUrl}/getMe`, {
        timeout: 10000
      });

      return response.data.ok === true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get bot information
   */
  async getBotInfo(): Promise<any> {
    try {
      const response = await axios.get(`${this.apiUrl}/getMe`, {
        timeout: 10000
      });

      return response.data.result;
    } catch (error) {
      throw new BuildError(`Failed to get bot info: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get chat information
   */
  async getChatInfo(): Promise<any> {
    try {
      const response = await axios.get(`${this.apiUrl}/getChat`, {
        params: { chat_id: this.chatId },
        timeout: 10000
      });

      return response.data.result;
    } catch (error) {
      throw new BuildError(`Failed to get chat info: ${error instanceof Error ? error.message : String(error)}`);
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
}