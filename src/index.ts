/**
 * CCanywhere main entry point for programmatic usage
 */

export * from './types/index.js';
export * from './config/index.js';
export * from './core/pipeline.js';
export * from './core/diff-generator.js';
export * from './core/deployment-trigger.js';
export * from './core/test-runner.js';
export * from './core/lock-manager.js';
export * from './core/logger.js';
export * from './core/notifications/index.js';

// Main pipeline class
export { BuildPipeline } from './core/pipeline.js';

// Configuration management
export { ConfigLoader } from './config/index.js';

// Factory functions
export { createLogger } from './core/logger.js';
export { createDeploymentTrigger } from './core/deployment-trigger.js';
export { createTestRunner } from './core/test-runner.js';