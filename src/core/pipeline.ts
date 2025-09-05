/**
 * Main pipeline orchestrator
 */

import { resolve, join } from 'path';
import fsExtra from 'fs-extra';
const { ensureDir } = fsExtra;
import { execa } from 'execa';
import type {
  RuntimeContext,
  BuildResult,
  CcanywhereConfig,
  Logger,
  BuildArtifact,
  CommitInfo
} from '../types/index.js';
import { BuildError } from '../types/index.js';
import { HtmlDiffGenerator } from './diff-generator.js';
import { createDeploymentTrigger } from './deployment-trigger.js';
import { createTestRunner } from './test-runner.js';
import { NotificationManager } from './notifications/manager.js';
import { FileLockManager } from './lock-manager.js';

export interface PipelineConfig {
  workDir: string;
  config: CcanywhereConfig;
  logger: Logger;
  dryRun?: boolean;
}

export class BuildPipeline {
  private readonly workDir: string;
  private readonly config: CcanywhereConfig;
  private readonly logger: Logger;
  private readonly dryRun: boolean;
  private readonly lockManager: FileLockManager;
  private readonly notificationManager: NotificationManager;

  constructor({ workDir, config, logger, dryRun = false }: PipelineConfig) {
    this.workDir = resolve(workDir);
    this.config = config;
    this.logger = logger;
    this.dryRun = dryRun;
    this.lockManager = new FileLockManager();

    if (!config.notifications) {
      throw new BuildError('Notifications configuration is required');
    }
    this.notificationManager = new NotificationManager(config.notifications);
  }

  /**
   * Run the complete build pipeline
   */
  async run(base?: string, head?: string): Promise<BuildResult> {
    const startTime = Date.now();
    let context: RuntimeContext | undefined;
    let lockFile: string | undefined;

    try {
      // Create runtime context
      context = await this.createContext(base, head);
      lockFile = context.lockFile;

      // Set logger context
      if ('setContext' in this.logger) {
        (this.logger as any).setContext(context);
      }

      this.logger.buildStart(context.revision, context.branch);

      // Acquire lock
      if (!this.dryRun) {
        await this.lockManager.acquire(lockFile, this.config.build?.lockTimeout);
        this.logger.step('lock', 'Build lock acquired');
      }

      // Ensure directories exist
      await ensureDir(context.artifactsDir);
      await ensureDir(context.logDir);

      // Pull latest changes
      await this.pullLatestChanges(context);

      // Generate diff
      const diffArtifact = await this.generateDiff(context);

      // Trigger deployment
      let deploymentUrl: string | undefined;
      if (this.config.deployment && !this.dryRun) {
        deploymentUrl = await this.triggerDeployment(context);
      } else {
        this.logger.step('deploy', 'Deployment skipped (dry run or not configured)');
      }

      // Run tests
      const testResult = await this.runTests(context);

      // Get commit info
      const commitInfo = await this.getCommitInfo(context);

      // Build artifacts
      const artifacts: BuildArtifact[] = [diffArtifact];
      if (testResult.reportUrl) {
        artifacts.push({
          type: 'report',
          url: testResult.reportUrl,
          path: '', // Not applicable for test reports
          timestamp: context.timestamp
        });
      }

      const duration = Date.now() - startTime;
      const result: BuildResult = {
        success: true,
        revision: context.revision,
        branch: context.branch,
        timestamp: context.timestamp,
        duration,
        artifacts,
        deploymentUrl,
        testResults: testResult,
        commitInfo
      };

      // Send success notification
      if (!this.dryRun) {
        await this.sendSuccessNotification(result);
      }

      this.logger.buildComplete(true, duration, { artifactCount: artifacts.length });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      const currentStep = this.getCurrentStep(error);

      this.logger.buildError(currentStep, errorMessage);

      // Send error notification
      if (!this.dryRun && context) {
        try {
          await this.sendErrorNotification(context, errorMessage, currentStep);
        } catch (notifyError) {
          this.logger.error('Failed to send error notification', { error: notifyError });
        }
      }

      const result: BuildResult = {
        success: false,
        revision: context?.revision || 'unknown',
        branch: context?.branch || 'unknown',
        timestamp: context?.timestamp || startTime,
        duration,
        artifacts: [],
        error: errorMessage
      };

      this.logger.buildComplete(false, duration, { error: errorMessage });

      return result;
    } finally {
      // Always release lock
      if (lockFile && !this.dryRun) {
        try {
          await this.lockManager.release(lockFile);
          this.logger.step('lock', 'Build lock released');
        } catch (error) {
          this.logger.warn('Failed to release lock', { error });
        }
      }
    }
  }

  /**
   * Create runtime context
   */
  private async createContext(base?: string, head?: string): Promise<RuntimeContext> {
    const timestamp = Date.now();
    const revision = await this.getRevision(head);
    const branch = await this.getBranch();

    const context: RuntimeContext = {
      config: this.config,
      timestamp,
      revision,
      branch,
      workDir: this.workDir,
      artifactsDir: join(this.workDir, '.artifacts'),
      logDir: join(this.workDir, '../logs'),
      lockFile: '/tmp/ccanywhere-locks/main.lock'
    };

    return context;
  }

  /**
   * Get current git revision
   */
  private async getRevision(head?: string): Promise<string> {
    try {
      const result = await execa('git', ['rev-parse', '--short', head || 'HEAD'], {
        cwd: this.workDir
      });
      return result.stdout.trim();
    } catch (error) {
      return 'unknown';
    }
  }

  /**
   * Get current git branch
   */
  private async getBranch(): Promise<string> {
    try {
      const result = await execa('git', ['symbolic-ref', '--short', 'HEAD'], {
        cwd: this.workDir
      });
      return result.stdout.trim();
    } catch (error) {
      return 'detached';
    }
  }

  /**
   * Pull latest changes from git
   */
  private async pullLatestChanges(context: RuntimeContext): Promise<void> {
    this.logger.step('git', 'Pulling latest changes');

    try {
      if (!this.dryRun) {
        await execa('git', ['fetch', 'origin'], { cwd: context.workDir });
      }
      this.logger.step('git', 'Git fetch completed');
    } catch (error) {
      this.logger.warn('Git fetch failed', { error });
    }
  }

  /**
   * Generate diff HTML
   */
  private async generateDiff(context: RuntimeContext): Promise<BuildArtifact> {
    const baseBranch = this.config.build?.base || 'origin/main';
    this.logger.step('diff', `Generating diff from ${baseBranch} to HEAD`);

    const diffGenerator = new HtmlDiffGenerator();
    const artifact = await diffGenerator.generate(baseBranch, 'HEAD', context);

    this.logger.step('diff', 'Diff generation completed', { url: artifact.url });
    return artifact;
  }

  /**
   * Trigger deployment
   */
  private async triggerDeployment(context: RuntimeContext): Promise<string | undefined> {
    this.logger.step('deploy', 'Triggering deployment');

    const deploymentTrigger = createDeploymentTrigger('dokploy');
    const deploymentInfo = await deploymentTrigger.trigger(context);

    if (deploymentInfo.status === 'success' || deploymentInfo.status === 'running') {
      this.logger.step('deploy', 'Deployment triggered successfully', {
        status: deploymentInfo.status,
        url: deploymentInfo.url
      });
      return deploymentInfo.url;
    } else {
      this.logger.warn('Deployment trigger failed', {
        status: deploymentInfo.status,
        error: deploymentInfo.error
      });
      return undefined;
    }
  }

  /**
   * Run tests
   */
  private async runTests(context: RuntimeContext) {
    // Check if tests are enabled
    if (context.config.test?.enabled === false) {
      this.logger.step('test', 'Tests disabled by configuration');
      return {
        status: 'skipped' as const,
        passed: 0,
        failed: 0,
        skipped: 0,
        duration: 0,
        message: 'Tests disabled by configuration',
        reportUrl: undefined
      };
    }

    this.logger.step('test', 'Running tests');

    const testRunner = createTestRunner(context.config.test);
    const testResult = await testRunner.run(context);

    this.logger.step('test', 'Test execution completed', {
      status: testResult.status,
      passed: testResult.passed,
      failed: testResult.failed,
      duration: testResult.duration
    });

    return testResult;
  }

  /**
   * Get commit information
   */
  private async getCommitInfo(context: RuntimeContext): Promise<CommitInfo> {
    try {
      const [authorResult, messageResult, timestampResult] = await Promise.all([
        execa('git', ['log', '-1', '--pretty=format:%an'], { cwd: context.workDir }),
        execa('git', ['log', '-1', '--pretty=format:%s'], { cwd: context.workDir }),
        execa('git', ['log', '-1', '--pretty=format:%ct'], { cwd: context.workDir })
      ]);

      return {
        sha: context.revision,
        shortSha: context.revision,
        author: authorResult.stdout.trim(),
        message: messageResult.stdout.trim(),
        timestamp: parseInt(timestampResult.stdout.trim()) * 1000
      };
    } catch (error) {
      return {
        sha: context.revision,
        shortSha: context.revision,
        author: 'Unknown',
        message: 'No commit message',
        timestamp: context.timestamp
      };
    }
  }

  /**
   * Send success notification
   */
  private async sendSuccessNotification(result: BuildResult): Promise<void> {
    const diffUrl = result.artifacts.find(a => a.type === 'diff')?.url;
    const reportUrl = result.testResults?.reportUrl;
    const extra = result.commitInfo
      ? `Commit: ${result.commitInfo.message} by ${result.commitInfo.author} (${Math.round(result.duration / 1000)}s)`
      : `Build completed in ${Math.round(result.duration / 1000)}s`;

    const message = this.notificationManager.createSuccessNotification(
      result.revision,
      diffUrl,
      result.deploymentUrl,
      reportUrl,
      extra
    );

    await this.notificationManager.send(message);
    this.logger.step('notify', 'Success notification sent');
  }

  /**
   * Send error notification
   */
  private async sendErrorNotification(
    context: RuntimeContext,
    error: string,
    step: string
  ): Promise<void> {
    const message = this.notificationManager.createErrorNotification(context.revision, error, step);

    await this.notificationManager.send(message);
    this.logger.step('notify', 'Error notification sent');
  }

  /**
   * Extract current step from error
   */
  private getCurrentStep(error: unknown): string {
    if (error instanceof BuildError) {
      // Could add step tracking to BuildError
      return 'build';
    }

    const errorMessage = error instanceof Error ? error.message : String(error);

    if (errorMessage.includes('diff')) return 'diff';
    if (errorMessage.includes('deploy')) return 'deploy';
    if (errorMessage.includes('test')) return 'test';
    if (errorMessage.includes('lock')) return 'lock';
    if (errorMessage.includes('git')) return 'git';

    return 'unknown';
  }
}
