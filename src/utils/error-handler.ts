/**
 * Comprehensive error handling and user feedback utilities
 * Provides consistent error handling across the Claude Code integration
 */

import chalkModule from 'chalk';
const chalk = chalkModule;
import { Logger } from './logger.js';

export interface ErrorContext {
  operation: string;
  component?: string;
  userId?: string;
  timestamp?: Date;
  metadata?: Record<string, any>;
}

export interface UserFeedback {
  level: 'error' | 'warning' | 'info' | 'success';
  title: string;
  message: string;
  details?: string[];
  suggestions?: string[];
  helpUrl?: string;
}

export class ClaudeCodeError extends Error {
  public readonly code: string;
  public readonly context?: ErrorContext;
  public readonly originalError?: Error;
  public readonly recoverable: boolean;

  constructor(message: string, code: string, context?: ErrorContext, originalError?: Error, recoverable = false) {
    super(message);
    this.name = 'ClaudeCodeError';
    this.code = code;
    this.context = context;
    this.originalError = originalError;
    this.recoverable = recoverable;

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ClaudeCodeError);
    }
  }
}

/**
 * Enhanced error handler for Claude Code integration operations
 */
export class ErrorHandler {
  private static logger = Logger.getInstance();

  /**
   * Handle errors with comprehensive logging and user feedback
   */
  static async handleError(
    error: Error | ClaudeCodeError,
    context: ErrorContext,
    provideFeedback = true
  ): Promise<UserFeedback> {
    const timestamp = new Date();
    const errorId = this.generateErrorId();

    // Log the error with full context
    this.logger.error(`[${errorId}] ${context.operation} failed:`, {
      error: error.message,
      stack: error.stack,
      context,
      timestamp
    });

    // Determine error category and create appropriate feedback
    const feedback = this.categorizeError(error, context, errorId);

    // Provide user feedback if requested
    if (provideFeedback) {
      this.displayFeedback(feedback);
    }

    // Log recovery suggestions if available
    if (feedback.suggestions && feedback.suggestions.length > 0) {
      this.logger.info(`[${errorId}] Recovery suggestions:`, feedback.suggestions);
    }

    return feedback;
  }

  /**
   * Categorize error and generate appropriate user feedback
   */
  private static categorizeError(error: Error | ClaudeCodeError, context: ErrorContext, errorId: string): UserFeedback {
    // Handle custom ClaudeCodeError
    if (error instanceof ClaudeCodeError) {
      return this.handleClaudeCodeError(error, context, errorId);
    }

    // Handle common error patterns
    if (this.isPermissionError(error)) {
      return this.createPermissionErrorFeedback(error, context, errorId);
    }

    if (this.isNetworkError(error)) {
      return this.createNetworkErrorFeedback(error, context, errorId);
    }

    if (this.isFileSystemError(error)) {
      return this.createFileSystemErrorFeedback(error, context, errorId);
    }

    if (this.isConfigurationError(error)) {
      return this.createConfigurationErrorFeedback(error, context, errorId);
    }

    // Generic error fallback
    return this.createGenericErrorFeedback(error, context, errorId);
  }

  /**
   * Handle ClaudeCodeError instances
   */
  private static handleClaudeCodeError(error: ClaudeCodeError, context: ErrorContext, errorId: string): UserFeedback {
    const baseMessage = error.message;
    const suggestions: string[] = [];

    switch (error.code) {
      case 'CLAUDE_NOT_FOUND':
        suggestions.push(
          'Install Claude Code from the official source',
          'Ensure Claude Code is in your PATH',
          'Check that Claude Code configuration directory exists'
        );
        break;

      case 'HOOKS_INJECTION_FAILED':
        suggestions.push(
          'Check permissions on Claude Code configuration directory',
          'Verify Claude Code hooks configuration format',
          'Try running with --force flag to overwrite existing hooks',
          'Use --backup flag to create a backup before injection'
        );
        break;

      case 'CONFIG_INVALID':
        suggestions.push(
          'Run "ccanywhere init" to create a valid configuration',
          'Check your environment variables for missing or invalid values',
          'Validate your ccanywhere.config.json syntax'
        );
        break;

      case 'PIPELINE_FAILED':
        suggestions.push(
          'Check your git repository is in a clean state',
          'Verify your deployment credentials are correct',
          'Ensure notification channels are properly configured',
          'Run "ccanywhere test" to verify your setup'
        );
        break;

      default:
        suggestions.push(
          'Check the CCanywhere documentation',
          'Run with --verbose for more detailed logging',
          'Report this issue if the problem persists'
        );
    }

    return {
      level: error.recoverable ? 'warning' : 'error',
      title: `${context.operation} Failed`,
      message: baseMessage,
      suggestions,
      helpUrl: 'https://github.com/mylukin/ccanywhere#troubleshooting'
    };
  }

  /**
   * Check if error is permission-related
   */
  private static isPermissionError(error: Error): boolean {
    const permissionPatterns = [
      /permission denied/i,
      /eacces/i,
      /eperm/i,
      /access is denied/i,
      /insufficient privileges/i
    ];

    return permissionPatterns.some(pattern => pattern.test(error.message) || pattern.test(error.name));
  }

  /**
   * Check if error is network-related
   */
  private static isNetworkError(error: Error): boolean {
    const networkPatterns = [
      /enotfound/i,
      /econnrefused/i,
      /econnreset/i,
      /timeout/i,
      /network/i,
      /fetch failed/i,
      /request failed/i
    ];

    return networkPatterns.some(pattern => pattern.test(error.message) || pattern.test(error.name));
  }

  /**
   * Check if error is file system-related
   */
  private static isFileSystemError(error: Error): boolean {
    const fsPatterns = [
      /enoent/i,
      /eisdir/i,
      /enotdir/i,
      /emfile/i,
      /enfile/i,
      /enospc/i,
      /file not found/i,
      /directory not found/i
    ];

    return fsPatterns.some(pattern => pattern.test(error.message) || pattern.test(error.name));
  }

  /**
   * Check if error is configuration-related
   */
  private static isConfigurationError(error: Error): boolean {
    const configPatterns = [/config/i, /invalid json/i, /parse error/i, /missing required/i, /validation failed/i];

    return configPatterns.some(pattern => pattern.test(error.message) || pattern.test(error.name));
  }

  /**
   * Create permission error feedback
   */
  private static createPermissionErrorFeedback(error: Error, context: ErrorContext, errorId: string): UserFeedback {
    return {
      level: 'error',
      title: 'Permission Error',
      message: `Permission denied during ${context.operation}`,
      details: [error.message],
      suggestions: [
        'Check file and directory permissions',
        'Try running with appropriate privileges',
        'Ensure you have write access to the target directory',
        'On Unix systems, try using sudo (if appropriate)'
      ]
    };
  }

  /**
   * Create network error feedback
   */
  private static createNetworkErrorFeedback(error: Error, context: ErrorContext, errorId: string): UserFeedback {
    return {
      level: 'error',
      title: 'Network Error',
      message: `Network issue during ${context.operation}`,
      details: [error.message],
      suggestions: [
        'Check your internet connection',
        'Verify proxy settings if applicable',
        'Check if the target service is available',
        'Try again in a few moments'
      ]
    };
  }

  /**
   * Create file system error feedback
   */
  private static createFileSystemErrorFeedback(error: Error, context: ErrorContext, errorId: string): UserFeedback {
    return {
      level: 'error',
      title: 'File System Error',
      message: `File system issue during ${context.operation}`,
      details: [error.message],
      suggestions: [
        'Check if the file or directory exists',
        'Verify you have necessary permissions',
        'Ensure sufficient disk space is available',
        'Check if the path is correct'
      ]
    };
  }

  /**
   * Create configuration error feedback
   */
  private static createConfigurationErrorFeedback(error: Error, context: ErrorContext, errorId: string): UserFeedback {
    return {
      level: 'error',
      title: 'Configuration Error',
      message: `Configuration issue during ${context.operation}`,
      details: [error.message],
      suggestions: [
        'Run "ccanywhere init" to create a valid configuration',
        'Check your configuration file syntax',
        'Verify all required fields are present',
        'Validate your environment variables'
      ]
    };
  }

  /**
   * Create generic error feedback
   */
  private static createGenericErrorFeedback(error: Error, context: ErrorContext, errorId: string): UserFeedback {
    return {
      level: 'error',
      title: 'Unexpected Error',
      message: `An unexpected error occurred during ${context.operation}`,
      details: [error.message, `Error ID: ${errorId}`],
      suggestions: [
        'Try running the command again',
        'Check the logs for more details',
        'Run with --verbose for additional information',
        'Report this issue if it persists'
      ],
      helpUrl: 'https://github.com/mylukin/ccanywhere/issues'
    };
  }

  /**
   * Display user feedback to console
   */
  private static displayFeedback(feedback: UserFeedback): void {
    const levelColors = {
      error: chalk.red,
      warning: chalk.yellow,
      info: chalk.blue,
      success: chalk.green
    };

    const levelIcons = {
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️',
      success: '✅'
    };

    const color = levelColors[feedback.level];
    const icon = levelIcons[feedback.level];

    console.log();
    console.log(color(`${icon} ${feedback.title}`));
    console.log(color(feedback.message));

    if (feedback.details && feedback.details.length > 0) {
      console.log();
      console.log(chalk.gray('Details:'));
      for (const detail of feedback.details) {
        console.log(chalk.gray(`  • ${detail}`));
      }
    }

    if (feedback.suggestions && feedback.suggestions.length > 0) {
      console.log();
      console.log(chalk.cyan('Suggestions:'));
      for (const suggestion of feedback.suggestions) {
        console.log(chalk.cyan(`  • ${suggestion}`));
      }
    }

    if (feedback.helpUrl) {
      console.log();
      console.log(chalk.blue(`For more help: ${feedback.helpUrl}`));
    }

    console.log();
  }

  /**
   * Generate unique error ID for tracking
   */
  private static generateErrorId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    return `${timestamp}-${random}`;
  }

  /**
   * Wrap async operations with error handling
   */
  static async wrapOperation<T>(
    operation: () => Promise<T>,
    context: ErrorContext,
    provideFeedback = true
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      await this.handleError(error instanceof Error ? error : new Error(String(error)), context, provideFeedback);
      throw error;
    }
  }

  /**
   * Create a ClaudeCodeError with proper context
   */
  static createError(
    message: string,
    code: string,
    context?: ErrorContext,
    originalError?: Error,
    recoverable = false
  ): ClaudeCodeError {
    return new ClaudeCodeError(message, code, context, originalError, recoverable);
  }
}

export default ErrorHandler;
