/**
 * Cloudflare R2 storage provider
 */

import { S3Client, PutObjectCommand, HeadObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { BaseStorageProvider } from './base.js';
import type { CcanywhereConfig } from '../../types/index.js';

export class R2StorageProvider extends BaseStorageProvider {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly accountId: string;

  constructor(config: NonNullable<CcanywhereConfig['storage']>['r2']) {
    super(config);
    
    if (!config) {
      throw new Error('R2 configuration is required');
    }

    this.bucket = config.bucket;
    this.accountId = config.accountId;
    
    // Cloudflare R2 uses S3-compatible API
    this.client = new S3Client({
      region: 'auto', // R2 uses 'auto' as region
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey
      }
    });
  }

  async upload(key: string, content: Buffer | string, contentType?: string): Promise<string> {
    try {
      const buffer = this.ensureBuffer(content);
      const finalContentType = contentType || this.getContentType(key);

      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: finalContentType,
        CacheControl: 'public, max-age=31536000' // 1 year cache
      });

      await this.client.send(command);
      return `https://${this.bucket}.${this.accountId}.r2.cloudflarestorage.com/${key}`;
    } catch (error) {
      this.handleError(error, 'upload');
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key
      });

      await this.client.send(command);
      return true;
    } catch (error: any) {
      if (error?.name === 'NotFound' || error?.statusCode === 404) {
        return false;
      }
      this.handleError(error, 'exists check');
    }
  }

  async delete(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key
      });

      await this.client.send(command);
    } catch (error) {
      this.handleError(error, 'delete');
    }
  }

  async getUrl(key: string): Promise<string> {
    // For R2, we return the public URL directly
    return `https://${this.bucket}.${this.accountId}.r2.cloudflarestorage.com/${key}`;
  }
}