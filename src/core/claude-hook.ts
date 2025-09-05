/**
 * Claude Code hooks integration for CCanywhere
 * Provides hook handlers that can be injected into Claude Code's hook system
 */

import path from 'path';
import fs from 'fs-extra';
import { Logger } from '../utils/logger.js';
import { ConfigLoader } from '../config/index.js';
import { HtmlDiffGenerator } from './diff-generator.js';
import { NotificationManager } from './notifications/index.js';

export interface ClaudeHookContext {
  workingDir: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface ClaudeHookResult {
  success: boolean;
  message?: string;
  data?: any;
}

/**
 * Claude Code hook handlers
 */
export class ClaudeHooks {
  private static logger = Logger.getInstance();

  /**
   * Pre-commit hook - runs before git commits
   * Generates diff and runs analysis
   */
  static async preCommit(context: ClaudeHookContext): Promise<ClaudeHookResult> {
    try {
      this.logger.info('🔍 Running CCanywhere pre-commit hook');
      
      const configLoader = ConfigLoader.getInstance();
      const config = await configLoader.loadConfig(context.workingDir);
      
      if (!(config as any).hooks?.preCommit) {
        this.logger.debug('Pre-commit hook disabled in configuration');
        return { success: true, message: 'Pre-commit hook disabled' };
      }

      // Generate diff for staged changes
      const diffGenerator = new HtmlDiffGenerator();
      const runtimeContext = {
        config: config,
        revision: 'staged',
        branch: 'current',
        timestamp: Date.now(),
        workDir: context.workingDir,
        artifactsDir: '/tmp/ccanywhere-artifacts',
        logDir: '/tmp/ccanywhere-logs',
        lockFile: '/tmp/ccanywhere-locks/build.lock'
      };
      const diffResult = await diffGenerator.generate('HEAD', '--staged', runtimeContext);

      if (!diffResult.path) {
        this.logger.info('No staged changes to analyze');
        return { success: true, message: 'No staged changes' };
      }

      this.logger.info('📊 Analyzed staged changes');
      
      // Optional: Send notification about commit
      if ((config.notifications as any)?.onCommit && config.notifications) {
        const notificationManager = new NotificationManager(config.notifications);
        await notificationManager.send({
          title: '📝 Pre-commit Analysis',
          extra: 'Analyzed staged changes before commit',
          timestamp: Date.now()
        });
      }

      return {
        success: true,
        message: 'Analyzed staged changes',
        data: { diffResult }
      };

    } catch (error) {
      this.logger.error('Pre-commit hook failed:', error);
      
      // Don't block commits on CCanywhere failures unless configured to do so
      if (process.env.CCANYWHERE_STRICT_HOOKS === 'true') {
        return {
          success: false,
          message: error instanceof Error ? error.message : 'Pre-commit hook failed'
        };
      }

      return {
        success: true,
        message: 'Pre-commit hook failed but allowing commit to proceed'
      };
    }
  }

  /**
   * Post-run hook - runs after Claude Code operations
   * Triggers full CCanywhere pipeline
   */
  static async postRun(context: ClaudeHookContext): Promise<ClaudeHookResult> {
    try {
      this.logger.info('🚀 Running CCanywhere post-run hook');
      
      const configLoader = ConfigLoader.getInstance();
      const config = await configLoader.loadConfig(context.workingDir);
      
      if (!(config as any).hooks?.postRun) {
        this.logger.debug('Post-run hook disabled in configuration');
        return { success: true, message: 'Post-run hook disabled' };
      }

      // Run full CCanywhere pipeline
      const { BuildPipeline } = await import('./pipeline.js');
      const { Logger } = await import('../utils/logger.js');
      const logger = Logger.getInstance();
      
      const pipeline = new BuildPipeline({
        workDir: context.workingDir,
        config: config,
        logger: logger
      });
      
      const result = await pipeline.run(
        config.repo?.branch || 'main',
        'HEAD'
      );

      this.logger.info('✅ CCanywhere pipeline completed successfully');
      
      return {
        success: true,
        message: 'CCanywhere pipeline completed',
        data: result
      };

    } catch (error) {
      this.logger.error('Post-run hook failed:', error);
      
      // Post-run failures shouldn't block Claude Code operations
      return {
        success: true,
        message: 'Post-run hook failed but Claude Code operation succeeded'
      };
    }
  }

  /**
   * Pre-test hook - runs before test execution
   */
  static async preTest(context: ClaudeHookContext): Promise<ClaudeHookResult> {
    try {
      this.logger.info('🧪 Running CCanywhere pre-test hook');
      
      const configLoader = ConfigLoader.getInstance();
      const config = await configLoader.loadConfig(context.workingDir);
      
      if (!(config as any).hooks?.preTest) {
        this.logger.debug('Pre-test hook disabled in configuration');
        return { success: true, message: 'Pre-test hook disabled' };
      }

      // Ensure test environment is ready
      if ((config as any).testing?.playwright) {
        const { execSync } = await import('child_process');
        try {
          execSync('npx playwright install --with-deps', {
            cwd: context.workingDir,
            stdio: 'pipe'
          });
          this.logger.info('📦 Playwright dependencies ensured');
        } catch (error) {
          this.logger.warn('Failed to install Playwright dependencies:', error);
        }
      }

      return {
        success: true,
        message: 'Pre-test setup completed'
      };

    } catch (error) {
      this.logger.error('Pre-test hook failed:', error);
      return {
        success: true,
        message: 'Pre-test hook failed but allowing tests to proceed'
      };
    }
  }

  /**
   * Post-test hook - runs after test execution
   */
  static async postTest(context: ClaudeHookContext): Promise<ClaudeHookResult> {
    try {
      this.logger.info('📊 Running CCanywhere post-test hook');
      
      const configLoader = ConfigLoader.getInstance();
      const config = await configLoader.loadConfig(context.workingDir);
      
      if (!(config as any).hooks?.postTest) {
        this.logger.debug('Post-test hook disabled in configuration');
        return { success: true, message: 'Post-test hook disabled' };
      }

      // Send test completion notification
      if ((config.notifications as any)?.onTestComplete && config.notifications) {
        const notificationManager = new NotificationManager(config.notifications);
        await notificationManager.send({
          title: '🧪 Tests Completed',
          extra: 'Test execution finished via Claude Code',
          timestamp: Date.now()
        });
      }

      return {
        success: true,
        message: 'Post-test processing completed'
      };

    } catch (error) {
      this.logger.error('Post-test hook failed:', error);
      return {
        success: true,
        message: 'Post-test hook failed but test results are unaffected'
      };
    }
  }

  /**
   * Get all available hook handlers
   */
  static getHookHandlers() {
    return {
      preCommit: this.preCommit.bind(this),
      postRun: this.postRun.bind(this),
      preTest: this.preTest.bind(this),
      postTest: this.postTest.bind(this)
    };
  }

  /**
   * Generate hook configuration for Claude Code
   */
  static generateHookConfig(options: {
    enablePreCommit?: boolean;
    enablePostRun?: boolean;
    enablePreTest?: boolean;
    enablePostTest?: boolean;
  } = {}) {
    const {
      enablePreCommit = true,
      enablePostRun = true,
      enablePreTest = false,
      enablePostTest = false
    } = options;

    const hooks: Record<string, any> = {};

    if (enablePreCommit) {
      hooks.preCommit = {
        name: 'CCanywhere Pre-commit Analysis',
        handler: 'ccanywhere/hooks',
        method: 'preCommit',
        async: true,
        failOnError: false
      };
    }

    if (enablePostRun) {
      hooks.postRun = {
        name: 'CCanywhere Pipeline',
        handler: 'ccanywhere/hooks',
        method: 'postRun',
        async: true,
        failOnError: false
      };
    }

    if (enablePreTest) {
      hooks.preTest = {
        name: 'CCanywhere Pre-test Setup',
        handler: 'ccanywhere/hooks',
        method: 'preTest',
        async: true,
        failOnError: false
      };
    }

    if (enablePostTest) {
      hooks.postTest = {
        name: 'CCanywhere Post-test Processing',
        handler: 'ccanywhere/hooks',
        method: 'postTest',
        async: true,
        failOnError: false
      };
    }

    return hooks;
  }
}

export default ClaudeHooks;