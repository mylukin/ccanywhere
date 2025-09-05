# CCanywhere - TypeScript CI/CD Tool

[![npm version](https://badge.fury.io/js/ccanywhere.svg)](https://badge.fury.io/js/ccanywhere)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)

English | [简体中文](README-zh.md)

**Claude Code Anywhere** - A modern TypeScript CI/CD tool designed for mobile-friendly development workflows. Convert your development process into an automated pipeline that generates mobile-optimized diff pages, triggers deployments, runs tests, and sends notifications to your mobile devices.

## 🎯 Features

- **📱 Mobile-Friendly Diff Pages**: Generate beautiful, mobile-optimized HTML diff pages
- **🚀 Deployment Automation**: Trigger webhook-based deployments
- **🧪 Playwright Integration**: Run automated tests with comprehensive reporting
- **📬 Multi-Channel Notifications**: Support for Telegram, DingTalk, WeCom, and Email
- **🔒 Concurrency Control**: File-based locking prevents concurrent builds
- **📊 JSON Audit Logging**: Comprehensive logging with structured JSON output
- **🎯 Claude Code Integration**: Seamless hooks for automatic CI/CD on Claude Code operations
- **⚡ TypeScript First**: Fully typed with excellent IDE support
- **🛠 CLI Interface**: Easy-to-use command-line interface
- **🔧 Configurable**: Flexible configuration via JSON or environment variables

## 🚀 Quick Start

### Installation

```bash
# Install globally
npm install -g ccanywhere

# Or install as dev dependency
npm install -D ccanywhere

# If you want to use Playwright testing (optional)
npm install -D @playwright/test
```

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

# Test runner (for Playwright tests)
ccanywhere test-runner
```

### Claude Code Integration

CCanywhere provides seamless integration with Claude Code through automatic hook injection:

```bash
# For global installations, hooks are registered automatically
npm install -g ccanywhere

# Manual hook management
ccanywhere claude-register --status       # Check current status
ccanywhere claude-register               # Interactive registration
ccanywhere claude-register --post-run    # Enable post-run hook
ccanywhere claude-register --pre-commit  # Enable pre-commit analysis
ccanywhere claude-register --remove      # Remove all hooks

# Restore from backup if needed
ccanywhere claude-register --restore /path/to/backup
```

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

See [Claude Code Integration Guide](./docs/CLAUDE-CODE-INTEGRATION.md) for detailed configuration options.
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

- `ccanywhere.config.json`
- `ccanywhere.config.js`
- `.ccanywhere.json`

### Environment Variables

All configuration can be overridden with environment variables:

```bash
# Repository (Optional - Auto-detected from .git config)
REPO_URL=https://github.com/mylukin/ccanywhere  # Optional, auto-detected
REPO_KIND=github                                # Optional, auto-detected
REPO_BRANCH=main                                # Optional, auto-detected

# URLs
ARTIFACTS_URL=https://artifacts.example.com

# Deployment
DEPLOYMENT_WEBHOOK_URL=https://deploy.example.com/webhook

# Notifications
BOT_TOKEN_TELEGRAM=your-token
CHAT_ID_TELEGRAM=your-chat-id
BOT_TOKEN_DINGTALK=your-dingtalk-token
SECRET_DINGTALK=your-dingtalk-secret
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

## 🧪 Testing Integration

### Prerequisites

First, install Playwright in your project:

```bash
npm install -D @playwright/test
npx playwright install # Install browser binaries
```

### Playwright Configuration

CCanywhere works seamlessly with Playwright. Create `playwright.config.ts`:

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

Or with object syntax:

```json
{
  "deployment": {
    "webhook": "https://deploy.yourdomain.com/api/webhook/deploy"
  }
}
```

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

```bash
# Exclude paths (comma-separated)
EXCLUDE_PATHS=.artifacts,node_modules,dist,coverage
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