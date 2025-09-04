# CCanywhere Architecture

## Project Structure

```
ccanywhere/
├── src/                     # TypeScript source code
│   ├── cli/                # Command-line interface
│   │   ├── index.ts       # CLI entry point
│   │   └── commands/      # CLI commands
│   ├── config/            # Configuration management
│   │   ├── loader.ts      # Config loader
│   │   └── schema.ts      # Zod validation schemas
│   ├── core/              # Core functionality
│   │   ├── diff-generator.ts     # Generate HTML diffs
│   │   ├── deployment-trigger.ts # Trigger deployments
│   │   ├── test-runner.ts        # Run Playwright tests
│   │   ├── pipeline.ts           # Build pipeline
│   │   ├── lock-manager.ts       # Concurrency control
│   │   ├── logger.ts             # JSON logging
│   │   └── notifications/        # Notification channels
│   ├── types/             # TypeScript type definitions
│   └── utils/             # Utility functions
├── dist/                  # Compiled JavaScript
├── templates/             # HTML templates
├── examples/              # Example configurations
└── docs/                  # Documentation
```

## Core Components

### 1. Build Pipeline (`core/pipeline.ts`)
- Orchestrates the entire CI/CD process
- Manages step execution order
- Handles error recovery and rollback
- Provides hooks for plugins

### 2. Configuration System (`config/`)
- Loads configuration from multiple sources
- Validates using Zod schemas
- Supports environment variable overrides
- Provides default values

### 3. Diff Generator (`core/diff-generator.ts`)
- Generates mobile-friendly HTML diffs
- Uses diff2html library
- Adds GitHub/GitLab integration
- Supports custom templates

### 4. Notification Manager (`core/notifications/`)
- Multi-channel notification support
- Message formatting (plain, markdown, HTML)
- Error handling and fallbacks
- Channel-specific implementations

### 5. Lock Manager (`core/lock-manager.ts`)
- File-based locking mechanism
- Prevents concurrent builds
- Handles stale lock cleanup
- Process-aware locking

### 6. Logger (`core/logger.ts`)
- Structured JSON logging
- Multiple log levels
- File and console output
- Log rotation support

## Data Flow

1. **Configuration Loading**
   - Load from file (JSON/JS)
   - Override with environment variables
   - Validate against schema

2. **Pipeline Execution**
   - Acquire build lock
   - Generate diff
   - Trigger deployment
   - Run tests
   - Send notifications
   - Release lock

3. **Error Handling**
   - Catch errors at each step
   - Log to audit trail
   - Send error notifications
   - Clean up resources

## External Integrations

### Git
- Uses simple-git for repository operations
- Supports GitHub and GitLab

### Deployment Platforms
- Dokploy (webhook-based)
- Generic webhook support
- Status polling capability

### Notification Services
- Telegram Bot API
- DingTalk webhooks
- WeCom webhooks
- Email (SMTP/local mail)

### Testing
- Playwright integration
- Report generation
- Trace collection

## Security Considerations

- Environment variables for secrets
- File permissions (600) for sensitive files
- No secrets in logs
- Input validation
- Safe file operations

## Performance Optimizations

- Parallel notification sending
- Efficient diff generation
- Lazy loading of dependencies
- Stream processing for large files
- Caching where appropriate

## Extension Points

### Custom Plugins
- beforeBuild hook
- afterBuild hook
- Error handlers
- Custom steps

### Custom Notification Channels
- Implement ChannelNotifier interface
- Register with NotificationManager

### Custom Deployment Providers
- Implement deployment trigger interface
- Add to deployment factory