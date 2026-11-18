import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { applyRemediations } from '../../../src/core/fixer.js';
import { createFinding } from '../../../src/models/finding.js';
import type { RuleContext } from '../../../src/models/rule.js';
import { SourceAnalyzer } from '../../../src/analysis/source-analysis.js';
import type { FileCollectionResult } from '../../../src/fs/file-collector.js';

describe('applyRemediations (--fix)', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'auditor-fix-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function createMockContext(files: Record<string, string>): RuleContext {
    const fileCollection: FileCollectionResult = {
      files: Object.keys(files).map((p) => ({
        relativePath: p,
        absolutePath: path.join(tmpDir, p),
        extension: path.extname(p),
        size: files[p]!.length,
      })),
      skippedFiles: [],
      getFileContent: (p: string) => files[p] ?? null,
      hasFile: (p: string) => p in files,
    };

    const analyzer = new SourceAnalyzer(fileCollection);

    return {
      targetDir: tmpDir,
      project: {
        name: 'test-app',
        version: '1.0.0',
        type: 'typescript',
        frameworks: [],
        tools: [],
        isMonorepo: false,
        packageCount: 1,
        hasPackageJson: true,
        packageJsonRaw: null,
      },
      files: fileCollection.files,
      config: {},
      getFileContent: (p) => files[p] ?? null,
      hasFile: (p) => p in files,
      analyzer,
    };
  }

  it('creates .env.example with discovered variables when ENV002 is present', () => {
    const files = {
      'src/config.ts':
        'export const api = process.env.API_KEY; export const db = process.env.DATABASE_URL;',
    };
    // Write the source file to tmpDir
    fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'src/config.ts'), files['src/config.ts']);

    const context = createMockContext(files);
    const findings = [
      createFinding({
        ruleId: 'ENV002',
        title: 'Missing .env.example',
        severity: 'medium',
        category: 'configuration',
        message: 'Missing .env.example',
        evidence: 'Source references API_KEY',
        remediation: 'Create .env.example',
      }),
    ];

    const fixes = applyRemediations(tmpDir, findings, context);

    expect(fixes.length).toBe(1);
    expect(fixes[0]!.ruleId).toBe('ENV002');

    const envExample = fs.readFileSync(path.join(tmpDir, '.env.example'), 'utf8');
    expect(envExample).toContain('API_KEY=');
    expect(envExample).toContain('DATABASE_URL=');
  });

  it('creates .gitignore with standard patterns when CFG003 is present', () => {
    const findings = [
      createFinding({
        ruleId: 'CFG003',
        title: 'Missing .gitignore',
        severity: 'medium',
        category: 'configuration',
        message: 'No .gitignore file found',
        evidence: 'Missing .gitignore',
        remediation: 'Create .gitignore',
      }),
    ];

    const fixes = applyRemediations(tmpDir, findings);

    expect(fixes.length).toBe(1);
    expect(fixes[0]!.ruleId).toBe('CFG003');

    const gitignore = fs.readFileSync(path.join(tmpDir, '.gitignore'), 'utf8');
    expect(gitignore).toContain('node_modules/');
    expect(gitignore).toContain('.env');
  });

  it('pins wildcard dependencies to the lockfile-resolved version when CFG004 is present', () => {
    const pkgJson = {
      name: 'my-app',
      dependencies: {
        express: '*',
        zod: '^3.23.0',
      },
    };
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify(pkgJson, null, 2));
    fs.writeFileSync(
      path.join(tmpDir, 'package-lock.json'),
      JSON.stringify({ packages: { 'node_modules/express': { version: '4.21.2' } } }),
    );

    const findings = [
      createFinding({
        ruleId: 'CFG004',
        title: 'Unpinned dependency express',
        severity: 'low',
        category: 'configuration',
        message: 'express has wildcard version',
        evidence: '"express": "*"',
        file: 'package.json',
        remediation: 'Pin express',
      }),
    ];

    const fixes = applyRemediations(tmpDir, findings);

    expect(fixes.length).toBe(1);
    expect(fixes[0]!.ruleId).toBe('CFG004');

    const updatedPkg = JSON.parse(fs.readFileSync(path.join(tmpDir, 'package.json'), 'utf8'));
    expect(updatedPkg.dependencies.express).toBe('^4.21.2');
    expect(updatedPkg.dependencies.zod).toBe('^3.23.0');
  });

  it('leaves wildcard dependencies unchanged when no resolved version is known', () => {
    const original = JSON.stringify({ name: 'my-app', dependencies: { express: '*' } }, null, 2);
    fs.writeFileSync(path.join(tmpDir, 'package.json'), original);

    const findings = [
      createFinding({
        ruleId: 'CFG004',
        title: 'Unpinned dependency express',
        severity: 'low',
        category: 'configuration',
        message: 'express has wildcard version',
        evidence: '"express": "*"',
        file: 'package.json',
        remediation: 'Pin express',
      }),
    ];

    const fixes = applyRemediations(tmpDir, findings);

    expect(fixes).toHaveLength(0);
    expect(fs.readFileSync(path.join(tmpDir, 'package.json'), 'utf8')).toBe(original);
  });
});
