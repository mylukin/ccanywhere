/**
 * Configuration module exports
 */

export { ConfigLoader } from './loader.js';
export {
  validateConfig,
  getDefaultConfig,
  CcanywhereConfigSchema,
  RepoKindSchema,
  NotificationChannelSchema
} from './schema.js';

// Re-export types
export type { CcanywhereConfig, RepoKind, NotificationChannel } from '../types/index.js';
