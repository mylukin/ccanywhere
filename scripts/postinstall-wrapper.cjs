#!/usr/bin/env node

/**
 * Postinstall wrapper script for CCanywhere
 * 
 * This is a lightweight wrapper that handles edge cases before
 * calling the actual postinstall logic (if available).
 */

const fs = require('fs');
const path = require('path');

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
  console.log('📦 CI environment detected - skipping postinstall hooks');
  process.exit(0);
}

// Check if running during npm install (not npm ci)
const npmCommand = process.env.npm_command;
const isNpmInstall = npmCommand === 'install' || npmCommand === 'i';

// Path to compiled postinstall script
const distScriptPath = path.join(__dirname, '..', 'dist', 'scripts', 'postinstall.js');

// If dist doesn't exist yet, it's likely a fresh install
if (!fs.existsSync(distScriptPath)) {
  if (isNpmInstall || isDevelopment) {
    console.log('⚠️  Build artifacts not found - this is expected for first-time setup');
    console.log('   Run "npm run build" to generate the dist directory');
    console.log('   Then run "npm run postinstall" to complete setup');
  }
  // Exit gracefully - don't break the install
  process.exit(0);
}

// Run the actual postinstall script
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