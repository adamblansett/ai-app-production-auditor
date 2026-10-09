import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { collectFiles } from '../../../src/fs/file-collector.js';

describe('File Collector & Safeguards', () => {
  let tempDir: string;

  beforeAll(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'auditor-fs-test-'));

    // Normal source file
    fs.mkdirSync(path.join(tempDir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(tempDir, 'src', 'app.ts'), 'export const x = 1;');

    // Ignored directory
    fs.mkdirSync(path.join(tempDir, 'node_modules'), { recursive: true });
    fs.writeFileSync(path.join(tempDir, 'node_modules', 'dep.js'), 'module.exports = {};');

    // Binary file (contains null byte)
    const binaryBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x00]);
    fs.writeFileSync(path.join(tempDir, 'src', 'image.png'), binaryBuffer);

    // Large file (exceeds 100 bytes for test)
    fs.writeFileSync(path.join(tempDir, 'src', 'large.txt'), 'A'.repeat(500));

    // Symlink file
    try {
      fs.symlinkSync(
        path.join(tempDir, 'src', 'app.ts'),
        path.join(tempDir, 'src', 'symlink-app.ts'),
      );
    } catch {
      // Symlinks might not be supported on some OS permissions, safely continue
    }
  });

  afterAll(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
  });

  it('collects normal files while skipping node_modules by default', () => {
    const result = collectFiles(tempDir);
    const paths = result.files.map((f) => f.relativePath);
    expect(paths).toContain('src/app.ts');
    expect(paths).not.toContain('node_modules/dep.js');
  });

  it('skips binary files from text analysis', () => {
    const result = collectFiles(tempDir);
    const paths = result.files.map((f) => f.relativePath);
    expect(paths).not.toContain('src/image.png');
    const skippedBinary = result.skippedFiles.find((s) => s.path === 'src/image.png');
    expect(skippedBinary).toBeDefined();
    expect(skippedBinary?.reason).toContain('Binary file');
  });

  it('skips files exceeding maxFileSizeBytes limit', () => {
    const result = collectFiles(tempDir, {
      limits: { maxFiles: 100, maxFileSizeBytes: 100 },
    });
    const paths = result.files.map((f) => f.relativePath);
    expect(paths).not.toContain('src/large.txt');
    const skippedLarge = result.skippedFiles.find((s) => s.path === 'src/large.txt');
    expect(skippedLarge).toBeDefined();
    expect(skippedLarge?.reason).toContain('exceeds maximum allowed size');
  });

  it('enforces maxFiles limit across scan', () => {
    const result = collectFiles(tempDir, {
      limits: { maxFiles: 1, maxFileSizeBytes: 10000 },
    });
    expect(result.files.length).toBeLessThanOrEqual(1);
    expect(result.skippedFiles.some((s) => s.reason.includes('Scan limit reached'))).toBe(true);
  });

  it('does not follow symlinks by default', () => {
    const symlinkPath = path.join(tempDir, 'src', 'symlink-app.ts');
    if (fs.existsSync(symlinkPath)) {
      const result = collectFiles(tempDir, { followSymlinks: false });
      const paths = result.files.map((f) => f.relativePath);
      expect(paths).not.toContain('src/symlink-app.ts');
      const skippedSymlink = result.skippedFiles.find((s) => s.path === 'src/symlink-app.ts');
      expect(skippedSymlink).toBeDefined();
      expect(skippedSymlink?.reason).toContain('Symbolic links');
    }
  });
});
