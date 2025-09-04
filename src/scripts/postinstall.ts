#!/usr/bin/env node

/**
 * Post-install script for CCanywhere
 */

import fsExtra from 'fs-extra';
const { ensureDir } = fsExtra;
import chalkModule from 'chalk';
const chalk = chalkModule;

async function postInstall(): Promise<void> {
  console.log(chalk.blue('🚀 CCanywhere post-install setup'));

  try {
    // Ensure common directories exist
    const lockDir = '/tmp/ccanywhere-locks';
    await ensureDir(lockDir);

    console.log(chalk.green('✅ CCanywhere installation completed successfully!'));
    console.log();
    console.log(chalk.blue('Getting started:'));
    console.log('1. Run ' + chalk.cyan('ccanywhere init') + ' in your project directory');
    console.log('2. Configure your .env file with your actual credentials');
    console.log('3. Test your setup with ' + chalk.cyan('ccanywhere test'));
    console.log('4. Run your first build with ' + chalk.cyan('ccanywhere run'));
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
