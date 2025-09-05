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

创建 `ccanywhere.config.json`:

```json
{
  "repo": {
    "kind": "github",
    "url": "https://github.com/mylukin/ccanywhere",
    "branch": "main"
  },
  
  "notifications": {
    "channels": ["telegram"],
    "telegram": {
      "botToken": "您的机器人令牌",
      "chatId": "您的聊天ID"
    }
  },
  
  "deployment": "https://deploy.yourdomain.com/api/webhook",
  
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

# 发送测试通知
ccanywhere notify --channels telegram --title "部署完成"

# 清理旧产物
ccanywhere cleanup --days 7

# Claude Code集成管理
ccanywhere claude-register --status
```

### 高级用法

```bash
# 指定配置文件
ccanywhere run --config ./config/production.json

# 测试所有配置
ccanywhere test --all

# Claude Code钩子管理
ccanywhere claude-register              # 交互式设置
ccanywhere claude-register --post-run   # 启用特定钩子
ccanywhere claude-register --remove     # 移除所有钩子
```

## 🔌 Claude Code 集成

全局安装时会自动配置 Claude Code 钩子：

```bash
npm install -g ccanywhere
# 自动检测并配置 Claude Code 钩子 ✨
```

## 📱 在手机查看结果

运行后，你会在配置的通知渠道收到消息，包含：

1. **📝 Diff链接** - 移动端优化的代码差异页面
2. **🌐 预览链接** - 应用预览URL
3. **📊 测试报告** - Playwright测试结果

点击链接即可在手机浏览器中查看。

## 🎨 自定义

### 自定义构建配置

```json
// ccanywhere.config.json
{
  "build": {
    "base": "origin/main",
    "excludePaths": [".artifacts", "node_modules", "dist"],
    "lockTimeout": 300,
    "cleanupDays": 7
  }
}
```

### 存储配置选项

```json
// ccanywhere.config.json
{
  "storage": {
    "provider": "r2",  // 可选: r2(默认), s3, oss
    "folder": "diffs",  // 存储文件夹路径（默认："diffs"，可自定义）
    "r2": {  // Cloudflare R2 (推荐)
      "accountId": "您的Cloudflare账户ID",
      "accessKeyId": "您的R2访问密钥ID",
      "secretAccessKey": "您的R2秘密密钥",
      "bucket": "my-artifacts"
    },
    "s3": {  // AWS S3
      "accessKeyId": "您的AWS访问密钥",
      "secretAccessKey": "您的AWS秘密密钥",
      "region": "us-east-1",
      "bucket": "my-artifacts"
    },
    "oss": {  // 阿里云 OSS
      "accessKeyId": "您的阿里云访问密钥",
      "accessKeySecret": "您的阿里云密钥",
      "region": "oss-cn-hangzhou",
      "bucket": "my-artifacts"
    }
  }
}
```

### 通知渠道配置

```json
// ccanywhere.config.json
{
  "notifications": {
    "channels": ["telegram", "dingtalk", "wecom", "email"],
    "telegram": {
      "botToken": "您的机器人令牌",
      "chatId": "您的聊天ID"
    },
    "dingtalk": {
      "webhook": "https://oapi.dingtalk.com/robot/send?access_token=您的令牌",
      "secret": "您的钉钉密钥"
    }
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
LOG_LEVEL=debug ccanywhere run

# 测试配置
ccanywhere test --all

# 测试单个通知渠道
ccanywhere test notify --channels telegram

# 清理构建锁
ccanywhere cleanup --locks
```

## 🔐 环境变量

支持通过环境变量覆盖配置：

```bash
# .env
REPO_URL=https://github.com/mylukin/ccanywhere

# Cloudflare R2 存储（默认）
R2_ACCOUNT_ID=your-cloudflare-account-id
R2_ACCESS_KEY_ID=your-r2-access-key-id
R2_SECRET_ACCESS_KEY=your-r2-secret-key
R2_BUCKET=my-artifacts-bucket

# 通知
BOT_TOKEN_TELEGRAM=your-token
CHAT_ID_TELEGRAM=your-chat-id

# 部署
DEPLOYMENT_WEBHOOK_URL=https://deploy.example.com/hook

# 日志
LOG_LEVEL=info
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

# Claude Code集成状态
ccanywhere claude-register --status

# 查看版本
ccanywhere --version
```

## 🎯 最佳实践

1. **使用配置文件** 而非命令行参数
2. **设置环境变量** 保护敏感信息
3. **定期清理** 旧的构建产物
4. **监控日志** 确保流程正常
5. **测试先行** 在生产环境前充分测试

