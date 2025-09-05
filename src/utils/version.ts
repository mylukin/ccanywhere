import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let cachedVersion: string | null = null;
let cachedPackageInfo: { name: string; version: string } | null = null;

function loadPackageInfo(): { name: string; version: string } {
  if (cachedPackageInfo) {
    return cachedPackageInfo;
  }

  try {
    const packageJsonPath = join(__dirname, '../../package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    cachedPackageInfo = {
      name: packageJson.name || 'ccanywhere',
      version: packageJson.version || '0.0.0'
    };
    return cachedPackageInfo;
  } catch (error) {
    console.error('Failed to load package.json:', error);
    return { name: 'ccanywhere', version: '0.0.0' };
  }
}

export function getVersion(): string {
  if (cachedVersion) {
    return cachedVersion;
  }
  cachedVersion = loadPackageInfo().version;
  return cachedVersion;
}

export function getPackageName(): string {
  return loadPackageInfo().name;
}

export function getUserAgent(): string {
  const { version } = loadPackageInfo();
  // Always use CCanywhere regardless of the actual package name for consistency
  const normalizedName = 'CCanywhere';
  return `${normalizedName}/${version}`;
}

export function getFullVersion(): string {
  const { name, version } = loadPackageInfo();
  return `${name}@${version}`;
}