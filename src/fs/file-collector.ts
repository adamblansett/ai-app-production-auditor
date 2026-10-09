import fs from 'node:fs';
import path from 'node:path';
import { normalizePath, isBinaryFile } from './path-utils.js';
import type { ScanLimits } from '../core/limits.js';
import { DEFAULT_LIMITS } from '../core/limits.js';

export interface CollectedFile {
  readonly relativePath: string;
  readonly absolutePath: string;
  readonly size: number;
  readonly extension: string;
}

export interface SkippedFile {
  readonly path: string;
  readonly reason: string;
}

export interface FileCollectionResult {
  readonly files: readonly CollectedFile[];
  readonly skippedFiles: readonly SkippedFile[];
  getFileContent(relativePath: string): string | null;
  hasFile(relativePath: string): boolean;
}

const DEFAULT_IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  '.nuxt',
  '.output',
  'coverage',
  'vendor',
  '.turbo',
  '.cache',
  'out',
]);

export interface CollectFilesOptions {
  limits?: ScanLimits;
  ignorePaths?: readonly string[];
  followSymlinks?: boolean;
}

export function collectFiles(
  rootDir: string,
  options: CollectFilesOptions = {},
): FileCollectionResult {
  const limits = options.limits ?? DEFAULT_LIMITS;
  const userIgnores = new Set(options.ignorePaths ?? []);
  const followSymlinks = options.followSymlinks ?? false;

  const collected: CollectedFile[] = [];
  const skipped: SkippedFile[] = [];
  const contentCache = new Map<string, string | null>();
  const fileSet = new Set<string>();

  function walk(currentDir: string): void {
    if (collected.length >= limits.maxFiles) {
      skipped.push({
        path: normalizePath(path.relative(rootDir, currentDir)),
        reason: `Scan limit reached: maximum file count of ${limits.maxFiles} exceeded`,
      });
      return;
    }

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch (err) {
      skipped.push({
        path: normalizePath(path.relative(rootDir, currentDir)),
        reason: `Failed to read directory: ${err instanceof Error ? err.message : String(err)}`,
      });
      return;
    }

    // Sort entries for deterministic scanning order
    entries.sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      const relPath = normalizePath(path.relative(rootDir, fullPath));

      if (userIgnores.has(relPath) || userIgnores.has(entry.name)) {
        skipped.push({ path: relPath, reason: 'Matched user ignore rule' });
        continue;
      }

      // Check for symbolic links
      if (entry.isSymbolicLink()) {
        if (!followSymlinks) {
          skipped.push({ path: relPath, reason: 'Symbolic links are not followed by default' });
          continue;
        }
      }

      if (entry.isDirectory()) {
        if (DEFAULT_IGNORED_DIRS.has(entry.name)) {
          // Ignored directory
          continue;
        }
        walk(fullPath);
      } else if (entry.isFile()) {
        if (collected.length >= limits.maxFiles) {
          skipped.push({
            path: relPath,
            reason: `Scan limit reached: maximum file count of ${limits.maxFiles} exceeded`,
          });
          continue;
        }

        try {
          const stats = fs.statSync(fullPath);
          if (stats.size > limits.maxFileSizeBytes) {
            skipped.push({
              path: relPath,
              reason: `File size ${stats.size} bytes exceeds maximum allowed size of ${limits.maxFileSizeBytes} bytes`,
            });
            continue;
          }

          if (isBinaryFile(fullPath)) {
            skipped.push({
              path: relPath,
              reason: 'Binary file skipped from static analysis',
            });
            continue;
          }

          const ext = path.extname(entry.name).toLowerCase();
          collected.push({
            relativePath: relPath,
            absolutePath: fullPath,
            size: stats.size,
            extension: ext,
          });
          fileSet.add(relPath);
        } catch (err) {
          skipped.push({
            path: relPath,
            reason: `Failed to stat file: ${err instanceof Error ? err.message : String(err)}`,
          });
        }
      }
    }
  }

  walk(rootDir);

  function getFileContent(relativePath: string): string | null {
    const normalized = normalizePath(relativePath);
    if (contentCache.has(normalized)) {
      return contentCache.get(normalized) ?? null;
    }

    const fullPath = path.join(rootDir, normalized);
    try {
      if (!fs.existsSync(fullPath)) {
        contentCache.set(normalized, null);
        return null;
      }
      const stats = fs.statSync(fullPath);
      if (stats.size > limits.maxFileSizeBytes) {
        contentCache.set(normalized, null);
        return null;
      }
      const content = fs.readFileSync(fullPath, 'utf8');
      contentCache.set(normalized, content);
      return content;
    } catch {
      contentCache.set(normalized, null);
      return null;
    }
  }

  function hasFile(relativePath: string): boolean {
    const normalized = normalizePath(relativePath);
    return fileSet.has(normalized) || fs.existsSync(path.join(rootDir, normalized));
  }

  return {
    files: collected,
    skippedFiles: skipped,
    getFileContent,
    hasFile,
  };
}
