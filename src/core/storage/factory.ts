/**
 * Storage provider factory
 */

import { S3StorageProvider } from './s3-provider.js';
import { R2StorageProvider } from './r2-provider.js';
import { OSSStorageProvider } from './oss-provider.js';
import type { IStorageProvider, CcanywhereConfig } from '../../types/index.js';
import { ConfigurationError } from '../../types/index.js';

export class StorageFactory {
  static create(config: CcanywhereConfig): IStorageProvider | null {
    // Try new artifacts.storage configuration first, then fall back to legacy storage config
    const storageConfig = config.artifacts?.storage || config.storage;
    
    if (!storageConfig) {
      return null; // Storage is optional
    }

    const { provider } = storageConfig;

    switch (provider) {
      case 's3':
        if (!storageConfig.s3) {
          throw new ConfigurationError('S3 configuration is required when using S3 provider');
        }
        return new S3StorageProvider(storageConfig.s3);

      case 'r2':
        if (!storageConfig.r2) {
          throw new ConfigurationError('R2 configuration is required when using R2 provider');
        }
        return new R2StorageProvider(storageConfig.r2);

      case 'oss':
        if (!storageConfig.oss) {
          throw new ConfigurationError('OSS configuration is required when using OSS provider');
        }
        return new OSSStorageProvider(storageConfig.oss);

      default:
        throw new ConfigurationError(`Unsupported storage provider: ${provider}`);
    }
  }

  static isStorageEnabled(config: CcanywhereConfig): boolean {
    return !!(config.artifacts?.storage?.provider || config.storage?.provider);
  }
}