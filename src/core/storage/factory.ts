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
    if (!config.storage) {
      return null; // Storage is optional
    }

    const { provider } = config.storage;

    switch (provider) {
      case 's3':
        if (!config.storage.s3) {
          throw new ConfigurationError('S3 configuration is required when using S3 provider');
        }
        return new S3StorageProvider(config.storage.s3);

      case 'r2':
        if (!config.storage.r2) {
          throw new ConfigurationError('R2 configuration is required when using R2 provider');
        }
        return new R2StorageProvider(config.storage.r2);

      case 'oss':
        if (!config.storage.oss) {
          throw new ConfigurationError('OSS configuration is required when using OSS provider');
        }
        return new OSSStorageProvider(config.storage.oss);

      default:
        throw new ConfigurationError(`Unsupported storage provider: ${provider}`);
    }
  }

  static isStorageEnabled(config: CcanywhereConfig): boolean {
    return !!config.storage?.provider;
  }
}