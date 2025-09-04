/**
 * Message formatting utilities
 */

import type { NotificationMessage, NotificationFormat, FormattedMessage } from './types.js';

export class MessageFormatter {
  /**
   * Format message for specific output format
   */
  static format(message: NotificationMessage, format: NotificationFormat): FormattedMessage {
    switch (format) {
      case 'markdown':
        return this.formatMarkdown(message);
      case 'html':
        return this.formatHtml(message);
      case 'plain':
      default:
        return this.formatPlain(message);
    }
  }

  /**
   * Format message as plain text
   */
  private static formatPlain(message: NotificationMessage): FormattedMessage {
    let content = `${message.title}\n\n`;

    if (message.diffUrl) {
      content += `View Diff: ${message.diffUrl}\n`;
    }

    if (message.previewUrl) {
      content += `Preview: ${message.previewUrl}\n`;
    }

    if (message.reportUrl) {
      content += `Test Report: ${message.reportUrl}\n`;
    }

    if (message.extra) {
      content += `\n${message.extra}`;
    }

    return {
      title: message.title,
      content,
      format: 'plain'
    };
  }

  /**
   * Format message as Markdown
   */
  private static formatMarkdown(message: NotificationMessage): FormattedMessage {
    let content = `**${message.title}**\n\n`;

    if (message.diffUrl) {
      content += `📝 [View Diff](${message.diffUrl})\n`;
    }

    if (message.previewUrl) {
      content += `🌐 [Preview Site](${message.previewUrl})\n`;
    }

    if (message.reportUrl) {
      content += `📊 [Test Report](${message.reportUrl})\n`;
    }

    if (message.extra) {
      content += `\n${message.extra}`;
    }

    return {
      title: message.title,
      content,
      format: 'markdown'
    };
  }

  /**
   * Format message as HTML
   */
  private static formatHtml(message: NotificationMessage): FormattedMessage {
    let content = `<strong>${this.escapeHtml(message.title)}</strong><br><br>`;

    if (message.diffUrl) {
      content += `📝 <a href="${message.diffUrl}">View Diff</a><br>`;
    }

    if (message.previewUrl) {
      content += `🌐 <a href="${message.previewUrl}">Preview Site</a><br>`;
    }

    if (message.reportUrl) {
      content += `📊 <a href="${message.reportUrl}">Test Report</a><br>`;
    }

    if (message.extra) {
      content += `<br>${this.escapeHtml(message.extra)}`;
    }

    return {
      title: message.title,
      content,
      format: 'html'
    };
  }

  /**
   * Escape HTML entities
   */
  private static escapeHtml(text: string): string {
    const entityMap: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    };

    return text.replace(/[&<>"']/g, (char) => entityMap[char] || char);
  }

  /**
   * Truncate message if too long
   */
  static truncate(content: string, maxLength: number): string {
    if (content.length <= maxLength) {
      return content;
    }

    const suffix = '...';
    return content.substring(0, maxLength - suffix.length) + suffix;
  }

  /**
   * Get emoji for build status
   */
  static getStatusEmoji(isError: boolean, title: string): string {
    if (isError) {
      return '❌';
    }

    if (title.toLowerCase().includes('success')) {
      return '✅';
    }

    if (title.toLowerCase().includes('warning')) {
      return '⚠️';
    }

    if (title.toLowerCase().includes('deploy')) {
      return '🚀';
    }

    if (title.toLowerCase().includes('test')) {
      return '🧪';
    }

    return '🔔';
  }
}