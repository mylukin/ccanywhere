# Claude Code Integration Guide

CCanywhere provides seamless integration with Claude Code through an intelligent hook system. This guide explains how to set up, configure, and use CCanywhere with Claude Code for enhanced development workflows.

## Overview

The Claude Code integration allows CCanywhere to automatically:
- Analyze code changes before commits
- Run full CI/CD pipelines after Claude Code operations
- Setup test environments before test execution
- Send notifications after operations complete

## Automatic Installation (Global Install)

When you install CCanywhere globally, it automatically detects Claude Code and registers hooks:

```bash
npm install -g ccanywhere
```

This will:
1. Detect your Claude Code installation
2. Register CCanywhere hooks with conservative defaults
3. Create backups of existing configurations
4. Provide clear feedback about what was configured

## Manual Registration

You can manually register or modify hooks using the `claude-register` command:

```bash
# Interactive registration with prompts
ccanywhere claude-register

# Register specific hooks
ccanywhere claude-register --post-run --pre-commit

# Force overwrite existing hooks
ccanywhere claude-register --force

# Check current status
ccanywhere claude-register --status

# Remove CCanywhere hooks
ccanywhere claude-register --remove
```

## Hook Types

### Pre-commit Hook
- **Purpose**: Analyzes staged changes before commits
- **Default**: Disabled (conservative)
- **Use Case**: Code quality analysis, diff generation
- **Failure Behavior**: Non-blocking (commits proceed)

### Post-run Hook  
- **Purpose**: Runs full CCanywhere pipeline after Claude Code operations
- **Default**: Enabled
- **Use Case**: Complete CI/CD pipeline execution
- **Failure Behavior**: Non-blocking (Claude Code operations succeed)

### Pre-test Hook
- **Purpose**: Sets up test environment before execution
- **Default**: Disabled
- **Use Case**: Playwright installation, dependency checks
- **Failure Behavior**: Non-blocking (tests proceed)

### Post-test Hook
- **Purpose**: Processes results and sends notifications
- **Default**: Disabled  
- **Use Case**: Test result notifications, reporting
- **Failure Behavior**: Non-blocking (test results unaffected)

## Configuration

### Environment Detection

CCanywhere automatically detects Claude Code by checking:
- Environment variables (`CLAUDE_CODE_HOME`, `CLAUDE_CONFIG_DIR`)
- Platform-specific configuration directories
- Standard installation locations

### Supported Platforms

| Platform | Default Config Locations |
|----------|--------------------------|
| macOS    | `~/Library/Application Support/claude-code`<br>`~/.config/claude-code`<br>`~/.claude` |
| Windows  | `%APPDATA%/claude-code`<br>`%LOCALAPPDATA%/claude-code`<br>`~/.config/claude-code` |
| Linux    | `~/.config/claude-code`<br>`~/.claude-code`<br>`~/.claude` |

### Hook Configuration Files

CCanywhere supports both JavaScript and JSON hook configurations:

**JavaScript Format** (`hooks.js`):
```javascript
module.exports = {
  postRun: {
    name: 'CCanywhere Pipeline',
    handler: 'ccanywhere/hooks',
    method: 'postRun',
    async: true,
    failOnError: false
  }
};
```

**JSON Format** (`hooks.json`):
```json
{
  "postRun": {
    "name": "CCanywhere Pipeline", 
    "handler": "ccanywhere/hooks",
    "method": "postRun",
    "async": true,
    "failOnError": false
  }
}
```

## Advanced Configuration

### Hook Options

Each hook can be configured with additional options:

```javascript
module.exports = {
  preCommit: {
    name: 'CCanywhere Pre-commit Analysis',
    handler: 'ccanywhere/hooks',
    method: 'preCommit',
    async: true,
    failOnError: false,
    options: {
      strictMode: false,        // Enable strict error handling
      analyzeOnlyChanged: true  // Only analyze staged changes
    }
  },
  
  postRun: {
    name: 'CCanywhere Pipeline',
    handler: 'ccanywhere/hooks',
    method: 'postRun', 
    async: true,
    failOnError: false,
    options: {
      includeUncommitted: true,   // Include uncommitted changes
      notifyOnCompletion: true    // Send completion notifications
    }
  }
};
```

### CCanywhere Configuration

Configure CCanywhere behavior through your project's configuration:

```javascript
// ccanywhere.config.js
export default {
  hooks: {
    preCommit: true,   // Enable pre-commit analysis
    postRun: true,     // Enable post-run pipeline
    preTest: false,    // Disable pre-test setup
    postTest: false    // Disable post-test processing
  },
  
  notifications: {
    onCommit: true,         // Notify on commits
    onTestComplete: false,  // Notify on test completion
    channels: ['telegram']  // Notification channels
  }
};
```

## Workflow Examples

### Typical Development Workflow

1. **Code in Claude Code**: Make changes using Claude Code
2. **Commit Changes**: Git commit triggers pre-commit hook (if enabled)
   - CCanywhere analyzes staged changes
   - Generates diff preview
   - Optional notifications sent
3. **Claude Code Operations**: Run tests, builds, etc.
4. **Post-run Trigger**: CCanywhere full pipeline executes
   - Complete diff generation
   - Artifact upload
   - Deployment webhooks
   - Notifications sent

### Test-Driven Development

1. **Pre-test Setup**: Before running tests
   - Playwright dependencies installed
   - Environment verified
2. **Test Execution**: Claude Code runs tests normally
3. **Post-test Processing**: After tests complete
   - Results analyzed
   - Notifications sent
   - Reports generated

## Troubleshooting

### Common Issues

**Claude Code Not Detected**
```bash
# Check detection status
ccanywhere claude-register --status

# Force detection by setting environment variable
export CLAUDE_CODE_HOME=/path/to/claude-code
ccanywhere claude-register
```

**Permission Errors**
```bash
# Check file permissions
ls -la ~/.config/claude-code/hooks.js

# Fix permissions if needed
chmod 644 ~/.config/claude-code/hooks.js
```

**Hook Injection Failed**
```bash
# View detailed error information
ccanywhere claude-register --verbose

# Force overwrite existing configuration
ccanywhere claude-register --force --backup
```

### Recovery

**Restore from Backup**
```bash
# List available backups
ccanywhere claude-register --status

# Restore from specific backup
ccanywhere claude-register --restore /path/to/backup
```

**Remove All Hooks**
```bash
# Remove CCanywhere hooks
ccanywhere claude-register --remove

# Verify removal
ccanywhere claude-register --status
```

## Integration Benefits

### Seamless Workflow
- No manual intervention required
- Works with existing Claude Code commands
- Respects existing hook configurations

### Enhanced Visibility  
- Automatic diff generation after operations
- Real-time notifications of build status
- Comprehensive logging and error handling

### Flexible Configuration
- Choose which hooks to enable
- Configure behavior per project
- Easy to disable or remove

### Production Ready
- Non-invasive integration
- Comprehensive error handling
- Automatic backup creation
- Graceful failure handling

## API Reference

For programmatic usage, import the integration components:

```typescript
import {
  ClaudeHooks,
  ClaudeCodeDetector,
  HookInjector,
  ErrorHandler
} from 'ccanywhere';

// Detect Claude Code environment
const env = await ClaudeCodeDetector.detectEnvironment();

// Inject hooks programmatically
const result = await HookInjector.injectHooks({
  enablePostRun: true,
  createBackup: true
});

// Use hooks directly
const hookResult = await ClaudeHooks.postRun({
  workingDir: process.cwd(),
  command: 'claude run'
});
```

For more information, see the [API Documentation](./API.md).