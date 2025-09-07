/**
 * Configuration loader and manager
 */

import fsExtra from 'fs-extra';
const { readFile, pathExists } = fsExtra;
import { resolve, join } from 'path';
import { homedir } from 'os';
import { config as loadEnv } from 'dotenv';
import { validateConfig, getDefaultConfig } from './schema.js';
import type { CcanywhereConfig, NotificationChannel, RepoKind } from '../types/index.js';
import { ConfigurationError } from '../types/index.js';
import { detectGitInfo } from '../utils/git.js';
import { Logger } from '../utils/logger.js';

export class ConfigLoader {
  private static instance: ConfigLoader;
  private cachedConfig?: CcanywhereConfig;
  private static logger = Logger.getInstance();

  private constructor() {}

  static getInstance(): ConfigLoader {
    if (!ConfigLoader.instance) {
      ConfigLoader.instance = new ConfigLoader();
    }
    return ConfigLoader.instance;
  }

  /**
   * Reset the singleton instance (for testing purposes)
   */
  static reset(): void {
    ConfigLoader.instance = null as any;
  }

  /**
   * Load configuration from file or environment
   */
  async loadConfig(configPath?: string, projectPath: string = '.'): Promise<CcanywhereConfig> {
    if (this.cachedConfig) {
      return this.cachedConfig;
    }

    // Start with default config
    let config: Partial<CcanywhereConfig> = getDefaultConfig();

    // Load user-level configuration from ~/.claude/
    const userConfig = await this.loadFromUserConfig();
    if (userConfig && Object.keys(userConfig).length > 0) {
      config = this.mergeConfigs(config, userConfig);
      ConfigLoader.logger.debug('Loaded user-level configuration from ~/.claude/');
    }

    // Load project-level configuration
    let projectConfig: Partial<CcanywhereConfig> = {};
    if (configPath) {
      projectConfig = await this.loadFromFile(configPath);
    } else {
      // Try to find config file in standard locations
      const standardPaths = ['ccanywhere.config.json', 'ccanywhere.config.js', '.ccanywhere.json', '.ccanywhere.js'];

      for (const path of standardPaths) {
        if (await pathExists(path)) {
          projectConfig = await this.loadFromFile(path);
          ConfigLoader.logger.debug(`Loaded project configuration from ${path}`);
          break;
        }
      }
    }

    // Merge project config over user config
    if (Object.keys(projectConfig).length > 0) {
      config = this.mergeConfigs(config, projectConfig);
    }

    // Auto-detect Git repository information
    const gitInfo = await detectGitInfo(projectPath);
    if (gitInfo.repoUrl && !config.repo?.url) {
      config.repo = {
        ...config.repo,
        url: gitInfo.repoUrl,
        kind: gitInfo.repoKind || 'github',
        branch: gitInfo.repoBranch || 'main'
      };
    }

    // Load environment variables (highest priority)
    const envConfig = await this.loadFromEnv();

    // Merge configurations (env overrides everything)
    const mergedConfig = this.mergeConfigs(config, envConfig);

    // Apply backward compatibility transformations
    const compatibleConfig = this.applyBackwardCompatibility(mergedConfig);

    // Validate the final configuration
    this.cachedConfig = validateConfig(compatibleConfig);

    return this.cachedConfig;
  }

  /**
   * Load configuration from a file
   */
  private async loadFromFile(filePath: string): Promise<Partial<CcanywhereConfig>> {
    try {
      const absolutePath = resolve(filePath);

      if (!(await pathExists(absolutePath))) {
        throw new ConfigurationError(`Configuration file not found: ${absolutePath}`);
      }

      if (filePath.endsWith('.json')) {
        const content = await readFile(absolutePath, 'utf8');
        return JSON.parse(content);
      } else if (filePath.endsWith('.js')) {
        const module = await import(absolutePath);
        return module.default || module;
      } else {
        throw new ConfigurationError(`Unsupported config file format: ${filePath}`);
      }
    } catch (error) {
      if (error instanceof ConfigurationError) {
        throw error;
      }
      throw new ConfigurationError(
        `Failed to load config file: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Load configuration from user-level config directory (~/.claude/)
   */
  private async loadFromUserConfig(): Promise<Partial<CcanywhereConfig>> {
    try {
      const userConfigDir = join(homedir(), '.claude');
      const userConfigPaths = [
        join(userConfigDir, 'ccanywhere.config.json'),
        join(userConfigDir, 'ccanywhere.config.js'),
        join(userConfigDir, '.ccanywhere.json'),
        join(userConfigDir, '.ccanywhere.js')
      ];

      for (const path of userConfigPaths) {
        if (await pathExists(path)) {
          ConfigLoader.logger.debug(`Found user config at: ${path}`);
          return await this.loadFromFile(path);
        }
      }

      return {};
    } catch (error) {
      ConfigLoader.logger.debug('Error loading user config:', error);
      return {};
    }
  }

  /**
   * Load configuration from environment variables
   */
  private async loadFromEnv(): Promise<Partial<CcanywhereConfig>> {
    // Load .env file if it exists
    loadEnv({ path: resolve('.env') });

    const env = process.env;
    const config: any = {};

    // Repository configuration
    if (env.REPO_URL) {
      config.repo = {
        kind: (env.REPO_KIND as RepoKind) || 'github',
        url: env.REPO_URL,
        branch: env.REPO_BRANCH || 'main'
      };
    }

    // URLs configuration (deprecated - use ARTIFACTS_BASE_URL)
    if (env.ARTIFACTS_URL) {
      config.urls = {
        artifacts: env.ARTIFACTS_URL
      };
    }

    // Artifacts configuration
    if (
      env.ARTIFACTS_BASE_URL ||
      env.ARTIFACTS_RETENTION_DAYS ||
      env.ARTIFACTS_MAX_SIZE ||
      env.STORAGE_PROVIDER ||
      env.STORAGE_FOLDER ||
      env.R2_ACCOUNT_ID ||
      env.S3_ACCESS_KEY_ID ||
      env.OSS_ACCESS_KEY_ID
    ) {
      config.artifacts = {
        baseUrl: env.ARTIFACTS_BASE_URL,
        retentionDays: env.ARTIFACTS_RETENTION_DAYS ? parseInt(env.ARTIFACTS_RETENTION_DAYS) : undefined,
        maxSize: env.ARTIFACTS_MAX_SIZE,
        storage: undefined as any
      };

      // Storage configuration
      const storageProvider = env.STORAGE_PROVIDER || 'r2';
      const storageFolder = env.STORAGE_FOLDER || 'diffs';

      // R2 configuration (default)
      if (storageProvider === 'r2' && env.R2_ACCOUNT_ID) {
        config.artifacts.storage = {
          provider: 'r2' as const,
          folder: storageFolder,
          r2: {
            accountId: env.R2_ACCOUNT_ID,
            accessKeyId: env.R2_ACCESS_KEY_ID || '',
            secretAccessKey: env.R2_SECRET_ACCESS_KEY || '',
            bucket: env.R2_BUCKET || ''
          }
        };
      }

      // S3 configuration
      else if (storageProvider === 's3' && env.S3_ACCESS_KEY_ID) {
        config.artifacts.storage = {
          provider: 's3' as const,
          folder: storageFolder,
          s3: {
            accessKeyId: env.S3_ACCESS_KEY_ID,
            secretAccessKey: env.S3_SECRET_ACCESS_KEY || '',
            region: env.S3_REGION || 'us-east-1',
            bucket: env.S3_BUCKET || ''
          }
        };
      }

      // OSS configuration
      else if (storageProvider === 'oss' && env.OSS_ACCESS_KEY_ID) {
        config.artifacts.storage = {
          provider: 'oss' as const,
          folder: storageFolder,
          oss: {
            accessKeyId: env.OSS_ACCESS_KEY_ID,
            accessKeySecret: env.OSS_ACCESS_KEY_SECRET || '',
            region: env.OSS_REGION || 'oss-cn-hangzhou',
            bucket: env.OSS_BUCKET || ''
          }
        };
      }

      // Clean up undefined storage if not configured
      if (!config.artifacts.storage) {
        delete (config.artifacts as any).storage;
      }
    }

    // Deployment configuration
    if (env.DEPLOYMENT_WEBHOOK_URL) {
      config.deployment = {
        webhook: env.DEPLOYMENT_WEBHOOK_URL,
        statusUrl: env.DEPLOYMENT_STATUS_URL,
        maxWait: env.MAX_WAIT ? parseInt(env.MAX_WAIT) : undefined,
        pollInterval: env.POLL_INTERVAL ? parseInt(env.POLL_INTERVAL) : undefined
      };
    }

    // Notifications configuration
    const channels = env.NOTIFY_CHANNELS?.split(',').map(c => c.trim() as NotificationChannel) || [];
    if (channels.length > 0) {
      config.notifications = { channels };

      // Telegram
      if (env.BOT_TOKEN_TELEGRAM && env.CHAT_ID_TELEGRAM) {
        config.notifications.telegram = {
          botToken: env.BOT_TOKEN_TELEGRAM,
          chatId: env.CHAT_ID_TELEGRAM
        };
      }

      // DingTalk
      if (env.DINGTALK_WEBHOOK) {
        config.notifications.dingtalk = env.DINGTALK_WEBHOOK;
      }

      // WeCom
      if (env.WECOM_WEBHOOK) {
        config.notifications.wecom = env.WECOM_WEBHOOK;
      }

      // Email
      if (env.EMAIL_TO) {
        config.notifications.email = {
          to: env.EMAIL_TO,
          from: env.EMAIL_FROM
        };

        if (env.SMTP_HOST && env.SMTP_PORT && env.SMTP_USER && env.SMTP_PASS) {
          config.notifications.email.smtp = {
            host: env.SMTP_HOST,
            port: parseInt(env.SMTP_PORT),
            user: env.SMTP_USER,
            pass: env.SMTP_PASS
          };
        }
      }
    }

    // Build configuration
    config.build = {};
    if (env.BASE) config.build.base = env.BASE;
    if (env.LOCK_TIMEOUT) config.build.lockTimeout = parseInt(env.LOCK_TIMEOUT);
    if (env.CLEANUP_DAYS) config.build.cleanupDays = parseInt(env.CLEANUP_DAYS);
    if (env.EXCLUDE_PATHS) config.build.excludePaths = env.EXCLUDE_PATHS.split(',').map(p => p.trim());

    // Test configuration
    if (env.TEST_ENABLED !== undefined || env.PLAYWRIGHT_CONFIG) {
      config.test = {
        enabled: env.TEST_ENABLED === 'true',
        configFile: env.PLAYWRIGHT_CONFIG || './playwright.config.ts'
      };
    }

    // Security configuration
    if (env.READ_ONLY || env.LINK_EXPIRY) {
      config.security = {
        readOnly: env.READ_ONLY === 'true',
        linkExpiry: env.LINK_EXPIRY ? parseInt(env.LINK_EXPIRY) : undefined
      };
    }

    return config;
  }

  /**
   * Merge two configuration objects with deep merging support
   */
  private mergeConfigs(
    base: Partial<CcanywhereConfig>,
    override: Partial<CcanywhereConfig>
  ): Partial<CcanywhereConfig> {
    const result = { ...base };

    for (const [key, value] of Object.entries(override)) {
      if (value !== undefined && value !== null) {
        if (typeof value === 'object' && !Array.isArray(value) && key in result) {
          // Deep merge objects recursively
          const baseValue = (result as any)[key];
          if (typeof baseValue === 'object' && !Array.isArray(baseValue)) {
            (result as any)[key] = this.deepMerge(baseValue, value);
          } else {
            (result as any)[key] = value;
          }
        } else {
          // Replace primitive values and arrays
          (result as any)[key] = value;
        }
      }
    }

    return result;
  }

  /**
   * Deep merge helper for nested objects
   */
  private deepMerge(target: any, source: any): any {
    const result = { ...target };

    for (const key in source) {
      if (source[key] !== undefined && source[key] !== null) {
        if (typeof source[key] === 'object' && !Array.isArray(source[key]) && key in target) {
          result[key] = this.deepMerge(target[key], source[key]);
        } else {
          result[key] = source[key];
        }
      }
    }

    return result;
  }

  /**
   * Apply backward compatibility transformations
   */
  private applyBackwardCompatibility(config: Partial<CcanywhereConfig>): Partial<CcanywhereConfig> {
    const result = { ...config };

    // Initialize artifacts if it doesn't exist
    if (!result.artifacts) {
      result.artifacts = {};
    }

    // Migrate URLs.artifacts to artifacts.baseUrl if not already set
    if (result.urls?.artifacts && !result.artifacts.baseUrl) {
      result.artifacts.baseUrl = result.urls.artifacts;
    }

    // Migrate storage config to artifacts.storage if not already set
    if (result.storage && !result.artifacts.storage) {
      result.artifacts.storage = result.storage;
    }

    // Ensure backward compatibility fields are also set
    if (result.artifacts.baseUrl && !result.urls?.artifacts) {
      result.urls = { ...result.urls, artifacts: result.artifacts.baseUrl };
    }

    if (result.artifacts.storage && !result.storage) {
      result.storage = result.artifacts.storage;
    }

    return result;
  }

  /**
   * Clear cached configuration
   */
  clearCache(): void {
    this.cachedConfig = undefined;
  }

  /**
   * Get current configuration (must be loaded first)
   */
  getCurrentConfig(): CcanywhereConfig {
    if (!this.cachedConfig) {
      throw new ConfigurationError('Configuration not loaded. Call loadConfig() first.');
    }
    return this.cachedConfig;
  }
}
