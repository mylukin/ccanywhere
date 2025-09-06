# CCanywhere - TypeScript CI/CD Tool

[![npm version](https://badge.fury.io/js/ccanywhere.svg)](https://badge.fury.io/js/ccanywhere)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)

English | [简体中文](README-zh.md)

**CCanywhere** - A CI/CD tool born from the need to code on mobile devices (phones/iPads) via SSH with Claude Code. When developing through SSH terminals on mobile devices, viewing code diffs becomes challenging. CCanywhere solves this by automatically capturing code changes, generating mobile-optimized HTML diff pages, uploading them to cloud storage, and sending notifications with viewable links through Telegram, DingTalk, WeChat Work, or Email.

## 🎯 Why CCanywhere?

### The Problem
When coding on mobile devices through SSH with Claude Code, developers face a critical challenge: **no convenient way to view code diffs**. Traditional terminal-based diff viewing is nearly impossible on small screens.

### The Solution
CCanywhere integrates with Claude Code's hook system to:
1. **Automatically capture** code changes when Claude Code completes a task
2. **Generate mobile-optimized** HTML diff pages with syntax highlighting
3. **Upload to cloud storage** and create shareable links
4. **Send instant notifications** via Telegram/DingTalk/WeChat Work/Email
5. **Enable seamless navigation** to GitHub/GitLab for full code context

## ✨ Core Features

- **📱 Mobile-First Diff Viewing**: HTML diffs optimized for phones and tablets
- **🔗 Claude Code Hooks**: Automatic triggers on code operations
- **☁️ Cloud Storage Integration**: Support for R2, S3, and Alibaba OSS
- **📬 Instant Notifications**: Multi-channel alerts with diff links
- **🧪 Playwright Testing**: Automated testing with screenshots for responsive development
- **🔄 GitHub/GitLab Integration**: Direct links from diffs to source repositories
- **🚀 Deployment Triggers**: Optional webhook-based deployments
- **📊 Structured Logging**: JSON audit trails for all operations

## 🚀 Quick Start

### Installation

```bash
# Install globally (recommended for Claude Code integration)
npm install -g ccanywhere

# Or install as dev dependency
npm install -D ccanywhere

# If you want to use Playwright testing (optional)
npm install -D @playwright/test
```

**🎉 Automatic Claude Code Integration**: When installed globally, CCanywhere automatically detects and integrates with Claude Code! The installation process will:
- Detect your Claude Code installation
- Register hooks to trigger CCanywhere at session end (Stop event)
- Create backups of your Claude settings
- Provide setup confirmation and usage instructions

No manual configuration needed! Just install and start using Claude Code.

### Initialize Your Project

```bash
# Initialize CCanywhere in your project
ccanywhere init

# Follow the interactive setup wizard
```

### Configuration

Edit the generated `ccanywhere.config.json`:

```json
{
  "repo": {
    "kind": "github",
    "url": "https://github.com/mylukin/ccanywhere",
    "branch": "main"
  },
  "artifacts": {
    "baseUrl": "https://artifacts.yourdomain.com",
    "retentionDays": 7,
    "maxSize": "100MB",
    "storage": {
      "provider": "r2",
      "folder": "diffs",  // Storage folder path (default: "diffs")
      "r2": {
        "accountId": "YOUR_CLOUDFLARE_ACCOUNT_ID",
        "accessKeyId": "YOUR_R2_ACCESS_KEY_ID",
        "secretAccessKey": "YOUR_R2_SECRET_ACCESS_KEY",
        "bucket": "my-artifacts-bucket"
      }
    }
  },
  "notifications": {
    "channels": ["telegram"],
    "telegram": {
      "botToken": "YOUR_BOT_TOKEN",
      "chatId": "YOUR_CHAT_ID"
    }
  },
  "build": {
    "base": "origin/main",
    "excludePaths": [".artifacts", "node_modules"]
  }
}
```

Configure your environment variables in `.env`:

```bash
# Required
REPO_URL=https://github.com/mylukin/ccanywhere

# Artifacts Configuration
ARTIFACTS_BASE_URL=https://artifacts.yourdomain.com
ARTIFACTS_RETENTION_DAYS=7
ARTIFACTS_MAX_SIZE=100MB

# Cloudflare R2 Storage (Default)
R2_ACCOUNT_ID=your-cloudflare-account-id
R2_ACCESS_KEY_ID=your-r2-access-key
R2_SECRET_ACCESS_KEY=your-r2-secret-key
R2_BUCKET=my-artifacts-bucket

# Notifications
BOT_TOKEN_TELEGRAM=123456789:your-bot-token
CHAT_ID_TELEGRAM=-1001234567890

# Optional: Deployment
DEPLOYMENT_WEBHOOK_URL=https://deploy.yourdomain.com/api/webhook
```

### Test Your Configuration

```bash
ccanywhere test
```

### Run Your First Build

```bash
ccanywhere run
```

## 📖 Usage

### CLI Commands

```bash
# Initialize new project
ccanywhere init

# Run build pipeline
ccanywhere run

# Test configuration
ccanywhere test --all

# Send test notification
ccanywhere notify --channels telegram --title "Hello World"

# Cleanup old artifacts
ccanywhere cleanup --days 7

# Claude Code integration
ccanywhere claude-register --status      # Check hook status
ccanywhere claude-register              # Interactive hook setup
ccanywhere claude-register --post-run   # Enable specific hooks
ccanywhere claude-register --remove     # Remove all hooks

# Show project information
ccanywhere info

# Manage build locks
ccanywhere lock status        # Check lock status
ccanywhere lock clean         # Clean stale locks
ccanywhere lock force-release # Force release locks

# Configuration management
ccanywhere config show        # Show current configuration
ccanywhere config validate    # Validate configuration file
ccanywhere config edit        # Edit configuration file

# Run tests (including Playwright tests)
ccanywhere test
```

### Claude Code Integration

CCanywhere provides seamless integration with Claude Code through automatic hook registration:

**🔄 Automatic Setup (Recommended)**:
```bash
# Global installation automatically registers hooks
npm install -g ccanywhere
# That's it! CCanywhere will run when you end Claude Code sessions
```

**⚙️ Manual Hook Management**:
```bash
ccanywhere claude-register --status       # Check current status
ccanywhere claude-register               # Register with Stop event (session end)
ccanywhere claude-register --post-tool   # Register with PostToolUse (after each edit)
ccanywhere claude-register --remove      # Remove hooks
```

**🎯 Hook Event Options**:
- **Stop Event** (Default): Runs when you end a Claude Code session
  - ✅ One notification per session with complete summary
  - ✅ Better user experience, less intrusive
  - ✅ Comprehensive diff of all changes made
- **PostToolUse Event**: Runs after each file operation
  - ⚠️ More frequent notifications (after each edit)
  - ⚠️ May be overwhelming for active development

**Available Hooks:**
- **Pre-commit**: Analyzes staged changes before commits
- **Post-run**: Runs full CCanywhere pipeline after Claude Code operations  
- **Pre-test**: Sets up environment before test execution
- **Post-test**: Processes results and sends notifications

**Benefits:**
- ✅ Automatic diff generation after Claude Code operations
- ✅ Zero-configuration for global installs
- ✅ Non-invasive integration with existing workflows
- ✅ Automatic backup creation for safety
- ✅ Platform-specific path detection (Windows, macOS, Linux)

```

### Programmatic Usage

```typescript
import { BuildPipeline, ConfigLoader, createLogger } from 'ccanywhere';

async function runBuild() {
  // Load configuration
  const configLoader = ConfigLoader.getInstance();
  const config = await configLoader.loadConfig();

  // Create logger
  const logger = createLogger({
    logDir: './logs',
    level: 'info',
    console: true
  });

  // Create and run pipeline
  const pipeline = new BuildPipeline({
    workDir: process.cwd(),
    config,
    logger
  });

  const result = await pipeline.run();
  console.log('Build result:', result);
}
```

## ⚙️ Configuration

### Auto Configuration Detection

CCanywhere automatically detects Git repository information:
- **Repository URL**: Auto-retrieved from `git remote origin`
- **Repository Type**: Auto-identified from URL (GitHub/GitLab/Bitbucket/Gitee)
- **Branch Name**: Auto-retrieved from current branch

If your project is a Git repository, manual repository configuration is not required.

### Configuration File

CCanywhere supports multiple configuration formats:

- `ccanywhere.config.json` - Standard JSON configuration
- `ccanywhere.config.js` - JavaScript configuration (supports dynamic values)
- `.ccanywhere.json` - Hidden JSON configuration
- `.ccanywhere.js` - Hidden JavaScript configuration

### Environment Variables

All configuration can be overridden with environment variables:

```bash
# Repository (Optional - Auto-detected from .git config)
REPO_URL=https://github.com/mylukin/ccanywhere  # Optional, auto-detected
REPO_KIND=github                                # Optional, auto-detected
REPO_BRANCH=main                                # Optional, auto-detected

# URLs
ARTIFACTS_BASE_URL=https://artifacts.example.com

# Deployment
DEPLOYMENT_WEBHOOK_URL=https://deploy.example.com/webhook

# Notifications
BOT_TOKEN_TELEGRAM=your-token
CHAT_ID_TELEGRAM=your-chat-id
DINGTALK_WEBHOOK=https://oapi.dingtalk.com/robot/send?access_token=YOUR_TOKEN
EMAIL_TO=admin@example.com
```

### Notification Channels

#### Telegram

1. Create a bot via [@BotFather](https://t.me/botfather)
2. Get your bot token
3. Add the bot to your chat/channel
4. Get the chat ID

```json
{
  "notifications": {
    "channels": ["telegram"],
    "telegram": {
      "botToken": "123456789:ABCdef...",
      "chatId": "-1001234567890"
    }
  }
}
```

#### Email

Configure SMTP settings or use local mail:

```json
{
  "notifications": {
    "channels": ["email"],
    "email": {
      "to": "admin@example.com",
      "from": "noreply@example.com",
      "smtp": {
        "host": "smtp.gmail.com",
        "port": 587,
        "user": "your-email@gmail.com",
        "pass": "your-app-password"
      }
    }
  }
}
```

## 🧪 Playwright Testing Integration

### Why Playwright?

When developing responsive web applications on mobile devices, you need to test across multiple screen sizes. CCanywhere integrates Playwright to:
- **Test responsive designs** across different viewport sizes
- **Capture screenshots** automatically during tests
- **Generate test reports** with visual evidence
- **Send results** via notifications

### Setup

First, install Playwright in your project:

```bash
npm install -D @playwright/test
npx playwright install # Install browser binaries
```

### Configuration

Create `playwright.config.ts`:

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  reporter: [['html', { outputFolder: 'playwright-report' }]],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
```

### Test Files

Create test files in the `tests` directory:

```typescript
// tests/example.spec.ts
import { test, expect } from '@playwright/test';

test('homepage loads correctly', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Home/);
});
```

## 🚀 Deployment Integration

### Deployment Webhooks

CCanywhere supports webhook-based deployment triggers:

```json
{
  "deployment": "https://deploy.yourdomain.com/api/webhook/deploy"
}
```

Or with object syntax for advanced deployment options:

```json
{
  "deployment": {
    "webhook": "https://deploy.yourdomain.com/api/webhook/deploy",
    "statusUrl": "https://deploy.yourdomain.com/status/{deploymentId}",
    "maxWait": 600,
    "pollInterval": 30
  }
}
```

**Deployment Configuration Fields:**
- `webhook`: Deployment webhook URL (required)
- `statusUrl`: Optional status check URL with `{deploymentId}` placeholder
- `maxWait`: Maximum wait time for deployment in seconds (default: 600)
- `pollInterval`: Status polling interval in seconds (default: 30)

The deployment webhook is called with a payload containing:
- `ref`: Git commit hash
- `branch`: Current branch name
- `trigger`: "ccanywhere"
- `timestamp`: Unix timestamp

## 📱 Mobile Experience

CCanywhere generates mobile-optimized diff pages with:

- Responsive design for all screen sizes
- Touch-friendly navigation
- Syntax highlighting
- Direct links to GitHub/GitLab
- Quick access to deployment and test results

## 📁 Storage Organization

CCanywhere automatically organizes storage paths based on your project structure:

### Storage Path Structure

Generated artifacts are stored with the following path pattern:
```
{folder}/{project-name}/{filename}
```

For example:
- Repository: `https://github.com/mylukin/my-project`
- Generated path: `diffs/mylukin/my-project/diff-7531080.html`
- Full URL: `https://assets.example.com/diffs/mylukin/my-project/diff-7531080.html`

### Automatic Project Detection

The project name is automatically extracted from your repository URL:
- GitHub: `https://github.com/owner/repo` → `owner/repo`
- GitLab: `https://gitlab.com/owner/repo` → `owner/repo`
- Bitbucket: `https://bitbucket.org/owner/repo` → `owner/repo`
- SSH URLs: `git@github.com:owner/repo.git` → `owner/repo`

This ensures:
- **Better Organization**: Each project's artifacts are isolated in their own directory
- **Easy Management**: Clear project separation for permissions and lifecycle management
- **Meaningful URLs**: Instantly recognizable project paths in URLs
- **Multi-Project Support**: Multiple projects can share the same storage bucket without conflicts

### Customizing Storage Paths

You can customize the storage folder in your configuration:
```json
{
  "artifacts": {
    "storage": {
      "folder": "builds"  // Custom folder (default: "diffs")
    }
  }
}
```

This would result in paths like: `builds/mylukin/my-project/diff-7531080.html`

## 🏗️ Build Configuration

### Excluding Paths from Diffs

You can exclude specific paths from being included in the generated diff files:

```json
{
  "build": {
    "base": "origin/main",
    "lockTimeout": 300,
    "cleanupDays": 7,
    "excludePaths": [".artifacts", "node_modules", ".git", "dist"]
  }
}
```

- `excludePaths`: Array of paths to exclude from diff generation
- Default: `[".artifacts"]` if not specified
- Useful for ignoring generated files, dependencies, or build outputs

### Environment Variable Configuration

All storage provider environment variables are now supported. You can also configure build options:

```bash
# Exclude paths from diffs (comma-separated)
EXCLUDE_PATHS=.artifacts,node_modules,dist,coverage

# All storage provider environment variables are supported
# Cloudflare R2
R2_ACCOUNT_ID=your-account-id
R2_ACCESS_KEY_ID=your-access-key
R2_SECRET_ACCESS_KEY=your-secret-key
R2_BUCKET=your-bucket

# AWS S3
S3_ACCESS_KEY_ID=your-access-key
S3_SECRET_ACCESS_KEY=your-secret-key
S3_REGION=us-east-1
S3_BUCKET=your-bucket

# Alibaba Cloud OSS
OSS_ACCESS_KEY_ID=your-access-key
OSS_ACCESS_KEY_SECRET=your-secret-key
OSS_REGION=oss-cn-hangzhou
OSS_BUCKET=your-bucket
```

## 🔧 Advanced Usage

### Custom Plugins

```typescript
import type { CcanywherePlugin, RuntimeContext } from 'ccanywhere';

const myPlugin: CcanywherePlugin = {
  name: 'my-plugin',
  version: '0.1.0',
  
  async beforeBuild(context: RuntimeContext) {
    console.log('Before build:', context.revision);
  },
  
  async afterBuild(context: RuntimeContext, result: BuildResult) {
    console.log('Build completed:', result.success);
  }
};
```

### Custom Notification Channels

```typescript
import type { ChannelNotifier, NotificationMessage } from 'ccanywhere';

class SlackNotifier implements ChannelNotifier {
  readonly channel = 'slack' as const;
  
  async send(message: NotificationMessage): Promise<void> {
    // Implement Slack webhook logic
  }
}
```

## 🛡️ Security

- Environment variables stored in `.env` files (git-ignored)
- File permissions set to 600 for sensitive files
- Lock files prevent concurrent builds
- Audit logs track all operations
- Security configuration for read-only mode and link expiration

## 📊 Monitoring

### Logs

CCanywhere uses structured JSON logging:

```bash
# View recent logs
tail -f logs/runner.jsonl | jq .

# Filter by revision
grep "abc123" logs/runner.jsonl | jq .

# Filter by error level
jq 'select(.level == "error")' logs/runner.jsonl
```

### Metrics

Monitor build metrics:

```typescript
const logger = createLogger({ logDir: './logs' });
const recentLogs = await logger.getRecentLogs(50);
const errorCount = recentLogs.filter(log => log.level === 'error').length;
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Development

```bash
# Clone and setup
git clone https://github.com/mylukin/ccanywhere.git
cd ccanywhere
npm install

# Development
npm run dev

# Watch mode
npm run dev:watch

# Testing
npm test
npm run test:coverage

# Build
npm run build

# Lint
npm run lint
npm run format
```

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- 📖 [Documentation](https://github.com/mylukin/ccanywhere/wiki)
- 🐛 [Issue Tracker](https://github.com/mylukin/ccanywhere/issues)
- 💬 [Discussions](https://github.com/mylukin/ccanywhere/discussions)

## 🙏 Acknowledgments

- Built with [TypeScript](https://www.typescriptlang.org/)
- CLI powered by [Commander.js](https://github.com/tj/commander.js/)
- Testing with [Playwright](https://playwright.dev/)
- Diff generation using [diff2html](https://github.com/rtfpessoa/diff2html)
- Schema validation with [Zod](https://github.com/colinhacks/zod)

---

**Made with ❤️ for developers who code anywhere** 📱💻🌍