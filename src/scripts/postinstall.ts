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

async function postInstall(): Promise<void> {
  console.log(chalk.blue('🚀 CCanywhere post-install setup'));

  try {
    // Ensure common directories exist
    const lockDir = '/tmp/ccanywhere-locks';
    await ensureDir(lockDir);

    // Inject npm scripts into user's package.json
    await injectNpmScripts();

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
    console.log(
      'For more information, visit: ' + chalk.cyan('https://github.com/mylukin/ccanywhere')
    );
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
