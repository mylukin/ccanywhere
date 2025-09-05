/**
 * Alibaba Cloud OSS storage provider
 */

import OSS from 'ali-oss';
import { BaseStorageProvider } from './base.js';
import type { CcanywhereConfig } from '../../types/index.js';

export class OSSStorageProvider extends BaseStorageProvider {
  private readonly client: OSS;
  private readonly bucket: string;

  constructor(config: NonNullable<CcanywhereConfig['storage']>['oss']) {
    super(config);
    
    if (!config) {
      throw new Error('OSS configuration is required');
    }

    this.bucket = config.bucket;
    this.client = new OSS({
      region: config.region,
      accessKeyId: config.accessKeyId,
      accessKeySecret: config.accessKeySecret,
      bucket: config.bucket,
      endpoint: config.endpoint
    });
  }

  async upload(key: string, content: Buffer | string, contentType?: string): Promise<string> {
    try {
      const buffer = this.ensureBuffer(content);
      const finalContentType = contentType || this.getContentType(key);

      const result = await this.client.put(key, buffer, {
        headers: {
          'Content-Type': finalContentType,
          'Cache-Control': 'public, max-age=31536000', // 1 year cache
        }
      });

      return result.url;
    } catch (error) {
      this.handleError(error, 'upload');
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.head(key);
      return true;
    } catch (error: any) {
      if (error?.name === 'NoSuchKeyError' || error?.status === 404) {
        return false;
      }
      this.handleError(error, 'exists check');
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.client.delete(key);
    } catch (error) {
      this.handleError(error, 'delete');
    }
  }

  async getUrl(key: string): Promise<string> {
    try {
      // Generate a public URL for the object
      const result = await this.client.signatureUrl(key, { expires: 3600 * 24 * 365 }); // 1 year expiry
      return result;
    } catch (error) {
      // Fallback to simple URL construction
      const endpoint = this.config.endpoint || `https://${this.bucket}.oss-${this.config.region}.aliyuncs.com`;
      return `${endpoint}/${key}`;
    }
  }
}