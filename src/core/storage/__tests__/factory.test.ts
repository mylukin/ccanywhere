/**
 * Storage factory tests
 */

import { StorageFactory } from '../factory.js';
import { S3StorageProvider } from '../s3-provider.js';
import { R2StorageProvider } from '../r2-provider.js';
import { OSSStorageProvider } from '../oss-provider.js';
import type { CcanywhereConfig } from '../../../types/index.js';

describe('StorageFactory', () => {
  describe('create', () => {
    it('should return null when storage is not configured', () => {
      const config: CcanywhereConfig = {};
      const provider = StorageFactory.create(config);
      expect(provider).toBeNull();
    });

    it('should create S3 provider when s3 is configured in artifacts.storage', () => {
      const config: CcanywhereConfig = {
        artifacts: {
          storage: {
            provider: 's3',
            s3: {
              accessKeyId: 'test-key',
              secretAccessKey: 'test-secret',
              region: 'us-east-1',
              bucket: 'test-bucket'
            }
          }
        }
      };
      const provider = StorageFactory.create(config);
      expect(provider).toBeInstanceOf(S3StorageProvider);
    });

    it('should create S3 provider when s3 is configured in legacy storage (backward compatibility)', () => {
      const config: CcanywhereConfig = {
        storage: {
          provider: 's3',
          s3: {
            accessKeyId: 'test-key',
            secretAccessKey: 'test-secret',
            region: 'us-east-1',
            bucket: 'test-bucket'
          }
        }
      };
      const provider = StorageFactory.create(config);
      expect(provider).toBeInstanceOf(S3StorageProvider);
    });

    it('should create R2 provider when r2 is configured in artifacts.storage', () => {
      const config: CcanywhereConfig = {
        artifacts: {
          storage: {
            provider: 'r2',
            r2: {
              accountId: 'test-account',
              accessKeyId: 'test-key',
              secretAccessKey: 'test-secret',
              bucket: 'test-bucket'
            }
          }
        }
      };
      const provider = StorageFactory.create(config);
      expect(provider).toBeInstanceOf(R2StorageProvider);
    });

    it('should create OSS provider when oss is configured in artifacts.storage', () => {
      const config: CcanywhereConfig = {
        artifacts: {
          storage: {
            provider: 'oss',
            oss: {
              accessKeyId: 'test-key',
              accessKeySecret: 'test-secret',
              region: 'oss-cn-hangzhou',
              bucket: 'test-bucket'
            }
          }
        }
      };
      const provider = StorageFactory.create(config);
      expect(provider).toBeInstanceOf(OSSStorageProvider);
    });

    it('should throw error for unsupported provider', () => {
      const config: CcanywhereConfig = {
        artifacts: {
          storage: {
            provider: 'unknown' as any
          }
        }
      };
      expect(() => StorageFactory.create(config)).toThrow('Unsupported storage provider');
    });

    it('should prefer artifacts.storage over legacy storage config', () => {
      const config: CcanywhereConfig = {
        artifacts: {
          storage: {
            provider: 'r2',
            r2: {
              accountId: 'artifacts-account',
              accessKeyId: 'artifacts-key',
              secretAccessKey: 'artifacts-secret',
              bucket: 'artifacts-bucket'
            }
          }
        },
        storage: {
          provider: 's3',
          s3: {
            accessKeyId: 'legacy-key',
            secretAccessKey: 'legacy-secret',
            region: 'us-east-1',
            bucket: 'legacy-bucket'
          }
        }
      };
      const provider = StorageFactory.create(config);
      expect(provider).toBeInstanceOf(R2StorageProvider);
    });
  });

  describe('isStorageEnabled', () => {
    it('should return false when storage is not configured', () => {
      const config: CcanywhereConfig = {};
      expect(StorageFactory.isStorageEnabled(config)).toBe(false);
    });

    it('should return true when artifacts.storage is configured', () => {
      const config: CcanywhereConfig = {
        artifacts: {
          storage: {
            provider: 's3'
          }
        }
      };
      expect(StorageFactory.isStorageEnabled(config)).toBe(true);
    });

    it('should return true when legacy storage is configured', () => {
      const config: CcanywhereConfig = {
        storage: {
          provider: 's3',
          s3: {
            accessKeyId: 'test-key',
            secretAccessKey: 'test-secret',
            region: 'us-east-1',
            bucket: 'test-bucket'
          }
        }
      };
      expect(StorageFactory.isStorageEnabled(config)).toBe(true);
    });
  });
});