# CCanywhere

[![npm version](https://badge.fury.io/js/ccanywhere.svg)](https://badge.fury.io/js/ccanywhere)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

English | [简体中文](README-zh.md)

Mobile-friendly CI/CD tool for viewing code diffs when developing via SSH with Claude Code. Automatically captures changes, generates HTML diffs, uploads to cloud storage, and sends notifications.

## 🎯 Why CCanywhere?

**Problem**: Can't view code diffs on mobile devices when using Claude Code via SSH.

**Solution**: Auto-capture changes → Generate mobile HTML diffs → Upload to cloud → Send notification links.

## ✨ Features

- 📱 Mobile-optimized diff viewing
- 🔗 Claude Code hook integration
- ☁️ Cloud storage (R2, S3, OSS)
- 📬 Multi-channel notifications (Telegram, DingTalk, WeChat Work, Email)
- 🧪 Playwright testing support
- 🚀 Deployment webhooks

## 🚀 Quick Start

### Install

```bash
# Global install (recommended)
npm install -g ccanywhere
ccanywhere init

# Or project-specific
npm install -D ccanywhere
```

### Configure

Create `ccanywhere.config.json`:

```json
{
  "artifacts": {
    "baseUrl": "https://artifacts.example.com",
    "storage": {
      "provider": "r2",
      "r2": {
        "accountId": "YOUR_ACCOUNT_ID",
        "accessKeyId": "YOUR_ACCESS_KEY",
        "secretAccessKey": "YOUR_SECRET_KEY",
        "bucket": "my-bucket"
      }
    }
  },
  "notifications": {
    "channels": ["telegram"],
    "telegram": {
      "botToken": "YOUR_BOT_TOKEN",
      "chatId": "YOUR_CHAT_ID"
    }
  }
}
```

### Test & Run

```bash
# Test configuration
ccanywhere test --all

# Run pipeline
ccanywhere run
```

## 📖 Commands

```bash
ccanywhere init          # Initialize configuration
ccanywhere run           # Run build pipeline
ccanywhere test          # Test configuration
ccanywhere register      # Manage Claude Code hooks
ccanywhere cleanup       # Clean old artifacts
ccanywhere info          # Show configuration info
```

### Test Options

```bash
ccanywhere test --all              # Test everything
ccanywhere test --notifications    # Test notifications only
ccanywhere test --deployment       # Test deployment only
ccanywhere test --notifications --send --title "Test" --message "Hello"
```

### Claude Code Integration

```bash
ccanywhere register         # Register Stop hook
ccanywhere register --status  # Check hook status
ccanywhere register --remove  # Remove hooks
```

## ⚙️ Configuration

### Configuration Hierarchy

1. Environment variables (highest priority)
2. Project config (`ccanywhere.config.json`)
3. User config (`~/.claude/ccanywhere.config.json`)
4. Defaults

### User Configuration

Store common settings in `~/.claude/ccanywhere.config.json`:

```json
{
  "notifications": {
    "channels": ["telegram"],
    "telegram": {
      "botToken": "YOUR_BOT_TOKEN",
      "chatId": "YOUR_CHAT_ID"
    }
  }
}
```

### Environment Variables

Set system environment variables to override configuration:

```bash
# Storage
export STORAGE_PROVIDER=r2
export R2_ACCOUNT_ID=your-account-id
export R2_ACCESS_KEY_ID=your-key
export R2_SECRET_ACCESS_KEY=your-secret
export R2_BUCKET=my-bucket

# Notifications
export BOT_TOKEN_TELEGRAM=your-token
export CHAT_ID_TELEGRAM=your-chat-id

# Optional
export DEPLOYMENT_WEBHOOK_URL=https://deploy.example.com/webhook
```

## 📬 Notifications

### Telegram

1. Create bot via [@BotFather](https://t.me/botfather)
2. Get bot token
3. Add bot to chat and get chat ID

### Email

```json
{
  "email": {
    "to": "admin@example.com",
    "smtp": {
      "host": "smtp.gmail.com",
      "port": 587,
      "user": "your-email@gmail.com",
      "pass": "your-app-password"
    }
  }
}
```

### DingTalk / WeChat Work

```json
{
  "dingtalk": "https://oapi.dingtalk.com/robot/send?access_token=TOKEN",
  "wecom": "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=KEY"
}
```

## 🧪 Playwright Testing

```bash
# Install Playwright
npm install -D @playwright/test
npx playwright install

# Configure in ccanywhere.config.json
{
  "test": {
    "enabled": true,
    "configFile": "./playwright.config.ts"
  }
}
```

## 📁 Storage Structure

Files are organized as: `{folder}/{project-name}/{filename}`

- GitHub repo: `https://github.com/owner/repo`
- Storage path: `diffs/owner/repo/diff-123.html`

## 🚀 Deployment

```json
{
  "deployment": "https://deploy.example.com/webhook"
}
```

Webhook receives:
- `ref`: Git commit hash
- `branch`: Current branch
- `trigger`: "ccanywhere"
- `timestamp`: Unix timestamp

## 🔧 Development

```bash
# Setup
git clone https://github.com/mylukin/ccanywhere.git
cd ccanywhere
npm install

# Development
npm run dev

# Test
npm test

# Build
npm run build

# Lint & Format
npm run lint
npm run format
```

## 📝 License

MIT

## 🆘 Support

- [Issues](https://github.com/mylukin/ccanywhere/issues)
- [Discussions](https://github.com/mylukin/ccanywhere/discussions)

---

**Made with ❤️ for developers who code anywhere** 📱💻🌍