/**
 * Example Claude Code hooks configuration with CCanywhere integration
 * This file shows how CCanywhere hooks are configured in Claude Code
 */

module.exports = {
  // CCanywhere pre-commit hook
  // Runs before git commits to analyze staged changes
  preCommit: {
    name: 'CCanywhere Pre-commit Analysis',
    handler: 'ccanywhere/hooks',
    method: 'preCommit',
    async: true,
    failOnError: false, // Don't block commits on CCanywhere failures
    options: {
      // Optional: Configure hook behavior
      strictMode: false,
      analyzeOnlyChanged: true
    }
  },

  // CCanywhere post-run hook  
  // Runs after Claude Code operations to trigger full pipeline
  postRun: {
    name: 'CCanywhere Pipeline',
    handler: 'ccanywhere/hooks', 
    method: 'postRun',
    async: true,
    failOnError: false, // Don't block Claude Code operations
    options: {
      // Optional: Configure pipeline behavior
      includeUncommitted: true,
      notifyOnCompletion: true
    }
  },

  // Optional: CCanywhere pre-test hook
  // Runs before test execution to setup environment
  preTest: {
    name: 'CCanywhere Pre-test Setup',
    handler: 'ccanywhere/hooks',
    method: 'preTest', 
    async: true,
    failOnError: false,
    options: {
      ensurePlaywright: true
    }
  },

  // Optional: CCanywhere post-test hook
  // Runs after tests complete for notifications
  postTest: {
    name: 'CCanywhere Post-test Processing',
    handler: 'ccanywhere/hooks',
    method: 'postTest',
    async: true, 
    failOnError: false,
    options: {
      notifyOnResults: true
    }
  },

  // Example: Custom hooks from other tools can coexist
  // customHook: {
  //   name: 'My Custom Hook',
  //   handler: './my-hooks.js',
  //   method: 'myHookFunction',
  //   async: true,
  //   failOnError: true
  // }
};