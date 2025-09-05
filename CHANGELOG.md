# Changelog

## [Unreleased] - 2025-09-05

### Added
- **Storage Folder Configuration**: Added configurable `folder` parameter to storage configuration
  - Allows users to customize the storage folder path (default: "diffs")
  - Supports both `artifacts.storage.folder` and legacy `storage.folder` configuration
  - Automatically normalizes paths (removes trailing slashes, handles empty values)
  - Full backward compatibility maintained with "diffs" as default

- **Automatic Project Path Organization**: Storage paths now include project names for better organization
  - Automatically extracts project name from repository URL (GitHub, GitLab, Bitbucket, etc.)
  - Storage path pattern: `{folder}/{project-name}/{filename}`
  - Example: `diffs/mylukin/my-project/diff-7531080.html`
  - Supports SSH URLs, custom enterprise instances, and various URL formats
  - Gracefully falls back to simple folder structure when no repository is configured
  - Works perfectly without Git - project remains fully functional

### Changed
- Updated `StorageFactory` to include `getStorageFolder()` utility method
- Enhanced storage path construction in `HtmlDiffGenerator` to use configurable folder

## [0.1.1] - 2024-12-19

### 🔧 Configuration Refactoring

#### Changed
- **BREAKING/COMPATIBLE**: Merged scattered storage-related configuration into unified `artifacts` block
- Moved `urls.artifacts` to `artifacts.baseUrl` for better semantic structure  
- Moved standalone `artifacts` properties to unified configuration block
- Moved `storage` configuration to `artifacts.storage` for logical grouping
- Updated all example configuration files with new structure
- Updated documentation to reflect new configuration format

#### Added
- Full backward compatibility support for existing configuration formats
- New environment variables: `ARTIFACTS_BASE_URL`, `ARTIFACTS_RETENTION_DAYS`, `ARTIFACTS_MAX_SIZE`
- Enhanced configuration validation schema for unified artifacts configuration

#### Migration Guide
**Old configuration:**
```json
{
  "urls": { "artifacts": "https://artifacts.example.com" },
  "artifacts": { "retentionDays": 7, "maxSize": "100MB" },
  "storage": { "provider": "s3", "s3": { ... } }
}
```

**New configuration:**
```json
{
  "artifacts": {
    "baseUrl": "https://artifacts.example.com",
    "retentionDays": 7,
    "maxSize": "100MB",
    "storage": { "provider": "s3", "s3": { ... } }
  }
}
```

*Note: Old configuration format continues to work with automatic migration.*

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