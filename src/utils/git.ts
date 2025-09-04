import { execSync } from 'child_process';
import fsExtra from 'fs-extra';
const { pathExists } = fsExtra;
import path from 'path';

export interface GitInfo {
  repoUrl?: string;
  repoKind?: 'github' | 'gitlab' | 'bitbucket' | 'gitee';
  repoBranch?: string;
}

/**
 * 从 Git 配置中自动检测仓库信息
 */
export async function detectGitInfo(projectPath: string): Promise<GitInfo> {
  const gitPath = path.join(projectPath, '.git');

  // 检查是否是 git 仓库
  if (!(await pathExists(gitPath))) {
    return {};
  }

  const info: GitInfo = {};

  try {
    // 获取远程仓库 URL
    const remoteUrl = execSync('git config --get remote.origin.url', {
      cwd: projectPath,
      encoding: 'utf8'
    }).trim();

    if (remoteUrl) {
      // 转换 SSH URL 为 HTTPS URL
      let repoUrl = remoteUrl;
      if (repoUrl.startsWith('git@')) {
        // git@github.com:user/repo.git -> https://github.com/user/repo
        repoUrl = repoUrl
          .replace(/^git@/, 'https://')
          .replace(/:([^/])/, '/$1')
          .replace(/\.git$/, '');
      } else if (repoUrl.endsWith('.git')) {
        repoUrl = repoUrl.replace(/\.git$/, '');
      }

      info.repoUrl = repoUrl;

      // 检测仓库类型
      if (repoUrl.includes('github.com')) {
        info.repoKind = 'github';
      } else if (repoUrl.includes('gitlab.com') || repoUrl.includes('gitlab')) {
        info.repoKind = 'gitlab';
      } else if (repoUrl.includes('bitbucket.org')) {
        info.repoKind = 'bitbucket';
      } else if (repoUrl.includes('gitee.com')) {
        info.repoKind = 'gitee';
      }
    }

    // 获取当前分支
    const currentBranch = execSync('git branch --show-current', {
      cwd: projectPath,
      encoding: 'utf8'
    }).trim();

    if (currentBranch) {
      info.repoBranch = currentBranch;
    } else {
      // 如果是 detached HEAD 状态，尝试获取默认分支
      try {
        const defaultBranch = execSync('git symbolic-ref refs/remotes/origin/HEAD', {
          cwd: projectPath,
          encoding: 'utf8'
        })
          .trim()
          .replace('refs/remotes/origin/', '');

        if (defaultBranch) {
          info.repoBranch = defaultBranch;
        }
      } catch {
        // 默认使用 main 或 master
        info.repoBranch = 'main';
      }
    }
  } catch (error) {
    // Git 命令执行失败，返回空对象
    console.debug('Failed to detect git info:', error);
  }

  return info;
}

/**
 * 获取当前 Git 提交的 SHA
 */
export function getCurrentCommitSha(projectPath: string): string | undefined {
  try {
    return execSync('git rev-parse HEAD', {
      cwd: projectPath,
      encoding: 'utf8'
    }).trim();
  } catch {
    return undefined;
  }
}

/**
 * 获取最近的提交信息
 */
export function getRecentCommits(projectPath: string, count: number = 10): string[] {
  try {
    const commits = execSync(`git log --oneline -n ${count}`, {
      cwd: projectPath,
      encoding: 'utf8'
    })
      .trim()
      .split('\n');
    return commits.filter(Boolean);
  } catch {
    return [];
  }
}
