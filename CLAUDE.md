# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Context

CCanywhere solves the problem of viewing code diffs when developing on mobile devices (phones/iPads) via SSH with Claude Code. It automatically captures code changes through Claude Code hooks, generates mobile-optimized HTML diff pages, uploads them to cloud storage, and sends notification links via Telegram/DingTalk/WeChat Work/Email.

## Essential Commands

### Build & Development
```bash
npm run build         # Build TypeScript to dist/ (removes tsconfig.tsbuildinfo first)
npm run dev          # Run in development mode with tsx watch
npm run clean        # Remove dist directory
```

### Testing
```bash
npm test             # Run all tests with Jest (NODE_OPTIONS='--experimental-vm-modules')
npm run test:watch   # Run tests in watch mode
npm run test:coverage # Generate coverage report

# Run specific tests
NODE_OPTIONS='--experimental-vm-modules' jest src/core/__tests__/logger.test.ts --no-coverage
NODE_OPTIONS='--experimental-vm-modules' jest src/config/__tests__/schema.test.ts --no-coverage
```

### Code Quality
```bash
npm run lint         # Run ESLint on src/**/*.ts
npm run lint:fix     # Auto-fix ESLint issues
npm run format       # Format code with Prettier
npm run format:check # Check formatting without changes
```

### Publishing
```bash
npm run prepublishOnly # Clean, build, and test before publish
```

## Architecture Overview

### Core Modules Structure

The project follows a modular architecture with clear separation of concerns:

1. **CLI Layer** (`src/cli/`)
   - Entry point: `src/cli/index.ts`
   - Commands: `src/cli/commands/` - Each command is a separate module
   - Key commands: init, run, test-runner, notify, claude-register, cleanup, config, lock

2. **Core Pipeline** (`src/core/`)
   - `pipeline.ts`: Main BuildPipeline class orchestrating the CI/CD workflow
   - `diff-generator.ts`: Creates mobile-friendly HTML diff pages
   - `deployment-trigger.ts`: Handles webhook-based deployments
   - `test-runner.ts`: Executes tests including Playwright integration
   - `lock-manager.ts`: File-based concurrency control
   - `logger.ts`: Structured JSON logging with Winston
   - `claude-hook.ts`: Claude Code integration hooks

3. **Storage Abstraction** (`src/core/storage/`)
   - Factory pattern for multiple storage providers
   - Supported: R2 (Cloudflare), S3 (AWS), OSS (Alibaba)
   - Auto-organizes paths: `{folder}/{project-name}/{filename}`
   - Project name extracted from repository URL

4. **Notification System** (`src/core/notifications/`)
   - Multi-channel support: Telegram, DingTalk, WeCom, Email
   - Centralized NotificationManager
   - Formatted messages with build status, links, and details

5. **Configuration** (`src/config/`)
   - Schema validation with Zod
   - Multiple sources: JSON file, environment variables, Git config
   - Auto-detection of repository details from Git

6. **Type Definitions** (`src/types/`)
   - Central type definitions for the entire codebase
   - Ensures type safety across modules

### Key Design Patterns

- **Factory Pattern**: Storage providers, notification channels
- **Builder Pattern**: Pipeline construction with configuration
- **Singleton Pattern**: ConfigLoader instance management
- **Strategy Pattern**: Different storage and notification implementations
- **Module Pattern**: ES modules with explicit exports

### Configuration Flow

1. ConfigLoader checks for config files: `ccanywhere.config.json`, `.ccanywhere.json`
2. Merges with environment variables (env vars take precedence)
3. Auto-detects Git repository information if not provided
4. Validates against Zod schema
5. Returns strongly-typed configuration object

### Pipeline Execution Flow

1. Lock acquisition (prevents concurrent builds)
2. Git operations (fetch, diff generation)
3. HTML diff page creation with mobile-optimized layout
4. Upload to configured storage provider
5. Optional deployment trigger via webhook
6. Optional test execution (including Playwright)
7. Notification dispatch to configured channels
8. Lock release

### Testing Strategy

- Jest with ts-jest for TypeScript support
- ES modules configuration (experimental VM modules)
- Test files in `__tests__` directories or `*.test.ts`
- Coverage thresholds set at 5% (minimal for now)
- 30-second timeout for async operations
- Setup file at `src/__tests__/setup.ts`
- Extensive test coverage across CLI commands, core modules, notifications, and utilities

## Important Technical Details

### ES Modules
- Project uses ES modules (`"type": "module"` in package.json)
- All imports must include `.js` extension (even for TypeScript files)
- Jest configured with experimental VM modules support

### TypeScript Configuration
- Target: ES2022
- Strict mode enabled with all strict checks
- Path aliases: `@/*` maps to `src/*`
- Incremental compilation enabled
- Source maps and declarations generated

### CLI Binary
- Binary exposed as `ccanywhere` via npm
- Shebang: `#!/usr/bin/env node` in `src/cli/index.ts`
- Made executable during build: `chmod +x dist/cli/index.js`

### Claude Code Integration
- Hooks automatically registered on global install
- Supported hooks: pre-commit, post-run, pre-test, post-test
- Platform-specific path detection for hook files
- Backup creation before modification

### Storage Path Structure
- Automatic project name extraction from repo URL
- Format: `{storage.folder}/{owner}/{repo}/{filename}`
- Example: `diffs/mylukin/ccanywhere/diff-7531080.html`

### Deployment Webhook
- POST request with JSON payload
- Includes: ref (commit hash), branch, trigger ("ccanywhere"), timestamp
- Configurable via `deployment` field or `DEPLOYMENT_WEBHOOK_URL` env var

## Dependencies

### Core Runtime Dependencies
- **Commander**: CLI framework
- **Zod**: Schema validation
- **Winston**: Logging
- **diff2html**: HTML diff generation
- **Axios**: HTTP requests
- **Chalk/Ora**: Terminal output styling
- **Storage SDKs**: @aws-sdk/client-s3, ali-oss
- **Notification libs**: nodemailer, node-telegram-bot-api

### Development Dependencies
- **TypeScript** 5.3.3
- **Jest** with ts-jest
- **ESLint** with TypeScript plugin
- **Prettier** for formatting
- **tsx** for development mode

## Working Principles

### Leverage Specialized Agents for Complex Tasks
When working on this codebase, prioritize using specialized agents to handle complex, multi-step operations. This approach ensures:
- **Parallel Processing**: Multiple agents can work concurrently on different aspects
- **Domain Expertise**: Each agent brings specialized knowledge for specific tasks
- **Comprehensive Coverage**: Agents thoroughly explore and handle edge cases
- **Efficient Search**: Agents optimize file discovery and code analysis

#### When to Use Agents:
- **Code Search & Analysis**: Use agents for finding implementations, dependencies, or patterns across the codebase
- **Refactoring**: Let agents handle systematic code changes across multiple files
- **Testing**: Deploy test-automator agents for comprehensive test coverage
- **Documentation**: Use docs-architect agents for generating technical documentation
- **Performance**: Leverage performance-engineer agents for optimization tasks
- **Security**: Employ security-auditor agents for vulnerability assessments

#### Agent Selection Strategy:
1. Identify the task complexity - if it involves multiple files or steps, use an agent
2. Match the task to the appropriate specialized agent type
3. Launch multiple agents concurrently when tasks are independent
4. Provide clear, detailed instructions to maximize agent effectiveness

## Common Development Tasks

### Adding a New CLI Command
1. Create file in `src/cli/commands/{command-name}.ts`
2. Export async function handling the command
3. Register in `src/cli/index.ts`
4. Add types in `src/types/` if needed
5. Create test file in `src/cli/commands/__tests__/{command-name}.test.ts`

### Adding a Storage Provider
1. Create provider in `src/core/storage/{provider}-provider.ts`
2. Extend `BaseStorageProvider` class
3. Register in `src/core/storage/factory.ts`
4. Update config schema in `src/config/schema.ts`
5. Add provider-specific tests in `src/core/storage/__tests__/`

### Adding a Notification Channel
1. Create channel in `src/core/notifications/{channel}.ts`
2. Implement `ChannelNotifier` interface
3. Register in `src/core/notifications/manager.ts`
4. Update config schema and types
5. Create test in `src/core/notifications/__tests__/{channel}.test.ts`

### Running Single Tests
Always use NODE_OPTIONS for Jest with ES modules:
```bash
NODE_OPTIONS='--experimental-vm-modules' jest path/to/test.ts --no-coverage
```

### Debugging
- Check logs in `logs/runner.jsonl` (JSON Lines format)
- Use `jq` for filtering: `tail -f logs/runner.jsonl | jq .`
- Enable verbose mode: `ccanywhere run --verbose` or `LOG_LEVEL=debug`

### Claude Code Hook Management
The project includes utilities for managing Claude Code integration:
- `src/utils/claude-detector.ts`: Platform-specific path detection for Claude settings
- `src/utils/hook-injector.ts`: Safe hook injection with backup/restore capabilities
- `src/cli/commands/claude-register.ts`: CLI interface for hook management