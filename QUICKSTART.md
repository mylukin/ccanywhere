# CCanywhere - 快速开始指南

## 📦 1分钟安装

```bash
# 全局安装
npm install -g ccanywhere

# 或使用 pnpm/yarn
pnpm add -g ccanywhere
yarn global add ccanywhere
```

## 🚀 30秒初始化

```bash
# 在你的项目目录中运行
ccanywhere init

# 这会创建 ccanywhere.config.js 配置文件
# 并引导你完成基础设置
```

## ⚙️ 基础配置

创建 `ccanywhere.config.js`:

```javascript
export default {
  // Git仓库配置
  repository: {
    url: 'https://github.com/mylukin/ccanywhere',
    base: 'origin/main'
  },
  
  // 通知配置（选择你需要的渠道）
  notifications: {
    channels: ['telegram'], // 可选: telegram, dingtalk, wecom, email
    telegram: {
      botToken: process.env.TELEGRAM_BOT_TOKEN,
      chatId: process.env.TELEGRAM_CHAT_ID
    }
  },
  
  // 部署配置
  deployment: process.env.DEPLOYMENT_WEBHOOK_URL,
  
  // 产物配置
  artifacts: {
    baseUrl: 'https://artifacts.yourdomain.com',
    retentionDays: 7,
    maxSize: '100MB',
    storage: {
      provider: 's3',
      s3: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        region: 'us-east-1',
        bucket: 'my-artifacts-bucket'
      }
    }
  }
}
```

## 🏃 运行

### 基础命令

```bash
# 测试配置是否正确
ccanywhere test

# 运行完整的CI/CD流程
ccanywhere run

# 只生成diff
ccanywhere diff

# 只发送通知
ccanywhere notify --message "部署完成"

# 查看最近的日志
ccanywhere logs
```

### 高级用法

```bash
# 指定配置文件
ccanywhere run --config ./config/production.js

# 指定git范围
ccanywhere diff --base origin/main --head feature/new

# 跳过某些步骤
ccanywhere run --skip test --skip notify

# 只运行特定步骤
ccanywhere run --only diff,deploy
```

## 🔌 Claude Code 集成

### 方法1：自动注册

```bash
ccanywhere claude-register
```

### 方法2：手动配置

在 `.claude/hooks.js` 中：

```javascript
const { ClaudeHook } = require('ccanywhere');

module.exports = {
  postRun: ClaudeHook.postRun,
  preCommit: ClaudeHook.preCommit
}
```

## 📱 在手机查看结果

运行后，你会在配置的通知渠道收到消息，包含：

1. **📝 Diff链接** - 移动端优化的代码差异页面
2. **🌐 预览链接** - 应用预览URL
3. **📊 测试报告** - Playwright测试结果

点击链接即可在手机浏览器中查看。

## 🎨 自定义

### 自定义diff模板

```javascript
// ccanywhere.config.js
export default {
  diff: {
    template: './my-templates/diff.html',
    css: './my-templates/diff.css'
  }
}
```

### 添加自定义步骤

```javascript
// ccanywhere.config.js
export default {
  pipeline: {
    steps: [
      'diff',
      'custom:./scripts/my-check.js', // 自定义步骤
      'deploy',
      'test',
      'notify'
    ]
  }
}
```

### 自定义通知格式

```javascript
// ccanywhere.config.js
export default {
  notifications: {
    format: 'markdown', // plain, markdown, html
    template: `
      🚀 部署 {{rev}}
      差异: {{diffUrl}}
      预览: {{previewUrl}}
      耗时: {{duration}}秒
    `
  }
}
```

## 📊 npm脚本集成

在 `package.json` 中：

```json
{
  "scripts": {
    "deploy": "ccanywhere run",
    "deploy:production": "ccanywhere run --env production --confirm",
    "test:config": "ccanywhere test",
    "cleanup": "ccanywhere cleanup --days 7"
  }
}
```

## 🐛 调试

```bash
# 启用详细日志
ccanywhere run --verbose

# 干运行（不实际执行）
ccanywhere run --dry-run

# 查看当前配置
ccanywhere config show

# 验证配置
ccanywhere config validate
```

## 🔐 环境变量

支持通过环境变量覆盖配置：

```bash
# .env
CCANYWHERE_REPO_URL=https://github.com/mylukin/ccanywhere
CCANYWHERE_TELEGRAM_TOKEN=your-token
CCANYWHERE_TELEGRAM_CHAT_ID=your-chat-id
DEPLOYMENT_WEBHOOK_URL=https://deploy.example.com/hook
```

## 📝 常见场景

### 场景1：每次提交后自动部署

```bash
# 在 git hooks 中
echo "ccanywhere run" >> .git/hooks/post-commit
chmod +x .git/hooks/post-commit
```

### 场景2：PR合并后部署

```yaml
# .github/workflows/deploy.yml
on:
  push:
    branches: [main]
    
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - run: npm install -g ccanywhere
      - run: ccanywhere run
```

### 场景3：定时部署

```bash
# 添加到 crontab
0 2 * * * cd /your/project && ccanywhere run
```

## ❓ 获取帮助

```bash
# 查看所有命令
ccanywhere --help

# 查看特定命令帮助
ccanywhere run --help

# 查看版本
ccanywhere --version
```

## 🎯 最佳实践

1. **使用配置文件** 而非命令行参数
2. **设置环境变量** 保护敏感信息
3. **定期清理** 旧的构建产物
4. **监控日志** 确保流程正常
5. **测试先行** 在生产环境前充分测试

---

需要更多帮助？查看[完整文档](./README_npm.md)或[迁移指南](./MIGRATION.md)。