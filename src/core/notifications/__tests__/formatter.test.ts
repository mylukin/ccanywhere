/**
 * Message formatter tests
 */

import { describe, it, expect } from '@jest/globals';
import { MessageFormatter } from '../formatter.js';
import type { NotificationMessage } from '../../../types/index.js';

describe('MessageFormatter', () => {
  const testMessage: NotificationMessage = {
    title: 'Test Build Success',
    diffUrl: 'https://example.com/diff.html',
    previewUrl: 'https://staging.example.com',
    reportUrl: 'https://example.com/report.html',
    extra: 'Additional information here',
    timestamp: Date.now(),
    isError: false
  };

  describe('format', () => {
    it('should format message as plain text', () => {
      const formatted = MessageFormatter.format(testMessage, 'plain');
      
      expect(formatted.format).toBe('plain');
      expect(formatted.title).toBe('Test Build Success');
      expect(formatted.content).toContain('Test Build Success');
      expect(formatted.content).toContain('View Diff: https://example.com/diff.html');
      expect(formatted.content).toContain('Preview: https://staging.example.com');
      expect(formatted.content).toContain('Test Report: https://example.com/report.html');
      expect(formatted.content).toContain('Additional information here');
    });

    it('should format message as markdown', () => {
      const formatted = MessageFormatter.format(testMessage, 'markdown');
      
      expect(formatted.format).toBe('markdown');
      expect(formatted.content).toContain('**Test Build Success**');
      expect(formatted.content).toContain('[View Diff](https://example.com/diff.html)');
      expect(formatted.content).toContain('[Preview Site](https://staging.example.com)');
      expect(formatted.content).toContain('[Test Report](https://example.com/report.html)');
      expect(formatted.content).toContain('📝');
      expect(formatted.content).toContain('🌐');
      expect(formatted.content).toContain('📊');
    });

    it('should format message as HTML', () => {
      const formatted = MessageFormatter.format(testMessage, 'html');
      
      expect(formatted.format).toBe('html');
      expect(formatted.content).toContain('<strong>Test Build Success</strong>');
      expect(formatted.content).toContain('<a href="https://example.com/diff.html">View Diff</a>');
      expect(formatted.content).toContain('<a href="https://staging.example.com">Preview Site</a>');
      expect(formatted.content).toContain('<a href="https://example.com/report.html">Test Report</a>');
      expect(formatted.content).toContain('<br>');
    });

    it('should handle message with only title', () => {
      const simpleMessage: NotificationMessage = {
        title: 'Simple Message',
        timestamp: Date.now(),
        isError: false
      };

      const formatted = MessageFormatter.format(simpleMessage, 'plain');
      
      expect(formatted.content).toContain('Simple Message');
      expect(formatted.content).not.toContain('View Diff:');
      expect(formatted.content).not.toContain('Preview:');
      expect(formatted.content).not.toContain('Test Report:');
    });

    it('should escape HTML entities in HTML format', () => {
      const messageWithHtml: NotificationMessage = {
        title: 'Test <script>alert("xss")</script>',
        extra: 'Some & dangerous < content >',
        timestamp: Date.now(),
        isError: false
      };

      const formatted = MessageFormatter.format(messageWithHtml, 'html');
      
      expect(formatted.content).not.toContain('<script>');
      expect(formatted.content).toContain('&lt;script&gt;');
      expect(formatted.content).toContain('&amp;');
      expect(formatted.content).toContain('&lt;');
      expect(formatted.content).toContain('&gt;');
    });
  });

  describe('truncate', () => {
    it('should truncate long content', () => {
      const longContent = 'a'.repeat(100);
      const truncated = MessageFormatter.truncate(longContent, 50);
      
      expect(truncated.length).toBe(50);
      expect(truncated.endsWith('...')).toBe(true);
    });

    it('should not truncate short content', () => {
      const shortContent = 'short message';
      const result = MessageFormatter.truncate(shortContent, 50);
      
      expect(result).toBe(shortContent);
    });
  });

  describe('getStatusEmoji', () => {
    it('should return error emoji for errors', () => {
      const emoji = MessageFormatter.getStatusEmoji(true, 'any title');
      expect(emoji).toBe('❌');
    });

    it('should return success emoji for success', () => {
      const emoji = MessageFormatter.getStatusEmoji(false, 'Build success');
      expect(emoji).toBe('✅');
    });

    it('should return warning emoji for warnings', () => {
      const emoji = MessageFormatter.getStatusEmoji(false, 'Build warning detected');
      expect(emoji).toBe('⚠️');
    });

    it('should return deploy emoji for deployments', () => {
      const emoji = MessageFormatter.getStatusEmoji(false, 'Deployment started');
      expect(emoji).toBe('🚀');
    });

    it('should return test emoji for tests', () => {
      const emoji = MessageFormatter.getStatusEmoji(false, 'Test results');
      expect(emoji).toBe('🧪');
    });

    it('should return default emoji for unknown status', () => {
      const emoji = MessageFormatter.getStatusEmoji(false, 'Unknown status');
      expect(emoji).toBe('🔔');
    });
  });
});