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

// Environment detection - simplified
const isCI = process.env.CI === 'true';
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

// Check if this is a global install
function detectGlobalInstall() {
  return process.env.npm_config_global === 'true' ||
         process.cwd().includes('.npm-global') ||
         process.cwd().includes('npm/lib/node_modules') ||
         process.cwd().includes('.nvm/versions') ||
         process.cwd().includes('yarn/global') ||
         process.cwd().includes('pnpm-global');
}

const isGlobalInstall = detectGlobalInstall();

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
  // Pass global install flag to the actual postinstall script
  process.env.CCANYWHERE_IS_GLOBAL = 'true';
  // Don't run postinstall for global installs due to npm limitations
  process.exit(0);
}

// Run the actual postinstall script for local installs
try {
  // Set environment flag for local install
  process.env.CCANYWHERE_IS_GLOBAL = 'false';
  require(distScriptPath);
} catch (error) {
  // Only show errors in debug mode or production
  if (process.env.CCANYWHERE_DEBUG || !isDevelopment) {
    if (error.code === 'MODULE_NOT_FOUND') {
      console.error('❌ Postinstall script not found');
      if (process.env.CCANYWHERE_DEBUG) {
        console.error('   Path:', distScriptPath);
      }
    } else {
      console.error('❌ Postinstall error:', error.message);
      if (process.env.CCANYWHERE_DEBUG && error.stack) {
        console.error(error.stack);
      }
    }
  }
  
  // Always exit gracefully to not break npm install
  process.exit(0);
}