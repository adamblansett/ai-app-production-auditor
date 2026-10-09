import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { loadConfig, DEFAULT_CONFIG } from '../../../src/config/loader.js';

describe('Configuration Loader & Schema Validation', () => {
  let tempDir: string;

  beforeAll(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'auditor-cfg-test-'));
  });

  afterAll(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
  });

  it('returns default config when no configuration file exists', () => {
    const result = loadConfig(tempDir);
    expect(result.config).toEqual(DEFAULT_CONFIG);
    expect(result.configFilePath).toBeNull();
  });

  it('loads and validates valid .auditorrc.json in target directory', () => {
    const cfgPath = path.join(tempDir, '.auditorrc.json');
    fs.writeFileSync(
      cfgPath,
      JSON.stringify({
        schemaVersion: 1,
        severityThreshold: 'medium',
        rules: {
          URL001: { enabled: false },
        },
        ignorePaths: ['legacy/**'],
      }),
    );

    const result = loadConfig(tempDir);
    expect(result.configFilePath).toBe(cfgPath);
    expect(result.config.severityThreshold).toBe('medium');
    expect(result.config.rules?.['URL001']?.enabled).toBe(false);
    expect(result.config.ignorePaths).toContain('legacy/**');

    fs.unlinkSync(cfgPath);
  });

  it('throws an error when explicit config path does not exist', () => {
    expect(() => loadConfig(tempDir, path.join(tempDir, 'nonexistent.json'))).toThrow(
      'Configuration file not found',
    );
  });

  it('throws a descriptive error when config contains malformed JSON syntax', () => {
    const brokenPath = path.join(tempDir, 'broken.json');
    fs.writeFileSync(brokenPath, '{ "schemaVersion": 1, '); // missing closing brace

    expect(() => loadConfig(tempDir, brokenPath)).toThrow('Malformed JSON');

    fs.unlinkSync(brokenPath);
  });

  it('throws a schema validation error when config has invalid property values', () => {
    const invalidPath = path.join(tempDir, 'invalid-schema.json');
    fs.writeFileSync(
      invalidPath,
      JSON.stringify({
        schemaVersion: 1,
        severityThreshold: 'not-a-real-severity',
      }),
    );

    expect(() => loadConfig(tempDir, invalidPath)).toThrow('Invalid configuration');

    fs.unlinkSync(invalidPath);
  });
});
