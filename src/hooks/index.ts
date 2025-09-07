/**
 * CCanywhere hooks entry point for Claude Code integration
 * This module provides the hook handlers that Claude Code can load and execute
 *
 * Supported Claude Code hooks:
 * - Stop: Runs when Claude Code finishes responding
 * - PostToolUse: Runs after tool calls complete
 * - PreToolUse: Runs before tool calls (can block them)
 * - UserPromptSubmit: Runs when the user submits a prompt
 * - Notification: Runs when Claude Code sends notifications
 * - SubagentStop: Runs when subagent tasks complete
 * - PreCompact: Runs before Claude Code compacts operation
 * - SessionStart: Runs when Claude Code starts/resumes a session
 * - SessionEnd: Runs when Claude Code session ends
 */

import { ClaudeHooks, ClaudeHookContext, ClaudeHookResult } from '../core/claude-hook.js';

// Export Stop hook handler (primary hook used by CCanywhere)
export const Stop = async (context: ClaudeHookContext): Promise<ClaudeHookResult> => {
  return ClaudeHooks.Stop(context);
};

// Export PostToolUse hook handler
export const PostToolUse = async (context: ClaudeHookContext): Promise<ClaudeHookResult> => {
  return ClaudeHooks.PostToolUse(context);
};

// Export UserPromptSubmit hook handler
export const UserPromptSubmit = async (context: ClaudeHookContext): Promise<ClaudeHookResult> => {
  return ClaudeHooks.UserPromptSubmit(context);
};

// Export all handlers as a group
export const hooks = {
  Stop,
  PostToolUse,
  UserPromptSubmit
};

// Default export for CommonJS compatibility
export default hooks;

// CommonJS compatibility
module.exports = hooks;
module.exports.Stop = Stop;
module.exports.PostToolUse = PostToolUse;
module.exports.UserPromptSubmit = UserPromptSubmit;
module.exports.hooks = hooks;
