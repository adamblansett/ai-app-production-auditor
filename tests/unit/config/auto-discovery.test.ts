import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { loadConfig } from '../../../src/config/loader.js';

describe('Configuration Auto-Discovery', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'auditor-config-discovery-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('discovers and loads config from .auditorrc', () => {
    const configData = {
      schemaVersion: 1,
      severityThreshold: 'medium',
      ignorePaths: ['legacy/'],
    };
    fs.writeFileSync(path.join(tmpDir, '.auditorrc'), JSON.stringify(configData));

    const result = loadConfig(tmpDir);
    expect(result.configFilePath).toBe(path.join(tmpDir, '.auditorrc'));
    expect(result.config.severityThreshold).toBe('medium');
    expect(result.config.ignorePaths).toEqual(['legacy/']);
  });

  it('discovers and loads config from "auditor" key in package.json', () => {
    const pkgData = {
      name: 'discovered-app',
      version: '1.0.0',
      auditor: {
        schemaVersion: 1,
        severityThreshold: 'low',
        rules: {
          URL001: { enabled: false },
        },
      },
    };
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify(pkgData));

    const result = loadConfig(tmpDir);
    expect(result.configFilePath).toBe(path.join(tmpDir, 'package.json'));
    expect(result.config.severityThreshold).toBe('low');
    expect(result.config.rules?.['URL001']?.enabled).toBe(false);
  });
});
