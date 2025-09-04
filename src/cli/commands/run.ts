/**
 * Run command - Execute the build pipeline
 */

import { resolve } from 'path';
import chalkModule from 'chalk';
const chalk = chalkModule;
import oraModule from 'ora';
const ora = oraModule;
import { ConfigLoader } from '../../config/index.js';
import { createLogger } from '../../core/logger.js';
import { BuildPipeline } from '../../core/pipeline.js';
import type { CliOptions } from '../../types/index.js';

interface RunOptions extends CliOptions {
  base?: string;
  head?: string;
  workDir?: string;
}

export async function runCommand(options: RunOptions): Promise<void> {
  const spinner = ora('Initializing CCanywhere...').start();
  
  try {
    // Load configuration
    const configLoader = ConfigLoader.getInstance();
    const config = await configLoader.loadConfig(options.config);
    
    spinner.succeed('Configuration loaded');

    // Setup logger
    const workDir = resolve(options.workDir || process.cwd());
    const logDir = resolve(workDir, '../logs');
    
    const logger = createLogger({
      logDir,
      level: options.verbose ? 'debug' : 'info',
      console: true
    });

    // Create pipeline
    const pipeline = new BuildPipeline({
      workDir,
      config,
      logger,
      dryRun: options.dryRun
    });

    if (options.dryRun) {
      console.log(chalk.yellow('🏃 Running in dry-run mode'));
    }

    console.log(chalk.blue('🚀 Starting build pipeline...'));
    console.log(chalk.gray(`Working directory: ${workDir}`));
    console.log(chalk.gray(`Base: ${options.base || config.build?.base || 'origin/main'}`));
    console.log(chalk.gray(`Head: ${options.head || 'HEAD'}`));
    console.log();

    // Run pipeline
    const result = await pipeline.run(options.base, options.head);

    // Display results
    console.log();
    if (result.success) {
      console.log(chalk.green('✅ Build completed successfully!'));
      console.log(chalk.gray(`Duration: ${Math.round(result.duration / 1000)}s`));
      console.log(chalk.gray(`Revision: ${result.revision}`));
      console.log(chalk.gray(`Branch: ${result.branch}`));
      
      if (result.artifacts.length > 0) {
        console.log();
        console.log(chalk.blue('📦 Generated artifacts:'));
        result.artifacts.forEach(artifact => {
          console.log(`  ${getArtifactEmoji(artifact.type)} ${artifact.type}: ${chalk.cyan(artifact.url)}`);
        });
      }
      
      if (result.deploymentUrl) {
        console.log();
        console.log(chalk.blue('🌐 Deployment URL:'));
        console.log(`  ${chalk.cyan(result.deploymentUrl)}`);
      }
      
      if (result.testResults) {
        console.log();
        console.log(chalk.blue('🧪 Test results:'));
        console.log(`  Status: ${getTestStatusEmoji(result.testResults.status)} ${result.testResults.status}`);
        console.log(`  Passed: ${chalk.green(result.testResults.passed)}`);
        console.log(`  Failed: ${chalk.red(result.testResults.failed)}`);
        console.log(`  Skipped: ${chalk.yellow(result.testResults.skipped)}`);
        
        if (result.testResults.reportUrl) {
          console.log(`  Report: ${chalk.cyan(result.testResults.reportUrl)}`);
        }
      }

      if (result.commitInfo) {
        console.log();
        console.log(chalk.blue('📝 Commit info:'));
        console.log(`  Author: ${result.commitInfo.author}`);
        console.log(`  Message: ${result.commitInfo.message}`);
      }

    } else {
      console.log(chalk.red('❌ Build failed!'));
      console.log(chalk.gray(`Duration: ${Math.round(result.duration / 1000)}s`));
      
      if (result.error) {
        console.log();
        console.log(chalk.red('Error details:'));
        console.log(chalk.gray(result.error));
      }
      
      process.exit(1);
    }

  } catch (error) {
    spinner.fail('Build failed');
    console.error(chalk.red('Error:'), error instanceof Error ? error.message : String(error));
    
    if (options.verbose && error instanceof Error) {
      console.error(chalk.gray(error.stack));
    }
    
    process.exit(1);
  }
}

function getArtifactEmoji(type: string): string {
  switch (type) {
    case 'diff': return '📝';
    case 'report': return '📊';
    case 'trace': return '🔍';
    default: return '📦';
  }
}

function getTestStatusEmoji(status: string): string {
  switch (status) {
    case 'passed': return '✅';
    case 'failed': return '❌';
    case 'skipped': return '⏭️';
    default: return '🔄';
  }
}