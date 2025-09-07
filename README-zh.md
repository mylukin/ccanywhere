# CCanywhere

[![npm version](https://badge.fury.io/js/ccanywhere.svg)](https://badge.fury.io/js/ccanywhere)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[English](README.md) | 简体中文

移动友好的 CI/CD 工具，解决通过 SSH 使用 Claude Code 时无法查看代码差异的问题。自动捕获变更、生成 HTML 差异、上传云存储并发送通知。

## 🎯 为什么需要 CCanywhere？

**问题**：在移动设备上通过 SSH 使用 Claude Code 时无法查看代码差异。

**解决方案**：自动捕获变更 → 生成移动 HTML 差异 → 上传云存储 → 发送通知链接。

## ✨ 功能

- 📱 移动优化的差异查看
- 🔗 Claude Code 钩子集成
- ☁️ 云存储（R2、S3、OSS）
- 📬 多渠道通知（Telegram、钉钉、企业微信、邮件）
- 🧪 Playwright 测试支持
- 🚀 部署 Webhook

## 🚀 快速开始

### 安装

```bash
# 全局安装（推荐）
npm install -g ccanywhere
ccanywhere init

# 或作为项目依赖
npm install -D ccanywhere
```

### 配置

创建 `ccanywhere.config.json`：

```json
{
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

### 测试和运行

```bash
# 测试配置
ccanywhere test --all

# 运行管道
ccanywhere run
```

## 📖 命令

```bash
ccanywhere init          # 初始化配置
ccanywhere run           # 运行构建管道
ccanywhere test          # 测试配置
ccanywhere register      # 管理 Claude Code 钩子
ccanywhere cleanup       # 清理旧产物
ccanywhere info          # 显示配置信息
```

### 测试选项

```bash
ccanywhere test --all              # 测试所有
ccanywhere test --notifications    # 仅测试通知
ccanywhere test --deployment       # 仅测试部署
ccanywhere test --notifications --send --title "测试" --message "你好"
```

### Claude Code 集成

```bash
ccanywhere register         # 注册 Stop 钩子
ccanywhere register --status  # 检查钩子状态
ccanywhere register --remove  # 移除钩子
```

## ⚙️ 配置

### 配置优先级

1. 环境变量（最高优先级）
2. 项目配置（`ccanywhere.config.json`）
3. 用户配置（`~/.claude/ccanywhere.config.json`）
4. 默认值

### 用户配置

在 `~/.claude/ccanywhere.config.json` 存储通用设置：

```json
{
  "notifications": {
    "channels": ["telegram"],
    "telegram": {
      "botToken": "您的令牌",
      "chatId": "您的聊天ID"
    }
  }
}
```

### 环境变量

```bash
# 存储
STORAGE_PROVIDER=r2
R2_ACCOUNT_ID=your-account-id
R2_ACCESS_KEY_ID=your-key
R2_SECRET_ACCESS_KEY=your-secret
R2_BUCKET=my-bucket

# 通知
BOT_TOKEN_TELEGRAM=your-token
CHAT_ID_TELEGRAM=your-chat-id

# 可选
DEPLOYMENT_WEBHOOK_URL=https://deploy.example.com/webhook
```

## 📬 通知

### Telegram

1. 通过 [@BotFather](https://t.me/botfather) 创建机器人
2. 获取机器人令牌
3. 添加机器人到聊天并获取聊天 ID

### 邮件

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

### 钉钉 / 企业微信

```json
{
  "dingtalk": "https://oapi.dingtalk.com/robot/send?access_token=TOKEN",
  "wecom": "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=KEY"
}
```

## 🧪 Playwright 测试

```bash
# 安装 Playwright
npm install -D @playwright/test
npx playwright install

# 在 ccanywhere.config.json 配置
{
  "test": {
    "enabled": true,
    "configFile": "./playwright.config.ts"
  }
}
```

## 📁 存储结构

文件组织为：`{folder}/{project-name}/{filename}`

- GitHub 仓库：`https://github.com/owner/repo`
- 存储路径：`diffs/owner/repo/diff-123.html`

## 🚀 部署

```json
{
  "deployment": "https://deploy.example.com/webhook"
}
```

Webhook 接收：
- `ref`：Git 提交哈希
- `branch`：当前分支
- `trigger`："ccanywhere"
- `timestamp`：Unix 时间戳

## 🔧 开发

```bash
# 设置
git clone https://github.com/mylukin/ccanywhere.git
cd ccanywhere
npm install

# 开发
npm run dev

# 测试
npm test

# 构建
npm run build

# 代码检查和格式化
npm run lint
npm run format
```

## 📝 许可证

MIT

## 🆘 支持

- [Issues](https://github.com/mylukin/ccanywhere/issues)
- [Discussions](https://github.com/mylukin/ccanywhere/discussions)

---

**用 ❤️ 为随时随地编码的开发者而制作** 📱💻🌍