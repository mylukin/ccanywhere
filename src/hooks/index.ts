/**
 * CCanywhere hooks entry point for Claude Code integration
 * This module provides the hook handlers that Claude Code can load and execute
 */

import { ClaudeHooks, ClaudeHookContext, ClaudeHookResult } from '../core/claude-hook.js';

// Export individual hook handlers for Claude Code to import
export const preCommit = async (context: ClaudeHookContext): Promise<ClaudeHookResult> => {
  return ClaudeHooks.preCommit(context);
};

export const postRun = async (context: ClaudeHookContext): Promise<ClaudeHookResult> => {
  return ClaudeHooks.postRun(context);
};

export const preTest = async (context: ClaudeHookContext): Promise<ClaudeHookResult> => {
  return ClaudeHooks.preTest(context);
};

export const postTest = async (context: ClaudeHookContext): Promise<ClaudeHookResult> => {
  return ClaudeHooks.postTest(context);
};

// Export all handlers as a group
export const hooks = {
  preCommit,
  postRun,
  preTest,
  postTest
};

// Default export for CommonJS compatibility
export default hooks;

// CommonJS compatibility
module.exports = hooks;
module.exports.preCommit = preCommit;
module.exports.postRun = postRun;
module.exports.preTest = preTest;
module.exports.postTest = postTest;
module.exports.hooks = hooks;
