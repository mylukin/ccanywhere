/**
 * Playwright test runner module
 */

import { join } from 'path';
import fsExtra from 'fs-extra';
const { pathExists, ensureDir, copy } = fsExtra;
import { execa } from 'execa';
import type { ExecaError } from 'execa';
import { glob } from 'glob';
import type { TestRunner, TestResult, RuntimeContext, TestStatus } from '../types/index.js';
import { BuildError } from '../types/index.js';

export interface PlaywrightConfig {
  configFile?: string;
  reporter?: string;
  trace?: boolean;
  video?: boolean;
  screenshot?: boolean | string;
  maxFailures?: number;
  timeout?: number;
  workers?: number;
}

export class PlaywrightTestRunner implements TestRunner {
  private readonly defaultConfig: PlaywrightConfig = {
    reporter: 'html',
    trace: true,
    video: false,
    screenshot: 'only-on-failure',
    maxFailures: 10,
    timeout: 30000,
    workers: 1
  };

  constructor(private readonly config: PlaywrightConfig = {}) {
    this.config = { ...this.defaultConfig, ...config };
  }

  /**
   * Run Playwright tests
   */
  async run(context: RuntimeContext): Promise<TestResult> {
    const startTime = Date.now();

    try {
      // Check if Playwright is available and configured
      await this.validatePlaywrightSetup(context.workDir);

      // Prepare test environment
      await this.prepareTestEnvironment(context);

      // Run tests
      const testOutput = await this.executeTests(context);

      // Parse results
      const testResult = await this.parseTestResults(testOutput, context, startTime);

      // Copy artifacts
      await this.copyTestArtifacts(context, testResult);

      return testResult;
    } catch (error) {
      const duration = Date.now() - startTime;

      if (error instanceof BuildError) {
        throw error;
      }

      return {
        status: 'failed',
        passed: 0,
        failed: 1,
        skipped: 0,
        duration,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Validate Playwright setup
   */
  private async validatePlaywrightSetup(workDir: string): Promise<void> {
    // Check for Playwright config files
    const configFiles = ['playwright.config.js', 'playwright.config.ts', 'playwright.config.mjs'];

    let configExists = false;
    for (const configFile of configFiles) {
      if (await pathExists(join(workDir, configFile))) {
        configExists = true;
        this.config.configFile = configFile;
        break;
      }
    }

    if (!configExists) {
      throw new BuildError(
        'Playwright configuration file not found. Expected playwright.config.js, playwright.config.ts, or playwright.config.mjs'
      );
    }

    // Check if Playwright is installed
    try {
      await execa('npx', ['playwright', '--version'], { cwd: workDir });
    } catch (error) {
      throw new BuildError('Playwright is not installed. Run: npm install -D @playwright/test');
    }

    // Check for test files
    const testFiles = await glob('**/*.{spec,test}.{js,ts,mjs}', {
      cwd: workDir,
      ignore: ['node_modules/**', 'dist/**', 'build/**']
    });

    if (testFiles.length === 0) {
      throw new BuildError('No Playwright test files found');
    }
  }

  /**
   * Prepare test environment
   */
  private async prepareTestEnvironment(context: RuntimeContext): Promise<void> {
    // Ensure artifacts directory exists
    await ensureDir(context.artifactsDir);

    // Set environment variables for tests
    const testEnv = {
      ...process.env,
      ARTIFACTS_DIR: context.artifactsDir,
      STAGING_URL: context.config.urls?.staging || '',
      TEST_TIMEOUT: this.config.timeout?.toString(),
      CI: 'true',
      PLAYWRIGHT_HTML_REPORT: join(context.artifactsDir, `playwright-report-${context.revision}`)
    };

    // Store environment for test execution
    (this as any).testEnv = testEnv;
  }

  /**
   * Execute Playwright tests
   */
  private async executeTests(context: RuntimeContext): Promise<string> {
    const args = ['playwright', 'test'];

    // Add configuration file
    if (this.config.configFile) {
      args.push('--config', this.config.configFile);
    }

    // Add reporter
    if (this.config.reporter) {
      args.push('--reporter', this.config.reporter);
    }

    // Add trace collection
    if (this.config.trace) {
      args.push('--trace', 'on');
    }

    // Add video recording
    if (this.config.video) {
      args.push('--video', this.config.video === true ? 'on' : String(this.config.video));
    }

    // Add screenshot options
    if (this.config.screenshot) {
      args.push('--screenshot', String(this.config.screenshot));
    }

    // Add max failures
    if (this.config.maxFailures) {
      args.push('--max-failures', String(this.config.maxFailures));
    }

    // Add workers
    if (this.config.workers) {
      args.push('--workers', String(this.config.workers));
    }

    try {
      const result = await execa('npx', args, {
        cwd: context.workDir,
        env: (this as any).testEnv,
        timeout: (this.config.timeout || 300000) + 30000, // Add buffer
        stripFinalNewline: false
      });

      return result.stdout;
    } catch (error: unknown) {
      // Check if error has ExecaError properties
      if (error && typeof error === 'object' && 'exitCode' in error && 'stdout' in error) {
        const execaErr = error as ExecaError;
        // Playwright may exit with non-zero code even on partial success
        return execaErr.stdout || execaErr.stderr || '';
      }
      throw new BuildError(
        `Test execution failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Parse test results from Playwright output
   */
  private async parseTestResults(
    output: string,
    context: RuntimeContext,
    startTime: number
  ): Promise<TestResult> {
    const duration = Date.now() - startTime;

    // Parse Playwright's summary output
    const summaryRegex = /(\d+)\s+passed.*?(?:(\d+)\s+failed)?.*?(?:(\d+)\s+skipped)?/i;
    const match = output.match(summaryRegex);

    let passed = 0;
    let failed = 0;
    let skipped = 0;

    if (match) {
      passed = parseInt(match[1] || '0');
      failed = parseInt(match[2] || '0');
      skipped = parseInt(match[3] || '0');
    } else {
      // Fallback: try to detect failures from output
      if (output.includes('failed') || output.includes('error')) {
        failed = 1;
      } else if (output.includes('passed') || output.includes('success')) {
        passed = 1;
      }
    }

    // Determine overall status
    let status: TestStatus;
    if (failed > 0) {
      status = 'failed';
    } else if (passed > 0) {
      status = 'passed';
    } else if (skipped > 0) {
      status = 'skipped';
    } else {
      status = 'failed'; // No clear result
    }

    const result: TestResult = {
      status,
      passed,
      failed,
      skipped,
      duration
    };

    // Add report URL if HTML report was generated
    const reportDir = join(context.artifactsDir, `playwright-report-${context.revision}`);
    if (await pathExists(join(reportDir, 'index.html'))) {
      result.reportUrl = `${context.config.urls?.artifacts || ''}/playwright-report-${context.revision}/index.html`;
    }

    return result;
  }

  /**
   * Copy test artifacts to artifacts directory
   */
  private async copyTestArtifacts(context: RuntimeContext, testResult: TestResult): Promise<void> {
    const workDir = context.workDir;
    const artifactsDir = context.artifactsDir;
    const revision = context.revision;

    try {
      // Copy Playwright HTML report
      const defaultReportDir = join(workDir, 'playwright-report');
      const targetReportDir = join(artifactsDir, `playwright-report-${revision}`);

      if (await pathExists(defaultReportDir)) {
        await copy(defaultReportDir, targetReportDir);
      }

      // Copy test results (JSON reports, etc.)
      const testResultsDir = join(workDir, 'test-results');
      if (await pathExists(testResultsDir)) {
        const targetResultsDir = join(artifactsDir, `test-results-${revision}`);
        await copy(testResultsDir, targetResultsDir);
      }

      // Find and copy trace files
      const traceFiles = await glob('**/trace.zip', { cwd: workDir, absolute: true });
      if (traceFiles.length > 0) {
        const traceDir = join(artifactsDir, `traces-${revision}`);
        await ensureDir(traceDir);

        const traceUrls: string[] = [];

        for (let i = 0; i < traceFiles.length; i++) {
          const traceFile = traceFiles[i]!;
          const targetFile = join(traceDir, `trace-${i + 1}.zip`);
          await copy(traceFile, targetFile);

          traceUrls.push(
            `${context.config.urls?.artifacts || ''}/traces-${revision}/trace-${i + 1}.zip`
          );
        }

        testResult.traceUrls = traceUrls;
      }

      // Copy screenshots if they exist
      const screenshotDirs = await glob('**/test-results/*', {
        cwd: workDir,
        withFileTypes: false,
        absolute: true
      });

      if (screenshotDirs.length > 0) {
        const screenshotsDir = join(artifactsDir, `screenshots-${revision}`);
        await ensureDir(screenshotsDir);

        for (const dir of screenshotDirs) {
          const dirName = dir.split('/').pop() || 'unknown';
          await copy(dir, join(screenshotsDir, dirName));
        }
      }
    } catch (error) {
      console.warn(
        `Failed to copy some test artifacts: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Install Playwright browsers if needed
   */
  async installBrowsers(workDir: string): Promise<void> {
    try {
      await execa('npx', ['playwright', 'install'], { cwd: workDir });
    } catch (error) {
      throw new BuildError(
        `Failed to install Playwright browsers: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get supported browsers
   */
  async getSupportedBrowsers(workDir: string): Promise<string[]> {
    try {
      const result = await execa('npx', ['playwright', 'install', '--dry-run'], { cwd: workDir });
      const browsers = result.stdout
        .split('\n')
        .filter((line: string) => line.includes('browser'))
        .map((line: string) => line.split(' ')[0])
        .filter((browser): browser is string => Boolean(browser));

      return browsers;
    } catch (error) {
      return ['chromium', 'firefox', 'webkit']; // Default browsers
    }
  }
}

/**
 * Create a test runner with default configuration
 */
export function createTestRunner(config?: PlaywrightConfig): TestRunner {
  return new PlaywrightTestRunner(config);
}
