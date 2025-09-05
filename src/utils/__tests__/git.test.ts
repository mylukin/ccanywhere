/**
 * Tests for git utility functions
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

// Mock execa
const mockExeca = jest.fn() as any;
jest.unstable_mockModule('execa', () => ({
  execa: mockExeca
}));

// Mock fs-extra
const mockFs = {
  pathExists: jest.fn() as any,
  readFile: jest.fn() as any
};
jest.unstable_mockModule('fs-extra', () => ({
  default: mockFs
}));

// Import the module after mocking
const { detectGitInfo, getCurrentBranch, getCurrentCommit, getCommitInfo, isGitRepository } = await import('../git.js');

describe('git utilities', () => {
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup default mock returns
    mockExeca.mockResolvedValue({ stdout: 'mock-output' });
    mockFs.pathExists.mockResolvedValue(true);
    mockFs.readFile.mockResolvedValue('[remote "origin"]\n\turl = https://github.com/test/repo.git\n\tfetch = +refs/heads/*:refs/remotes/origin/*');
  });

  describe('isGitRepository', () => {
    it('should return true for git repository', async () => {
      mockFs.pathExists.mockResolvedValue(true);

      const result = await isGitRepository('/test/project');

      expect(result).toBe(true);
      expect(mockFs.pathExists).toHaveBeenCalledWith('/test/project/.git');
    });

    it('should return false for non-git directory', async () => {
      mockFs.pathExists.mockResolvedValue(false);

      const result = await isGitRepository('/test/project');

      expect(result).toBe(false);
    });

    it('should handle file system errors', async () => {
      mockFs.pathExists.mockRejectedValue(new Error('Permission denied'));

      const result = await isGitRepository('/test/project');

      expect(result).toBe(false);
    });
  });

  describe('getCurrentBranch', () => {
    it('should return current branch name', async () => {
      mockExeca.mockResolvedValue({ stdout: 'main' });

      const result = await getCurrentBranch('/test/project');

      expect(result).toBe('main');
      expect(mockExeca).toHaveBeenCalledWith('git', ['branch', '--show-current'], {
        cwd: '/test/project'
      });
    });

    it('should handle detached HEAD state', async () => {
      mockExeca.mockResolvedValue({ stdout: '' });

      const result = await getCurrentBranch('/test/project');

      expect(result).toBeNull();
    });

    it('should handle git command errors', async () => {
      mockExeca.mockRejectedValue(new Error('Not a git repository'));

      const result = await getCurrentBranch('/test/project');

      expect(result).toBeNull();
    });

    it('should trim whitespace from branch name', async () => {
      mockExeca.mockResolvedValue({ stdout: '  feature/test-branch  \n' });

      const result = await getCurrentBranch('/test/project');

      expect(result).toBe('feature/test-branch');
    });
  });

  describe('getCurrentCommit', () => {
    it('should return current commit hash', async () => {
      mockExeca.mockResolvedValue({ stdout: 'abc123def456' });

      const result = await getCurrentCommit('/test/project');

      expect(result).toBe('abc123def456');
      expect(mockExeca).toHaveBeenCalledWith('git', ['rev-parse', 'HEAD'], {
        cwd: '/test/project'
      });
    });

    it('should handle git command errors', async () => {
      mockExeca.mockRejectedValue(new Error('Not a git repository'));

      const result = await getCurrentCommit('/test/project');

      expect(result).toBeNull();
    });

    it('should trim whitespace from commit hash', async () => {
      mockExeca.mockResolvedValue({ stdout: '  abc123def456  \n' });

      const result = await getCurrentCommit('/test/project');

      expect(result).toBe('abc123def456');
    });
  });

  describe('getCommitInfo', () => {
    it('should return commit information', async () => {
      mockExeca.mockResolvedValue({ 
        stdout: 'John Doe\nAdd new feature\n2023-01-01 12:00:00' 
      });

      const result = await getCommitInfo('/test/project', 'abc123');

      expect(result).toEqual({
        hash: 'abc123',
        author: 'John Doe',
        message: 'Add new feature',
        date: '2023-01-01 12:00:00'
      });
      expect(mockExeca).toHaveBeenCalledWith('git', [
        'show',
        '--format=%an%n%s%n%ci',
        '--no-patch',
        'abc123'
      ], {
        cwd: '/test/project'
      });
    });

    it('should use HEAD when no commit hash provided', async () => {
      mockExeca.mockResolvedValue({ 
        stdout: 'Jane Doe\nFix bug\n2023-01-02 15:30:00' 
      });

      const result = await getCommitInfo('/test/project');

      expect(mockExeca).toHaveBeenCalledWith(
        expect.anything(),
        expect.arrayContaining(['HEAD']),
        expect.anything()
      );
    });

    it('should handle partial commit info', async () => {
      mockExeca.mockResolvedValue({ stdout: 'John Doe\nAdd feature\n' });

      const result = await getCommitInfo('/test/project', 'abc123');

      expect(result).toEqual({
        hash: 'abc123',
        author: 'John Doe',
        message: 'Add feature',
        date: ''
      });
    });

    it('should handle git command errors', async () => {
      mockExeca.mockRejectedValue(new Error('Invalid commit'));

      const result = await getCommitInfo('/test/project', 'invalid');

      expect(result).toBeNull();
    });

    it('should handle empty commit info', async () => {
      mockExeca.mockResolvedValue({ stdout: '' });

      const result = await getCommitInfo('/test/project');

      expect(result).toEqual({
        hash: 'HEAD',
        author: '',
        message: '',
        date: ''
      });
    });
  });

  describe('detectGitInfo', () => {
    it('should detect complete git information', async () => {
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readFile.mockResolvedValue(`
        [remote "origin"]
          url = https://github.com/test/repo.git
          fetch = +refs/heads/*:refs/remotes/origin/*
      `);
      mockExeca
        .mockResolvedValueOnce({ stdout: 'main' })           // branch
        .mockResolvedValueOnce({ stdout: 'abc123def456' });  // commit

      const result = await detectGitInfo('/test/project');

      expect(result).toEqual({
        repoUrl: 'https://github.com/test/repo.git',
        repoKind: 'github',
        repoBranch: 'main',
        currentCommit: 'abc123def456'
      });
    });

    it('should detect GitLab repositories', async () => {
      mockFs.readFile.mockResolvedValue(`
        [remote "origin"]
          url = https://gitlab.com/test/repo.git
      `);
      mockExeca.mockResolvedValueOnce({ stdout: 'develop' });

      const result = await detectGitInfo('/test/project');

      expect(result.repoKind).toBe('gitlab');
      expect(result.repoUrl).toBe('https://gitlab.com/test/repo.git');
    });

    it('should handle SSH URLs', async () => {
      mockFs.readFile.mockResolvedValue(`
        [remote "origin"]
          url = git@github.com:test/repo.git
      `);

      const result = await detectGitInfo('/test/project');

      expect(result.repoUrl).toBe('git@github.com:test/repo.git');
      expect(result.repoKind).toBe('github');
    });

    it('should handle self-hosted Git services', async () => {
      mockFs.readFile.mockResolvedValue(`
        [remote "origin"]
          url = https://git.company.com/test/repo.git
      `);

      const result = await detectGitInfo('/test/project');

      expect(result.repoUrl).toBe('https://git.company.com/test/repo.git');
      expect(result.repoKind).toBe('git');
    });

    it('should handle non-git directories', async () => {
      mockFs.pathExists.mockResolvedValue(false);

      const result = await detectGitInfo('/test/project');

      expect(result).toEqual({
        repoUrl: null,
        repoKind: null,
        repoBranch: null,
        currentCommit: null
      });
    });

    it('should handle missing remote origin', async () => {
      mockFs.readFile.mockResolvedValue(`
        [core]
          bare = false
      `);

      const result = await detectGitInfo('/test/project');

      expect(result.repoUrl).toBeNull();
      expect(result.repoKind).toBeNull();
    });

    it('should handle git config read errors', async () => {
      mockFs.readFile.mockRejectedValue(new Error('Permission denied'));

      const result = await detectGitInfo('/test/project');

      expect(result.repoUrl).toBeNull();
    });

    it('should detect different URL formats', async () => {
      const urlFormats = [
        { 
          url: 'https://github.com/user/repo.git',
          expected: { kind: 'github', url: 'https://github.com/user/repo.git' }
        },
        {
          url: 'git@github.com:user/repo.git',
          expected: { kind: 'github', url: 'git@github.com:user/repo.git' }
        },
        {
          url: 'https://gitlab.com/user/repo.git',
          expected: { kind: 'gitlab', url: 'https://gitlab.com/user/repo.git' }
        },
        {
          url: 'git@gitlab.com:user/repo.git',
          expected: { kind: 'gitlab', url: 'git@gitlab.com:user/repo.git' }
        },
        {
          url: 'https://bitbucket.org/user/repo.git',
          expected: { kind: 'git', url: 'https://bitbucket.org/user/repo.git' }
        }
      ];

      for (const { url, expected } of urlFormats) {
        mockFs.readFile.mockResolvedValue(`[remote "origin"]\n\turl = ${url}`);

        const result = await detectGitInfo('/test/project');

        expect(result.repoKind).toBe(expected.kind);
        expect(result.repoUrl).toBe(expected.url);
      }
    });
  });

  describe('error handling', () => {
    it('should handle command execution timeouts', async () => {
      mockExeca.mockRejectedValue({ signal: 'SIGTERM', message: 'Command timed out' });

      const result = await getCurrentBranch('/test/project');

      expect(result).toBeNull();
    });

    it('should handle permission denied errors', async () => {
      mockExeca.mockRejectedValue({ code: 'EACCES', message: 'Permission denied' });

      const result = await getCurrentCommit('/test/project');

      expect(result).toBeNull();
    });

    it('should handle non-Error objects', async () => {
      mockExeca.mockRejectedValue('String error');

      const result = await getCurrentBranch('/test/project');

      expect(result).toBeNull();
    });
  });

  describe('path handling', () => {
    it('should handle relative paths', async () => {
      await getCurrentBranch('./test/project');

      expect(mockExeca).toHaveBeenCalledWith(
        'git',
        expect.any(Array),
        expect.objectContaining({
          cwd: './test/project'
        })
      );
    });

    it('should handle paths with spaces', async () => {
      await getCurrentBranch('/path with spaces/project');

      expect(mockExeca).toHaveBeenCalledWith(
        'git',
        expect.any(Array),
        expect.objectContaining({
          cwd: '/path with spaces/project'
        })
      );
    });

    it('should use current directory when no path provided', async () => {
      await getCurrentBranch();

      expect(mockExeca).toHaveBeenCalledWith(
        'git',
        expect.any(Array),
        expect.objectContaining({
          cwd: process.cwd()
        })
      );
    });
  });

  describe('branch name parsing', () => {
    it('should handle feature branch names', async () => {
      mockExeca.mockResolvedValue({ stdout: 'feature/new-functionality' });

      const result = await getCurrentBranch();

      expect(result).toBe('feature/new-functionality');
    });

    it('should handle release branch names', async () => {
      mockExeca.mockResolvedValue({ stdout: 'release/v1.2.3' });

      const result = await getCurrentBranch();

      expect(result).toBe('release/v1.2.3');
    });

    it('should handle hotfix branch names', async () => {
      mockExeca.mockResolvedValue({ stdout: 'hotfix/critical-bug' });

      const result = await getCurrentBranch();

      expect(result).toBe('hotfix/critical-bug');
    });

    it('should handle branch names with special characters', async () => {
      mockExeca.mockResolvedValue({ stdout: 'feature/user-123_fix-issue' });

      const result = await getCurrentBranch();

      expect(result).toBe('feature/user-123_fix-issue');
    });
  });
});