/**
 * Jest test setup file
 */

import { jest } from '@jest/globals';

// Global test timeout
jest.setTimeout(30000);

// Mock console methods in tests to avoid noise
const originalConsole = console;

beforeEach(() => {
  // Reset console before each test
  global.console = {
    ...originalConsole,
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn()
  } as any;
});

afterEach(() => {
  // Restore console after each test
  global.console = originalConsole;
});

// Global test utilities
(global as any).mockConfig = {
  repo: {
    kind: 'github',
    url: 'https://github.com/test/repo',
    branch: 'main'
  },
  urls: {
    artifacts: 'https://artifacts.test.com',
    staging: 'https://staging.test.com'
  },
  notifications: {
    channels: ['telegram'],
    telegram: {
      botToken: '123456789:test-token',
      chatId: '-1001234567890'
    }
  },
  build: {
    base: 'origin/main',
    lockTimeout: 300,
    cleanupDays: 7
  }
};

// Mock runtime context
(global as any).mockContext = {
  config: (global as any).mockConfig,
  timestamp: Date.now(),
  revision: 'abc123',
  branch: 'main',
  workDir: '/tmp/test',
  artifactsDir: '/tmp/test/.artifacts',
  logDir: '/tmp/test/logs',
  lockFile: '/tmp/test.lock'
};

// Add a dummy test to satisfy Jest
describe('Setup', () => {
  it('should have mock config', () => {
    expect((global as any).mockConfig).toBeDefined();
  });
});
