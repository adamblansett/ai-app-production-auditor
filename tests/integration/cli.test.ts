import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { runCli } from '../../src/cli.js';
import { ExitCode } from '../../src/cli/exit-codes.js';

describe('CLI Integration & Execution', () => {
  const fixturesDir = path.resolve(__dirname, '../../fixtures');
  let tempDir: string;

  beforeAll(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'auditor-cli-test-'));
  });

  afterAll(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
  });

  it('exits with OK (0) on healthy-app', async () => {
    const code = await runCli(['node', 'cli.js', path.join(fixturesDir, 'healthy-app')]);
    expect(code).toBe(ExitCode.OK);
  });

  it('exits with OK (0) on localhost-app when severity threshold is high', async () => {
    const code = await runCli([
      'node',
      'cli.js',
      path.join(fixturesDir, 'localhost-app'),
      '--severity',
      'high',
    ]);
    expect(code).toBe(ExitCode.OK);
  });

  it('exits with FAILURE (1) on localhost-app when severity threshold is medium', async () => {
    const code = await runCli([
      'node',
      'cli.js',
      path.join(fixturesDir, 'localhost-app'),
      '--severity',
      'medium',
    ]);
    expect(code).toBe(ExitCode.FAILURE);
  });

  it('returns INVALID_CONFIG_OR_USAGE (2) on invalid format option', async () => {
    const code = await runCli([
      'node',
      'cli.js',
      path.join(fixturesDir, 'healthy-app'),
      '--format',
      'unsupported-format',
    ]);
    expect(code).toBe(ExitCode.INVALID_CONFIG_OR_USAGE);
  });

  it('returns INVALID_CONFIG_OR_USAGE (2) on invalid severity threshold', async () => {
    const code = await runCli([
      'node',
      'cli.js',
      path.join(fixturesDir, 'healthy-app'),
      '--severity',
      'invalid-level',
    ]);
    expect(code).toBe(ExitCode.INVALID_CONFIG_OR_USAGE);
  });

  it('returns OPERATIONAL_ERROR (3) on nonexistent target directory', async () => {
    const code = await runCli(['node', 'cli.js', path.join(tempDir, 'does-not-exist-at-all')]);
    expect(code).toBe(ExitCode.OPERATIONAL_ERROR);
  });

  it('writes output report to file and enforces overwrite protection', async () => {
    const outPath = path.join(tempDir, 'cli-report.json');

    // First write should succeed
    const code1 = await runCli([
      'node',
      'cli.js',
      path.join(fixturesDir, 'healthy-app'),
      '--format',
      'json',
      '--output',
      outPath,
    ]);
    expect(code1).toBe(ExitCode.OK);
    expect(fs.existsSync(outPath)).toBe(true);

    const reportContent = fs.readFileSync(outPath, 'utf8');
    const parsed = JSON.parse(reportContent);
    expect(parsed.project.name).toBe('healthy-sample-app');

    // Second write without force should fail with operational error
    const code2 = await runCli([
      'node',
      'cli.js',
      path.join(fixturesDir, 'healthy-app'),
      '--format',
      'json',
      '--output',
      outPath,
    ]);
    expect(code2).toBe(ExitCode.OPERATIONAL_ERROR);

    // Third write with force should succeed
    const code3 = await runCli([
      'node',
      'cli.js',
      path.join(fixturesDir, 'healthy-app'),
      '--format',
      'json',
      '--output',
      outPath,
      '--force',
    ]);
    expect(code3).toBe(ExitCode.OK);
  });

  it('handles paths with spaces and Unicode safely', async () => {
    const spaceDir = path.join(tempDir, 'app with spaces and 🚀 unicode');
    fs.mkdirSync(path.join(spaceDir, 'src'), { recursive: true });
    fs.writeFileSync(
      path.join(spaceDir, 'package.json'),
      JSON.stringify({
        name: 'unicode-app',
        scripts: { build: 'tsc', test: 'vitest run' },
      }),
    );
    fs.writeFileSync(path.join(spaceDir, '.gitignore'), 'node_modules\n.env\n');

    const code = await runCli(['node', 'cli.js', spaceDir]);
    expect(code).toBe(ExitCode.OK);
  });
});
