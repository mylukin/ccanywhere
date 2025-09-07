/**
 * Claude Code hooks integration for CCanywhere
 * Provides hook handlers that can be injected into Claude Code's hook system
 */

import { Logger } from '../utils/logger.js';
import { ConfigLoader } from '../config/index.js';
import { HtmlDiffGenerator } from './diff-generator.js';
import { NotificationManager } from './notifications/index.js';

export interface ClaudeHookContext {
  workingDir: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  data?: any;
}

export interface ClaudeHookResult {
  success: boolean;
  message?: string;
  data?: any;
  block?: boolean; // For PreToolUse hook to block tool execution
}

/**
 * Claude Code hook handlers
 */
export class ClaudeHooks {
  private static logger = Logger.getInstance();

  /**
   * Stop hook - runs when Claude Code finishes responding
   * This is the primary hook used by CCanywhere
   */
  static async Stop(context: ClaudeHookContext): Promise<ClaudeHookResult> {
    try {
      this.logger.info('🔍 Running CCanywhere Stop hook');

      const configLoader = ConfigLoader.getInstance();
      const config = await configLoader.loadConfig(context.workingDir);

      if (!(config as any).hooks?.Stop) {
        this.logger.debug('Stop hook disabled in configuration');
        return { success: true, message: 'Stop hook disabled' };
      }

      // Generate diff for session changes
      const diffGenerator = new HtmlDiffGenerator();
      const runtimeContext = {
        workDir: context.workingDir,
        artifactsDir: '.artifacts',
        timestamp: Date.now(),
        config: config,
        revision: 'HEAD',
        branch: config.repo?.branch || 'main',
        logDir: 'logs',
        lockFile: '.ccanywhere.lock'
      };

      const base = config.build?.base || 'origin/main';
      const head = 'HEAD';

      const artifact = await diffGenerator.generate(base, head, runtimeContext);
      const diffPath = artifact?.url;

      // Send notification if configured
      if (config.notifications?.channels && config.notifications.channels.length > 0) {
        const notificationManager = new NotificationManager(config.notifications);
        await notificationManager.send({
          title: '🛑 Claude Code Session Ended',
          diffUrl: diffPath ? `file://${diffPath}` : undefined,
          extra: 'Session summary generated',
          timestamp: Date.now()
        });
      }

      this.logger.info('✅ Stop hook completed successfully');

      return {
        success: true,
        message: 'Stop hook completed',
        data: { diffPath }
      };
    } catch (error) {
      this.logger.error('Stop hook failed:', error);

      // Hook failures shouldn't block Claude Code operations
      return {
        success: true,
        message: 'Stop hook failed but Claude Code operation succeeded'
      };
    }
  }

  /**
   * PostToolUse hook - runs after tool calls complete
   */
  static async PostToolUse(context: ClaudeHookContext): Promise<ClaudeHookResult> {
    try {
      this.logger.info('🔧 Running CCanywhere PostToolUse hook');

      const configLoader = ConfigLoader.getInstance();
      const config = await configLoader.loadConfig(context.workingDir);

      if (!(config as any).hooks?.PostToolUse) {
        this.logger.debug('PostToolUse hook disabled in configuration');
        return { success: true, message: 'PostToolUse hook disabled' };
      }

      // Log tool usage for audit purposes
      if (context.data?.tool) {
        this.logger.info(`Tool used: ${context.data.tool}`, {
          tool: context.data.tool,
          args: context.data.args,
          timestamp: Date.now()
        });
      }

      return {
        success: true,
        message: 'PostToolUse hook completed'
      };
    } catch (error) {
      this.logger.error('PostToolUse hook failed:', error);
      return {
        success: true,
        message: 'PostToolUse hook failed but operation continues'
      };
    }
  }

  /**
   * PreToolUse hook - runs before tool calls (can block them)
   */
  static async PreToolUse(context: ClaudeHookContext): Promise<ClaudeHookResult> {
    try {
      this.logger.info('🔍 Running CCanywhere PreToolUse hook');

      const configLoader = ConfigLoader.getInstance();
      const config = await configLoader.loadConfig(context.workingDir);

      if (!(config as any).hooks?.PreToolUse) {
        this.logger.debug('PreToolUse hook disabled in configuration');
        return { success: true, message: 'PreToolUse hook disabled' };
      }

      // Example: Block dangerous operations if configured
      if ((config as any).security?.blockDangerousOps && context.data?.tool === 'rm') {
        this.logger.warn('Blocking dangerous operation: rm');
        return {
          success: true,
          message: 'Dangerous operation blocked',
          block: true
        };
      }

      return {
        success: true,
        message: 'PreToolUse hook completed'
      };
    } catch (error) {
      this.logger.error('PreToolUse hook failed:', error);
      return {
        success: true,
        message: 'PreToolUse hook failed but allowing operation'
      };
    }
  }

  /**
   * UserPromptSubmit hook - runs when the user submits a prompt
   */
  static async UserPromptSubmit(context: ClaudeHookContext): Promise<ClaudeHookResult> {
    try {
      this.logger.info('💬 Running CCanywhere UserPromptSubmit hook');

      const configLoader = ConfigLoader.getInstance();
      const config = await configLoader.loadConfig(context.workingDir);

      if (!(config as any).hooks?.UserPromptSubmit) {
        this.logger.debug('UserPromptSubmit hook disabled in configuration');
        return { success: true, message: 'UserPromptSubmit hook disabled' };
      }

      // Log user prompt for audit purposes
      if (context.data?.prompt) {
        this.logger.info('User prompt submitted', {
          promptLength: context.data.prompt.length,
          timestamp: Date.now()
        });
      }

      return {
        success: true,
        message: 'UserPromptSubmit hook completed'
      };
    } catch (error) {
      this.logger.error('UserPromptSubmit hook failed:', error);
      return {
        success: true,
        message: 'UserPromptSubmit hook failed but operation continues'
      };
    }
  }

  /**
   * SessionStart hook - runs when Claude Code starts/resumes a session
   */
  static async SessionStart(context: ClaudeHookContext): Promise<ClaudeHookResult> {
    try {
      this.logger.info('🚀 Running CCanywhere SessionStart hook');

      const configLoader = ConfigLoader.getInstance();
      const config = await configLoader.loadConfig(context.workingDir);

      if (!(config as any).hooks?.SessionStart) {
        this.logger.debug('SessionStart hook disabled in configuration');
        return { success: true, message: 'SessionStart hook disabled' };
      }

      // Send session start notification if configured
      if ((config.notifications as any)?.onSessionStart && config.notifications) {
        const notificationManager = new NotificationManager(config.notifications);
        await notificationManager.send({
          title: '🚀 Claude Code Session Started',
          extra: 'New session initiated',
          timestamp: Date.now()
        });
      }

      return {
        success: true,
        message: 'SessionStart hook completed'
      };
    } catch (error) {
      this.logger.error('SessionStart hook failed:', error);
      return {
        success: true,
        message: 'SessionStart hook failed but session continues'
      };
    }
  }

  /**
   * SessionEnd hook - runs when Claude Code session ends
   */
  static async SessionEnd(context: ClaudeHookContext): Promise<ClaudeHookResult> {
    try {
      this.logger.info('🏁 Running CCanywhere SessionEnd hook');

      const configLoader = ConfigLoader.getInstance();
      const config = await configLoader.loadConfig(context.workingDir);

      if (!(config as any).hooks?.SessionEnd) {
        this.logger.debug('SessionEnd hook disabled in configuration');
        return { success: true, message: 'SessionEnd hook disabled' };
      }

      // Send session end notification if configured
      if ((config.notifications as any)?.onSessionEnd && config.notifications) {
        const notificationManager = new NotificationManager(config.notifications);
        await notificationManager.send({
          title: '🏁 Claude Code Session Ended',
          extra: 'Session concluded',
          timestamp: Date.now()
        });
      }

      return {
        success: true,
        message: 'SessionEnd hook completed'
      };
    } catch (error) {
      this.logger.error('SessionEnd hook failed:', error);
      return {
        success: true,
        message: 'SessionEnd hook failed'
      };
    }
  }

  /**
   * Get all available hook handlers
   */
  static getHookHandlers() {
    return {
      Stop: this.Stop.bind(this),
      PostToolUse: this.PostToolUse.bind(this),
      PreToolUse: this.PreToolUse.bind(this),
      UserPromptSubmit: this.UserPromptSubmit.bind(this),
      SessionStart: this.SessionStart.bind(this),
      SessionEnd: this.SessionEnd.bind(this)
    };
  }

  /**
   * Generate hook configuration for Claude Code
   */
  static generateHookConfig(
    options: {
      enableStop?: boolean;
      enablePostToolUse?: boolean;
      enablePreToolUse?: boolean;
      enableUserPromptSubmit?: boolean;
      enableSessionStart?: boolean;
      enableSessionEnd?: boolean;
    } = {}
  ) {
    const {
      enableStop = true,
      enablePostToolUse = false,
      enablePreToolUse = false,
      enableUserPromptSubmit = false,
      enableSessionStart = false,
      enableSessionEnd = false
    } = options;

    const hooks: Record<string, any> = {};

    if (enableStop) {
      hooks.Stop = {
        handler: 'ccanywhere/hooks',
        name: 'CCanywhere Session Summary',
        method: 'Stop',
        description: 'Generate diff and send notification when session ends'
      };
    }

    if (enablePostToolUse) {
      hooks.PostToolUse = {
        handler: 'ccanywhere/hooks',
        name: 'CCanywhere Tool Logger',
        method: 'PostToolUse',
        description: 'Log tool usage for audit purposes'
      };
    }

    if (enablePreToolUse) {
      hooks.PreToolUse = {
        handler: 'ccanywhere/hooks',
        name: 'CCanywhere Tool Guard',
        method: 'PreToolUse',
        description: 'Guard against dangerous operations'
      };
    }

    if (enableUserPromptSubmit) {
      hooks.UserPromptSubmit = {
        handler: 'ccanywhere/hooks',
        name: 'CCanywhere Prompt Logger',
        method: 'UserPromptSubmit',
        description: 'Log user prompts for audit purposes'
      };
    }

    if (enableSessionStart) {
      hooks.SessionStart = {
        handler: 'ccanywhere/hooks',
        name: 'CCanywhere Session Starter',
        method: 'SessionStart',
        description: 'Initialize session and send notification'
      };
    }

    if (enableSessionEnd) {
      hooks.SessionEnd = {
        handler: 'ccanywhere/hooks',
        name: 'CCanywhere Session Ender',
        method: 'SessionEnd',
        description: 'Clean up and send notification when session ends'
      };
    }

    return hooks;
  }
}

export default ClaudeHooks;