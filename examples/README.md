# CCanywhere Examples

This directory contains example configurations and test files for CCanywhere.

## Files

### Configuration Examples

#### `ccanywhere.config.json`
A complete JSON configuration example showing all available options. This is the recommended configuration format for most projects.

#### `ccanywhere.config.js`
A JavaScript configuration example that demonstrates:
- Dynamic configuration based on environment variables
- Environment-specific overrides
- Custom hooks for build events

Use this format when you need:
- Dynamic configuration values
- Environment-based settings
- Custom build hooks

#### `.env.example`
Environment variables configuration for users who prefer this approach or need to override config file settings. 

Note: Config files take precedence over environment variables.

### Project Integration

#### `package.json`
Shows how to integrate CCanywhere into your Node.js project:
- Installing as a dev dependency
- Adding npm scripts for common tasks
- Example project structure with Next.js and Playwright

### Testing

#### `playwright.config.ts`
Complete Playwright configuration optimized for CCanywhere:
- Multiple browser configurations
- Mobile device testing
- CI/CD optimizations
- Artifact generation settings

#### `tests/example.spec.ts`
Example Playwright test file demonstrating:
- Homepage testing patterns
- Responsive design tests
- Performance checks
- SEO validation

## Usage

### 1. Quick Start

Copy the configuration file that matches your preference:

```bash
# For JSON configuration
cp examples/ccanywhere.config.json ./ccanywhere.config.json

# For JavaScript configuration
cp examples/ccanywhere.config.js ./ccanywhere.config.js

# For environment variables
cp examples/.env.example ./.env
```

### 2. Customize Configuration

Edit the configuration file with your actual values:
- Repository URL
- Notification credentials (Telegram, Email, etc.)
- Deployment webhooks
- Test settings

### 3. Set Up Testing

If using Playwright for testing:

```bash
# Copy test configuration
cp examples/playwright.config.ts ./playwright.config.ts

# Create tests directory
mkdir tests
cp examples/tests/example.spec.ts ./tests/

# Install Playwright
npm install -D @playwright/test
npx playwright install
```

### 4. Run CCanywhere

```bash
# Initialize (first time)
ccanywhere init

# Test configuration
ccanywhere test

# Run full pipeline
ccanywhere run
```

## Configuration Priority

When multiple configuration sources are present, CCanywhere uses this priority order:

1. Command-line arguments
2. Configuration file (`ccanywhere.config.js` or `ccanywhere.config.json`)
3. Environment variables (`.env` file or system environment)
4. Default values

## Best Practices

1. **Use configuration files** for project settings
2. **Use environment variables** for secrets and credentials
3. **Don't commit `.env` files** - add to `.gitignore`
4. **Test locally first** with `ccanywhere test`
5. **Start simple** - enable features as needed

## Need Help?

- [Documentation](https://github.com/mylukin/ccanywhere#readme)
- [Issue Tracker](https://github.com/mylukin/ccanywhere/issues)
- [Quick Start Guide](../QUICKSTART.md)