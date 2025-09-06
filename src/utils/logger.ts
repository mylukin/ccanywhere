/**
 * Simple singleton logger utility for Claude Code integration
 */

import { JsonLogger, LoggerConfig } from '../core/logger.js';
import path from 'path';
import os from 'os';

export class Logger {
  private static instance: JsonLogger | null = null;

  /**
   * Get singleton logger instance
   */
  static getInstance(): JsonLogger {
    if (!this.instance) {
      const config: LoggerConfig = {
        logDir: path.join(os.tmpdir(), 'ccanywhere-logs'),
        level: (process.env.LOG_LEVEL as any) || 'info',
        console: true,
        maxFileSize: 5 * 1024 * 1024, // 5MB
        maxFiles: 3
      };

      this.instance = new JsonLogger(config);
    }

    return this.instance;
  }

  /**
   * Set a custom logger instance
   */
  static setInstance(logger: JsonLogger): void {
    this.instance = logger;
  }

  /**
   * Reset the singleton instance
   */
  static async reset(): Promise<void> {
    if (this.instance) {
      await this.instance.close();
      this.instance = null;
    }
  }
}
