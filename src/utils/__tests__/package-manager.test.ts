/**
 * Tests for PackageManager utility
 */

import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { PackageManager, type PackageJson, type ScriptToInject } from '../package-manager.js';

describe('PackageManager', () => {
  let tempDir: string;
  let packageJsonPath: string;

  beforeEach(async () => {
    // Create a temporary directory for testing
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ccanywhere-test-'));
    packageJsonPath = path.join(tempDir, 'package.json');
  });

  afterEach(async () => {
    // Clean up temporary directory
    await fs.remove(tempDir);
  });

  describe('findPackageJson', () => {
    it('should find package.json in the current directory', async () => {
      const packageJson = { name: 'test-package', version: '1.0.0' };
      await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));

      const found = await PackageManager.findPackageJson(tempDir);
      expect(found).toBe(packageJsonPath);
    });

    it('should find package.json in parent directories', async () => {
      const subDir = path.join(tempDir, 'sub', 'nested');
      await fs.ensureDir(subDir);

      const packageJson = { name: 'test-package', version: '1.0.0' };
      await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));

      const found = await PackageManager.findPackageJson(subDir);
      expect(found).toBe(packageJsonPath);
    });

    it('should return null if no package.json is found', async () => {
      const found = await PackageManager.findPackageJson(tempDir);
      expect(found).toBeNull();
    });
  });

  describe('readPackageJson', () => {
    it('should read and parse valid package.json', async () => {
      const packageJson = { name: 'test-package', version: '1.0.0', scripts: { test: 'echo test' } };
      await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));

      const result = await PackageManager.readPackageJson(packageJsonPath);
      expect(result).toEqual(packageJson);
    });

    it('should throw error for invalid JSON', async () => {
      await fs.writeFile(packageJsonPath, '{ invalid json }');

      await expect(PackageManager.readPackageJson(packageJsonPath))
        .rejects.toThrow('Invalid JSON in package.json');
    });

    it('should throw error for empty file', async () => {
      await fs.writeFile(packageJsonPath, '');

      await expect(PackageManager.readPackageJson(packageJsonPath))
        .rejects.toThrow('Package.json file is empty');
    });
  });

  describe('hasScript', () => {
    it('should return true if script exists', () => {
      const packageJson = { scripts: { test: 'echo test', build: 'npm run compile' } };
      expect(PackageManager.hasScript(packageJson, 'test')).toBe(true);
      expect(PackageManager.hasScript(packageJson, 'build')).toBe(true);
    });

    it('should return false if script does not exist', () => {
      const packageJson = { scripts: { test: 'echo test' } };
      expect(PackageManager.hasScript(packageJson, 'build')).toBe(false);
      expect(PackageManager.hasScript(packageJson, 'nonexistent')).toBe(false);
    });

    it('should return false if scripts section does not exist', () => {
      const packageJson = {};
      expect(PackageManager.hasScript(packageJson, 'test')).toBe(false);
    });
  });

  describe('addScripts', () => {
    it('should add new scripts to package.json', () => {
      const packageJson: PackageJson = { name: 'test' };
      const scripts: ScriptToInject[] = [
        { name: 'ccanywhere:run', command: 'ccanywhere run' },
        { name: 'ccanywhere:test', command: 'ccanywhere test' }
      ];

      const result = PackageManager.addScripts(packageJson, scripts);

      expect(result.added).toHaveLength(2);
      expect(result.skipped).toHaveLength(0);
      expect(packageJson.scripts).toEqual({
        'ccanywhere:run': 'ccanywhere run',
        'ccanywhere:test': 'ccanywhere test'
      });
    });

    it('should skip existing scripts', () => {
      const packageJson: PackageJson = {
        name: 'test',
        scripts: {
          'ccanywhere:run': 'ccanywhere run',
          'existing': 'existing command'
        }
      };
      const scripts: ScriptToInject[] = [
        { name: 'ccanywhere:run', command: 'ccanywhere run' },
        { name: 'ccanywhere:test', command: 'ccanywhere test' }
      ];

      const result = PackageManager.addScripts(packageJson, scripts);

      expect(result.added).toHaveLength(1);
      expect(result.skipped).toHaveLength(1);
      expect(result.added[0]?.name).toBe('ccanywhere:test');
      expect(result.skipped[0]?.name).toBe('ccanywhere:run');
    });

    it('should create scripts section if it does not exist', () => {
      const packageJson: PackageJson = { name: 'test' };
      const scripts: ScriptToInject[] = [
        { name: 'ccanywhere:run', command: 'ccanywhere run' }
      ];

      PackageManager.addScripts(packageJson, scripts);

      expect(packageJson.scripts).toBeDefined();
      expect(packageJson.scripts!['ccanywhere:run']).toBe('ccanywhere run');
    });
  });

  describe('getDefaultScripts', () => {
    it('should return the expected default scripts', () => {
      const defaultScripts = PackageManager.getDefaultScripts();

      expect(defaultScripts).toHaveLength(3);
      expect(defaultScripts).toEqual([
        { name: 'ccanywhere:run', command: 'ccanywhere run', description: 'Run the complete CCanywhere build pipeline' },
        { name: 'ccanywhere:test', command: 'ccanywhere test', description: 'Test CCanywhere configuration and services' },
        { name: 'ccanywhere:init', command: 'ccanywhere init', description: 'Initialize CCanywhere in current directory' }
      ]);
    });
  });

  describe('isCcanywherePackage', () => {
    it('should return true for ccanywhere package', async () => {
      const packageJson = { name: 'ccanywhere', version: '1.0.0' };
      await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));

      const result = await PackageManager.isCcanywherePackage(packageJsonPath);
      expect(result).toBe(true);
    });

    it('should return false for other packages', async () => {
      const packageJson = { name: 'other-package', version: '1.0.0' };
      await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));

      const result = await PackageManager.isCcanywherePackage(packageJsonPath);
      expect(result).toBe(false);
    });

    it('should return false for non-existent file', async () => {
      const result = await PackageManager.isCcanywherePackage('/nonexistent/package.json');
      expect(result).toBe(false);
    });
  });

  describe('injectScripts', () => {
    it('should inject scripts and write to file', async () => {
      const packageJson = { name: 'test-package', version: '1.0.0' };
      await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));

      const scripts: ScriptToInject[] = [
        { name: 'ccanywhere:run', command: 'ccanywhere run' }
      ];

      const result = await PackageManager.injectScripts(packageJsonPath, scripts);

      expect(result.added).toHaveLength(1);
      expect(result.skipped).toHaveLength(0);

      // Verify the file was updated
      const updatedPackageJson = await PackageManager.readPackageJson(packageJsonPath);
      expect(updatedPackageJson.scripts!['ccanywhere:run']).toBe('ccanywhere run');
    });

    it('should not write file if no scripts were added', async () => {
      const packageJson = { 
        name: 'test-package', 
        version: '1.0.0',
        scripts: {
          'ccanywhere:run': 'ccanywhere run'
        }
      };
      await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));

      const scripts: ScriptToInject[] = [
        { name: 'ccanywhere:run', command: 'ccanywhere run' }
      ];

      const result = await PackageManager.injectScripts(packageJsonPath, scripts);

      expect(result.added).toHaveLength(0);
      expect(result.skipped).toHaveLength(1);
    });
  });
});