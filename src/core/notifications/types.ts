/**
 * Notification system types
 */

import type { NotificationChannel } from '../../types/index.js';

export interface NotificationMessage {
  title: string;
  diffUrl?: string;
  previewUrl?: string;
  reportUrl?: string;
  extra?: string;
  timestamp: number;
  isError?: boolean;
}

export type NotificationFormat = 'plain' | 'markdown' | 'html';

export interface ChannelNotifier {
  readonly channel: NotificationChannel;
  send(message: NotificationMessage): Promise<void>;
}

export interface FormattedMessage {
  title: string;
  content: string;
  format: NotificationFormat;
}

export interface NotificationResult {
  channel: NotificationChannel;
  success: boolean;
  error?: string;
  timestamp: number;
}