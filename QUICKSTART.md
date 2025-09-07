# CCanywhere - 快速开始

## 📦 安装

```bash
# 全局安装
npm install -g ccanywhere

# 或使用 pnpm/yarn
pnpm add -g ccanywhere
yarn global add ccanywhere
```

## 🚀 初始化

```bash
# 在项目目录中运行
ccanywhere init

# 创建配置文件并引导设置
```

## ⚙️ 基础配置

创建 `ccanywhere.config.json`:

```json
{
  "notifications": {
    "channels": ["telegram"],
    "telegram": {
      "botToken": "您的机器人令牌",
      "chatId": "您的聊天ID"
    }
  },
  "artifacts": {
    "baseUrl": "https://artifacts.example.com",
    "storage": {
      "provider": "r2",
      "r2": {
        "accountId": "您的账户ID",
        "accessKeyId": "您的访问密钥",
        "secretAccessKey": "您的秘密密钥",
        "bucket": "my-bucket"
      }
    }
  }
}
```

## 🏃 运行

### 基础命令

```bash
# 测试配置
ccanywhere test --all

# 运行构建管道
ccanywhere run

# 发送测试通知
ccanywhere test --notifications --send --title "测试"

# 清理旧产物
ccanywhere cleanup --days 7

# 查看配置信息
ccanywhere info
```

### Claude Code 集成

```bash
# 注册钩子
ccanywhere register

# 查看状态
ccanywhere register --status

# 移除钩子
ccanywhere register --remove
```

## 🔌 Claude Code 自动集成

全局安装时会提示配置 Claude Code 钩子：

```bash
npm install -g ccanywhere
ccanywhere init  # 自动检测并配置 Claude Code
```

Stop 钩子在 Claude Code 会话结束时运行，生成整个会话的 diff 摘要。

## 📱 移动端查看

运行后，你会在配置的通知渠道收到：

1. **📝 Diff 链接** - 移动优化的代码差异页面
2. **🌐 预览链接** - 应用预览 URL
3. **📊 测试报告** - Playwright 测试结果

## 🎨 自定义配置

### 构建配置

```json
{
  "build": {
    "base": "origin/main",
    "excludePaths": [".artifacts", "node_modules", "dist"],
    "lockTimeout": 300,
    "cleanupDays": 7
  }
}
```

### 存储配置

```json
{
  "artifacts": {
    "storage": {
      "provider": "r2",  // 可选: r2, s3, oss
      "folder": "diffs",
      "r2": {
        "accountId": "YOUR_ID",
        "accessKeyId": "YOUR_KEY",
        "secretAccessKey": "YOUR_SECRET",
        "bucket": "my-bucket"
      }
    }
  }
}
```

### 通知配置

```json
{
  "notifications": {
    "channels": ["telegram", "dingtalk", "wecom", "email"],
    "telegram": {
      "botToken": "YOUR_TOKEN",
      "chatId": "YOUR_CHAT_ID"
    },
    "dingtalk": "https://oapi.dingtalk.com/robot/send?access_token=TOKEN",
    "wecom": "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=KEY"
  }
}
```

## 📊 npm 脚本集成

在 `package.json`:

```json
{
  "scripts": {
    "deploy": "ccanywhere run",
    "test:config": "ccanywhere test --all",
    "cleanup": "ccanywhere cleanup --days 7"
  }
}
```

## 🐛 调试

```bash
# 详细日志
LOG_LEVEL=debug ccanywhere run

# 测试配置
ccanywhere test --all

# 清理旧产物和锁
ccanywhere cleanup --days 7
```

## 🔐 环境变量

支持通过环境变量覆盖配置：

```bash
# .env
# R2 存储
R2_ACCOUNT_ID=your-account-id
R2_ACCESS_KEY_ID=your-key
R2_SECRET_ACCESS_KEY=your-secret
R2_BUCKET=my-bucket

# 通知
BOT_TOKEN_TELEGRAM=your-token
CHAT_ID_TELEGRAM=your-chat-id

# 部署
DEPLOYMENT_WEBHOOK_URL=https://deploy.example.com/webhook
```

## ❓ 获取帮助

```bash
# 查看帮助
ccanywhere --help

# 查看命令帮助
ccanywhere run --help

# 查看版本
ccanywhere --version
```

## 🎯 最佳实践

1. **使用配置文件**而非命令行参数
2. **设置环境变量**保护敏感信息
3. **定期清理**旧的构建产物
4. **监控日志**确保流程正常
5. **测试先行**在生产环境前充分测试