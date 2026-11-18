import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { runCli } from '../../src/cli.js';

describe('CLI Enhancements (--format sarif and --fix)', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'auditor-cli-enhancements-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('generates valid SARIF report via -f sarif -o output.sarif', async () => {
    const pkg = {
      name: 'sarif-test',
      scripts: { build: 'echo 1', test: 'vitest', lint: 'eslint .' },
      devDependencies: { vitest: '^2.0.0', eslint: '^9.0.0' },
    };
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify(pkg, null, 2));
    fs.writeFileSync(path.join(tmpDir, '.gitignore'), 'node_modules\n.env\n');

    const sarifOutput = path.join(tmpDir, 'results.sarif');
    const code = await runCli(['node', 'cli.js', tmpDir, '-f', 'sarif', '-o', sarifOutput]);

    expect(code).toBe(0);
    expect(fs.existsSync(sarifOutput)).toBe(true);

    const sarifJson = JSON.parse(fs.readFileSync(sarifOutput, 'utf8'));
    expect(sarifJson.version).toBe('2.1.0');
    expect(sarifJson.runs[0]!.tool.driver.name).toBe('ai-app-production-auditor');
  });

  it('automatically remediates missing .env.example with --fix', async () => {
    const pkg = {
      name: 'fix-test',
      scripts: { build: 'echo 1', test: 'vitest', lint: 'eslint .' },
      devDependencies: { vitest: '^2.0.0', eslint: '^9.0.0' },
    };
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify(pkg, null, 2));
    fs.writeFileSync(
      path.join(tmpDir, 'index.ts'),
      'export const key = process.env.API_SECRET_KEY;',
    );

    expect(fs.existsSync(path.join(tmpDir, '.env.example'))).toBe(false);

    // Run with --fix
    await runCli(['node', 'cli.js', tmpDir, '--fix', '--severity', 'none']);

    expect(fs.existsSync(path.join(tmpDir, '.env.example'))).toBe(true);
    const envExample = fs.readFileSync(path.join(tmpDir, '.env.example'), 'utf8');
    expect(envExample).toContain('API_SECRET_KEY=');
  });
});
