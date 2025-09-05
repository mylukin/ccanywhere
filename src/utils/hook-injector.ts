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
  enablePreCommit?: boolean;
  enablePostRun?: boolean;
  enablePreTest?: boolean;
  enablePostTest?: boolean;
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

export interface HookConfigFormat {
  type: 'js' | 'json';
  content: any;
  raw?: string;
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

      result.configPath = claudePaths.hooksConfig;

      // Read existing hooks configuration
      const existingConfig = await this.readHooksConfig(claudePaths.hooksConfig);
      
      // Create backup if requested
      if (options.createBackup !== false && existingConfig) {
        const backupPath = await this.createBackup(claudePaths.hooksConfig, claudePaths.backup);
        if (backupPath) {
          result.backupPath = backupPath;
          this.logger.info(`Created backup: ${backupPath}`);
        }
      }

      // Generate CCanywhere hook configuration
      const ccanywhereHooks = ClaudeHooks.generateHookConfig({
        enablePreCommit: options.enablePreCommit,
        enablePostRun: options.enablePostRun,
        enablePreTest: options.enablePreTest,
        enablePostTest: options.enablePostTest
      });

      // Merge configurations
      const mergedConfig = await this.mergeHookConfigs(
        existingConfig,
        ccanywhereHooks,
        options.force
      );

      // Track what was added/skipped
      for (const [hookName, hookConfig] of Object.entries(ccanywhereHooks)) {
        if (existingConfig?.content[hookName] && !options.force) {
          result.hooksSkipped.push(hookName);
        } else {
          result.hooksAdded.push(hookName);
        }
      }

      // Write the merged configuration
      await this.writeHooksConfig(claudePaths.hooksConfig, mergedConfig);

      result.success = true;
      result.message = `Successfully injected CCanywhere hooks`;
      
      this.logger.info(`Hooks injected: ${result.hooksAdded.join(', ')}`);
      if (result.hooksSkipped.length > 0) {
        this.logger.info(`Hooks skipped (already exist): ${result.hooksSkipped.join(', ')}`);
      }

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

      const existingConfig = await this.readHooksConfig(claudePaths.hooksConfig);
      if (!existingConfig) {
        result.message = 'No hooks configuration found';
        return result;
      }

      // Remove CCanywhere-related hooks
      const cleanedConfig = { ...existingConfig };
      const ccanywhereHookNames = ['preCommit', 'postRun', 'preTest', 'postTest'];
      let removedCount = 0;

      for (const hookName of ccanywhereHookNames) {
        if (cleanedConfig.content[hookName]?.handler === 'ccanywhere/hooks') {
          delete cleanedConfig.content[hookName];
          result.hooksAdded.push(hookName); // Using hooksAdded to track removed hooks
          removedCount++;
        }
      }

      if (removedCount === 0) {
        result.message = 'No CCanywhere hooks found to remove';
        result.success = true;
        return result;
      }

      // Write cleaned configuration
      await this.writeHooksConfig(claudePaths.hooksConfig, cleanedConfig);

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
   * Read existing hooks configuration
   */
  private static async readHooksConfig(configPath: string): Promise<HookConfigFormat | null> {
    try {
      if (!(await fs.pathExists(configPath))) {
        return null;
      }

      const ext = path.extname(configPath).toLowerCase();
      const raw = await fs.readFile(configPath, 'utf8');

      if (ext === '.json') {
        return {
          type: 'json',
          content: JSON.parse(raw),
          raw
        };
      } else {
        // Assume .js format
        // For .js files, we'll need to evaluate the module
        // This is a simplified approach - in production, you might want more sophisticated parsing
        try {
          // Try to extract the exported configuration
          const config = await this.parseJsHooksConfig(raw);
          return {
            type: 'js',
            content: config || {},
            raw
          };
        } catch {
          // If parsing fails, assume empty config
          return {
            type: 'js',
            content: {},
            raw
          };
        }
      }
    } catch (error) {
      this.logger.debug(`Error reading hooks config ${configPath}:`, error);
      return null;
    }
  }

  /**
   * Parse JavaScript hooks configuration file
   */
  private static async parseJsHooksConfig(jsContent: string): Promise<any> {
    // This is a simplified parser - in production you might want to use a proper JS parser
    // For now, we'll look for common patterns
    
    try {
      // Remove comments first
      const cleanContent = jsContent
        .replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments
        .replace(/\/\/.*$/gm, ''); // Remove line comments

      // Look for module.exports or export default patterns
      const moduleExportsMatch = cleanContent.match(/module\.exports\s*=\s*({[\s\S]*})\s*;?\s*$/);
      if (moduleExportsMatch && moduleExportsMatch[1]) {
        // Try to evaluate the object literal
        const objStr = moduleExportsMatch[1].trim();
        return eval(`(${objStr})`);
      }

      const exportDefaultMatch = cleanContent.match(/export\s+default\s+({[\s\S]*?})(?:\s*;?\s*)?$/m);
      if (exportDefaultMatch && exportDefaultMatch[1]) {
        const objStr = exportDefaultMatch[1].trim();
        return eval(`(${objStr})`);
      }

      // Try to parse as simple object if it looks like one
      if (cleanContent.trim().startsWith('{') && cleanContent.trim().endsWith('}')) {
        return eval(`(${cleanContent.trim()})`);
      }

      // If no clear pattern, return empty object
      return {};
    } catch (error) {
      this.logger.debug('Error parsing JS hooks config:', error);
      return {};
    }
  }

  /**
   * Merge hook configurations
   */
  private static async mergeHookConfigs(
    existingConfig: HookConfigFormat | null,
    newHooks: Record<string, any>,
    force = false
  ): Promise<HookConfigFormat> {
    const baseConfig = existingConfig || {
      type: 'js' as const,
      content: {},
      raw: ''
    };

    const mergedContent = { ...baseConfig.content };

    // Add new hooks, respecting existing ones unless force is true
    for (const [hookName, hookConfig] of Object.entries(newHooks)) {
      if (!mergedContent[hookName] || force) {
        mergedContent[hookName] = hookConfig;
      }
    }

    return {
      ...baseConfig,
      content: mergedContent
    };
  }

  /**
   * Write hooks configuration to file
   */
  private static async writeHooksConfig(
    configPath: string,
    config: HookConfigFormat
  ): Promise<void> {
    // Ensure directory exists
    await fs.ensureDir(path.dirname(configPath));

    let content: string;

    if (config.type === 'json') {
      content = JSON.stringify(config.content, null, 2);
    } else {
      // Generate JavaScript module
      content = this.generateJsHooksConfig(config.content);
    }

    await fs.writeFile(configPath, content, 'utf8');
  }

  /**
   * Generate JavaScript hooks configuration content
   */
  private static generateJsHooksConfig(hooks: Record<string, any>): string {
    const header = `/**
 * Claude Code Hooks Configuration
 * Auto-generated by CCanywhere
 */

`;

    const hooksStr = JSON.stringify(hooks, null, 2);
    
    const jsContent = `${header}module.exports = ${hooksStr};
`;

    return jsContent;
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
      const backupFiles = files.filter(file => 
        file.includes('hooks') && file.includes('.backup')
      );

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

      const existingConfig = await this.readHooksConfig(claudePaths.hooksConfig);
      if (!existingConfig) {
        return false;
      }

      // Check if any CCanywhere hooks are present
      const ccanywhereHookNames = ['preCommit', 'postRun', 'preTest', 'postTest'];
      return ccanywhereHookNames.some(hookName => {
        const hook = existingConfig.content[hookName];
        return hook && hook.handler === 'ccanywhere/hooks';
      });
    } catch (error) {
      this.logger.debug('Error checking hook injection status:', error);
      return false;
    }
  }
}

export default HookInjector;