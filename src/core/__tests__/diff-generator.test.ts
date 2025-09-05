/**
 * HtmlDiffGenerator tests for project path functionality
 */

import { jest } from '@jest/globals';
import { StorageFactory } from '../storage/index.js';
import type { CcanywhereConfig } from '../../types/index.js';

describe('HtmlDiffGenerator Project Path Logic', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('storage path construction logic', () => {
    it('should construct storage key with project path when repo URL is configured', () => {
      const config: CcanywhereConfig = {
        repo: {
          kind: 'github',
          url: 'https://github.com/owner/repo',
          branch: 'main'
        },
        artifacts: {
          storage: {
            provider: 's3',
            folder: 'diffs'
          }
        }
      };

      const storageFolder = StorageFactory.getStorageFolder(config);
      const projectPath = StorageFactory.getProjectPath(config);
      const fileName = 'diff-abc123.html';

      const storageKey = projectPath 
        ? `${storageFolder}/${projectPath}/${fileName}`
        : `${storageFolder}/${fileName}`;

      expect(storageKey).toBe('diffs/owner/repo/diff-abc123.html');
    });

    it('should use custom folder with project path in storage key', () => {
      const config: CcanywhereConfig = {
        repo: {
          kind: 'gitlab',
          url: 'git@gitlab.com:owner/repo.git',
          branch: 'main'
        },
        artifacts: {
          storage: {
            provider: 's3',
            folder: 'custom-folder'
          }
        }
      };

      const storageFolder = StorageFactory.getStorageFolder(config);
      const projectPath = StorageFactory.getProjectPath(config);
      const fileName = 'diff-abc123.html';

      const storageKey = projectPath 
        ? `${storageFolder}/${projectPath}/${fileName}`
        : `${storageFolder}/${fileName}`;

      expect(storageKey).toBe('custom-folder/owner/repo/diff-abc123.html');
    });

    it('should maintain backward compatibility when no repo URL is configured', () => {
      const config: CcanywhereConfig = {
        artifacts: {
          storage: {
            provider: 's3',
            folder: 'diffs'
          }
        }
      };

      const storageFolder = StorageFactory.getStorageFolder(config);
      const projectPath = StorageFactory.getProjectPath(config);
      const fileName = 'diff-abc123.html';

      const storageKey = projectPath 
        ? `${storageFolder}/${projectPath}/${fileName}`
        : `${storageFolder}/${fileName}`;

      expect(storageKey).toBe('diffs/diff-abc123.html');
    });

    it('should maintain backward compatibility when repo URL is invalid', () => {
      const config: CcanywhereConfig = {
        repo: {
          kind: 'github',
          url: 'invalid-url',
          branch: 'main'
        },
        artifacts: {
          storage: {
            provider: 's3',
            folder: 'diffs'
          }
        }
      };

      const storageFolder = StorageFactory.getStorageFolder(config);
      const projectPath = StorageFactory.getProjectPath(config);
      const fileName = 'diff-abc123.html';

      const storageKey = projectPath 
        ? `${storageFolder}/${projectPath}/${fileName}`
        : `${storageFolder}/${fileName}`;

      expect(storageKey).toBe('diffs/diff-abc123.html');
    });

    it('should work with legacy storage configuration', () => {
      const config: CcanywhereConfig = {
        repo: {
          kind: 'bitbucket',
          url: 'https://bitbucket.org/owner/repo',
          branch: 'main'
        },
        storage: {
          provider: 's3',
          folder: 'legacy-diffs'
        }
      };

      const storageFolder = StorageFactory.getStorageFolder(config);
      const projectPath = StorageFactory.getProjectPath(config);
      const fileName = 'diff-abc123.html';

      const storageKey = projectPath 
        ? `${storageFolder}/${projectPath}/${fileName}`
        : `${storageFolder}/${fileName}`;

      expect(storageKey).toBe('legacy-diffs/owner/repo/diff-abc123.html');
    });

    it('should handle complex GitLab URLs with subgroups', () => {
      const config: CcanywhereConfig = {
        repo: {
          kind: 'gitlab',
          url: 'https://gitlab.com/group/subgroup/repo',
          branch: 'main'
        },
        artifacts: {
          storage: {
            provider: 's3',
            folder: 'diffs'
          }
        }
      };

      const storageFolder = StorageFactory.getStorageFolder(config);
      const projectPath = StorageFactory.getProjectPath(config);
      const fileName = 'diff-abc123.html';

      const storageKey = projectPath 
        ? `${storageFolder}/${projectPath}/${fileName}`
        : `${storageFolder}/${fileName}`;

      expect(storageKey).toBe('diffs/group/subgroup/diff-abc123.html');
    });

    it('should construct baseUrl with project path correctly', () => {
      const config: CcanywhereConfig = {
        repo: {
          kind: 'github',
          url: 'https://github.com/owner/repo',
          branch: 'main'
        },
        artifacts: {
          baseUrl: 'https://cdn.example.com',
          storage: {
            provider: 's3',
            folder: 'diffs'
          }
        }
      };

      const storageFolder = StorageFactory.getStorageFolder(config);
      const projectPath = StorageFactory.getProjectPath(config);
      const fileName = 'diff-abc123.html';
      const baseUrl = config.artifacts?.baseUrl;

      const storageKey = projectPath 
        ? `${storageFolder}/${projectPath}/${fileName}`
        : `${storageFolder}/${fileName}`;

      const finalUrl = `${baseUrl}/${storageKey}`;

      expect(finalUrl).toBe('https://cdn.example.com/diffs/owner/repo/diff-abc123.html');
    });
  });
});