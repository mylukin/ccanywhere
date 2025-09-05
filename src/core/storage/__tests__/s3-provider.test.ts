/**
 * Tests for S3StorageProvider
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Mock AWS S3 client
const mockS3Client = {
  send: jest.fn()
} as any;

const mockS3ClientConstructor = jest.fn(() => mockS3Client);

jest.unstable_mockModule('@aws-sdk/client-s3', () => ({
  S3Client: mockS3ClientConstructor,
  PutObjectCommand: jest.fn((params: any) => ({ input: params, name: 'PutObjectCommand' })),
  HeadObjectCommand: jest.fn((params: any) => ({ input: params, name: 'HeadObjectCommand' })),
  DeleteObjectCommand: jest.fn((params: any) => ({ input: params, name: 'DeleteObjectCommand' }))
}));

// Import the module after mocking
const { S3StorageProvider } = await import('../s3-provider.js');

describe('S3StorageProvider', () => {
  let provider: any;
  let mockConfig: any;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup mock config matching actual implementation structure
    mockConfig = {
      region: 'us-east-1',
      bucket: 'test-bucket',
      accessKeyId: 'test-access-key',
      secretAccessKey: 'test-secret-key'
    };

    // Setup default mock returns
    mockS3Client.send.mockResolvedValue({});
  });

  describe('constructor', () => {
    it('should initialize with valid configuration', () => {
      provider = new S3StorageProvider(mockConfig);
      
      expect(mockS3ClientConstructor).toHaveBeenCalledWith({
        region: mockConfig.region,
        credentials: {
          accessKeyId: mockConfig.accessKeyId,
          secretAccessKey: mockConfig.secretAccessKey
        },
        endpoint: mockConfig.endpoint
      });
      expect(provider).toBeDefined();
    });

    it('should handle custom endpoint', () => {
      const configWithEndpoint = {
        ...mockConfig,
        endpoint: 'https://custom-s3.example.com'
      };

      provider = new S3StorageProvider(configWithEndpoint);

      expect(mockS3ClientConstructor).toHaveBeenCalledWith({
        region: configWithEndpoint.region,
        credentials: {
          accessKeyId: configWithEndpoint.accessKeyId,
          secretAccessKey: configWithEndpoint.secretAccessKey
        },
        endpoint: configWithEndpoint.endpoint
      });
    });
  });

  describe('upload method', () => {
    beforeEach(() => {
      provider = new S3StorageProvider(mockConfig);
    });

    it('should upload file successfully', async () => {
      const content = Buffer.from('test content');
      const key = 'test-file.txt';

      const result = await provider.upload(key, content);

      expect(result).toBe(`https://test-bucket.s3.us-east-1.amazonaws.com/${key}`);
      expect(mockS3Client.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            Bucket: 'test-bucket',
            Key: key,
            Body: content,
            ContentType: 'application/octet-stream',
            CacheControl: 'public, max-age=31536000',
            ServerSideEncryption: 'AES256'
          })
        })
      );
    });

    it('should auto-detect content type from file extension', async () => {
      await provider.upload('test-file.html', 'content');

      expect(mockS3Client.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            ContentType: 'text/html; charset=utf-8'
          })
        })
      );
    });

    it('should use provided content type over auto-detection', async () => {
      await provider.upload('test-file.html', 'content', 'application/custom');

      expect(mockS3Client.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            ContentType: 'application/custom'
          })
        })
      );
    });

    it('should handle upload errors', async () => {
      mockS3Client.send.mockRejectedValue(new Error('Upload failed'));

      await expect(provider.upload('test-key', 'content'))
        .rejects.toThrow('Storage upload failed: Upload failed');
    });

    it('should handle string content', async () => {
      const content = 'test string content';
      await provider.upload('test-key', content);

      expect(mockS3Client.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            Body: Buffer.from(content, 'utf8')
          })
        })
      );
    });
  });

  describe('exists method', () => {
    beforeEach(() => {
      provider = new S3StorageProvider(mockConfig);
    });

    it('should return true when object exists', async () => {
      mockS3Client.send.mockResolvedValue({ ContentLength: 1024 });

      const result = await provider.exists('test-key');

      expect(result).toBe(true);
      expect(mockS3Client.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            Bucket: 'test-bucket',
            Key: 'test-key'
          })
        })
      );
    });

    it('should return false when object does not exist', async () => {
      const notFoundError = new Error('Not Found');
      (notFoundError as any).name = 'NotFound';
      mockS3Client.send.mockRejectedValue(notFoundError);

      const result = await provider.exists('non-existent-key');

      expect(result).toBe(false);
    });

    it('should return false for 404 errors', async () => {
      const notFoundError = new Error('Not Found');
      (notFoundError as any).statusCode = 404;
      mockS3Client.send.mockRejectedValue(notFoundError);

      const result = await provider.exists('non-existent-key');

      expect(result).toBe(false);
    });

    it('should handle other errors', async () => {
      mockS3Client.send.mockRejectedValue(new Error('Access denied'));

      await expect(provider.exists('test-key'))
        .rejects.toThrow('Storage exists check failed: Access denied');
    });
  });

  describe('delete method', () => {
    beforeEach(() => {
      provider = new S3StorageProvider(mockConfig);
    });

    it('should delete object successfully', async () => {
      await provider.delete('test-key');

      expect(mockS3Client.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            Bucket: 'test-bucket',
            Key: 'test-key'
          })
        })
      );
    });

    it('should handle delete errors', async () => {
      mockS3Client.send.mockRejectedValue(new Error('Delete failed'));

      await expect(provider.delete('test-key'))
        .rejects.toThrow('Storage delete failed: Delete failed');
    });
  });

  describe('getUrl method', () => {
    beforeEach(() => {
      provider = new S3StorageProvider(mockConfig);
    });

    it('should return correct S3 URL', async () => {
      const url = await provider.getUrl('test-key');

      expect(url).toBe('https://test-bucket.s3.us-east-1.amazonaws.com/test-key');
    });

    it('should handle keys with special characters', async () => {
      const url = await provider.getUrl('folder/test file.html');

      expect(url).toBe('https://test-bucket.s3.us-east-1.amazonaws.com/folder/test file.html');
    });
  });

  describe('content type detection', () => {
    beforeEach(() => {
      provider = new S3StorageProvider(mockConfig);
    });

    it('should detect HTML content type', async () => {
      await provider.upload('index.html', '<html></html>');

      expect(mockS3Client.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            ContentType: 'text/html; charset=utf-8'
          })
        })
      );
    });

    it('should detect JSON content type', async () => {
      await provider.upload('data.json', '{}');

      expect(mockS3Client.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            ContentType: 'application/json; charset=utf-8'
          })
        })
      );
    });

    it('should detect CSS content type', async () => {
      await provider.upload('style.css', 'body {}');

      expect(mockS3Client.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            ContentType: 'text/css; charset=utf-8'
          })
        })
      );
    });

    it('should detect JavaScript content type', async () => {
      await provider.upload('script.js', 'console.log("test");');

      expect(mockS3Client.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            ContentType: 'application/javascript; charset=utf-8'
          })
        })
      );
    });

    it('should use default content type for unknown extensions', async () => {
      await provider.upload('unknown.xyz', 'content');

      expect(mockS3Client.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            ContentType: 'application/octet-stream'
          })
        })
      );
    });
  });

  describe('error handling', () => {
    beforeEach(() => {
      provider = new S3StorageProvider(mockConfig);
    });

    it('should handle network timeouts', async () => {
      const timeoutError = new Error('Request timeout');
      (timeoutError as any).code = 'ECONNRESET';
      mockS3Client.send.mockRejectedValue(timeoutError);

      await expect(provider.upload('test-key', 'content'))
        .rejects.toThrow('Storage upload failed: Request timeout');
    });

    it('should handle service unavailable errors', async () => {
      const serviceError = new Error('Service Unavailable');
      (serviceError as any).statusCode = 503;
      mockS3Client.send.mockRejectedValue(serviceError);

      await expect(provider.upload('test-key', 'content'))
        .rejects.toThrow('Storage upload failed: Service Unavailable');
    });

    it('should handle non-Error objects', async () => {
      mockS3Client.send.mockRejectedValue('String error');

      await expect(provider.upload('test-key', 'content'))
        .rejects.toThrow('Storage upload failed: String error');
    });
  });
});