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

  describe('getStorageFolder', () => {
    it('should return default "diffs" when no storage configuration exists', () => {
      const config: CcanywhereConfig = {};
      const folder = StorageFactory.getStorageFolder(config);
      expect(folder).toBe('diffs');
    });

    it('should return default "diffs" when folder is not configured', () => {
      const config: CcanywhereConfig = {
        artifacts: {
          storage: {
            provider: 's3'
          }
        }
      };
      const folder = StorageFactory.getStorageFolder(config);
      expect(folder).toBe('diffs');
    });

    it('should return configured folder from artifacts.storage', () => {
      const config: CcanywhereConfig = {
        artifacts: {
          storage: {
            provider: 's3',
            folder: 'custom-folder'
          }
        }
      };
      const folder = StorageFactory.getStorageFolder(config);
      expect(folder).toBe('custom-folder');
    });

    it('should return configured folder from legacy storage configuration', () => {
      const config: CcanywhereConfig = {
        storage: {
          provider: 's3',
          folder: 'legacy-folder'
        }
      };
      const folder = StorageFactory.getStorageFolder(config);
      expect(folder).toBe('legacy-folder');
    });

    it('should prefer artifacts.storage folder over legacy storage folder', () => {
      const config: CcanywhereConfig = {
        artifacts: {
          storage: {
            provider: 'r2',
            folder: 'artifacts-folder'
          }
        },
        storage: {
          provider: 's3',
          folder: 'legacy-folder'
        }
      };
      const folder = StorageFactory.getStorageFolder(config);
      expect(folder).toBe('artifacts-folder');
    });

    it('should normalize folder path by removing trailing slashes', () => {
      const config: CcanywhereConfig = {
        artifacts: {
          storage: {
            provider: 's3',
            folder: 'custom-folder///'
          }
        }
      };
      const folder = StorageFactory.getStorageFolder(config);
      expect(folder).toBe('custom-folder');
    });

    it('should trim whitespace from folder path', () => {
      const config: CcanywhereConfig = {
        artifacts: {
          storage: {
            provider: 's3',
            folder: '  custom-folder  '
          }
        }
      };
      const folder = StorageFactory.getStorageFolder(config);
      expect(folder).toBe('custom-folder');
    });

    it('should return default "diffs" when folder is empty string', () => {
      const config: CcanywhereConfig = {
        artifacts: {
          storage: {
            provider: 's3',
            folder: ''
          }
        }
      };
      const folder = StorageFactory.getStorageFolder(config);
      expect(folder).toBe('diffs');
    });

    it('should return default "diffs" when folder is only whitespace', () => {
      const config: CcanywhereConfig = {
        artifacts: {
          storage: {
            provider: 's3',
            folder: '   '
          }
        }
      };
      const folder = StorageFactory.getStorageFolder(config);
      expect(folder).toBe('diffs');
    });

    it('should return default "diffs" when folder is not a string', () => {
      const config: CcanywhereConfig = {
        artifacts: {
          storage: {
            provider: 's3',
            folder: null as any
          }
        }
      };
      const folder = StorageFactory.getStorageFolder(config);
      expect(folder).toBe('diffs');
    });
  });

  describe('extractProjectName', () => {
    it('should extract project name from GitHub HTTPS URL', () => {
      const projectName = StorageFactory.extractProjectName('https://github.com/owner/repo');
      expect(projectName).toBe('owner/repo');
    });

    it('should extract project name from GitHub HTTPS URL with .git suffix', () => {
      const projectName = StorageFactory.extractProjectName('https://github.com/owner/repo.git');
      expect(projectName).toBe('owner/repo');
    });

    it('should extract project name from GitHub SSH URL', () => {
      const projectName = StorageFactory.extractProjectName('git@github.com:owner/repo.git');
      expect(projectName).toBe('owner/repo');
    });

    it('should extract project name from GitLab HTTPS URL', () => {
      const projectName = StorageFactory.extractProjectName('https://gitlab.com/owner/repo');
      expect(projectName).toBe('owner/repo');
    });

    it('should extract project name from GitLab SSH URL', () => {
      const projectName = StorageFactory.extractProjectName('git@gitlab.com:owner/repo.git');
      expect(projectName).toBe('owner/repo');
    });

    it('should extract project name from Bitbucket HTTPS URL', () => {
      const projectName = StorageFactory.extractProjectName('https://bitbucket.org/owner/repo');
      expect(projectName).toBe('owner/repo');
    });

    it('should extract project name from Bitbucket SSH URL', () => {
      const projectName = StorageFactory.extractProjectName('git@bitbucket.org:owner/repo.git');
      expect(projectName).toBe('owner/repo');
    });

    it('should handle URLs with trailing slashes', () => {
      const projectName = StorageFactory.extractProjectName('https://github.com/owner/repo/');
      expect(projectName).toBe('owner/repo');
    });

    it('should handle URLs with multiple trailing slashes', () => {
      const projectName = StorageFactory.extractProjectName('https://github.com/owner/repo///');
      expect(projectName).toBe('owner/repo');
    });

    it('should handle GitLab subgroups by taking first two path components', () => {
      const projectName = StorageFactory.extractProjectName('https://gitlab.com/group/subgroup/repo');
      expect(projectName).toBe('group/subgroup');
    });

    it('should handle custom GitLab instance URLs', () => {
      const projectName = StorageFactory.extractProjectName('https://gitlab.company.com/owner/repo');
      expect(projectName).toBe('owner/repo');
    });

    it('should handle custom GitHub Enterprise URLs', () => {
      const projectName = StorageFactory.extractProjectName('https://github.company.com/owner/repo.git');
      expect(projectName).toBe('owner/repo');
    });

    it('should handle SSH URLs with custom ports', () => {
      const projectName = StorageFactory.extractProjectName('ssh://git@github.com:22/owner/repo.git');
      expect(projectName).toBe('owner/repo');
    });

    it('should return empty string for null URL', () => {
      const projectName = StorageFactory.extractProjectName(null as any);
      expect(projectName).toBe('');
    });

    it('should return empty string for undefined URL', () => {
      const projectName = StorageFactory.extractProjectName(undefined as any);
      expect(projectName).toBe('');
    });

    it('should return empty string for empty URL', () => {
      const projectName = StorageFactory.extractProjectName('');
      expect(projectName).toBe('');
    });

    it('should return empty string for whitespace-only URL', () => {
      const projectName = StorageFactory.extractProjectName('   ');
      expect(projectName).toBe('');
    });

    it('should return empty string for invalid URL', () => {
      const projectName = StorageFactory.extractProjectName('not-a-url');
      expect(projectName).toBe('');
    });

    it('should handle URLs with query parameters', () => {
      const projectName = StorageFactory.extractProjectName('https://github.com/owner/repo?tab=readme');
      expect(projectName).toBe('owner/repo');
    });

    it('should handle URLs with fragments', () => {
      const projectName = StorageFactory.extractProjectName('https://github.com/owner/repo#readme');
      expect(projectName).toBe('owner/repo');
    });

    it('should handle single path component gracefully', () => {
      const projectName = StorageFactory.extractProjectName('https://github.com/owner');
      expect(projectName).toBe('');
    });

    it('should trim whitespace from URL', () => {
      const projectName = StorageFactory.extractProjectName('  https://github.com/owner/repo  ');
      expect(projectName).toBe('owner/repo');
    });

    it('should handle malformed SSH URLs using fallback method', () => {
      const projectName = StorageFactory.extractProjectName('git@github.com/owner/repo.git');
      expect(projectName).toBe('owner/repo');
    });

    it('should handle URLs without protocol using fallback method', () => {
      const projectName = StorageFactory.extractProjectName('github.com/owner/repo');
      expect(projectName).toBe('owner/repo');
    });
  });

  describe('getProjectPath', () => {
    it('should return empty string when no repo configuration exists', () => {
      const config: CcanywhereConfig = {};
      const projectPath = StorageFactory.getProjectPath(config);
      expect(projectPath).toBe('');
    });

    it('should return empty string when repo.url is not configured', () => {
      const config: CcanywhereConfig = {
        repo: {
          kind: 'github',
          branch: 'main'
        }
      };
      const projectPath = StorageFactory.getProjectPath(config);
      expect(projectPath).toBe('');
    });

    it('should return project name when repo.url is configured', () => {
      const config: CcanywhereConfig = {
        repo: {
          kind: 'github',
          url: 'https://github.com/owner/repo',
          branch: 'main'
        }
      };
      const projectPath = StorageFactory.getProjectPath(config);
      expect(projectPath).toBe('owner/repo');
    });

    it('should handle SSH URLs in repo configuration', () => {
      const config: CcanywhereConfig = {
        repo: {
          kind: 'gitlab',
          url: 'git@gitlab.com:owner/repo.git',
          branch: 'main'
        }
      };
      const projectPath = StorageFactory.getProjectPath(config);
      expect(projectPath).toBe('owner/repo');
    });

    it('should return empty string for invalid repo URL', () => {
      const config: CcanywhereConfig = {
        repo: {
          kind: 'github',
          url: 'not-a-valid-url',
          branch: 'main'
        }
      };
      const projectPath = StorageFactory.getProjectPath(config);
      expect(projectPath).toBe('');
    });
  });
});