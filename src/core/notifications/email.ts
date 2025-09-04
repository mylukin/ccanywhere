/**
 * Email notification channel
 */

import { createTransport } from 'nodemailer';
import { execa } from 'execa';
import type { CcanywhereConfig } from '../../types/index.js';
import type { ChannelNotifier, NotificationMessage } from './types.js';
import { BuildError } from '../../types/index.js';
import { MessageFormatter } from './formatter.js';

export class EmailNotifier implements ChannelNotifier {
  readonly channel = 'email' as const;
  
  private readonly config: NonNullable<NonNullable<CcanywhereConfig['notifications']>['email']>;

  constructor(config: NonNullable<NonNullable<CcanywhereConfig['notifications']>['email']>) {
    this.config = config;
  }

  async send(message: NotificationMessage): Promise<void> {
    if (this.config.smtp) {
      await this.sendViaSmtp(message);
    } else {
      await this.sendViaLocalMail(message);
    }
  }

  /**
   * Send email via SMTP
   */
  private async sendViaSmtp(message: NotificationMessage): Promise<void> {
    try {
      const formatted = MessageFormatter.format(message, 'html');
      const transporter = createTransport({
        host: this.config.smtp!.host,
        port: this.config.smtp!.port,
        secure: this.config.smtp!.port === 465,
        auth: {
          user: this.config.smtp!.user,
          pass: this.config.smtp!.pass
        }
      });

      await transporter.sendMail({
        from: this.config.from || this.config.smtp!.user,
        to: this.config.to,
        subject: formatted.title,
        html: formatted.content,
        text: MessageFormatter.format(message, 'plain').content
      });

    } catch (error) {
      throw new BuildError(`Failed to send SMTP email: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Send email via local mail command
   */
  private async sendViaLocalMail(message: NotificationMessage): Promise<void> {
    try {
      const formatted = MessageFormatter.format(message, 'html');
      
      // Try 'mail' command first
      try {
        await execa('mail', [
          '-a', 'Content-Type: text/html',
          '-s', formatted.title,
          this.config.to
        ], {
          input: formatted.content,
          timeout: 30000
        });
        return;
      } catch (mailError) {
        // Fall back to sendmail
        await this.sendViaSendmail(message);
      }

    } catch (error) {
      throw new BuildError(`Failed to send email: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Send email via sendmail command
   */
  private async sendViaSendmail(message: NotificationMessage): Promise<void> {
    try {
      const formatted = MessageFormatter.format(message, 'html');
      const from = this.config.from || 'noreply@ccanywhere.local';
      
      const emailContent = [
        `To: ${this.config.to}`,
        `From: ${from}`,
        `Subject: ${formatted.title}`,
        'Content-Type: text/html; charset=utf-8',
        '',
        formatted.content
      ].join('\n');

      await execa('sendmail', [this.config.to], {
        input: emailContent,
        timeout: 30000
      });

    } catch (error) {
      throw new BuildError(`Failed to send email via sendmail: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Test email configuration
   */
  async test(): Promise<boolean> {
    try {
      await this.sendTest();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Send a test email
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
   * Check if local mail commands are available
   */
  static async isLocalMailAvailable(): Promise<{ mail: boolean; sendmail: boolean }> {
    const checkCommand = async (cmd: string): Promise<boolean> => {
      try {
        await execa('which', [cmd]);
        return true;
      } catch (error) {
        return false;
      }
    };

    const [mail, sendmail] = await Promise.all([
      checkCommand('mail'),
      checkCommand('sendmail')
    ]);

    return { mail, sendmail };
  }
}