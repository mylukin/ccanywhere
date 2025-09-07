/**
 * Claude Code hook injection system
 * Safely merges CCanywhere hooks with existing Claude Code hook configurations
 */

import path from 'path';
import fs from 'fs-extra';
import { Logger } from './logger.js';
import { ClaudeCodeDetector } from './claude-detector.js';
import { ClaudeHooks } from '../core/claude-hook.js';
import { ErrorHandler, ClaudeCodeError } from './error-handler.js';

export interface HookInjectionOptions {
  enableStop?: boolean;
  createBackup?: boolean;
  force?: boolean;
}

export interface HookInjectionResult {
  success: boolean;
  message: string;
  backupPath?: string;
  hooksAdded: string[];
  hooksSkipped: string[];
  configPath?: string;
}

export interface SettingsConfig {
  hooks?: {
    [key: string]: Array<{
      matcher: string;
      hooks: Array<{
        type: string;
        command?: string;
        handler?: string;
      }>;
    }>;
  };
  [key: string]: any;
}

/**
 * Handles injection of CCanywhere hooks into Claude Code configuration
 */
export class HookInjector {
  private static logger = Logger.getInstance();

  /**
   * Inject CCanywhere hooks into Claude Code configuration
   */
  static async injectHooks(options: HookInjectionOptions = {}): Promise<HookInjectionResult> {
    const result: HookInjectionResult = {
      success: false,
      message: '',
      hooksAdded: [],
      hooksSkipped: []
    };

    try {
      // Detect Claude Code environment
      const claudePaths = await ClaudeCodeDetector.getClaudeCodePaths();
      if (!claudePaths) {
        result.message = 'Claude Code environment not detected';
        return result;
      }

      // Path to settings.json
      const settingsPath = path.join(claudePaths.configDir, 'settings.json');
      result.configPath = settingsPath;

      // Read existing settings.json
      let settings: SettingsConfig = {};
      if (await fs.pathExists(settingsPath)) {
        const content = await fs.readFile(settingsPath, 'utf8');
        settings = JSON.parse(content);

        // Create backup if requested
        if (options.createBackup !== false) {
          const backupPath = await this.createBackup(settingsPath, claudePaths.backup);
          if (backupPath) {
            result.backupPath = backupPath;
            this.logger.info(`Created backup: ${backupPath}`);
          }
        }
      }

      // Initialize hooks object if it doesn't exist
      if (!settings.hooks) {
        settings.hooks = {};
      }

      // Add Stop hook for CCanywhere
      if (options.enableStop !== false) {
        const ccanywhereHook = {
          matcher: '.*',
          hooks: [
            {
              type: 'command',
              command:
                'cd "$CLAUDE_PROJECT_DIR" && npx ccanywhere run --hook-mode 2>&1 >> /tmp/ccanywhere-hook.log || true'
            }
          ]
        };

        // Check if Stop hook already exists
        if (!settings.hooks.Stop) {
          settings.hooks.Stop = [];
        }

        // Check if our hook is already registered
        const isAlreadyRegistered = settings.hooks.Stop.some(hookEntry =>
          hookEntry.hooks.some(h => h.command && h.command.includes('ccanywhere run'))
        );

        if (isAlreadyRegistered && !options.force) {
          result.hooksSkipped.push('Stop');
        } else {
          // Remove old ccanywhere hooks if force is true
          if (options.force) {
            settings.hooks.Stop = settings.hooks.Stop.filter(
              hookEntry => !hookEntry.hooks.some(h => h.command && h.command.includes('ccanywhere run'))
            );
          }

          // Add our hook
          settings.hooks.Stop.push(ccanywhereHook);
          result.hooksAdded.push('Stop');
        }
      }

      // Write the updated settings.json
      await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2), 'utf8');

      result.success = true;
      result.message = `Successfully injected CCanywhere hooks into settings.json`;

      this.logger.info(`Hooks injected: ${result.hooksAdded.join(', ')}`);
      if (result.hooksSkipped.length > 0) {
        this.logger.info(`Hooks skipped (already exist): ${result.hooksSkipped.join(', ')}`);
      }

      // Clean up old files
      await this.cleanupOldFiles(claudePaths.configDir);
    } catch (error) {
      result.message = `Failed to inject hooks: ${error instanceof Error ? error.message : String(error)}`;
      this.logger.error('Hook injection failed:', error);
    }

    return result;
  }

  /**
   * Remove CCanywhere hooks from Claude Code configuration
   */
  static async removeHooks(): Promise<HookInjectionResult> {
    const result: HookInjectionResult = {
      success: false,
      message: '',
      hooksAdded: [],
      hooksSkipped: []
    };

    try {
      const claudePaths = await ClaudeCodeDetector.getClaudeCodePaths();
      if (!claudePaths) {
        result.message = 'Claude Code environment not detected';
        return result;
      }

      const settingsPath = path.join(claudePaths.configDir, 'settings.json');

      if (!(await fs.pathExists(settingsPath))) {
        result.message = 'No settings.json found';
        return result;
      }

      const content = await fs.readFile(settingsPath, 'utf8');
      const settings: SettingsConfig = JSON.parse(content);

      if (!settings.hooks) {
        result.message = 'No hooks found in settings';
        result.success = true;
        return result;
      }

      let removedCount = 0;

      // Remove CCanywhere hooks from Stop event
      if (settings.hooks.Stop) {
        const originalLength = settings.hooks.Stop.length;
        settings.hooks.Stop = settings.hooks.Stop.filter(
          hookEntry => !hookEntry.hooks.some(h => h.command && h.command.includes('ccanywhere run'))
        );

        if (settings.hooks.Stop.length < originalLength) {
          removedCount++;
          result.hooksAdded.push('Stop'); // Using hooksAdded to track removed hooks
        }

        // Clean up empty arrays
        if (settings.hooks.Stop.length === 0) {
          delete settings.hooks.Stop;
        }
      }

      if (removedCount === 0) {
        result.message = 'No CCanywhere hooks found to remove';
        result.success = true;
        return result;
      }

      // Write cleaned settings
      await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2), 'utf8');

      // Clean up old files
      await this.cleanupOldFiles(claudePaths.configDir);

      result.success = true;
      result.message = `Removed ${removedCount} CCanywhere hooks`;

      this.logger.info(`Removed hooks: ${result.hooksAdded.join(', ')}`);
    } catch (error) {
      result.message = `Failed to remove hooks: ${error instanceof Error ? error.message : String(error)}`;
      this.logger.error('Hook removal failed:', error);
    }

    return result;
  }

  /**
   * Clean up old hook-related files
   */
  private static async cleanupOldFiles(configDir: string): Promise<void> {
    const filesToClean = ['hooks.js', 'ccanywhere.hooks.js'];

    for (const fileName of filesToClean) {
      const filePath = path.join(configDir, fileName);
      if (await fs.pathExists(filePath)) {
        try {
          const content = await fs.readFile(filePath, 'utf8');
          // Only remove if it's a CCanywhere-related file
          if (content.includes('CCanywhere') || content.includes('ccanywhere')) {
            await fs.remove(filePath);
            this.logger.info(`Removed old file: ${fileName}`);
          }
        } catch (error) {
          this.logger.debug(`Error cleaning up ${fileName}:`, error);
        }
      }
    }
  }

  /**
   * Create backup of existing configuration
   */
  private static async createBackup(configPath: string, backupPath: string): Promise<string | null> {
    try {
      if (!(await fs.pathExists(configPath))) {
        return null;
      }

      // Add timestamp to backup filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const finalBackupPath = backupPath.replace(/\.backup$/, `.${timestamp}.backup`);

      await fs.copy(configPath, finalBackupPath);
      return finalBackupPath;
    } catch (error) {
      this.logger.error('Failed to create backup:', error);
      return null;
    }
  }

  /**
   * Restore configuration from backup
   */
  static async restoreFromBackup(backupPath: string): Promise<boolean> {
    try {
      const claudePaths = await ClaudeCodeDetector.getClaudeCodePaths();
      if (!claudePaths) {
        return false;
      }

      if (!(await fs.pathExists(backupPath))) {
        this.logger.error(`Backup file not found: ${backupPath}`);
        return false;
      }

      await fs.copy(backupPath, claudePaths.hooksConfig);
      this.logger.info(`Restored configuration from backup: ${backupPath}`);
      return true;
    } catch (error) {
      this.logger.error('Failed to restore from backup:', error);
      return false;
    }
  }

  /**
   * List available backups
   */
  static async listBackups(): Promise<string[]> {
    try {
      const claudePaths = await ClaudeCodeDetector.getClaudeCodePaths();
      if (!claudePaths) {
        return [];
      }

      const backupDir = path.dirname(claudePaths.backup);
      if (!(await fs.pathExists(backupDir))) {
        return [];
      }

      const files = await fs.readdir(backupDir);
      const backupFiles = files.filter(file => file.includes('hooks') && file.includes('.backup'));

      return backupFiles.map(file => path.join(backupDir, file));
    } catch (error) {
      this.logger.error('Failed to list backups:', error);
      return [];
    }
  }

  /**
   * Check if CCanywhere hooks are already injected
   */
  static async areHooksInjected(): Promise<boolean> {
    try {
      const claudePaths = await ClaudeCodeDetector.getClaudeCodePaths();
      if (!claudePaths) {
        return false;
      }

      const settingsPath = path.join(claudePaths.configDir, 'settings.json');

      if (!(await fs.pathExists(settingsPath))) {
        return false;
      }

      const content = await fs.readFile(settingsPath, 'utf8');
      const settings: SettingsConfig = JSON.parse(content);

      if (!settings.hooks || !settings.hooks.Stop) {
        return false;
      }

      // Check if CCanywhere hook is present in Stop hooks
      return settings.hooks.Stop.some(hookEntry =>
        hookEntry.hooks.some(h => h.command && h.command.includes('ccanywhere run'))
      );
    } catch (error) {
      this.logger.debug('Error checking hook injection status:', error);
      return false;
    }
  }
}

export default HookInjector;
