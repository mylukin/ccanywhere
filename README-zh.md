# CCanywhere - TypeScript CI/CD 工具

[![npm version](https://badge.fury.io/js/ccanywhere.svg)](https://badge.fury.io/js/ccanywhere)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)

[English](README.md) | 简体中文

**CCanywhere** - 一个为解决在移动设备（手机/iPad）上通过 SSH 使用 Claude Code 编程而诞生的 CI/CD 工具。在移动设备上通过 SSH 终端开发时，查看代码差异变得极其困难。CCanywhere 通过自动捕获代码变更、生成移动优化的 HTML 差异页面、上传至云存储，并通过 Telegram、钉钉、企业微信或邮件发送可查看的链接通知，完美解决了这个问题。

## 🎯 为什么需要 CCanywhere？

### 问题背景
在移动设备上通过 SSH 使用 Claude Code 编程时，开发者面临一个关键挑战：**无法方便地查看代码差异**。在小屏幕上查看终端式的 diff 几乎是不可能的。

### 解决方案
CCanywhere 通过集成 Claude Code 的钩子系统，实现了：
1. **自动捕获**：当 Claude Code 完成任务时自动获取代码变更
2. **生成移动优化页面**：创建带语法高亮的 HTML 差异页面
3. **上传云存储**：自动上传并生成可分享的链接
4. **即时通知**：通过 Telegram/钉钉/企业微信/邮件发送链接
5. **无缝跳转**：从差异页面直接跳转到 GitHub/GitLab 查看完整代码

## ✨ 核心功能

- **📱 移动优先的差异查看**：为手机和平板优化的 HTML 差异页面
- **🔗 Claude Code 钩子**：代码操作时自动触发
- **☁️ 云存储集成**：支持 R2、S3 和阿里云 OSS
- **📬 即时通知**：多渠道推送带差异链接的通知
- **🧪 Playwright 测试**：响应式开发的自动化测试与截图
- **🔄 GitHub/GitLab 集成**：从差异直接链接到源代码仓库
- **🚀 部署触发器**：可选的基于 webhook 的部署
- **📊 结构化日志**：所有操作的 JSON 审计跟踪

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
      "provider": "r2",
      "folder": "diffs",  // 存储文件夹路径（默认："diffs"）
      "r2": {
        "accountId": "您的Cloudflare账户ID",
        "accessKeyId": "您的R2访问密钥ID",
        "secretAccessKey": "您的R2秘密访问密钥",
        "bucket": "my-artifacts-bucket"
      }
    }
  },
  "build": {
    "base": "origin/main",
    "excludePaths": [".artifacts", "node_modules"]
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

# Cloudflare R2 存储（默认）
R2_ACCOUNT_ID=您的Cloudflare账户ID
R2_ACCESS_KEY_ID=您的R2访问密钥
R2_SECRET_ACCESS_KEY=您的R2秘密密钥
R2_BUCKET=my-artifacts-bucket

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

# 清理旧制品
ccanywhere cleanup --days 7

# 显示项目信息
ccanywhere info

# 管理构建锁
ccanywhere lock status        # 检查锁状态
ccanywhere lock clean         # 清理失效锁
ccanywhere lock force-release # 强制释放锁

# 配置管理
ccanywhere config show        # 显示当前配置
ccanywhere config validate    # 验证配置文件
ccanywhere config edit        # 编辑配置文件
ccanywhere config init-env    # 从配置生成 .env

# Claude Code 集成
ccanywhere claude-register --status      # 检查钩子状态
ccanywhere claude-register              # 交互式设置
ccanywhere claude-register --post-run   # 启用特定钩子
ccanywhere claude-register --remove     # 移除所有钩子
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
BOT_TOKEN_TELEGRAM=your-token
CHAT_ID_TELEGRAM=your-chat-id
DINGTALK_WEBHOOK=https://oapi.dingtalk.com/robot/send?access_token=YOUR_TOKEN
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

## 🧪 Playwright 测试集成

### 为什么集成 Playwright？

在移动设备上开发响应式 Web 应用时，需要测试不同的屏幕尺寸。CCanywhere 集成 Playwright 以实现：
- **测试响应式设计**：跨不同视口尺寸测试
- **自动截图**：测试过程中自动捕获截图
- **生成测试报告**：包含视觉证据的测试报告
- **发送测试结果**：通过通知渠道发送结果

### 设置

首先，在项目中安装 Playwright：

```bash
npm install -D @playwright/test
npx playwright install # 安装浏览器二进制文件
```

### 配置

创建 `playwright.config.ts`：

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

### 部署 Webhook

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

## 📁 存储组织

CCanywhere 根据项目结构自动组织存储路径：

### 存储路径结构

生成的文件按以下路径模式存储：
```
{folder}/{project-name}/{filename}
```

例如：
- 仓库：`https://github.com/mylukin/my-project`
- 生成路径：`diffs/mylukin/my-project/diff-7531080.html`
- 完整 URL：`https://assets.example.com/diffs/mylukin/my-project/diff-7531080.html`

### 自动项目检测

项目名称自动从仓库 URL 中提取：
- GitHub: `https://github.com/owner/repo` → `owner/repo`
- GitLab: `https://gitlab.com/owner/repo` → `owner/repo`
- Bitbucket: `https://bitbucket.org/owner/repo` → `owner/repo`
- SSH URLs: `git@github.com:owner/repo.git` → `owner/repo`

这确保了：
- **更好的组织**：每个项目的文件都隔离在自己的目录中
- **易于管理**：清晰的项目分离，便于权限和生命周期管理
- **有意义的 URL**：URL 中的项目路径一目了然
- **多项目支持**：多个项目可以共享同一个存储桶而不会冲突

### 自定义存储路径

您可以在配置中自定义存储文件夹：
```json
{
  "artifacts": {
    "storage": {
      "folder": "builds"  // 自定义文件夹（默认："diffs"）
    }
  }
}
```

这将生成类似的路径：`builds/mylukin/my-project/diff-7531080.html`

### 构建配置

#### 排除路径配置

您可以从差异生成中排除特定路径：

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

- `excludePaths`: 要从差异生成中排除的路径数组
- 默认值：如未指定则为 `[".artifacts"]`
- 用途：忽略生成的文件、依赖项或构建输出

#### 环境变量配置

现在支持所有存储提供商环境变量。您也可以配置构建选项：

```bash
# 从差异中排除路径（逗号分隔）
EXCLUDE_PATHS=.artifacts,node_modules,dist,coverage

# 支持所有存储提供商环境变量
# Cloudflare R2
R2_ACCOUNT_ID=你的账户ID
R2_ACCESS_KEY_ID=你的访问密钥
R2_SECRET_ACCESS_KEY=你的秘密密钥
R2_BUCKET=你的存储桶

# AWS S3
S3_ACCESS_KEY_ID=你的访问密钥
S3_SECRET_ACCESS_KEY=你的秘密密钥
S3_REGION=us-east-1
S3_BUCKET=你的存储桶

# 阿里云 OSS
OSS_ACCESS_KEY_ID=你的访问密钥
OSS_ACCESS_KEY_SECRET=你的密钥
OSS_REGION=oss-cn-hangzhou
OSS_BUCKET=你的存储桶
```

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
- 支持安全配置（只读模式、链接过期等）

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

# 构建监视模式
npm run dev:watch

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