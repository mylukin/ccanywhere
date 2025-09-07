# CLAUDE.md

Guidance for Claude Code when working with this repository.

## Project Context

CCanywhere enables viewing code diffs on mobile devices when using Claude Code via SSH. Captures changes, generates mobile HTML diffs, uploads to cloud, sends notifications.

## Essential Commands

### Build & Development
```bash
npm run build    # Build TypeScript
npm run dev      # Development mode
npm run clean    # Remove dist
```

### Testing
```bash
npm test                        # Run all tests
npm run test:coverage           # Coverage report

# Run specific test
NODE_OPTIONS='--experimental-vm-modules' jest src/core/__tests__/logger.test.ts --no-coverage
```

### Code Quality
```bash
npm run lint         # ESLint
npm run lint:fix     # Auto-fix
npm run format       # Prettier
```

## Architecture

### Project Structure
```
src/
├── cli/              # CLI commands
│   ├── index.ts      # Entry point
│   └── commands/     # init, run, test-runner, register, cleanup, info
├── core/             # Core logic
│   ├── pipeline.ts   # Build pipeline
│   ├── diff-generator.ts
│   ├── storage/      # R2, S3, OSS providers
│   └── notifications/ # Telegram, DingTalk, WeChat, Email
├── config/           # Configuration & validation
├── types/            # TypeScript types
└── utils/            # Utilities
```

### Key Patterns
- Factory: Storage providers, notification channels
- Singleton: ConfigLoader
- Strategy: Multiple implementations per interface

### Configuration Hierarchy
1. Environment variables (highest)
2. Project config (`ccanywhere.config.json`)
3. User config (`~/.claude/ccanywhere.config.json`)
4. Defaults

### Pipeline Flow
1. Acquire lock
2. Generate diff
3. Create HTML page
4. Upload to storage
5. Trigger deployment (optional)
6. Run tests (optional)
7. Send notifications
8. Release lock

## Technical Details

### ES Modules
- Uses `"type": "module"`
- Imports need `.js` extension
- Jest uses experimental VM modules

### TypeScript
- Target: ES2022
- Strict mode enabled
- Path alias: `@/*` → `src/*`

### Claude Code Integration
- Uses Stop event hook only
- Auto-registered via `ccanywhere init`
- Runs when Claude Code session ends

### Storage Paths
Format: `{folder}/{owner}/{repo}/{filename}`
Example: `diffs/mylukin/ccanywhere/diff-123.html`

## Common Tasks

### User Configuration
```bash
ccanywhere init              # Initialize config
ccanywhere info --json       # View config
$EDITOR ~/.claude/ccanywhere.config.json  # Edit manually
```

### Add New CLI Command
1. Create `src/cli/commands/{name}.ts`
2. Export async function
3. Register in `src/cli/index.ts`
4. Add tests in `__tests__/`

### Add Storage Provider
1. Create `src/core/storage/{provider}-provider.ts`
2. Extend `BaseStorageProvider`
3. Register in `storage/factory.ts`
4. Update config schema

### Add Notification Channel
1. Create `src/core/notifications/{channel}.ts`
2. Implement `ChannelNotifier`
3. Register in `notifications/manager.ts`
4. Update schema

### Debugging
- Logs: `logs/runner.jsonl`
- Filter: `tail -f logs/runner.jsonl | jq .`
- Verbose: `LOG_LEVEL=debug` or `--verbose`

## Working Principles

### Use Specialized Agents
For complex tasks, use appropriate agents:
- **Search**: Finding code patterns
- **Refactoring**: Multi-file changes
- **Testing**: test-automator agent
- **Documentation**: docs-architect agent
- **Performance**: performance-engineer agent
- **Security**: security-auditor agent

Launch multiple agents concurrently when tasks are independent.