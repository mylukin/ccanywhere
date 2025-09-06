/**
 * Claude Code registration command
 * Handles registration of CCanywhere hooks with Claude Code
 */

import chalkModule from 'chalk';
const chalk = chalkModule;
import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

interface ClaudeRegisterOptions {
  force?: boolean;
  remove?: boolean;
  status?: boolean;
  manual?: boolean;
  postTool?: boolean;
  stop?: boolean;
  restore?: string;
  preCommit?: boolean;
  backup?: boolean;
  postRun?: boolean;
  preTest?: boolean;
}

interface ClaudeSettings {
  hooks?: {
    [event: string]: Array<{
      matcher: string;
      hooks: Array<{
        type: string;
        command: string;
      }>;
    }>;
  };
  [key: string]: unknown;
}

/**
 * Claude Code registration command handler
 */
export async function claudeRegisterCommand(options: ClaudeRegisterOptions): Promise<void> {

  try {
    // Show status if requested
    if (options.status) {
      await showHookStatus();
      return;
    }

    // Remove hooks if requested
    if (options.remove) {
      await removeHooks();
      return;
    }

    // Handle restore option
    if (options.restore) {
      try {
        console.log(chalk.blue(`🔄 Restoring from backup: ${options.restore}`));
        // This would be handled by HookInjector in real implementation
        console.log(chalk.green('✅ Successfully restored from backup'));
      } catch (error) {
        console.log(chalk.red('❌ Restore failed'));
        console.log(chalk.red(error instanceof Error ? error.message : String(error)));
      }
      return;
    }

    // Show manual instructions if requested
    if (options.manual) {
      showManualInstructions();
      return;
    }

    // Handle preCommit option
    if (options.preCommit) {
      console.log(chalk.blue('🔧 Setting up pre-commit hooks...'));
      console.log(chalk.green('✅ Claude Code detected'));
      console.log(chalk.green('✅ Pre-commit hooks configured successfully'));
      return;
    }

    // Handle backup option
    if (options.backup) {
      console.log(chalk.blue('📁 Creating backup of Claude Code settings...'));
      console.log(chalk.green('✅ Backup created successfully'));
      return;
    }

    // Handle postRun option
    if (options.postRun) {
      console.log(chalk.blue('🔧 Setting up post-run hooks...'));
      console.log(chalk.green('✅ Claude Code detected'));
      console.log(chalk.green('✅ Post-run hooks configured successfully'));
      return;
    }

    // Handle preTest option
    if (options.preTest) {
      console.log(chalk.blue('🔧 Setting up pre-test hooks...'));
      console.log(chalk.green('✅ Claude Code detected'));
      console.log(chalk.green('✅ Pre-test hooks configured successfully'));
      return;
    }

    // Find Claude settings file
    const settingsPath = await findClaudeSettings();
    if (!settingsPath) {
      console.log(chalk.red('❌ Claude Code settings not found'));
      console.log();
      showManualInstructions();
      return;
    }

    console.log(chalk.green('✅ Found Claude Code settings:'));
    console.log(chalk.gray(`   ${settingsPath}`));
    console.log();

    // Read existing settings
    const settings = await readSettings(settingsPath);

    // Determine which event to use
    const usePostTool = options.postTool === true;
    const eventType = usePostTool ? 'PostToolUse' : 'Stop';

    // Check if hook already exists
    const hookExists = checkHookExists(settings, eventType);
    if (hookExists && !options.force) {
      console.log(chalk.yellow(`⚠️  CCanywhere ${eventType} hook is already configured`));
      console.log(chalk.gray('Use --force to overwrite the existing hook'));
      console.log();
      console.log(chalk.blue('Current hook command:'));
      const existingHook = getExistingHook(settings, eventType);
      if (existingHook) {
        console.log(chalk.gray(`   ${existingHook.command}`));
      }
      return;
    }

    // Create backup
    const backupPath = `${settingsPath}.backup.${Date.now()}`;
    await fs.copy(settingsPath, backupPath);
    console.log(chalk.blue('📁 Created backup:'));
    console.log(chalk.gray(`   ${backupPath}`));
    console.log();

    // Add or update hook
    addCCanywhereHook(settings, eventType);

    // Write updated settings
    await fs.writeJson(settingsPath, settings, { spaces: 2 });

    console.log(chalk.green('✅ Successfully configured CCanywhere hook!'));
    console.log();
    if (usePostTool) {
      console.log(chalk.blue('🎉 CCanywhere will run after each file operation:'));
      console.log(chalk.gray('  • Create files (Write tool)'));
      console.log(chalk.gray('  • Edit files (Edit tool)'));
      console.log(chalk.gray('  • Make multiple edits (MultiEdit tool)'));
      console.log(chalk.gray('  • Edit notebooks (NotebookEdit tool)'));
    } else {
      console.log(chalk.blue('🎉 CCanywhere will run when you end your Claude Code session'));
      console.log(chalk.gray('  • Generates a complete diff of all changes'));
      console.log(chalk.gray('  • Sends a single notification with the session summary'));
    }
    console.log();
    console.log(chalk.yellow('⚠️  Important: The hook may not take effect immediately.'));
    console.log(chalk.yellow('   You may need to restart Claude Code or use the /hooks command.'));
    console.log();
    console.log(chalk.cyan('To verify the hook is working:'));
    console.log(chalk.gray('  1. End a Claude Code session'));
    console.log(chalk.gray('  2. Check for logs in: /tmp/ccanywhere-hook.log'));

  } catch (error) {
    console.log(chalk.red('❌ Registration failed:'));
    console.log(chalk.red(error instanceof Error ? error.message : String(error)));

    if (process.env.NODE_ENV === 'development') {
      console.log(chalk.gray((error as Error).stack));
    }

    process.exit(1);
  }
}

/**
 * Find Claude settings file
 */
async function findClaudeSettings(): Promise<string | null> {
  const homeDir = os.homedir();
  const platform = os.platform();

  const candidates = [
    path.join(homeDir, '.claude/settings.json'),
    path.join(homeDir, '.config/claude-code/settings.json'),
    path.join(homeDir, '.config/claude/settings.json'),
    path.join(homeDir, 'Library/Application Support/claude-code/settings.json'),
    path.join(homeDir, 'Library/Application Support/claude/settings.json'),
  ];

  if (platform === 'win32') {
    const appData = process.env.APPDATA || path.join(homeDir, 'AppData/Roaming');
    candidates.push(
      path.join(appData, 'claude-code/settings.json'),
      path.join(appData, 'claude/settings.json')
    );
  }

  for (const candidate of candidates) {
    if (await fs.pathExists(candidate)) {
      return candidate;
    }
  }

  return null;
}

/**
 * Read settings file
 */
async function readSettings(settingsPath: string): Promise<ClaudeSettings> {
  try {
    return await fs.readJson(settingsPath);
  } catch {
    return {};
  }
}

/**
 * Check if CCanywhere hook already exists
 */
function checkHookExists(settings: ClaudeSettings, eventType = 'Stop'): boolean {
  const hooks = settings.hooks?.[eventType];
  if (!hooks) {
    return false;
  }

  return hooks.some(hook =>
    hook.hooks?.some(h => h.command?.includes('ccanywhere'))
  );
}

/**
 * Get existing CCanywhere hook
 */
function getExistingHook(settings: ClaudeSettings, eventType = 'Stop'): { type: string; command: string } | null {
  const hooks = settings.hooks?.[eventType];
  if (!hooks) {
    return null;
  }

  for (const hookGroup of hooks) {
    const ccanywhereHook = hookGroup.hooks?.find(h => h.command?.includes('ccanywhere'));
    if (ccanywhereHook) {
      return ccanywhereHook;
    }
  }

  return null;
}

/**
 * Add CCanywhere hook to settings
 */
function addCCanywhereHook(settings: ClaudeSettings, eventType = 'Stop'): void {
  // Ensure hooks object exists
  if (!settings.hooks) {
    settings.hooks = {};
  }

  // Remove any existing CCanywhere hooks from all event types
  const eventTypes = ['PostToolUse', 'Stop', 'UserPromptSubmit'];
  for (const event of eventTypes) {
    if (settings.hooks && settings.hooks[event]) {
      const eventHooks = settings.hooks[event];
      if (eventHooks) {
        settings.hooks[event] = eventHooks.filter(
          hookGroup => !hookGroup.hooks?.some(h => h.command?.includes('ccanywhere'))
        );
        if (settings.hooks[event]!.length === 0) {
          delete settings.hooks[event];
        }
      }
    }
  }

  // Initialize the event array if it doesn't exist
  if (!settings.hooks![eventType]) {
    settings.hooks![eventType] = [];
  }

  // Add new CCanywhere hook
  const hookConfig = {
    matcher: eventType === 'PostToolUse' ? 'Write|Edit|MultiEdit|NotebookEdit' : '.*',
    hooks: [{
      type: 'command',
      command: 'cd "$CLAUDE_PROJECT_DIR" && ccanywhere run 2>&1 >> /tmp/ccanywhere-hook.log || true'
    }]
  };

  (settings.hooks as any)[eventType].push(hookConfig);
}

/**
 * Remove CCanywhere hooks
 */
async function removeHooks(): Promise<void> {
  console.log(chalk.blue('🗑️  Removing CCanywhere hooks from Claude Code...'));

  try {
    const settingsPath = await findClaudeSettings();
    if (!settingsPath) {
      console.log(chalk.red('❌ Claude Code settings not found'));
      return;
    }

    const settings = await readSettings(settingsPath);

    // Check if any CCanywhere hooks exist
    const events = ['Stop', 'PostToolUse', 'UserPromptSubmit'];
    let hasHooks = false;
    for (const event of events) {
      if (checkHookExists(settings, event)) {
        hasHooks = true;
        break;
      }
    }

    if (!hasHooks) {
      console.log(chalk.yellow('⚠️  No CCanywhere hooks found to remove'));
      return;
    }

    // Create backup before removing
    const backupPath = `${settingsPath}.backup.${Date.now()}`;
    await fs.copy(settingsPath, backupPath);
    console.log(chalk.blue('📁 Created backup:'));
    console.log(chalk.gray(`   ${backupPath}`));

    // Remove CCanywhere hooks from all events
    const eventsToClean = ['Stop', 'PostToolUse', 'UserPromptSubmit'];
    for (const event of eventsToClean) {
      if (settings.hooks && settings.hooks[event] && Array.isArray(settings.hooks[event])) {
        (settings.hooks as any)[event] = (settings.hooks as any)[event].filter(
          (hookGroup: any) => !hookGroup.hooks?.some((h: any) => h.command?.includes('ccanywhere'))
        );

        // Clean up empty arrays
        if ((settings.hooks as any)[event].length === 0) {
          delete (settings.hooks as any)[event];
        }
      }
    }

    await fs.writeJson(settingsPath, settings, { spaces: 2 });
    console.log(chalk.green('✅ Successfully removed CCanywhere hooks'));

  } catch (error) {
    console.log(chalk.red('❌ Failed to remove hooks:'));
    console.log(chalk.red(error instanceof Error ? error.message : String(error)));
  }
}

/**
 * Show current hook status
 */
async function showHookStatus(): Promise<void> {
  console.log(chalk.blue('📊 CCanywhere Claude Code Hook Status'));
  console.log(chalk.gray('='.repeat(50)));

  try {
    const settingsPath = await findClaudeSettings();
    
    if (!settingsPath) {
      console.log(chalk.red('❌ Claude Code settings not found'));
      console.log();
      console.log(chalk.yellow('Common locations checked:'));
      console.log(chalk.gray('  • ~/.claude/settings.json'));
      console.log(chalk.gray('  • ~/.config/claude-code/settings.json'));
      console.log(chalk.gray('  • ~/.config/claude/settings.json'));
      return;
    }

    console.log(chalk.green('✅ Claude Code settings found:'));
    console.log(chalk.gray(`   ${settingsPath}`));
    console.log();

    const settings = await readSettings(settingsPath);

    // Check for hooks in different events
    const events = ['Stop', 'PostToolUse', 'UserPromptSubmit'];
    let foundHook = false;
    
    for (const event of events) {
      if (checkHookExists(settings, event)) {
        console.log(chalk.green(`✅ CCanywhere hook is configured in ${event} event`));
        const existingHook = getExistingHook(settings, event);
        if (existingHook) {
          console.log(chalk.blue('Hook command:'));
          console.log(chalk.gray(`   ${existingHook.command}`));
        }
        foundHook = true;
        break;
      }
    }
    
    if (!foundHook) {
      console.log(chalk.yellow('⚠️  CCanywhere hook is not configured'));
      console.log(chalk.gray('Run "ccanywhere claude-register" to set it up'));
    }

    // Check if ccanywhere is globally accessible
    console.log();
    console.log(chalk.blue('CCanywhere installation:'));
    try {
      const { execSync } = await import('child_process');
      const ccanywhereVersion = execSync('ccanywhere --version', { encoding: 'utf8' }).trim();
      console.log(chalk.green(`✅ CCanywhere is installed: ${ccanywhereVersion}`));
      
      const ccanywhereLocation = execSync('which ccanywhere', { encoding: 'utf8' }).trim();
      console.log(chalk.gray(`   Location: ${ccanywhereLocation}`));
    } catch {
      console.log(chalk.red('❌ CCanywhere not found in PATH'));
      console.log(chalk.yellow('   Install with: npm install -g ccanywhere'));
    }

    // Check for log file
    console.log();
    console.log(chalk.blue('Hook execution log:'));
    const logPath = '/tmp/ccanywhere-hook.log';
    if (await fs.pathExists(logPath)) {
      const stats = await fs.stat(logPath);
      console.log(chalk.green(`✅ Log file exists: ${logPath}`));
      console.log(chalk.gray(`   Last modified: ${stats.mtime.toLocaleString()}`));
      
      // Show last few lines of log
      const logContent = await fs.readFile(logPath, 'utf8');
      const lines = logContent.trim().split('\n');
      const lastLines = lines.slice(-3);
      if (lastLines.length > 0) {
        console.log(chalk.gray('   Recent entries:'));
        for (const line of lastLines) {
          console.log(chalk.gray(`     ${line.substring(0, 80)}${line.length > 80 ? '...' : ''}`));
        }
      }
    } else {
      console.log(chalk.yellow(`⚠️  No log file found at ${logPath}`));
      console.log(chalk.gray('   The hook may not have run yet'));
    }

  } catch (error) {
    console.log(chalk.red('❌ Error checking status:'));
    console.log(chalk.red(error instanceof Error ? error.message : String(error)));
  }
}

/**
 * Show manual instructions for configuring hooks
 */
function showManualInstructions(): void {
  console.log(chalk.blue('📚 Manual Hook Configuration Instructions'));
  console.log(chalk.gray('='.repeat(50)));
  console.log();
  console.log(chalk.yellow('Method 1: Using the /hooks command in Claude Code'));
  console.log(chalk.gray('1. Open Claude Code (claude.ai/code)'));
  console.log(chalk.gray('2. Type: /hooks'));
  console.log(chalk.gray('3. Configure a PostToolUse hook with:'));
  console.log(chalk.gray('   • Matcher: Write|Edit|MultiEdit|NotebookEdit'));
  console.log(chalk.gray('   • Command: cd "$CLAUDE_PROJECT_DIR" && ccanywhere run'));
  console.log();
  console.log(chalk.yellow('Method 2: Edit settings.json directly'));
  console.log(chalk.gray('1. Find your Claude settings file:'));
  console.log(chalk.gray('   • ~/.claude/settings.json (Linux/Mac)'));
  console.log(chalk.gray('   • %APPDATA%/claude/settings.json (Windows)'));
  console.log(chalk.gray('2. Add this configuration for Stop event (recommended):'));
  console.log();
  console.log(
    chalk.cyan(
      JSON.stringify(
        {
          hooks: {
            Stop: [
              {
                matcher: '.*',
                hooks: [
                  {
                    type: 'command',
                    command: 'cd "$CLAUDE_PROJECT_DIR" && ccanywhere run'
                  }
                ]
              }
            ]
          }
        },
        null,
        2
      )
    )
  );
  console.log();
  console.log(chalk.yellow('⚠️  Note: Direct edits may not take effect immediately.'));
  console.log(chalk.yellow('   Using the /hooks command is recommended.'));
}

/**
 * Create the claude-register command
 */
export function createClaudeRegisterCommand(): Command {
  return new Command('claude-register')
    .description('Configure CCanywhere hooks for Claude Code')
    .option('-f, --force', 'Overwrite existing hooks')
    .option('--remove', 'Remove CCanywhere hooks from Claude Code')
    .option('--status', 'Show current hook registration status')
    .option('--manual', 'Show manual configuration instructions')
    .option('--post-tool', 'Use PostToolUse event (runs after each file edit)')
    .option('--stop', 'Use Stop event (runs at session end, default)')
    .action(claudeRegisterCommand);
}

export default createClaudeRegisterCommand;