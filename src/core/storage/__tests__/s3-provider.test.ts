/**
 * Tests for S3StorageProvider
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

// Mock AWS S3 client
const mockS3Client = {
  send: jest.fn()
} as any;

const mockS3ClientConstructor = jest.fn(() => mockS3Client);

jest.unstable_mockModule('@aws-sdk/client-s3', () => ({
  S3Client: mockS3ClientConstructor,
  PutObjectCommand: jest.fn((params: any) => ({ input: params, name: 'PutObjectCommand' })),
  GetObjectCommand: jest.fn((params: any) => ({ input: params, name: 'GetObjectCommand' })),
  HeadObjectCommand: jest.fn((params: any) => ({ input: params, name: 'HeadObjectCommand' })),
  DeleteObjectCommand: jest.fn((params: any) => ({ input: params, name: 'DeleteObjectCommand' })),
  ListObjectsV2Command: jest.fn((params: any) => ({ input: params, name: 'ListObjectsV2Command' }))
}));

// Mock mime-types
const mockMimeTypes = {
  lookup: jest.fn()
} as any;
jest.unstable_mockModule('mime-types', () => ({
  default: mockMimeTypes
}));

// Import the module after mocking
const { S3StorageProvider } = await import('../s3-provider.js');

describe('S3StorageProvider', () => {
  let provider: any;
  let mockConfig: any;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup mock config
    mockConfig = {
      region: 'us-east-1',
      bucket: 'test-bucket',
      credentials: {
        accessKeyId: 'test-access-key',
        secretAccessKey: 'test-secret-key'
      }
    };

    // Setup default mock returns
    mockMimeTypes.lookup.mockReturnValue('text/html');
    mockS3Client.send.mockResolvedValue({});
  });

  describe('constructor', () => {
    it('should initialize with valid configuration', () => {
      provider = new S3StorageProvider(mockConfig);
      
      expect(mockS3ClientConstructor).toHaveBeenCalledWith({
        region: mockConfig.region,
        credentials: mockConfig.credentials
      });
      expect(provider).toBeDefined();
    });

    it('should throw error for missing bucket', () => {
      const configWithoutBucket = { ...mockConfig };
      delete configWithoutBucket.bucket;

      expect(() => {
        new S3StorageProvider(configWithoutBucket);
      }).toThrow('S3 bucket name is required');
    });

    it('should throw error for missing credentials', () => {
      const configWithoutCredentials = { ...mockConfig };
      delete configWithoutCredentials.credentials;

      expect(() => {
        new S3StorageProvider(configWithoutCredentials);
      }).toThrow('S3 credentials are required');
    });

    it('should use default region if not provided', () => {
      const configWithoutRegion = { ...mockConfig };
      delete configWithoutRegion.region;

      provider = new S3StorageProvider(configWithoutRegion);

      expect(mockS3ClientConstructor).toHaveBeenCalledWith(
        expect.objectContaining({
          region: 'us-east-1' // default region
        })
      );
    });

    it('should handle additional S3 client options', () => {
      const configWithOptions = {
        ...mockConfig,
        endpoint: 'https://custom-s3-endpoint.com',
        forcePathStyle: true
      };

      provider = new S3StorageProvider(configWithOptions);

      expect(mockS3ClientConstructor).toHaveBeenCalledWith(
        expect.objectContaining({
          endpoint: 'https://custom-s3-endpoint.com',
          forcePathStyle: true
        })
      );
    });
  });

  describe('upload method', () => {
    beforeEach(() => {
      provider = new S3StorageProvider(mockConfig);
    });

    it('should upload file successfully', async () => {
      const mockResponse = {
        Location: 'https://test-bucket.s3.amazonaws.com/test-key'
      };
      mockS3Client.send.mockResolvedValue(mockResponse);

      const result = await provider.upload('test-key', Buffer.from('test content'), 'text/plain');

      expect(result).toBe('https://test-bucket.s3.amazonaws.com/test-key');
      expect(mockS3Client.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: {
            Bucket: 'test-bucket',
            Key: 'test-key',
            Body: expect.any(Buffer),
            ContentType: 'text/plain'
          }
        })
      );
    });

    it('should auto-detect content type from file extension', async () => {
      mockMimeTypes.lookup.mockReturnValue('text/html');

      await provider.upload('test-file.html', Buffer.from('<html></html>'));

      expect(mockMimeTypes.lookup).toHaveBeenCalledWith('test-file.html');
      expect(mockS3Client.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            ContentType: 'text/html'
          })
        })
      );
    });

    it('should use provided content type over auto-detection', async () => {
      await provider.upload('test-file.html', Buffer.from('content'), 'application/json');

      expect(mockS3Client.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            ContentType: 'application/json'
          })
        })
      );
    });

    it('should use default content type when detection fails', async () => {
      mockMimeTypes.lookup.mockReturnValue(false);

      await provider.upload('unknown-file', Buffer.from('content'));

      expect(mockS3Client.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            ContentType: 'application/octet-stream'
          })
        })
      );
    });

    it('should handle upload errors', async () => {
      mockS3Client.send.mockRejectedValue(new Error('Upload failed'));

      await expect(provider.upload('test-key', Buffer.from('content')))
        .rejects.toThrow('Upload failed');
    });

    it('should handle S3 service errors', async () => {
      const s3Error = {
        name: 'NoSuchBucket',
        message: 'The specified bucket does not exist'
      };
      mockS3Client.send.mockRejectedValue(s3Error);

      await expect(provider.upload('test-key', Buffer.from('content')))
        .rejects.toThrow('The specified bucket does not exist');
    });

    it('should generate correct S3 URL', async () => {
      mockS3Client.send.mockResolvedValue({});

      const result = await provider.upload('folder/test-file.html', Buffer.from('content'));

      expect(result).toBe('https://test-bucket.s3.us-east-1.amazonaws.com/folder/test-file.html');
    });

    it('should handle special characters in key', async () => {
      await provider.upload('folder/file with spaces & special chars.html', Buffer.from('content'));

      expect(mockS3Client.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            Key: 'folder/file with spaces & special chars.html'
          })
        })
      );
    });
  });

  describe('download method', () => {
    beforeEach(() => {
      provider = new S3StorageProvider(mockConfig);
    });

    it('should download file successfully', async () => {
      const mockStream = {
        transformToByteArray: jest.fn()
      } as any;
      mockStream.transformToByteArray.mockResolvedValue(new Uint8Array([1, 2, 3, 4]));
      mockS3Client.send.mockResolvedValue({ Body: mockStream });

      const result = await provider.download('test-key');

      expect(result).toEqual(Buffer.from([1, 2, 3, 4]));
      expect(mockS3Client.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: {
            Bucket: 'test-bucket',
            Key: 'test-key'
          }
        })
      );
    });

    it('should handle download errors', async () => {
      mockS3Client.send.mockRejectedValue(new Error('Download failed'));

      await expect(provider.download('test-key'))
        .rejects.toThrow('Download failed');
    });

    it('should handle missing object', async () => {
      const s3Error = {
        name: 'NoSuchKey',
        message: 'The specified key does not exist'
      };
      mockS3Client.send.mockRejectedValue(s3Error);

      await expect(provider.download('nonexistent-key'))
        .rejects.toThrow('The specified key does not exist');
    });

    it('should handle missing body in response', async () => {
      mockS3Client.send.mockResolvedValue({}); // No Body property

      await expect(provider.download('test-key'))
        .rejects.toThrow();
    });
  });

  describe('delete method', () => {
    beforeEach(() => {
      provider = new S3StorageProvider(mockConfig);
    });

    it('should delete file successfully', async () => {
      mockS3Client.send.mockResolvedValue({});

      await provider.delete('test-key');

      expect(mockS3Client.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: {
            Bucket: 'test-bucket',
            Key: 'test-key'
          }
        })
      );
    });

    it('should handle delete errors', async () => {
      mockS3Client.send.mockRejectedValue(new Error('Delete failed'));

      await expect(provider.delete('test-key'))
        .rejects.toThrow('Delete failed');
    });

    it('should handle deleting non-existent object gracefully', async () => {
      const s3Error = {
        name: 'NoSuchKey',
        message: 'The specified key does not exist'
      };
      mockS3Client.send.mockRejectedValue(s3Error);

      // S3 delete is idempotent, so this should not throw
      await expect(provider.delete('nonexistent-key'))
        .rejects.toThrow('The specified key does not exist');
    });
  });

  describe('list method', () => {
    beforeEach(() => {
      provider = new S3StorageProvider(mockConfig);
    });

    it('should list objects successfully', async () => {
      const mockResponse = {
        Contents: [
          { Key: 'file1.txt', LastModified: new Date('2023-01-01'), Size: 100 },
          { Key: 'file2.html', LastModified: new Date('2023-01-02'), Size: 200 }
        ]
      };
      mockS3Client.send.mockResolvedValue(mockResponse);

      const result = await provider.list('test-prefix');

      expect(result).toEqual([
        { key: 'file1.txt', lastModified: new Date('2023-01-01'), size: 100 },
        { key: 'file2.html', lastModified: new Date('2023-01-02'), size: 200 }
      ]);
      expect(mockS3Client.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: {
            Bucket: 'test-bucket',
            Prefix: 'test-prefix'
          }
        })
      );
    });

    it('should handle empty list response', async () => {
      mockS3Client.send.mockResolvedValue({ Contents: [] });

      const result = await provider.list('empty-prefix');

      expect(result).toEqual([]);
    });

    it('should handle list errors', async () => {
      mockS3Client.send.mockRejectedValue(new Error('List failed'));

      await expect(provider.list('test-prefix'))
        .rejects.toThrow('List failed');
    });

    it('should handle missing Contents in response', async () => {
      mockS3Client.send.mockResolvedValue({}); // No Contents property

      const result = await provider.list('test-prefix');

      expect(result).toEqual([]);
    });
  });

  describe('test method', () => {
    beforeEach(() => {
      provider = new S3StorageProvider(mockConfig);
    });

    it('should return success for valid configuration', async () => {
      mockS3Client.send.mockResolvedValue({ Contents: [] });

      const result = await provider.test();

      expect(result.success).toBe(true);
      expect(mockS3Client.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: {
            Bucket: 'test-bucket',
            MaxKeys: 1
          }
        })
      );
    });

    it('should return failure for invalid credentials', async () => {
      const authError = {
        name: 'InvalidAccessKeyId',
        message: 'The AWS Access Key Id you provided does not exist'
      };
      mockS3Client.send.mockRejectedValue(authError);

      const result = await provider.test();

      expect(result.success).toBe(false);
      expect(result.error).toBe('The AWS Access Key Id you provided does not exist');
    });

    it('should return failure for invalid bucket', async () => {
      const bucketError = {
        name: 'NoSuchBucket',
        message: 'The specified bucket does not exist'
      };
      mockS3Client.send.mockRejectedValue(bucketError);

      const result = await provider.test();

      expect(result.success).toBe(false);
      expect(result.error).toBe('The specified bucket does not exist');
    });

    it('should return failure for permission errors', async () => {
      const permissionError = {
        name: 'AccessDenied',
        message: 'Access Denied'
      };
      mockS3Client.send.mockRejectedValue(permissionError);

      const result = await provider.test();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Access Denied');
    });

    it('should handle non-Error objects', async () => {
      mockS3Client.send.mockRejectedValue('String error');

      const result = await provider.test();

      expect(result.success).toBe(false);
      expect(result.error).toBe('String error');
    });
  });


  describe('configuration validation', () => {
    it('should validate required fields', () => {
      const requiredFields = ['bucket', 'credentials'];
      
      requiredFields.forEach(field => {
        const config = { ...mockConfig };
        delete config[field];

        expect(() => {
          new S3StorageProvider(config);
        }).toThrow();
      });
    });

    it('should validate credentials structure', () => {
      const invalidCredentials = [
        {},
        { accessKeyId: 'key' }, // missing secretAccessKey
        { secretAccessKey: 'secret' } // missing accessKeyId
      ];

      invalidCredentials.forEach(credentials => {
        expect(() => {
          new S3StorageProvider({ ...mockConfig, credentials });
        }).toThrow();
      });
    });
  });

  describe('error handling and resilience', () => {
    beforeEach(() => {
      provider = new S3StorageProvider(mockConfig);
    });

    it('should handle network timeouts', async () => {
      const timeoutError = {
        name: 'TimeoutError',
        message: 'Connection timeout'
      };
      mockS3Client.send.mockRejectedValue(timeoutError);

      await expect(provider.upload('test', Buffer.from('data')))
        .rejects.toThrow('Connection timeout');
    });

    it('should handle service unavailable errors', async () => {
      const serviceError = {
        name: 'ServiceUnavailable',
        message: 'Service Unavailable'
      };
      mockS3Client.send.mockRejectedValue(serviceError);

      await expect(provider.upload('test', Buffer.from('data')))
        .rejects.toThrow('Service Unavailable');
    });

    it('should handle concurrent operations', async () => {
      const operations = [
        provider.upload('file1', Buffer.from('data1')),
        provider.upload('file2', Buffer.from('data2')),
        provider.upload('file3', Buffer.from('data3'))
      ];

      await expect(Promise.all(operations)).resolves.not.toThrow();
      expect(mockS3Client.send).toHaveBeenCalledTimes(3);
    });
  });
});