#!/usr/bin/env node

/**
 * Postinstall wrapper script for CCanywhere
 * 
 * This is a lightweight wrapper that handles edge cases before
 * calling the actual postinstall logic (if available).
 */

const fs = require('fs');
const path = require('path');

// Debug output (only in debug mode)
if (process.env.CCANYWHERE_DEBUG) {
  console.log('🔍 CCanywhere postinstall starting...');
  console.log('   Current directory:', process.cwd());
  console.log('   npm_config_global:', process.env.npm_config_global);
  console.log('   npm_lifecycle_event:', process.env.npm_lifecycle_event);
}

// Environment detection
const isCI = process.env.CI === 'true' || 
              process.env.CONTINUOUS_INTEGRATION === 'true' ||
              process.env.GITHUB_ACTIONS === 'true' ||
              process.env.GITLAB_CI === 'true' ||
              process.env.CIRCLECI === 'true' ||
              process.env.TRAVIS === 'true' ||
              process.env.JENKINS_URL !== undefined;

const isDevelopment = process.env.NODE_ENV === 'development' || 
                      (!process.env.NODE_ENV && !isCI);

// Skip in CI environments
if (isCI) {
  if (process.env.CCANYWHERE_DEBUG) {
    console.log('📦 CI environment detected - skipping postinstall hooks');
  }
  process.exit(0);
}

// Check if running during npm install (not npm ci)
const npmCommand = process.env.npm_command;
const isNpmInstall = npmCommand === 'install' || npmCommand === 'i';

// Check if this is a global install by looking at the install path
const isGlobalInstall = process.env.npm_config_global === 'true' ||
                       process.cwd().includes('.npm-global') ||
                       process.cwd().includes('npm/lib/node_modules') ||
                       process.cwd().includes('.nvm/versions');

// Path to compiled postinstall script
const distScriptPath = path.join(__dirname, '..', 'dist', 'scripts', 'postinstall.js');

// If dist doesn't exist yet, it's likely a fresh install or development
if (!fs.existsSync(distScriptPath)) {
  // For global installs, this is expected since dist is included in the package
  // For local development, show helpful message
  if (!isGlobalInstall && (isNpmInstall || isDevelopment)) {
    console.log('⚠️  Build artifacts not found - this is expected for first-time setup');
    console.log('   Run "npm run build" to generate the dist directory');
    console.log('   Then run "npm run postinstall" to complete setup');
  }
  // Exit gracefully - don't break the install
  process.exit(0);
}

// For global installs, we'll rely on first-run detection instead
// This is because npm has issues with postinstall scripts in global packages
if (isGlobalInstall) {
  if (process.env.CCANYWHERE_DEBUG) {
    console.log('🌍 Global installation detected - initialization will happen on first run');
  }
  // Don't run postinstall for global installs due to npm limitations
  process.exit(0);
}

// Run the actual postinstall script for local installs
try {
  require(distScriptPath);
} catch (error) {
  // Distinguish between different error types
  if (error.code === 'MODULE_NOT_FOUND') {
    console.error('❌ Postinstall script not found at expected location');
    console.error('   Path:', distScriptPath);
  } else {
    console.error('❌ Error running postinstall script:', error.message);
    if (error.stack && process.env.DEBUG) {
      console.error(error.stack);
    }
  }
  
  // In development, continue despite errors
  if (isDevelopment) {
    console.log('   Continuing installation (development mode)');
    process.exit(0);
  }
  
  // In production, we should fail to alert the user
  console.error('   Installation may be incomplete');
  process.exit(1);
}