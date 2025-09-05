/**
 * Base storage provider interface and utilities
 */

import type { IStorageProvider } from '../../types/index.js';
import { BuildError } from '../../types/index.js';

export abstract class BaseStorageProvider implements IStorageProvider {
  protected readonly config: any;

  constructor(config: any) {
    this.config = config;
  }

  abstract upload(key: string, content: Buffer | string, contentType?: string): Promise<string>;
  abstract exists(key: string): Promise<boolean>;
  abstract delete(key: string): Promise<void>;
  abstract getUrl(key: string): Promise<string>;

  protected getContentType(key: string): string {
    const ext = key.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'html':
        return 'text/html; charset=utf-8';
      case 'json':
        return 'application/json; charset=utf-8';
      case 'css':
        return 'text/css; charset=utf-8';
      case 'js':
        return 'application/javascript; charset=utf-8';
      case 'png':
        return 'image/png';
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'svg':
        return 'image/svg+xml';
      case 'pdf':
        return 'application/pdf';
      default:
        return 'application/octet-stream';
    }
  }

  protected ensureBuffer(content: Buffer | string): Buffer {
    return Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8');
  }

  protected handleError(error: any, operation: string): never {
    const message = error?.message || String(error);
    throw new BuildError(`Storage ${operation} failed: ${message}`, error);
  }
}