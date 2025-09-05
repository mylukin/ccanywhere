/**
 * Tests for version utility module
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { readFileSync } from 'fs';

// Mock fs module
jest.unstable_mockModule('fs', () => ({
  readFileSync: jest.fn()
}));

describe('Version Utilities', () => {
  let originalConsoleError: typeof console.error;
  let versionModule: any;

  beforeEach(async () => {
    originalConsoleError = console.error;
    console.error = jest.fn();
    jest.clearAllMocks();
    
    // Clear module cache to ensure fresh imports
    jest.resetModules();
  });

  afterEach(() => {
    console.error = originalConsoleError;
  });

  it('should return version from package.json', async () => {
    const mockFs = await import('fs');
    (mockFs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify({
      name: 'ccanywhere',
      version: '1.2.3'
    }));

    versionModule = await import('../version.js');

    expect(versionModule.getVersion()).toBe('1.2.3');
    expect(mockFs.readFileSync).toHaveBeenCalled();
  });

  it('should return package name from package.json', async () => {
    const mockFs = await import('fs');
    (mockFs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify({
      name: 'test-package',
      version: '2.0.0'
    }));

    versionModule = await import('../version.js');

    expect(versionModule.getPackageName()).toBe('test-package');
  });

  it('should return user agent string', async () => {
    const mockFs = await import('fs');
    (mockFs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify({
      name: 'ccanywhere',
      version: '1.5.0'
    }));

    versionModule = await import('../version.js');

    expect(versionModule.getUserAgent()).toBe('CCanywhere/1.5.0');
  });

  it('should return full version string', async () => {
    const mockFs = await import('fs');
    (mockFs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify({
      name: 'ccanywhere',
      version: '0.9.0'
    }));

    versionModule = await import('../version.js');

    expect(versionModule.getFullVersion()).toBe('ccanywhere@0.9.0');
  });

  it('should handle missing package.json gracefully', async () => {
    const mockFs = await import('fs');
    (mockFs.readFileSync as jest.Mock).mockImplementation(() => {
      throw new Error('File not found');
    });

    versionModule = await import('../version.js');

    expect(versionModule.getVersion()).toBe('0.0.0');
    expect(versionModule.getPackageName()).toBe('ccanywhere');
    expect(console.error).toHaveBeenCalledWith('Failed to load package.json:', expect.any(Error));
  });

  it('should handle invalid JSON in package.json', async () => {
    const mockFs = await import('fs');
    (mockFs.readFileSync as jest.Mock).mockReturnValue('not valid json');

    versionModule = await import('../version.js');

    expect(versionModule.getVersion()).toBe('0.0.0');
    expect(versionModule.getPackageName()).toBe('ccanywhere');
    expect(console.error).toHaveBeenCalledWith('Failed to load package.json:', expect.any(Error));
  });

  it('should cache version after first read', async () => {
    const mockFs = await import('fs');
    (mockFs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify({
      name: 'ccanywhere',
      version: '3.0.0'
    }));

    versionModule = await import('../version.js');

    // First call
    expect(versionModule.getVersion()).toBe('3.0.0');
    expect(mockFs.readFileSync).toHaveBeenCalledTimes(1);

    // Second call should use cache
    expect(versionModule.getVersion()).toBe('3.0.0');
    expect(mockFs.readFileSync).toHaveBeenCalledTimes(1);
  });

  it('should cache package info after first read', async () => {
    const mockFs = await import('fs');
    (mockFs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify({
      name: 'ccanywhere',
      version: '4.0.0'
    }));

    versionModule = await import('../version.js');

    // Multiple calls should use cache
    expect(versionModule.getPackageName()).toBe('ccanywhere');
    expect(versionModule.getUserAgent()).toBe('CCanywhere/4.0.0');
    expect(versionModule.getFullVersion()).toBe('ccanywhere@4.0.0');
    
    // Should only read file once
    expect(mockFs.readFileSync).toHaveBeenCalledTimes(1);
  });
});