/**
 * Storage provider factory
 */

import { S3StorageProvider } from './s3-provider.js';
import { R2StorageProvider } from './r2-provider.js';
import { OSSStorageProvider } from './oss-provider.js';
import type { IStorageProvider, CcanywhereConfig } from '../../types/index.js';
import { ConfigurationError } from '../../types/index.js';

export class StorageFactory {
  /**
   * Extract project name from repository URL for storage path organization
   */
  static extractProjectName(url: string): string {
    if (!url || typeof url !== 'string') {
      return '';
    }

    try {
      let normalizedUrl = url.trim();

      // Handle SSH URLs (git@domain:owner/repo.git)
      const sshMatch = normalizedUrl.match(/^git@([^:]+):(.+)$/);
      if (sshMatch) {
        const [, domain, path] = sshMatch;
        normalizedUrl = `https://${domain}/${path}`;
      }

      // Parse as URL
      const urlObj = new URL(normalizedUrl);
      
      // Extract pathname and clean it up
      let pathname = urlObj.pathname;
      
      // Remove leading slash
      if (pathname.startsWith('/')) {
        pathname = pathname.substring(1);
      }
      
      // Remove trailing slash
      if (pathname.endsWith('/')) {
        pathname = pathname.substring(0, pathname.length - 1);
      }
      
      // Remove .git suffix
      if (pathname.endsWith('.git')) {
        pathname = pathname.substring(0, pathname.length - 4);
      }
      
      // For GitLab subgroups and complex paths, we want owner/repo format
      // Split by '/' and take the first two parts for standard cases
      const pathParts = pathname.split('/').filter(Boolean);
      
      if (pathParts.length >= 2) {
        // For most cases, return owner/repo
        return `${pathParts[0]!}/${pathParts[1]!}`;
      }
      
      return '';
    } catch (error) {
      // If URL parsing fails, try to extract manually
      return this.extractProjectNameFallback(url);
    }
  }

  /**
   * Fallback method for extracting project name when URL parsing fails
   */
  private static extractProjectNameFallback(url: string): string {
    // Remove common prefixes
    let cleanUrl = url.replace(/^(https?:\/\/|git@)/, '');
    
    // Handle SSH format (domain:path)
    const colonIndex = cleanUrl.indexOf(':');
    if (colonIndex !== -1 && !cleanUrl.includes('/') && colonIndex < cleanUrl.length - 1) {
      cleanUrl = cleanUrl.substring(colonIndex + 1);
    }
    
    // Remove domain part for HTTPS URLs
    const slashIndex = cleanUrl.indexOf('/');
    if (slashIndex !== -1) {
      cleanUrl = cleanUrl.substring(slashIndex + 1);
    }
    
    // Remove .git suffix and trailing slashes
    cleanUrl = cleanUrl.replace(/\.git$/, '').replace(/\/+$/, '');
    
    // Extract owner/repo
    const parts = cleanUrl.split('/').filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0]!}/${parts[1]!}`;
    }
    
    return '';
  }

  /**
   * Get project path for storage organization based on repository URL
   */
  static getProjectPath(config: CcanywhereConfig): string {
    const repoUrl = config.repo?.url;
    if (!repoUrl) {
      return ''; // Return empty for backward compatibility
    }
    
    return this.extractProjectName(repoUrl);
  }

  /**
   * Get the configured storage folder with proper validation and normalization
   */
  static getStorageFolder(config: CcanywhereConfig): string {
    // Try new artifacts.storage configuration first, then fall back to legacy storage config
    const storageConfig = config.artifacts?.storage || config.storage;
    const folder = storageConfig?.folder;
    
    // Default to "diffs" if not configured
    if (!folder || typeof folder !== 'string') {
      return 'diffs';
    }
    
    // Trim whitespace
    const cleanFolder = folder.trim();
    
    // Return "diffs" if empty after trimming
    if (!cleanFolder) {
      return 'diffs';
    }
    
    // Remove trailing slashes to normalize
    return cleanFolder.replace(/\/+$/, '');
  }

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