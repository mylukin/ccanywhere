# CCanywhere - TypeScript CI/CD 工具

[![npm version](https://badge.fury.io/js/ccanywhere.svg)](https://badge.fury.io/js/ccanywhere)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)

[English](README.md) | 简体中文

**Claude Code Anywhere** - 一个专为移动友好的开发工作流设计的现代 TypeScript CI/CD 工具。将您的开发流程转换为自动化管道，生成移动端优化的差异页面，触发部署，运行测试，并向您的移动设备发送通知。

## 🎯 特性

- **📱 移动友好的差异页面**：生成美观的、移动端优化的 HTML 差异页面
- **🚀 部署自动化**：触发 Dokploy 和其他基于 webhook 的部署
- **🧪 Playwright 集成**：运行自动化测试，提供全面的报告
- **📬 多渠道通知**：支持 Telegram、钉钉、企业微信和邮件
- **🔒 并发控制**：基于文件的锁定机制防止并发构建
- **📊 JSON 审计日志**：使用结构化 JSON 输出进行全面日志记录
- **⚡ TypeScript 优先**：完全类型化，出色的 IDE 支持
- **🛠 CLI 界面**：易于使用的命令行界面
- **🔧 可配置**：通过 JSON 或环境变量进行灵活配置

## 🚀 快速开始

### 安装

```bash
# 全局安装
npm install -g ccanywhere

# 或作为开发依赖安装
npm install -D ccanywhere
```

### 初始化项目

```bash
# 在项目中初始化 CCanywhere
ccanywhere init

# 跟随交互式设置向导
```

### 配置

编辑生成的 `ccanywhere.config.json`：

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
      "provider": "s3",
      "s3": {
        "accessKeyId": "您的AWS访问密钥ID",
        "secretAccessKey": "您的AWS秘密访问密钥",
        "region": "us-east-1",
        "bucket": "my-artifacts-bucket"
      }
    }
  },
  "notifications": {
    "channels": ["telegram"],
    "telegram": {
      "botToken": "您的机器人令牌",
      "chatId": "您的聊天ID"
    }
  }
}
```

在 `.env` 中配置环境变量：

```bash
# 必需
REPO_URL=https://github.com/mylukin/ccanywhere

# 制品配置
ARTIFACTS_BASE_URL=https://artifacts.yourdomain.com
ARTIFACTS_RETENTION_DAYS=7
ARTIFACTS_MAX_SIZE=100MB

# 通知
BOT_TOKEN_TELEGRAM=123456789:your-bot-token
CHAT_ID_TELEGRAM=-1001234567890

# 可选：部署
DEPLOYMENT_WEBHOOK_URL=https://deploy.yourdomain.com/api/webhook
```

### 测试配置

```bash
ccanywhere test
```

### 运行首次构建

```bash
ccanywhere run
```

## 📖 使用方法

### CLI 命令

```bash
# 初始化新项目
ccanywhere init

# 运行构建管道
ccanywhere run

# 测试配置
ccanywhere test --all

# 发送测试通知
ccanywhere notify --channels telegram --title "Hello World"

# 管理构建锁
ccanywhere lock status
ccanywhere lock clean

# 配置管理
ccanywhere config show
ccanywhere config validate

# 清理旧制品
ccanywhere cleanup --days 7

# 显示系统信息
ccanywhere info
```

### 编程式使用

```typescript
import { BuildPipeline, ConfigLoader, createLogger } from 'ccanywhere';

async function runBuild() {
  // 加载配置
  const configLoader = ConfigLoader.getInstance();
  const config = await configLoader.loadConfig();

  // 创建日志记录器
  const logger = createLogger({
    logDir: './logs',
    level: 'info',
    console: true
  });

  // 创建并运行管道
  const pipeline = new BuildPipeline({
    workDir: process.cwd(),
    config,
    logger
  });

  const result = await pipeline.run();
  console.log('构建结果:', result);
}
```

## ⚙️ 配置

### 自动配置检测

CCanywhere 会自动检测 Git 仓库信息：
- **仓库 URL**：从 `git remote origin` 自动获取
- **仓库类型**：根据 URL 自动识别 (GitHub/GitLab/Bitbucket/Gitee)
- **分支名称**：从当前分支自动获取

如果项目是 Git 仓库，无需手动配置仓库信息。

### 配置文件

CCanywhere 支持多种配置格式：

- `ccanywhere.config.json`
- `ccanywhere.config.js`
- `.ccanywhere.json`

### 环境变量

所有配置都可以通过环境变量覆盖：

```bash
# 仓库（可选 - 自动从 .git 配置检测）
REPO_URL=https://github.com/mylukin/ccanywhere  # 可选，自动检测
REPO_KIND=github                                # 可选，自动检测
REPO_BRANCH=main                                # 可选，自动检测

# URLs
ARTIFACTS_URL=https://artifacts.example.com

# 部署
DEPLOYMENT_WEBHOOK_URL=https://deploy.example.com/webhook

# 通知
NOTIFY_CHANNELS=telegram,email
BOT_TOKEN_TELEGRAM=your-token
CHAT_ID_TELEGRAM=your-chat-id
EMAIL_TO=admin@example.com
```

### 通知渠道

#### Telegram

1. 通过 [@BotFather](https://t.me/botfather) 创建机器人
2. 获取您的机器人令牌
3. 将机器人添加到您的聊天/频道
4. 获取聊天 ID

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

#### 邮件

配置 SMTP 设置或使用本地邮件：

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

## 🧪 测试集成

### Playwright 配置

CCanywhere 与 Playwright 无缝协作。创建 `playwright.config.ts`：

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

### 测试文件

在 `tests` 目录中创建测试文件：

```typescript
// tests/example.spec.ts
import { test, expect } from '@playwright/test';

test('首页正确加载', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Home/);
});
```

## 🚀 部署集成

### Dokploy

CCanywhere 支持基于 webhook 的部署触发：

```json
{
  "deployment": "https://deploy.yourdomain.com/api/webhook/deploy"
}
```

或使用对象语法：

```json
{
  "deployment": {
    "webhook": "https://deploy.yourdomain.com/api/webhook/deploy"
  }
}
```

部署 webhook 将接收包含以下信息的负载：
- `ref`: Git 提交哈希
- `branch`: 当前分支名称
- `trigger`: "ccanywhere"
- `timestamp`: Unix 时间戳

## 📱 移动端体验

CCanywhere 生成移动端优化的差异页面，具有：

- 适应所有屏幕尺寸的响应式设计
- 触摸友好的导航
- 语法高亮
- 直接链接到 GitHub/GitLab
- 快速访问部署和测试结果

## 🔧 高级用法

### 自定义插件

```typescript
import type { CcanywherePlugin, RuntimeContext } from 'ccanywhere';

const myPlugin: CcanywherePlugin = {
  name: 'my-plugin',
  version: '0.1.0',
  
  async beforeBuild(context: RuntimeContext) {
    console.log('构建前:', context.revision);
  },
  
  async afterBuild(context: RuntimeContext, result: BuildResult) {
    console.log('构建完成:', result.success);
  }
};
```

### 自定义通知渠道

```typescript
import type { ChannelNotifier, NotificationMessage } from 'ccanywhere';

class SlackNotifier implements ChannelNotifier {
  readonly channel = 'slack' as const;
  
  async send(message: NotificationMessage): Promise<void> {
    // 实现 Slack webhook 逻辑
  }
}
```

## 🛡️ 安全

- 环境变量存储在 `.env` 文件中（git 忽略）
- 敏感文件权限设置为 600
- 锁文件防止并发构建
- 审计日志跟踪所有操作
- 用于预发环境的可选只读模式

## 📊 监控

### 日志

CCanywhere 使用结构化 JSON 日志记录：

```bash
# 查看最近的日志
tail -f logs/runner.jsonl | jq .

# 按修订版本过滤
grep "abc123" logs/runner.jsonl | jq .

# 按错误级别过滤
jq 'select(.level == "error")' logs/runner.jsonl
```

### 指标

监控构建指标：

```typescript
const logger = createLogger({ logDir: './logs' });
const recentLogs = await logger.getRecentLogs(50);
const errorCount = recentLogs.filter(log => log.level === 'error').length;
```

## 🤝 贡献

1. Fork 仓库
2. 创建您的功能分支：`git checkout -b feature/amazing-feature`
3. 提交您的更改：`git commit -m 'Add amazing feature'`
4. 推送到分支：`git push origin feature/amazing-feature`
5. 打开 Pull Request

### 开发

```bash
# 克隆和设置
git clone https://github.com/mylukin/ccanywhere.git
cd ccanywhere
npm install

# 开发
npm run dev

# 测试
npm test
npm run test:coverage

# 构建
npm run build

# 代码检查
npm run lint
npm run format
```

## 📝 许可证

此项目根据 MIT 许可证授权 - 有关详细信息，请参阅 [LICENSE](LICENSE) 文件。

## 🆘 支持

- 📖 [文档](https://github.com/mylukin/ccanywhere/wiki)
- 🐛 [问题跟踪器](https://github.com/mylukin/ccanywhere/issues)
- 💬 [讨论区](https://github.com/mylukin/ccanywhere/discussions)

## 🙏 致谢

- 使用 [TypeScript](https://www.typescriptlang.org/) 构建
- CLI 由 [Commander.js](https://github.com/tj/commander.js/) 驱动
- 使用 [Playwright](https://playwright.dev/) 进行测试
- 使用 [diff2html](https://github.com/rtfpessoa/diff2html) 生成差异
- 使用 [Zod](https://github.com/colinhacks/zod) 进行架构验证

---

**用 ❤️ 为随时随地编码的开发者而制作** 📱💻🌍