/**
 * Tests for utils logger - minimal coverage
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

describe('Utils Logger', () => {
  let Logger: any;
  
  beforeEach(async () => {
    jest.clearAllMocks();
    
    // Import after mocks
    const module = await import('../logger.js');
    Logger = module.Logger;
  });

  afterEach(async () => {
    // Clean up logger instance after each test
    if (Logger) {
      await Logger.reset();
    }
  });

  it('should create logger instance', () => {
    const logger = Logger.getInstance();
    
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.debug).toBe('function');
    expect(typeof logger.warn).toBe('function');
  });

  it('should return same instance (singleton)', () => {
    const logger1 = Logger.getInstance();
    const logger2 = Logger.getInstance();
    
    expect(logger1).toBe(logger2);
  });

  it('should have logging methods available', async () => {
    const logger = Logger.getInstance();
    
    // Test methods exist and don't throw
    expect(() => logger.info('test')).not.toThrow();
    expect(() => logger.error('test')).not.toThrow();
    expect(() => logger.debug('test')).not.toThrow();
    expect(() => logger.warn('test')).not.toThrow();
    
    // Small delay to ensure async operations complete
    await new Promise(resolve => setTimeout(resolve, 10));
  });
});