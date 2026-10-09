import path from 'node:path';
import fs from 'node:fs';

/**
 * Normalizes relative paths to use standard forward slashes.
 */
export function normalizePath(filePath: string): string {
  return filePath.split(path.sep).join('/');
}

/**
 * Ensures that a target path is safely resolved within an allowed root,
 * preventing directory traversal attacks.
 */
export function isPathInside(targetPath: string, parentDir: string): boolean {
  const relative = path.relative(parentDir, targetPath);
  return !relative.startsWith('..') && !path.isAbsolute(relative);
}

/**
 * Verifies that a path exists, is a directory, and is accessible.
 */
export function validateDirectory(targetDir: string): {
  valid: boolean;
  resolvedPath: string;
  error?: string;
} {
  try {
    const resolved = path.resolve(targetDir);
    if (!fs.existsSync(resolved)) {
      return {
        valid: false,
        resolvedPath: resolved,
        error: `Directory does not exist: ${targetDir}`,
      };
    }

    const stats = fs.statSync(resolved);
    if (!stats.isDirectory()) {
      return {
        valid: false,
        resolvedPath: resolved,
        error: `Path is not a directory: ${targetDir}`,
      };
    }

    // Test readability
    fs.readdirSync(resolved);

    return { valid: true, resolvedPath: resolved };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      valid: false,
      resolvedPath: path.resolve(targetDir),
      error: `Cannot access directory: ${message}`,
    };
  }
}

/**
 * Checks if a file appears to be a binary file by inspecting initial bytes for null characters.
 */
export function isBinaryFile(filePath: string): boolean {
  try {
    const buffer = Buffer.alloc(512);
    const fd = fs.openSync(filePath, 'r');
    const bytesRead = fs.readSync(fd, buffer, 0, 512, 0);
    fs.closeSync(fd);

    for (let i = 0; i < bytesRead; i++) {
      if (buffer[i] === 0) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}
