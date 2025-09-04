/**
 * JSON audit logging system
 */

import fsExtra from 'fs-extra';
const { appendFile, ensureDir, readFile } = fsExtra;
import { join } from 'path';
import { createWriteStream } from 'fs';
import type { Logger, AuditLogEntry, LogLevel, RuntimeContext } from '../types/index.js';

export interface LoggerConfig {
  logDir: string;
  maxFileSize?: number; // bytes
  maxFiles?: number;
  level?: LogLevel;
  console?: boolean;
}

export class JsonLogger implements Logger {
  private readonly config: Required<LoggerConfig>;
  private readonly logFilePath: string;
  private writeStream?: ReturnType<typeof createWriteStream>;
  private context?: RuntimeContext;

  constructor(config: LoggerConfig) {
    this.config = {
      maxFileSize: config.maxFileSize || 10 * 1024 * 1024, // 10MB
      maxFiles: config.maxFiles || 5,
      level: config.level || 'info',
      console: config.console ?? true,
      logDir: config.logDir
    };

    this.logFilePath = join(this.config.logDir, 'runner.jsonl');
  }

  /**
   * Set runtime context for log entries
   */
  setContext(context: RuntimeContext): void {
    this.context = context;
  }

  /**
   * Log debug message
   */
  debug(message: string, meta?: any): void {
    if (this.shouldLog('debug')) {
      this.writeLog('debug', message, meta);
    }
  }

  /**
   * Log info message
   */
  info(message: string, meta?: any): void {
    if (this.shouldLog('info')) {
      this.writeLog('info', message, meta);
    }
  }

  /**
   * Log warning message
   */
  warn(message: string, meta?: any): void {
    if (this.shouldLog('warn')) {
      this.writeLog('warn', message, meta);
    }
  }

  /**
   * Log error message
   */
  error(message: string, meta?: any): void {
    if (this.shouldLog('error')) {
      this.writeLog('error', message, meta);
    }
  }

  /**
   * Log a step in the build process
   */
  step(step: string, message: string, meta?: any): void {
    this.writeLog('info', message, { ...meta, step });
  }

  /**
   * Log build start
   */
  buildStart(revision: string, branch: string): void {
    this.step('start', 'Starting build process', {
      revision,
      branch,
      timestamp: Date.now()
    });
  }

  /**
   * Log build completion
   */
  buildComplete(success: boolean, duration: number, meta?: any): void {
    const level: LogLevel = success ? 'info' : 'error';
    this.writeLog(level, success ? 'Build completed successfully' : 'Build failed', {
      ...meta,
      step: 'complete',
      success,
      duration
    });
  }

  /**
   * Log build error
   */
  buildError(step: string, error: string | Error, meta?: any): void {
    const errorMessage = error instanceof Error ? error.message : error;
    const errorStack = error instanceof Error ? error.stack : undefined;

    this.writeLog('error', errorMessage, {
      ...meta,
      step,
      error: true,
      stack: errorStack
    });
  }

  /**
   * Write log entry
   */
  private async writeLog(level: LogLevel, message: string, meta?: any): Promise<void> {
    try {
      // Ensure log directory exists
      await ensureDir(this.config.logDir);

      // Check if log rotation is needed
      await this.rotateLogsIfNeeded();

      // Create log entry
      const logEntry: AuditLogEntry = {
        timestamp: Date.now(),
        level,
        step: meta?.step || 'general',
        revision: this.context?.revision || meta?.revision || 'unknown',
        branch: this.context?.branch || meta?.branch || 'unknown',
        message,
        extra: meta ? JSON.stringify(meta) : undefined,
        error: level === 'error' || meta?.error,
        duration: meta?.duration
      };

      // Write to file
      const logLine = JSON.stringify(logEntry) + '\n';
      await appendFile(this.logFilePath, logLine, 'utf8');

      // Console output if enabled
      if (this.config.console) {
        this.logToConsole(level, message, meta);
      }
    } catch (error) {
      // Don't throw on logging errors, just output to console
      console.error('Failed to write log:', error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Log to console with appropriate formatting
   */
  private logToConsole(level: LogLevel, message: string, meta?: any): void {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;

    const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
    const logMessage = `${prefix} ${message}${metaStr}`;

    switch (level) {
      case 'error':
        console.error(logMessage);
        break;
      case 'warn':
        console.warn(logMessage);
        break;
      case 'debug':
        console.debug(logMessage);
        break;
      default:
        console.log(logMessage);
    }
  }

  /**
   * Check if we should log at this level
   */
  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    const currentLevelIndex = levels.indexOf(this.config.level);
    const logLevelIndex = levels.indexOf(level);

    return logLevelIndex >= currentLevelIndex;
  }

  /**
   * Rotate logs if file size exceeds limit
   */
  private async rotateLogsIfNeeded(): Promise<void> {
    try {
      const fs = await import('fs');
      const stats = await fs.promises.stat(this.logFilePath).catch(() => null);

      if (stats && stats.size >= this.config.maxFileSize) {
        await this.rotateLogs();
      }
    } catch (error) {
      // Ignore rotation errors
    }
  }

  /**
   * Rotate log files
   */
  private async rotateLogs(): Promise<void> {
    const fs = await import('fs');

    // Move existing logs
    for (let i = this.config.maxFiles - 1; i > 0; i--) {
      const oldFile = i === 1 ? this.logFilePath : `${this.logFilePath}.${i - 1}`;
      const newFile = `${this.logFilePath}.${i}`;

      try {
        await fs.promises.access(oldFile);
        if (i === this.config.maxFiles) {
          // Delete the oldest file
          await fs.promises.unlink(oldFile);
        } else {
          // Move file
          await fs.promises.rename(oldFile, newFile);
        }
      } catch (error) {
        // File doesn't exist, continue
      }
    }
  }

  /**
   * Get recent log entries
   */
  async getRecentLogs(count: number = 50): Promise<AuditLogEntry[]> {
    try {
      const content = await readFile(this.logFilePath, 'utf8');
      const lines = content.trim().split('\n');
      const entries: AuditLogEntry[] = [];

      // Get last N lines
      const recentLines = lines.slice(-count);

      for (const line of recentLines) {
        try {
          const entry = JSON.parse(line) as AuditLogEntry;
          entries.push(entry);
        } catch (error) {
          // Skip malformed lines
        }
      }

      return entries;
    } catch (error) {
      return [];
    }
  }

  /**
   * Get logs by revision
   */
  async getLogsByRevision(revision: string): Promise<AuditLogEntry[]> {
    try {
      const content = await readFile(this.logFilePath, 'utf8');
      const lines = content.trim().split('\n');
      const entries: AuditLogEntry[] = [];

      for (const line of lines) {
        try {
          const entry = JSON.parse(line) as AuditLogEntry;
          if (entry.revision === revision) {
            entries.push(entry);
          }
        } catch (error) {
          // Skip malformed lines
        }
      }

      return entries;
    } catch (error) {
      return [];
    }
  }

  /**
   * Get logs by time range
   */
  async getLogsByTimeRange(startTime: number, endTime: number): Promise<AuditLogEntry[]> {
    try {
      const content = await readFile(this.logFilePath, 'utf8');
      const lines = content.trim().split('\n');
      const entries: AuditLogEntry[] = [];

      for (const line of lines) {
        try {
          const entry = JSON.parse(line) as AuditLogEntry;
          if (entry.timestamp >= startTime && entry.timestamp <= endTime) {
            entries.push(entry);
          }
        } catch (error) {
          // Skip malformed lines
        }
      }

      return entries;
    } catch (error) {
      return [];
    }
  }

  /**
   * Clean up old log files
   */
  async cleanup(daysToKeep: number = 7): Promise<void> {
    const fs = await import('fs');
    const path = await import('path');

    try {
      const files = await fs.promises.readdir(this.config.logDir);
      const cutoffTime = Date.now() - daysToKeep * 24 * 60 * 60 * 1000;

      for (const file of files) {
        if (file.startsWith('runner.jsonl') && file !== 'runner.jsonl') {
          const filePath = path.join(this.config.logDir, file);
          const stats = await fs.promises.stat(filePath);

          if (stats.mtime.getTime() < cutoffTime) {
            await fs.promises.unlink(filePath);
            console.log(`Removed old log file: ${file}`);
          }
        }
      }
    } catch (error) {
      console.warn(
        `Failed to cleanup logs: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Close the logger and cleanup resources
   */
  async close(): Promise<void> {
    if (this.writeStream) {
      this.writeStream.end();
      this.writeStream = undefined;
    }
  }
}

/**
 * Create a logger instance
 */
export function createLogger(config: LoggerConfig): Logger {
  return new JsonLogger(config);
}
