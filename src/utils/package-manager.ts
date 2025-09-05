/**
 * Package.json management utilities
 */

import fs from 'fs-extra';
import path from 'path';
import chalkModule from 'chalk';
const chalk = chalkModule;

export interface PackageJson {
  name?: string;
  version?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  [key: string]: any;
}

export interface ScriptToInject {
  name: string;
  command: string;
  description?: string;
}

export class PackageManager {
  /**
   * Find the nearest package.json file starting from a directory
   */
  static async findPackageJson(startDir: string = process.cwd()): Promise<string | null> {
    try {
      let currentDir = path.resolve(startDir);
      const root = path.parse(currentDir).root;
      let depth = 0;
      const maxDepth = 10; // Prevent infinite loops

      while (currentDir !== root && depth < maxDepth) {
        const packageJsonPath = path.join(currentDir, 'package.json');
        
        try {
          await fs.access(packageJsonPath, fs.constants.F_OK);
          
          // Additional check to ensure it's readable
          await fs.access(packageJsonPath, fs.constants.R_OK);
          
          return packageJsonPath;
        } catch {
          // Continue searching in parent directory
          currentDir = path.dirname(currentDir);
          depth++;
        }
      }

      return null;
    } catch (error) {
      console.warn(chalk.yellow(`Warning: Error while searching for package.json: ${error instanceof Error ? error.message : String(error)}`));
      return null;
    }
  }

  /**
   * Read and parse a package.json file
   */
  static async readPackageJson(packageJsonPath: string): Promise<PackageJson> {
    try {
      // Check if file exists and is readable
      await fs.access(packageJsonPath, fs.constants.R_OK);
      
      const content = await fs.readFile(packageJsonPath, 'utf-8');
      
      if (!content.trim()) {
        throw new Error('Package.json file is empty');
      }
      
      const packageJson = JSON.parse(content);
      
      // Basic validation
      if (typeof packageJson !== 'object' || packageJson === null) {
        throw new Error('Package.json must contain a valid JSON object');
      }
      
      return packageJson;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`Invalid JSON in package.json at ${packageJsonPath}: ${error.message}`);
      }
      throw new Error(`Failed to read package.json at ${packageJsonPath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Write a package.json file with proper formatting
   */
  static async writePackageJson(packageJsonPath: string, packageJson: PackageJson): Promise<void> {
    try {
      // Check if the directory is writable
      const dir = path.dirname(packageJsonPath);
      await fs.access(dir, fs.constants.W_OK);
      
      // Create backup of original file if it exists
      try {
        await fs.access(packageJsonPath, fs.constants.F_OK);
        const backupPath = `${packageJsonPath}.backup.${Date.now()}`;
        await fs.copy(packageJsonPath, backupPath);
        console.log(chalk.gray(`💾 Created backup at ${backupPath}`));
      } catch {
        // Original file doesn't exist, no backup needed
      }
      
      const content = JSON.stringify(packageJson, null, 2) + '\n';
      await fs.writeFile(packageJsonPath, content, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to write package.json at ${packageJsonPath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Check if a script already exists in package.json
   */
  static hasScript(packageJson: PackageJson, scriptName: string): boolean {
    return !!(packageJson.scripts && packageJson.scripts[scriptName]);
  }

  /**
   * Add scripts to package.json, avoiding duplicates
   */
  static addScripts(packageJson: PackageJson, scripts: ScriptToInject[]): { added: ScriptToInject[]; skipped: ScriptToInject[] } {
    // Validate input
    if (!packageJson || typeof packageJson !== 'object') {
      throw new Error('Invalid package.json object');
    }

    if (!Array.isArray(scripts)) {
      throw new Error('Scripts must be an array');
    }

    // Ensure scripts section exists
    if (!packageJson.scripts) {
      packageJson.scripts = {};
    }

    const added: ScriptToInject[] = [];
    const skipped: ScriptToInject[] = [];

    for (const script of scripts) {
      // Validate script object
      if (!script || typeof script !== 'object' || !script.name || !script.command) {
        console.log(chalk.yellow(`⚠️  Skipping invalid script: ${JSON.stringify(script)}`));
        continue;
      }

      // Sanitize script name (remove potentially dangerous characters)
      const sanitizedName = script.name.replace(/[^a-zA-Z0-9:_-]/g, '');
      if (sanitizedName !== script.name) {
        console.log(chalk.yellow(`⚠️  Script name sanitized: "${script.name}" -> "${sanitizedName}"`));
      }

      if (this.hasScript(packageJson, sanitizedName)) {
        // Check if the command is different
        if (packageJson.scripts![sanitizedName] !== script.command) {
          console.log(
            chalk.yellow(
              `⚠️  Script "${sanitizedName}" already exists with different command: "${packageJson.scripts![sanitizedName]}"`
            )
          );
          console.log(
            chalk.yellow(
              `   Skipping injection of: "${script.command}"`
            )
          );
        }
        skipped.push({ ...script, name: sanitizedName });
      } else {
        packageJson.scripts[sanitizedName] = script.command;
        added.push({ ...script, name: sanitizedName });
      }
    }

    return { added, skipped };
  }

  /**
   * Inject CCanywhere scripts into a package.json file
   */
  static async injectScripts(packageJsonPath: string, scripts: ScriptToInject[]): Promise<{ added: ScriptToInject[]; skipped: ScriptToInject[] }> {
    const packageJson = await this.readPackageJson(packageJsonPath);
    const result = this.addScripts(packageJson, scripts);
    
    if (result.added.length > 0) {
      await this.writePackageJson(packageJsonPath, packageJson);
    }

    return result;
  }

  /**
   * Get default CCanywhere scripts to inject
   */
  static getDefaultScripts(): ScriptToInject[] {
    return [
      {
        name: 'ccanywhere:run',
        command: 'ccanywhere run',
        description: 'Run the complete CCanywhere build pipeline'
      },
      {
        name: 'ccanywhere:test',
        command: 'ccanywhere test',
        description: 'Test CCanywhere configuration and services'
      },
      {
        name: 'ccanywhere:init',
        command: 'ccanywhere init',
        description: 'Initialize CCanywhere in current directory'
      }
    ];
  }

  /**
   * Check if we're inside the ccanywhere package itself (to avoid self-injection)
   */
  static async isCcanywherePackage(packageJsonPath: string): Promise<boolean> {
    try {
      const packageJson = await this.readPackageJson(packageJsonPath);
      return packageJson.name === 'ccanywhere';
    } catch {
      return false;
    }
  }

  /**
   * Check if this is a global npm installation
   */
  static async isGlobalInstall(): Promise<boolean> {
    try {
      // Method 1: Check npm_config_global environment variable
      if (process.env.npm_config_global === 'true') {
        return true;
      }

      // Method 2: Check if npm_config_prefix is set (indicates global install)
      if (process.env.npm_config_prefix) {
        return true;
      }

      // Method 3: Check the installation path
      // Global installs typically go to specific directories
      const currentPath = process.cwd();
      const globalPaths = [
        '/usr/local/lib/node_modules',
        '/usr/lib/node_modules', 
        path.join(require('os').homedir(), '.npm-global'),
        path.join(require('os').homedir(), 'AppData/Roaming/npm') // Windows
      ];

      // Check if current path contains any global path patterns
      for (const globalPath of globalPaths) {
        if (currentPath.includes('node_modules') && 
            (currentPath.includes(globalPath) || currentPath.includes('global'))) {
          return true;
        }
      }

      // Method 4: Try to detect via npm command (if available)
      try {
        const { execSync } = await import('child_process');
        const npmRoot = execSync('npm root -g', { encoding: 'utf8', stdio: 'pipe' }).trim();
        if (currentPath.includes(npmRoot)) {
          return true;
        }
      } catch {
        // npm command not available or failed, continue with other methods
      }

      // Method 5: Check for specific environment indicators
      const envIndicators = [
        'npm_config_user_config',
        'npm_config_globalconfig',
        'npm_config_global_style'
      ];

      for (const indicator of envIndicators) {
        if (process.env[indicator]) {
          return true;
        }
      }

      return false;
    } catch (error) {
      // On error, assume local install to be safe
      console.log(chalk.gray(`Warning: Could not determine install type: ${error instanceof Error ? error.message : String(error)}`));
      return false;
    }
  }
}