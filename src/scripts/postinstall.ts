#!/usr/bin/env node

/**
 * Post-install script for CCanywhere
 */

import fsExtra from 'fs-extra';
const { ensureDir } = fsExtra;
import chalkModule from 'chalk';
const chalk = chalkModule;
import path from 'path';
import { PackageManager } from '../utils/package-manager.js';
import { ClaudeCodeDetector } from '../utils/claude-detector.js';
import { HookInjector } from '../utils/hook-injector.js';

async function injectNpmScripts(): Promise<void> {
  try {
    // Find the nearest package.json (user's project)
    const packageJsonPath = await PackageManager.findPackageJson();

    if (!packageJsonPath) {
      console.log(chalk.yellow('ℹ️  No package.json found, skipping script injection'));
      return;
    }

    // Check if we're inside the ccanywhere package itself
    if (await PackageManager.isCcanywherePackage(packageJsonPath)) {
      console.log(chalk.gray('🏠 Inside CCanywhere package, skipping script injection'));
      return;
    }

    console.log(chalk.blue('📦 Found package.json at:'), chalk.gray(packageJsonPath));

    // Get default scripts to inject
    const scriptsToInject = PackageManager.getDefaultScripts();

    // Inject scripts
    const result = await PackageManager.injectScripts(packageJsonPath, scriptsToInject);

    if (result.added.length > 0) {
      console.log(chalk.green('✅ Added CCanywhere scripts to package.json:'));
      for (const script of result.added) {
        console.log(`   ${chalk.cyan(script.name)}: ${chalk.gray(script.command)}`);
      }
    }

    if (result.skipped.length > 0) {
      console.log(chalk.yellow('⏭️  Skipped existing scripts:'));
      for (const script of result.skipped) {
        console.log(`   ${chalk.yellow(script.name)}: already exists`);
      }
    }

    if (result.added.length === 0 && result.skipped.length === 0) {
      console.log(chalk.gray('ℹ️  No scripts to add'));
    }
  } catch (error) {
    console.log(chalk.yellow('⚠️  Failed to inject npm scripts:'));
    console.log(chalk.yellow(error instanceof Error ? error.message : String(error)));
    console.log(chalk.gray('You can manually add the scripts later using:'));
    console.log(chalk.gray('  ccanywhere:run - ccanywhere run'));
    console.log(chalk.gray('  ccanywhere:test - ccanywhere test'));
    console.log(chalk.gray('  ccanywhere:init - ccanywhere init'));
  }
}

async function handleClaudeCodeIntegration(): Promise<void> {
  try {
    // Check if this is a global installation
    const isGlobalInstall = await PackageManager.isGlobalInstall();

    if (!isGlobalInstall) {
      console.log(chalk.gray('🏠 Local installation - skipping Claude Code auto-registration'));
      console.log(chalk.gray('   Use "ccanywhere claude-register" to manually register hooks'));
      return;
    }

    console.log(chalk.blue('🌍 Global installation detected - checking Claude Code integration...'));

    // Detect Claude Code environment
    const environment = await ClaudeCodeDetector.detectEnvironment();

    if (!environment.isClaudeCode) {
      console.log(chalk.gray('🔍 Claude Code not detected'));
      console.log(chalk.gray('   You can register hooks later with: ccanywhere claude-register'));
      return;
    }

    console.log(chalk.green('✅ Claude Code detected!'));
    console.log(chalk.gray(`   Config: ${environment.configDir}`));

    // Check if hooks are already injected
    const alreadyInjected = await HookInjector.areHooksInjected();
    if (alreadyInjected) {
      console.log(chalk.yellow('⚠️  CCanywhere hooks already registered with Claude Code'));
      return;
    }

    // Auto-inject hooks with conservative defaults
    console.log(chalk.blue('🔧 Auto-registering CCanywhere hooks with Claude Code...'));

    const result = await HookInjector.injectHooks({
      enablePreCommit: false, // Conservative: don't auto-enable pre-commit
      enablePostRun: true, // Enable post-run for full pipeline
      enablePreTest: false, // Conservative: don't auto-enable pre-test
      enablePostTest: false, // Conservative: don't auto-enable post-test
      createBackup: true, // Always create backup
      force: false // Don't overwrite existing
    });

    if (result.success) {
      console.log(chalk.green('🎉 CCanywhere is now integrated with Claude Code!'));

      if (result.hooksAdded.length > 0) {
        console.log(chalk.cyan('   Registered hooks:'));
        for (const hook of result.hooksAdded) {
          console.log(chalk.cyan(`     • ${hook}`));
        }
      }

      if (result.backupPath) {
        console.log(chalk.gray(`   Backup created: ${path.basename(result.backupPath)}`));
      }

      console.log();
      console.log(chalk.blue('📝 What happens now:'));
      console.log(chalk.gray('  • CCanywhere will run automatically after Claude Code operations'));
      console.log(chalk.gray('  • Your diffs and artifacts will be generated seamlessly'));
      console.log(chalk.gray('  • Use "ccanywhere claude-register --status" to see current configuration'));
      console.log(chalk.gray('  • Use "ccanywhere claude-register" to modify hook settings'));
    } else {
      console.log(chalk.yellow('⚠️  Auto-registration failed (this is okay):'));
      console.log(chalk.yellow(`   ${result.message}`));
      console.log(chalk.gray('   You can register manually with: ccanywhere claude-register'));
    }
  } catch (error) {
    // Don't fail the installation on Claude Code integration errors
    console.log(chalk.yellow('⚠️  Claude Code integration encountered an issue:'));
    console.log(chalk.yellow(error instanceof Error ? error.message : String(error)));
    console.log(chalk.gray('   You can register manually with: ccanywhere claude-register'));
  }
}

async function postInstall(): Promise<void> {
  console.log(chalk.blue('🚀 CCanywhere post-install setup'));

  try {
    // Ensure common directories exist
    const lockDir = '/tmp/ccanywhere-locks';
    await ensureDir(lockDir);

    // Inject npm scripts into user's package.json
    await injectNpmScripts();

    // Handle Claude Code integration for global installs
    await handleClaudeCodeIntegration();

    console.log();
    console.log(chalk.green('✅ CCanywhere installation completed successfully!'));
    console.log();
    console.log(chalk.blue('Getting started:'));
    console.log('1. Run ' + chalk.cyan('npm run ccanywhere:init') + ' in your project directory');
    console.log('   (or ' + chalk.cyan('ccanywhere init') + ' if you have it globally)');
    console.log('2. Configure your .env file with your actual credentials');
    console.log('3. Test your setup with ' + chalk.cyan('npm run ccanywhere:test'));
    console.log('4. Run your first build with ' + chalk.cyan('npm run ccanywhere:run'));
    console.log();
    console.log('For more information, visit: ' + chalk.cyan('https://github.com/mylukin/ccanywhere'));
  } catch (error) {
    console.warn(chalk.yellow('Warning: Post-install setup encountered issues'));
    console.warn(error instanceof Error ? error.message : String(error));

    // Don't fail the installation
    process.exit(0);
  }
}

// ES Module entry point
postInstall().catch(error => {
  console.error('Post-install failed:', error);
  process.exit(1);
});
