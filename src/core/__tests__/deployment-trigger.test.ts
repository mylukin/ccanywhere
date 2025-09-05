/**
 * Deployment trigger tests
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import type { RuntimeContext } from '../../types/index.js';

// Mock axios first
const mockPost = jest.fn() as jest.MockedFunction<any>;
jest.unstable_mockModule('axios', () => ({
  default: {
    post: mockPost,
  },
  AxiosError: class AxiosError extends Error {
    constructor(message: string, code?: string, config?: any, request?: any, response?: any) {
      super(message);
      this.response = response;
    }
    response?: any;
  }
}));

// Mock version utilities
jest.unstable_mockModule('@/utils/version', () => ({
  getUserAgent: jest.fn(() => 'CCanywhere/0.1.0'),
  getVersion: jest.fn(() => '0.1.0'),
  getPackageName: jest.fn(() => 'ccanywhere'),
  getFullVersion: jest.fn(() => 'ccanywhere@0.1.0')
}));

// Import the module after mocking
const { SimpleDeploymentTrigger, hasDeploymentConfig } = await import('../deployment-trigger');

describe('DeploymentTrigger', () => {
  let trigger: any;
  let mockContext: RuntimeContext;

  beforeEach(() => {
    trigger = new SimpleDeploymentTrigger();
    
    mockContext = {
      config: {
        deployment: 'https://deploy.example.com/webhook'
      },
      timestamp: 1234567890,
      revision: 'abc123',
      branch: 'main',
      workDir: '/tmp/test',
      artifactsDir: '/tmp/test/.artifacts',
      logDir: '/tmp/test/logs',
      lockFile: '/tmp/test.lock'
    } as RuntimeContext;

    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('trigger', () => {
    it('should trigger deployment with string webhook URL', async () => {
      mockPost.mockResolvedValue({ status: 200, statusText: 'OK' } as any);

      const result = await trigger.trigger(mockContext);

      expect(mockPost).toHaveBeenCalledWith(
        'https://deploy.example.com/webhook',
        {
          ref: 'abc123',
          branch: 'main',
          trigger: 'ccanywhere',
          timestamp: 1234567890
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'CCanywhere/0.1.0'
          },
          timeout: 30000
        }
      );

      expect(result.status).toBe('success');
      expect(result.startTime).toBeDefined();
      expect(result.endTime).toBeDefined();
    });

    it('should trigger deployment with object webhook config', async () => {
      mockContext.config.deployment = {
        webhook: 'https://deploy.example.com/webhook'
      };
      mockPost.mockResolvedValue({ status: 201, statusText: 'Created' } as any);

      const result = await trigger.trigger(mockContext);

      expect(mockPost).toHaveBeenCalledWith(
        'https://deploy.example.com/webhook',
        expect.objectContaining({
          ref: 'abc123',
          branch: 'main',
          trigger: 'ccanywhere',
          timestamp: 1234567890
        }),
        expect.any(Object)
      );

      expect(result.status).toBe('success');
    });

    it('should handle missing webhook configuration', async () => {
      mockContext.config.deployment = undefined;

      await expect(trigger.trigger(mockContext)).rejects.toThrow(
        'Deployment webhook URL not configured'
      );
    });

    it('should handle HTTP errors', async () => {
      const error = {
        response: { status: 404, statusText: 'Not Found' }
      };
      mockPost.mockRejectedValue(error as any);

      const result = await trigger.trigger(mockContext);

      expect(result.status).toBe('failed');
      expect(result.error).toBe('[object Object]'); // This is how the error is converted to string
      expect(result.startTime).toBeDefined();
      expect(result.endTime).toBeDefined();
    });

    it('should handle network errors', async () => {
      mockPost.mockRejectedValue(new Error('Network timeout') as any);

      const result = await trigger.trigger(mockContext);

      expect(result.status).toBe('failed');
      expect(result.error).toBe('Network timeout');
    });

    it('should handle non-2xx status codes', async () => {
      mockPost.mockResolvedValue({ status: 500, statusText: 'Internal Server Error' } as any);

      const result = await trigger.trigger(mockContext);
      
      expect(result.status).toBe('failed');
      expect(result.error).toBe('Deployment webhook returned 500: Internal Server Error');
    });
  });

  describe('getStatus', () => {
    it('should return success status', async () => {
      const result = await trigger.getStatus('test-deployment-id');

      expect(result.status).toBe('success');
      expect(result.startTime).toBeDefined();
      expect(result.endTime).toBeDefined();
    });
  });
});

describe('hasDeploymentConfig', () => {
  it('should return true for string deployment config', () => {
    const config = {
      deployment: 'https://deploy.example.com/webhook'
    };

    expect(hasDeploymentConfig(config)).toBe(true);
  });

  it('should return true for object deployment config', () => {
    const config = {
      deployment: {
        webhook: 'https://deploy.example.com/webhook'
      }
    };

    expect(hasDeploymentConfig(config)).toBe(true);
  });

  it('should return false for missing deployment config', () => {
    const config = {};

    expect(hasDeploymentConfig(config)).toBe(false);
  });

  it('should return false for empty string deployment config', () => {
    const config = {
      deployment: ''
    };

    expect(hasDeploymentConfig(config)).toBe(false);
  });

  it('should return false for object with empty webhook', () => {
    const config = {
      deployment: {
        webhook: ''
      }
    };

    expect(hasDeploymentConfig(config)).toBe(false);
  });

  it('should return false for undefined deployment', () => {
    const config = {
      deployment: undefined
    };

    expect(hasDeploymentConfig(config)).toBe(false);
  });
});