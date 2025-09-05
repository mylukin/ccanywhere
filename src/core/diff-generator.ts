/**
 * Diff HTML generator module
 */

import { resolve, join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { promises as fs } from 'fs';
import fsExtra from 'fs-extra';
const { readFile, writeFile, ensureDir } = fsExtra;
import { execa } from 'execa';
import * as diff2html from 'diff2html';
import type { DiffGenerator, BuildArtifact, RuntimeContext, CommitInfo, IStorageProvider } from '../types/index.js';
import { BuildError } from '../types/index.js';
import { StorageFactory } from './storage/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class HtmlDiffGenerator implements DiffGenerator {
  private readonly templatePath: string;
  private readonly storageProvider: IStorageProvider | null = null;

  constructor(templatePath?: string) {
    this.templatePath = templatePath || resolve(__dirname, '../../templates/mobile-wrapper.html');
  }

  /**
   * Generate diff HTML page
   */
  async generate(base: string, head: string, context: RuntimeContext): Promise<BuildArtifact> {
    try {
      await ensureDir(context.artifactsDir);

      // Check if there are actual changes
      const hasChanges = await this.hasChanges(base, head, context.workDir);

      if (!hasChanges) {
        throw new BuildError('No changes detected between base and head');
      }

      // Initialize storage provider if configured
      const storageProvider = StorageFactory.create(context.config);

      // Get git diff
      const diffContent = await this.getDiffContent(base, head, context.workDir);

      // Get commit information
      const commitInfo = await this.getCommitInfo(head, context.workDir);

      // Generate HTML
      const htmlContent = await this.generateHtml(diffContent, commitInfo, context);

      // File naming
      const fileName = `diff-${context.revision}.html`;
      const filePath = join(context.artifactsDir, fileName);
      
      // Write to local artifacts directory first
      await writeFile(filePath, htmlContent, 'utf8');

      // Get file size
      const stats = await fs.stat(filePath);

      let finalUrl: string;
      
      // Upload to cloud storage if enabled
      if (storageProvider) {
        try {
          const storageKey = `diffs/${fileName}`;
          const cloudUrl = await storageProvider.upload(storageKey, htmlContent, 'text/html; charset=utf-8');
          
          // Use artifacts base URL if configured, otherwise use direct cloud URL
          const baseUrl = context.config.artifacts?.baseUrl || context.config.urls?.artifacts;
          finalUrl = baseUrl 
            ? `${baseUrl}/${storageKey}`
            : cloudUrl;
        } catch (storageError) {
          // If cloud storage fails, log warning but continue with local URL
          console.warn('Cloud storage upload failed:', storageError);
          const baseUrl = context.config.artifacts?.baseUrl || context.config.urls?.artifacts;
          finalUrl = `${baseUrl || ''}/${fileName}`;
        }
      } else {
        // Use local/CDN URL
        const baseUrl = context.config.artifacts?.baseUrl || context.config.urls?.artifacts;
        finalUrl = `${baseUrl || ''}/${fileName}`;
      }

      const artifact: BuildArtifact = {
        type: 'diff',
        url: finalUrl,
        path: filePath,
        size: stats.size,
        timestamp: context.timestamp
      };

      return artifact;
    } catch (error) {
      if (error instanceof BuildError) {
        throw error;
      }
      throw new BuildError(
        `Failed to generate diff: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Check if there are changes between base and head, or uncommitted changes in working directory
   */
  private async hasChanges(base: string, head: string, workDir: string): Promise<boolean> {
    try {
      // Check for committed changes between base and head
      const committedResult = await execa('git', ['diff', '--quiet', `${base}...${head}`], {
        cwd: workDir,
        reject: false
      });
      
      // Check for uncommitted changes in working directory (staged and unstaged)
      const workingDirResult = await execa('git', ['diff', '--quiet', 'HEAD'], {
        cwd: workDir,
        reject: false
      });
      
      // Check for staged changes
      const stagedResult = await execa('git', ['diff', '--quiet', '--cached'], {
        cwd: workDir,
        reject: false
      });
      
      // Check for untracked files
      const untrackedResult = await execa('git', ['ls-files', '--others', '--exclude-standard'], {
        cwd: workDir,
        reject: false
      });
      
      // git diff --quiet returns 1 if there are differences, 0 if identical
      const hasCommittedChanges = committedResult.exitCode !== 0;
      const hasWorkingDirChanges = workingDirResult.exitCode !== 0;
      const hasStagedChanges = stagedResult.exitCode !== 0;
      const hasUntrackedFiles = untrackedResult.stdout.trim().length > 0;
      
      return hasCommittedChanges || hasWorkingDirChanges || hasStagedChanges || hasUntrackedFiles;
    } catch (error) {
      throw new BuildError(
        `Failed to check for changes: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get git diff content including both committed changes and working directory changes
   */
  private async getDiffContent(base: string, head: string, workDir: string): Promise<string> {
    try {
      const diffParts: string[] = [];
      
      // Get committed changes between base and head
      const committedResult = await execa('git', ['diff', '--minimal', `${base}...${head}`], {
        cwd: workDir,
        reject: false
      });
      if (committedResult.stdout.trim()) {
        diffParts.push(committedResult.stdout);
      }
      
      // Get staged changes
      const stagedResult = await execa('git', ['diff', '--minimal', '--cached'], {
        cwd: workDir,
        reject: false
      });
      if (stagedResult.stdout.trim()) {
        diffParts.push(stagedResult.stdout);
      }
      
      // Get working directory changes (unstaged)
      const workingDirResult = await execa('git', ['diff', '--minimal'], {
        cwd: workDir,
        reject: false
      });
      if (workingDirResult.stdout.trim()) {
        diffParts.push(workingDirResult.stdout);
      }
      
      // Get untracked files and generate diffs for them
      const untrackedResult = await execa('git', ['ls-files', '--others', '--exclude-standard'], {
        cwd: workDir,
        reject: false
      });
      
      const untrackedFiles = untrackedResult.stdout.trim().split('\n').filter(Boolean);
      for (const file of untrackedFiles) {
        try {
          // Generate diff for untracked files by comparing with /dev/null
          const untrackedDiffResult = await execa('git', ['diff', '--no-index', '/dev/null', file], {
            cwd: workDir,
            reject: false
          });
          if (untrackedDiffResult.stdout.trim()) {
            diffParts.push(untrackedDiffResult.stdout);
          }
        } catch (untrackedError) {
          // If individual file diff fails, continue with others
          console.warn(`Failed to get diff for untracked file ${file}:`, untrackedError);
        }
      }
      
      // Combine all diff parts
      const combinedDiff = diffParts.join('\n');
      
      if (!combinedDiff.trim()) {
        throw new BuildError('No diff content available');
      }
      
      return combinedDiff;
    } catch (error) {
      if (error instanceof BuildError) {
        throw error;
      }
      throw new BuildError(
        `Failed to get diff content: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get commit information
   */
  private async getCommitInfo(head: string, workDir: string): Promise<CommitInfo> {
    try {
      const [shaResult, authorResult, messageResult, timestampResult] = await Promise.all([
        execa('git', ['rev-parse', head], { cwd: workDir }),
        execa('git', ['log', '-1', '--pretty=format:%an', head], { cwd: workDir }),
        execa('git', ['log', '-1', '--pretty=format:%s', head], { cwd: workDir }),
        execa('git', ['log', '-1', '--pretty=format:%ct', head], { cwd: workDir })
      ]);

      const sha = shaResult.stdout.trim();

      return {
        sha,
        shortSha: sha.substring(0, 7),
        author: authorResult.stdout.trim(),
        message: messageResult.stdout.trim(),
        timestamp: parseInt(timestampResult.stdout.trim()) * 1000
      };
    } catch (error) {
      // Return default values if git commands fail
      return {
        sha: head,
        shortSha: head.substring(0, 7),
        author: 'Unknown',
        message: 'No commit message',
        timestamp: Date.now()
      };
    }
  }

  /**
   * Generate HTML content using template and diff2html
   */
  private async generateHtml(
    diffContent: string,
    commitInfo: CommitInfo,
    context: RuntimeContext
  ): Promise<string> {
    try {
      // Generate HTML diff using diff2html
      const diffHtml = diff2html.html(diffContent, {
        drawFileList: true,
        matching: 'lines',
        outputFormat: 'line-by-line'
      });

      // Get CSS bundle from diff2html
      const cssPath = resolve(
        __dirname,
        '../../node_modules/diff2html/bundles/css/diff2html.min.css'
      );
      const cssBundle = await readFile(cssPath, 'utf8');
      const jsBundle = ''; // diff2html doesn't provide default JS

      // Read template
      const template = await readFile(this.templatePath, 'utf8');

      // Inject variables into template
      const html = template
        .replace(/\{{{diff}}}/g, diffHtml)
        .replace(/\{{{cssBundle}}}/g, `<style>${cssBundle}</style>`)
        .replace(/\{{{jsBundle}}}/g, jsBundle)
        .replace(/\{\{commit\.hashAbbrev\}\}/g, commitInfo.shortSha)
        .replace(/\{\{files\.length\}\}/g, this.getFileCount(diffContent).toString());

      // Inject configuration for JavaScript
      const configScript = `
        <script>
          window.REPO_KIND = '${context.config.repo?.kind || ''}';
          window.REPO_URL = '${context.config.repo?.url || ''}';
          window.REV = '${commitInfo.sha}';
        </script>
      `;

      return html.replace('</head>', `${configScript}</head>`);
    } catch (error) {
      throw new BuildError(
        `Failed to generate HTML: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Count number of files in diff
   */
  private getFileCount(diffContent: string): number {
    const lines = diffContent.split('\n');
    let count = 0;

    for (const line of lines) {
      if (line.startsWith('diff --git')) {
        count++;
      }
    }

    return count;
  }

  /**
   * Generate diff using external diff2html-cli (fallback method)
   */
  async generateWithCli(
    base: string,
    head: string,
    context: RuntimeContext
  ): Promise<BuildArtifact> {
    try {
      await ensureDir(context.artifactsDir);

      const fileName = `diff-${context.revision}.html`;
      const outputPath = join(context.artifactsDir, fileName);

      // Use diff2html-cli
      await execa(
        'npx',
        [
          'diff2html-cli',
          '-i',
          'stdin',
          '-s',
          'line',
          '-F',
          outputPath,
          '--hwt',
          this.templatePath
        ],
        {
          cwd: context.workDir,
          input: await this.getDiffContent(base, head, context.workDir)
        }
      );

      // Get file size
      const stats = await fs.stat(outputPath);

      const baseUrl = context.config.artifacts?.baseUrl || context.config.urls?.artifacts;
      const artifact: BuildArtifact = {
        type: 'diff',
        url: `${baseUrl || ''}/${fileName}`,
        path: outputPath,
        size: stats.size,
        timestamp: context.timestamp
      };

      return artifact;
    } catch (error) {
      throw new BuildError(
        `Failed to generate diff with CLI: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
