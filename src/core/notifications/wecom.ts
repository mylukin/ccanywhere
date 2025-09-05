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
    if (!config.webhook || config.webhook.trim() === '') {
      throw new BuildError('WeCom webhook URL is required');
    }
    this.webhook = config.webhook;
  }

  async send(message: NotificationMessage | string): Promise<void> {
    try {
      // Handle both string messages and NotificationMessage objects
      const notificationMessage: NotificationMessage = typeof message === 'string' 
        ? { title: message, timestamp: Date.now() }
        : message;
      
      // For simple string messages, use the string directly for content detection
      const contentForDetection = typeof message === 'string' ? message : notificationMessage.title;
      
      // Detect if message has markdown formatting
      const hasMarkdown = this.hasMarkdownFormatting(contentForDetection);
      const format = hasMarkdown ? 'markdown' : 'plain';
      
      // For simple string messages, use the string directly as content
      const content = typeof message === 'string' 
        ? message 
        : MessageFormatter.format(notificationMessage, format).content;
      
      const payload = hasMarkdown ? {
        msgtype: 'markdown',
        markdown: {
          content: content
        }
      } : {
        msgtype: 'text',
        text: {
          content: content
        }
      };

      const response = await axios.post(this.webhook, payload, {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      // WeCom returns { "errcode": 0, "errmsg": "ok" } on success
      if (response.data.errcode !== 0) {
        const errorMsg = response.data.errmsg || response.data.errcode || 'Unknown error';
        throw new BuildError(`WeCom API error: ${errorMsg}`);
      }

    } catch (error) {
      if (error instanceof AxiosError) {
        const errorMsg = error.response?.data?.errmsg || error.message;
        throw new BuildError(`Failed to send WeCom notification: ${errorMsg}`);
      }
      
      if (error instanceof BuildError) {
        throw error;
      }

      // Handle error objects with message property (like timeout errors)
      let errorMessage: string;
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'object' && error !== null && 'message' in error) {
        errorMessage = String(error.message);
      } else {
        errorMessage = String(error);
      }

      throw new BuildError(`Failed to send WeCom notification: ${errorMessage}`);
    }
  }

  /**
   * Send a test message
   */
  async sendTest(): Promise<void> {
    await this.send('Test message from CCanywhere');
  }

  /**
   * Test the webhook configuration
   */
  async test(): Promise<{ success: boolean; error?: string }> {
    try {
      await this.sendTest();
      return { success: true };
    } catch (error) {
      // Extract just the core error message for test results
      let errorMessage: string;
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'object' && error !== null && 'message' in error) {
        errorMessage = String(error.message);
      } else {
        errorMessage = String(error);
      }
      
      // Remove our wrapper prefixes to get the core error
      errorMessage = errorMessage.replace(/^WeCom API error: /, '');
      errorMessage = errorMessage.replace(/^Failed to send WeCom notification: /, '');
      
      return { 
        success: false, 
        error: errorMessage
      };
    }
  }

  private hasMarkdownFormatting(content: string): boolean {
    // Check for common markdown patterns - be more specific to avoid false positives
    return content.includes('**') ||           // Bold
           content.includes('__') ||           // Bold alternate syntax
           /\*[^*\s][^*]*[^*\s]\*/.test(content) ||  // Italic *text* (not single chars or spaces)
           /_[^_\s][^_]*[^_\s]_/.test(content) ||    // Italic _text_ (not single chars or spaces)
           /^#{1,6}\s/.test(content) ||        // Headers at start of line with space
           content.startsWith('#') ||          // Headers without checking space
           /`[^`]+`/.test(content) ||          // Code (backticks with content)
           /\[[^\]]+\]\([^)]+\)/.test(content) || // Links [text](url)
           /^>\s/.test(content);               // Blockquotes at start of line
  }
}