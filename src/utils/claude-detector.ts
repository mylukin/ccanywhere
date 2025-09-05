/**
 * Claude Code environment detection and configuration utilities
 * Handles platform-specific detection of Claude Code installation and configuration paths
 */

import path from 'path';
import fs from 'fs-extra';
import os from 'os';
import { Logger } from './logger.js';
import { ErrorHandler, ClaudeCodeError } from './error-handler.js';

export interface ClaudeCodeEnvironment {
  isClaudeCode: boolean;
  configDir?: string;
  hooksConfigPath?: string;
  version?: string;
  installationType?: 'user' | 'system';
}

export interface ClaudeCodePaths {
  configDir: string;
  hooksConfig: string;
  backup: string;
}

/**
 * Detects Claude Code environment and provides configuration paths
 */
export class ClaudeCodeDetector {
  private static logger = Logger.getInstance();

  /**
   * Detect if running in Claude Code environment
   */
  static async detectEnvironment(): Promise<ClaudeCodeEnvironment> {
    const result: ClaudeCodeEnvironment = {
      isClaudeCode: false
    };

    try {
      // Check environment variables first
      if (this.checkEnvironmentVariables()) {
        result.isClaudeCode = true;
        this.logger.debug('Claude Code detected via environment variables');
      }

      // Check for Claude Code configuration directory
      const configDir = await this.findConfigDirectory();
      if (configDir) {
        result.configDir = configDir;
        result.isClaudeCode = true;
        
        // Try to find hooks configuration
        const hooksPath = await this.findHooksConfigPath(configDir);
        if (hooksPath) {
          result.hooksConfigPath = hooksPath;
        }
        
        this.logger.debug(`Claude Code config directory found: ${configDir}`);
      }

      // Try to detect version
      result.version = await this.detectVersion();
      
      // Determine installation type
      if (result.configDir) {
        result.installationType = this.determineInstallationType(result.configDir);
      }

    } catch (error) {
      this.logger.debug('Error detecting Claude Code environment:', error);
    }

    return result;
  }

  /**
   * Check Claude Code-specific environment variables
   */
  private static checkEnvironmentVariables(): boolean {
    const claudeVars = [
      'CLAUDE_CODE_HOME',
      'CLAUDE_CONFIG_DIR', 
      'CLAUDE_WORKSPACE',
      'CLAUDE_CODE_VERSION'
    ];

    return claudeVars.some(varName => process.env[varName]);
  }

  /**
   * Find Claude Code configuration directory
   */
  private static async findConfigDirectory(): Promise<string | null> {
    // Priority order for configuration directories
    const candidatePaths = this.getConfigCandidates();

    for (const candidatePath of candidatePaths) {
      try {
        if (await fs.pathExists(candidatePath)) {
          // Check if it looks like a Claude Code config directory
          const isClaudeConfig = await this.verifyClaudeConfigDirectory(candidatePath);
          if (isClaudeConfig) {
            return candidatePath;
          }
        }
      } catch (error) {
        this.logger.debug(`Error checking config path ${candidatePath}:`, error);
      }
    }

    return null;
  }

  /**
   * Get configuration directory candidates based on platform
   */
  private static getConfigCandidates(): string[] {
    const homeDir = os.homedir();
    const platform = os.platform();
    
    const candidates: string[] = [];

    // Environment variable override
    if (process.env.CLAUDE_CODE_HOME) {
      candidates.push(process.env.CLAUDE_CODE_HOME);
    }
    if (process.env.CLAUDE_CONFIG_DIR) {
      candidates.push(process.env.CLAUDE_CONFIG_DIR);
    }

    // Platform-specific paths
    switch (platform) {
      case 'darwin': // macOS
        candidates.push(
          path.join(homeDir, 'Library/Application Support/claude-code'),
          path.join(homeDir, 'Library/Preferences/claude-code'),
          path.join(homeDir, '.config/claude-code'),
          path.join(homeDir, '.claude-code'),
          path.join(homeDir, '.claude')
        );
        break;
        
      case 'win32': // Windows
        const appData = process.env.APPDATA || path.join(homeDir, 'AppData/Roaming');
        const localAppData = process.env.LOCALAPPDATA || path.join(homeDir, 'AppData/Local');
        candidates.push(
          path.join(appData, 'claude-code'),
          path.join(localAppData, 'claude-code'),
          path.join(homeDir, '.config/claude-code'),
          path.join(homeDir, '.claude-code'),
          path.join(homeDir, '.claude')
        );
        break;
        
      default: // Linux and others
        const xdgConfigHome = process.env.XDG_CONFIG_HOME || path.join(homeDir, '.config');
        candidates.push(
          path.join(xdgConfigHome, 'claude-code'),
          path.join(homeDir, '.config/claude-code'),
          path.join(homeDir, '.claude-code'),
          path.join(homeDir, '.claude')
        );
        break;
    }

    return candidates;
  }

  /**
   * Verify if a directory is actually a Claude Code configuration directory
   */
  private static async verifyClaudeConfigDirectory(dirPath: string): Promise<boolean> {
    try {
      // Look for Claude Code-specific files
      const indicatorFiles = [
        'config.json',
        'settings.json', 
        'hooks.js',
        'hooks.json',
        'claude.config.js',
        'claude.config.json'
      ];

      const subdirs = ['hooks', 'config', 'settings'];

      // Check for at least one indicator file
      for (const file of indicatorFiles) {
        if (await fs.pathExists(path.join(dirPath, file))) {
          return true;
        }
      }

      // Check for subdirectories
      for (const subdir of subdirs) {
        if (await fs.pathExists(path.join(dirPath, subdir))) {
          return true;
        }
      }

      return false;
    } catch {
      return false;
    }
  }

  /**
   * Find hooks configuration file path
   */
  private static async findHooksConfigPath(configDir: string): Promise<string | null> {
    const candidates = [
      path.join(configDir, 'hooks.js'),
      path.join(configDir, 'hooks.json'),
      path.join(configDir, 'config/hooks.js'),
      path.join(configDir, 'config/hooks.json'),
      path.join(configDir, 'settings/hooks.js'),
      path.join(configDir, 'settings/hooks.json'),
      path.join(configDir, 'hooks/index.js'),
      path.join(configDir, 'hooks/config.js'),
      path.join(configDir, 'claude.config.js')
    ];

    for (const candidate of candidates) {
      if (await fs.pathExists(candidate)) {
        return candidate;
      }
    }

    // Return default path for creation
    return path.join(configDir, 'hooks.js');
  }

  /**
   * Detect Claude Code version
   */
  private static async detectVersion(): Promise<string | undefined> {
    try {
      // Try to read version from various sources
      const versionSources = [
        () => process.env.CLAUDE_CODE_VERSION,
        () => this.readVersionFromConfig(),
        () => this.readVersionFromPackage()
      ];

      for (const getVersion of versionSources) {
        try {
          const version = await getVersion();
          if (version) return version;
        } catch {
          // Continue to next source
        }
      }

      return undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * Read version from configuration file
   */
  private static async readVersionFromConfig(): Promise<string | undefined> {
    const configDir = await this.findConfigDirectory();
    if (!configDir) return undefined;

    const configPath = path.join(configDir, 'config.json');
    if (await fs.pathExists(configPath)) {
      const config = await fs.readJson(configPath);
      return config.version || config.claudeVersion;
    }

    return undefined;
  }

  /**
   * Read version from package.json (if Claude Code is npm-installed)
   */
  private static async readVersionFromPackage(): Promise<string | undefined> {
    try {
      const { execSync } = await import('child_process');
      const result = execSync('claude --version', { encoding: 'utf8', stdio: 'pipe' });
      return result.trim();
    } catch {
      return undefined;
    }
  }

  /**
   * Determine installation type (user vs system)
   */
  private static determineInstallationType(configDir: string): 'user' | 'system' {
    const homeDir = os.homedir();
    
    if (configDir.startsWith(homeDir)) {
      return 'user';
    }
    
    // Check common system paths
    const systemPaths = [
      '/usr/local',
      '/opt',
      '/etc',
      'C:\\Program Files',
      'C:\\ProgramData'
    ];
    
    for (const systemPath of systemPaths) {
      if (configDir.startsWith(systemPath)) {
        return 'system';
      }
    }
    
    return 'user';
  }

  /**
   * Get Claude Code paths for configuration
   */
  static async getClaudeCodePaths(): Promise<ClaudeCodePaths | null> {
    const env = await this.detectEnvironment();
    
    if (!env.isClaudeCode || !env.configDir) {
      return null;
    }

    const configDir = env.configDir;
    const hooksConfig = env.hooksConfigPath || path.join(configDir, 'hooks.js');
    const backup = path.join(configDir, 'hooks.ccanywhere.backup');

    return {
      configDir,
      hooksConfig,
      backup
    };
  }

  /**
   * Check if Claude Code is available globally
   */
  static async isClaudeCodeAvailable(): Promise<boolean> {
    try {
      const { execSync } = await import('child_process');
      execSync('claude --help', { stdio: 'pipe' });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Ensure Claude Code configuration directory exists
   */
  static async ensureConfigDirectory(): Promise<string | null> {
    try {
      const env = await this.detectEnvironment();
      
      if (env.configDir && await fs.pathExists(env.configDir)) {
        return env.configDir;
      }

      // Try to create in default location
      const homeDir = os.homedir();
      const defaultPath = path.join(homeDir, '.config/claude-code');
      
      await fs.ensureDir(defaultPath);
      this.logger.info(`Created Claude Code config directory: ${defaultPath}`);
      
      return defaultPath;
    } catch (error) {
      this.logger.error('Failed to ensure config directory:', error);
      return null;
    }
  }
}

export default ClaudeCodeDetector;