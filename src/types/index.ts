/**
 * Core type definitions for CCanywhere
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type NotificationChannel = 'telegram' | 'dingtalk' | 'wecom' | 'email';

export type RepoKind = 'github' | 'gitlab' | 'bitbucket' | 'gitee';

export type StorageProvider = 's3' | 'r2' | 'oss';

export type DeploymentStatus = 'pending' | 'running' | 'success' | 'failed' | 'cancelled';

export type TestStatus = 'pending' | 'running' | 'passed' | 'failed' | 'skipped';

/**
 * Core configuration interface
 */
export interface CcanywhereConfig {
  /** Repository configuration (optional - auto-detected from .git) */
  repo?: {
    kind?: RepoKind;
    url?: string;
    branch?: string;
  };

  /** Server URLs (deprecated - use artifacts.baseUrl instead) */
  urls?: {
    artifacts?: string;
  };

  /** Deployment configuration - webhook URL or config object */
  deployment?:
    | string
    | {
        webhook: string;
      };

  /** Notification configuration */
  notifications?: {
    channels: NotificationChannel[];
    telegram?: {
      botToken: string;
      chatId: string;
    };
    dingtalk?: string;
    wecom?: string;
    email?: {
      to: string;
      from?: string;
      smtp?: {
        host: string;
        port: number;
        user: string;
        pass: string;
      };
    };
  };

  /** Build configuration */
  build?: {
    base?: string;
    lockTimeout?: number;
    cleanupDays?: number;
    excludePaths?: string[]; // Paths to exclude from diff generation
  };

  /** Test configuration */
  test?: {
    enabled?: boolean;
    configFile?: string;
    reporter?: string;
    timeout?: number;
    workers?: number;
  };

  /** Security settings */
  security?: {
    readOnly?: boolean;
    linkExpiry?: number;
  };

  /** Artifacts configuration - unified storage and URL configuration */
  artifacts?: {
    baseUrl?: string;
    retentionDays?: number;
    maxSize?: string;
    storage?: {
      provider: StorageProvider;
      folder?: string; // Storage folder path for organizing artifacts (default: "diffs")
      s3?: {
        accessKeyId: string;
        secretAccessKey: string;
        region: string;
        bucket: string;
        endpoint?: string;
      };
      r2?: {
        accountId: string;
        accessKeyId: string;
        secretAccessKey: string;
        bucket: string;
      };
      oss?: {
        accessKeyId: string;
        accessKeySecret: string;
        region: string;
        bucket: string;
        endpoint?: string;
      };
    };
  };

  /** Storage configuration (deprecated - use artifacts.storage instead) */
  storage?: {
    provider: StorageProvider;
    folder?: string; // Storage folder path for organizing artifacts (default: "diffs")
    s3?: {
      accessKeyId: string;
      secretAccessKey: string;
      region: string;
      bucket: string;
      endpoint?: string;
    };
    r2?: {
      accountId: string;
      accessKeyId: string;
      secretAccessKey: string;
      bucket: string;
    };
    oss?: {
      accessKeyId: string;
      accessKeySecret: string;
      region: string;
      bucket: string;
      endpoint?: string;
    };
  };
}

/**
 * Runtime context passed between modules
 */
export interface RuntimeContext {
  config: CcanywhereConfig;
  timestamp: number;
  revision: string;
  branch: string;
  workDir: string;
  artifactsDir: string;
  logDir: string;
  lockFile: string;
  base?: string;
  head?: string;
}

/**
 * Build artifact information
 */
export interface BuildArtifact {
  type: 'diff' | 'report' | 'trace';
  url: string;
  path: string;
  size?: number;
  timestamp: number;
}

/**
 * Build result from the pipeline
 */
export interface BuildResult {
  success: boolean;
  revision: string;
  branch: string;
  timestamp: number;
  duration: number;
  artifacts: BuildArtifact[];
  deploymentUrl?: string;
  testResults?: TestResult;
  commitInfo?: CommitInfo;
  error?: string;
  message?: string; // Optional message for special cases like no changes
}

/**
 * Git commit information
 */
export interface CommitInfo {
  sha: string;
  shortSha: string;
  author: string;
  message: string;
  timestamp: number;
}

/**
 * Test execution results
 */
export interface TestResult {
  status: TestStatus;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  reportUrl?: string;
  traceUrls?: string[];
  error?: string;
}

/**
 * Deployment information
 */
export interface DeploymentInfo {
  status: DeploymentStatus;
  url?: string;
  startTime: number;
  endTime?: number;
  error?: string;
}

/**
 * Lock mechanism interface
 */
export interface LockInfo {
  pid: number;
  timestamp: number;
  revision: string;
  acquired: boolean;
}

/**
 * Audit log entry
 */
export interface AuditLogEntry {
  timestamp: number;
  level: LogLevel;
  step: string;
  revision: string;
  branch: string;
  message: string;
  extra?: string;
  error?: boolean;
  duration?: number;
}

/**
 * Notification message
 */
export interface NotificationMessage {
  title: string;
  diffUrl?: string;
  previewUrl?: string;
  reportUrl?: string;
  extra?: string;
  isError?: boolean;
  timestamp: number;
}

/**
 * CLI command options
 */
export interface CliOptions {
  config?: string;
  verbose?: boolean;
  dryRun?: boolean;
  force?: boolean;
}

/**
 * Plugin interface for extensibility
 */
export interface CcanywherePlugin {
  name: string;
  version: string;
  initialize?(context: RuntimeContext): Promise<void>;
  beforeBuild?(context: RuntimeContext): Promise<void>;
  afterBuild?(context: RuntimeContext, result: BuildResult): Promise<void>;
  onError?(context: RuntimeContext, error: Error): Promise<void>;
}

/**
 * Event system types
 */
export type EventType =
  | 'build:start'
  | 'build:complete'
  | 'build:error'
  | 'diff:generated'
  | 'deployment:started'
  | 'deployment:complete'
  | 'test:started'
  | 'test:complete'
  | 'notification:sent';

export interface EventPayload {
  type: EventType;
  timestamp: number;
  context: RuntimeContext;
  data: any;
}

/**
 * Service interfaces
 */
export interface Logger {
  debug(message: string, meta?: any): void;
  info(message: string, meta?: any): void;
  warn(message: string, meta?: any): void;
  error(message: string, meta?: any): void;
  step(step: string, message: string, meta?: any): void;
  buildStart(revision: string, branch: string, meta?: any): void;
  buildComplete(success: boolean, duration: number, meta?: any): void;
  buildError(step: string, error: string, meta?: any): void;
  close?(): Promise<void>;
}

export interface DiffGenerator {
  generate(base: string, head: string, context: RuntimeContext): Promise<BuildArtifact>;
}

export interface DeploymentTrigger {
  trigger(context: RuntimeContext): Promise<DeploymentInfo>;
  getStatus(deploymentId: string): Promise<DeploymentInfo>;
}

export interface TestRunner {
  run(context: RuntimeContext): Promise<TestResult>;
}

export interface NotificationSender {
  send(message: NotificationMessage, channels: NotificationChannel[]): Promise<void>;
}

export interface LockManager {
  acquire(lockFile: string, timeout?: number): Promise<LockInfo>;
  release(lockFile: string): Promise<void>;
  clean(lockDir: string): Promise<void>;
  isLocked(lockFile: string): Promise<boolean>;
}

export interface IStorageProvider {
  upload(key: string, content: Buffer | string, contentType?: string): Promise<string>;
  exists(key: string): Promise<boolean>;
  delete(key: string): Promise<void>;
  getUrl(key: string): Promise<string>;
}

/**
 * Error types
 */
export class CcanywhereError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: any
  ) {
    super(message);
    this.name = 'CcanywhereError';
  }
}

export class ConfigurationError extends CcanywhereError {
  constructor(message: string, details?: any) {
    super(message, 'CONFIGURATION_ERROR', details);
    this.name = 'ConfigurationError';
  }
}

export class BuildError extends CcanywhereError {
  constructor(message: string, details?: any) {
    super(message, 'BUILD_ERROR', details);
    this.name = 'BuildError';
  }
}

export class LockError extends CcanywhereError {
  constructor(message: string, details?: any) {
    super(message, 'LOCK_ERROR', details);
    this.name = 'LockError';
  }
}
