/**
 * Initialize user-level configuration
 * Manual initialization command for development and npm link scenarios
 */

import chalkModule from 'chalk';
const chalk = chalkModule;
import { Command } from 'commander';
import { initializeUserConfig, registerClaudeHooks } from '../../scripts/postinstall.js';
import { Logger } from '../../utils/logger.js';

interface InitUserOptions {
  force?: boolean;
  skipHooks?: boolean;
}

/**
 * Initialize user configuration command handler
 */
export async function initUserCommand(options: InitUserOptions): Promise<void> {
  const logger = Logger.getInstance();
  
  try {
    console.log();
    console.log(chalk.blue('🚀 Initializing CCanywhere User Configuration'));
    console.log(chalk.gray('='.repeat(50)));
    
    // Initialize user configuration
    const configCreated = await initializeUserConfig();
    
    // Register Claude Code hooks unless skipped
    if (!options.skipHooks) {
      await registerClaudeHooks();
    }
    
    // Show next steps
    console.log();
    console.log(chalk.green('✨ Initialization complete!'));
    console.log();
    
    if (configCreated) {
      console.log(chalk.yellow('📝 Next steps:'));
      console.log(chalk.gray('   1. Edit your user configuration:'));
      console.log(chalk.cyan('      ccanywhere config-user --edit'));
      console.log(chalk.gray('   2. Or set specific values:'));
      console.log(chalk.cyan('      ccanywhere config-user set notifications.telegram.botToken --value "YOUR_TOKEN"'));
      console.log(chalk.gray('   3. Initialize a project:'));
      console.log(chalk.cyan('      cd your-project && ccanywhere init'));
    } else {
      console.log(chalk.gray('💡 User configuration already exists'));
      console.log(chalk.gray('   Manage it with:'));
      console.log(chalk.cyan('   ccanywhere config-user --show'));
      console.log(chalk.cyan('   ccanywhere config-user --edit'));
    }
    
    console.log();
    console.log(chalk.gray('📚 Documentation: https://github.com/mylukin/ccanywhere'));
    console.log();
    
  } catch (error) {
    console.log(chalk.red('❌ Initialization failed:'));
    console.log(chalk.red(error instanceof Error ? error.message : String(error)));
    if (process.env.NODE_ENV === 'development') {
      logger.error('Init user error:', error);
    }
    process.exit(1);
  }
}

/**
 * Create the init-user command
 */
export function createInitUserCommand(): Command {
  return new Command('init-user')
    .description('Initialize user-level configuration and Claude Code hooks')
    .option('-f, --force', 'Force re-initialization')
    .option('--skip-hooks', 'Skip Claude Code hook registration')
    .action(initUserCommand);
}

export default createInitUserCommand;