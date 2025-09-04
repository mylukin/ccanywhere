# Changelog

## [0.1.0] - 2024-09-04

### 🎉 Initial Release - Complete TypeScript Rewrite

#### Added
- **TypeScript Implementation**: Complete rewrite from Bash to TypeScript
- **npm Package**: Distributable as standard npm package
- **CLI Interface**: Commander.js based CLI with multiple commands
- **Configuration System**: Flexible configuration with Zod validation
- **Multi-Channel Notifications**: Support for Telegram, DingTalk, WeCom, Email
- **Mobile-Friendly Diffs**: Responsive HTML diff pages optimized for mobile
- **Deployment Integration**: Built-in Dokploy support with webhook triggers
- **Test Runner**: Playwright integration with report generation
- **Concurrency Control**: File-based locking mechanism
- **JSON Audit Logging**: Structured logging with metadata
- **Plugin System**: Extensible architecture for custom integrations
- **Cross-Platform**: Full support for Windows, macOS, and Linux

#### Changed
- Migrated from Bash scripts to TypeScript modules
- Configuration now uses JSON/JS files instead of .env
- Improved error handling and reporting
- Better IDE support with TypeScript types
- More efficient parallel processing

#### Features
- `ccanywhere init` - Interactive project initialization
- `ccanywhere run` - Execute build pipeline
- `ccanywhere test` - Test configuration and services
- `ccanywhere config` - Manage configuration
- `ccanywhere cleanup` - Clean old artifacts
- `ccanywhere lock` - Manage build locks
- `ccanywhere notify` - Send test notifications
- `ccanywhere info` - Display system information

#### Security
- Environment variable support for sensitive data
- Secure file permissions
- Input validation
- No secrets in logs

#### Documentation
- Comprehensive README
- Quick Start guide
- Migration guide from Bash version
- Architecture documentation
- API documentation with TypeScript types

---

## Previous Versions (Bash)

### [0.1.0] - Initial Bash Implementation
- Basic CI/CD pipeline in Bash
- Simple notification system
- File-based configuration
- Linux/macOS only support