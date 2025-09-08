/**
 * Run command - Execute the build pipeline
 */

import { resolve, join } from 'path';
import chalkModule from 'chalk';
const chalk = chalkModule;
import oraModule from 'ora';
const ora = oraModule;
import fsExtra from 'fs-extra';
const { pathExists } = fsExtra;
import inquirerModule from 'inquirer';
const inquirer = inquirerModule;
import { execa } from 'execa';
import { ConfigLoader } from '../../config/index.js';
import { createLogger } from '../../core/logger.js';
import { BuildPipeline } from '../../core/pipeline.js';
import { initCommand } from './init.js';
import type { CliOptions } from '../../types/index.js';

interface RunOptions extends CliOptions {
  base?: string;
  head?: string;
  workDir?: string;
  hookMode?: boolean;
}

export async function runCommand(options: RunOptions): Promise<void> {
  // Check if running in hook mode (from Claude Code hooks or CI/CD)
  const isHookMode = options.hookMode || process.env.CCANYWHERE_HOOK_MODE === 'true';
  
  // Check if configuration exists
  const configPaths = [
    'ccanywhere.config.json',
    'ccanywhere.config.js',
    '.ccanywhere.json',
    '.ccanywhere.js'
  ];
  
  let configExists = false;
  if (options.config) {
    configExists = await pathExists(options.config);
  } else {
    for (const path of configPaths) {
      if (await pathExists(path)) {
        configExists = true;
        break;
      }
    }
  }
  
  // Handle missing configuration
  if (!configExists) {
    if (isHookMode) {
      // In hook mode, silently exit if no config
      if (process.env.CCANYWHERE_DEBUG === 'true') {
        console.log(chalk.gray('[CCanywhere] No configuration found, skipping (hook mode)'));
      }
      process.exit(0);
    } else {
      // In manual mode, prompt to initialize
      console.log(chalk.yellow('⚠️  No CCanywhere configuration found in this project'));
      console.log(chalk.gray('    CCanywhere needs a project configuration to run.'));
      console.log(chalk.gray('    User configuration: ~/.claude/ccanywhere.config.json (if exists)'));
      console.log(chalk.gray('    Project configuration: ./ccanywhere.config.json (required)'));
      console.log();
      
      const { shouldInit } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'shouldInit',
          message: 'Would you like to initialize CCanywhere now?',
          default: true
        }
      ]);
      
      if (shouldInit) {
        console.log();
        await initCommand({});
        console.log();
        console.log(chalk.blue('ℹ️  Please configure your .env file and run again'));
        process.exit(0);
      } else {
        console.log(chalk.gray('Run "ccanywhere init" to set up configuration'));
        process.exit(0);
      }
    }
  }
  
  const spinner = ora('Initializing CCanywhere...').start();
  
  try {
    // Load configuration
    const configLoader = ConfigLoader.getInstance();
    const config = await configLoader.loadConfig(options.config);
    
    spinner.succeed('Configuration loaded');

    // Setup logger
    const workDir = resolve(options.workDir || process.cwd());
    const logDir = resolve(workDir, '../logs');
    
    // Check if we're in a git repository
    const gitPath = join(workDir, '.git');
    const isGitRepo = await pathExists(gitPath);
    
    if (!isGitRepo) {
      spinner.stop();
      console.log();
      console.log(chalk.yellow('⚠️  CCanywhere requires a Git repository to work properly'));
      console.log(chalk.gray('    CCanywhere analyzes git diffs to generate change reports.'));
      console.log(chalk.gray('    Without Git, it cannot detect or track code changes.'));
      console.log();
      
      // Check if in hook mode
      if (isHookMode) {
        // In hook mode, silently exit
        if (process.env.CCANYWHERE_DEBUG === 'true') {
          console.log(chalk.gray('[CCanywhere] Not a git repository, skipping (hook mode)'));
        }
        process.exit(0);
      }
      
      // Ask if user wants to initialize git
      const { shouldInitGit } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'shouldInitGit',
          message: 'Would you like to initialize a Git repository now?',
          default: true
        }
      ]);
      
      if (shouldInitGit) {
        try {
          console.log();
          const gitSpinner = ora('Initializing Git repository...').start();
          await execa('git', ['init'], { cwd: workDir });
          gitSpinner.succeed('Git repository initialized');
          
          // Suggest next steps
          console.log();
          console.log(chalk.green('✅ Git repository created successfully!'));
          console.log();
          console.log(chalk.blue('Next steps:'));
          console.log(chalk.gray('  1. Add files to git:') + chalk.cyan(' git add .'));
          console.log(chalk.gray('  2. Create initial commit:') + chalk.cyan(' git commit -m "Initial commit"'));
          console.log(chalk.gray('  3. Run CCanywhere again:') + chalk.cyan(' ccanywhere run'));
          console.log();
          console.log(chalk.yellow('ℹ️  Please make at least one commit before running CCanywhere'));
        } catch (error) {
          console.error(chalk.red('Failed to initialize Git repository:'), error);
        }
        process.exit(0);
      } else {
        console.log();
        console.log(chalk.gray('To use CCanywhere, please initialize Git manually:'));
        console.log(chalk.cyan('  git init'));
        console.log(chalk.cyan('  git add .'));
        console.log(chalk.cyan('  git commit -m "Initial commit"'));
        console.log();
        process.exit(0);
      }
    }
    
    // Check if there are any commits in the repository
    try {
      await execa('git', ['rev-parse', 'HEAD'], { cwd: workDir });
    } catch (error) {
      spinner.stop();
      console.log();
      console.log(chalk.yellow('⚠️  No commits found in the Git repository'));
      console.log(chalk.gray('    CCanywhere needs at least one commit to generate diffs.'));
      console.log();
      console.log(chalk.blue('Please create an initial commit:'));
      console.log(chalk.cyan('  git add .'));
      console.log(chalk.cyan('  git commit -m "Initial commit"'));
      console.log();
      process.exit(0);
    }
    
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
      
      // Show test results even on failure
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