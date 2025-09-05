/**
 * Tests for git utility functions
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Mock child_process
const mockExecSync = jest.fn() as any;
jest.unstable_mockModule('child_process', () => ({
  execSync: mockExecSync
}));

// Mock fs-extra
const mockFs = {
  pathExists: jest.fn() as any
};
jest.unstable_mockModule('fs-extra', () => ({
  default: mockFs
}));

// Import the module after mocking
const { detectGitInfo, getCurrentCommitSha, getRecentCommits } = await import('../git.js');

describe('git utilities', () => {
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup default mock returns
    mockFs.pathExists.mockResolvedValue(true);
    mockExecSync.mockReturnValue('mock-output');
  });

  describe('detectGitInfo', () => {
    it('should detect GitHub repository information', async () => {
      mockFs.pathExists.mockResolvedValue(true);
      mockExecSync
        .mockReturnValueOnce('https://github.com/test/repo.git') // remote url
        .mockReturnValueOnce('main'); // current branch

      const result = await detectGitInfo('/test/project');

      expect(result).toEqual({
        repoUrl: 'https://github.com/test/repo',
        repoKind: 'github',
        repoBranch: 'main'
      });
    });

    it('should detect GitLab repository', async () => {
      mockFs.pathExists.mockResolvedValue(true);
      mockExecSync
        .mockReturnValueOnce('https://gitlab.com/test/repo.git')
        .mockReturnValueOnce('develop');

      const result = await detectGitInfo('/test/project');

      expect(result.repoKind).toBe('gitlab');
      expect(result.repoUrl).toBe('https://gitlab.com/test/repo');
    });

    it('should convert SSH URLs to HTTPS', async () => {
      mockFs.pathExists.mockResolvedValue(true);
      mockExecSync
        .mockReturnValueOnce('git@github.com:test/repo.git')
        .mockReturnValueOnce('main');

      const result = await detectGitInfo('/test/project');

      expect(result.repoUrl).toBe('https://github.com/test/repo');
      expect(result.repoKind).toBe('github');
    });

    it('should handle detached HEAD state with fallback', async () => {
      mockFs.pathExists.mockResolvedValue(true);
      mockExecSync
        .mockReturnValueOnce('https://github.com/test/repo.git')
        .mockReturnValueOnce('') // empty current branch
        .mockReturnValueOnce('refs/remotes/origin/main'); // fallback to default

      const result = await detectGitInfo('/test/project');

      expect(result.repoBranch).toBe('main');
    });

    it('should handle non-git directories', async () => {
      mockFs.pathExists.mockResolvedValue(false);

      const result = await detectGitInfo('/test/project');

      expect(result).toEqual({});
    });

    it('should handle git command failures gracefully', async () => {
      mockFs.pathExists.mockResolvedValue(true);
      mockExecSync.mockImplementation(() => {
        throw new Error('Not a git repository');
      });

      const result = await detectGitInfo('/test/project');

      expect(result).toEqual({});
    });

    it('should detect different repository types', async () => {
      const testCases = [
        { url: 'https://github.com/test/repo.git', expected: 'github' },
        { url: 'https://gitlab.com/test/repo.git', expected: 'gitlab' },
        { url: 'https://bitbucket.org/test/repo.git', expected: 'bitbucket' },
        { url: 'https://gitee.com/test/repo.git', expected: 'gitee' }
      ];

      for (const { url, expected } of testCases) {
        mockFs.pathExists.mockResolvedValue(true);
        mockExecSync
          .mockReturnValueOnce(url)
          .mockReturnValueOnce('main');

        const result = await detectGitInfo('/test/project');

        expect(result.repoKind).toBe(expected);
      }
    });

    it('should handle default branch fallback', async () => {
      mockFs.pathExists.mockResolvedValue(true);
      mockExecSync
        .mockReturnValueOnce('https://github.com/test/repo.git')
        .mockReturnValueOnce('') // empty current branch
        .mockImplementationOnce(() => {
          throw new Error('No default branch');
        }); // fallback fails

      const result = await detectGitInfo('/test/project');

      expect(result.repoBranch).toBe('main');
    });
  });

  describe('getCurrentCommitSha', () => {
    it('should return current commit SHA', () => {
      mockExecSync.mockReturnValue('abc123def456789');

      const result = getCurrentCommitSha('/test/project');

      expect(result).toBe('abc123def456789');
      expect(mockExecSync).toHaveBeenCalledWith('git rev-parse HEAD', {
        cwd: '/test/project',
        encoding: 'utf8'
      });
    });

    it('should trim whitespace from commit SHA', () => {
      mockExecSync.mockReturnValue('  abc123def456789  \n');

      const result = getCurrentCommitSha('/test/project');

      expect(result).toBe('abc123def456789');
    });

    it('should handle git command errors', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Not a git repository');
      });

      const result = getCurrentCommitSha('/test/project');

      expect(result).toBeUndefined();
    });
  });

  describe('getRecentCommits', () => {
    it('should return recent commit list', () => {
      mockExecSync.mockReturnValue('abc123 Latest commit\ndef456 Previous commit\nghi789 Older commit');

      const result = getRecentCommits('/test/project', 3);

      expect(result).toEqual([
        'abc123 Latest commit',
        'def456 Previous commit', 
        'ghi789 Older commit'
      ]);
      expect(mockExecSync).toHaveBeenCalledWith('git log --oneline -n 3', {
        cwd: '/test/project',
        encoding: 'utf8'
      });
    });

    it('should use default count of 10', () => {
      mockExecSync.mockReturnValue('abc123 Latest commit');

      const result = getRecentCommits('/test/project');

      expect(mockExecSync).toHaveBeenCalledWith('git log --oneline -n 10', {
        cwd: '/test/project',
        encoding: 'utf8'
      });
    });

    it('should handle git command errors', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Not a git repository');
      });

      const result = getRecentCommits('/test/project');

      expect(result).toEqual([]);
    });

    it('should filter out empty lines', () => {
      mockExecSync.mockReturnValue('abc123 Latest commit\n\ndef456 Previous commit\n');

      const result = getRecentCommits('/test/project');

      expect(result).toEqual([
        'abc123 Latest commit',
        'def456 Previous commit'
      ]);
    });
  });
});