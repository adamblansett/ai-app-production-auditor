import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { runAudit } from '../../src/core/engine.js';
import { formatJsonReport } from '../../src/reporters/json-reporter.js';
import { formatMarkdownReport } from '../../src/reporters/markdown-reporter.js';
import { formatTerminalReport } from '../../src/reporters/terminal-reporter.js';

describe('AST Analysis Integration & Robustness', () => {
  let tempAppDir: string;

  beforeAll(() => {
    tempAppDir = fs.mkdtempSync(path.join(os.tmpdir(), 'auditor-ast-integration-'));
  });

  afterAll(() => {
    try {
      fs.rmSync(tempAppDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
  });

  it('ignores comments containing localhost, env variables, secrets, and insecure TLS without false positives', async () => {
    const testDir = path.join(tempAppDir, 'comment-heavy-app');
    fs.mkdirSync(path.join(testDir, 'src'), { recursive: true });

    // package.json and valid .env.example
    fs.writeFileSync(
      path.join(testDir, 'package.json'),
      JSON.stringify({
        name: 'comment-heavy-app',
        version: '1.0.0',
        scripts: {
          test: 'vitest run',
          build: 'tsc',
          lint: 'eslint .',
          typecheck: 'tsc --noEmit',
        },
      }),
    );
    fs.writeFileSync(path.join(testDir, '.env.example'), 'DATABASE_URL=postgres://...\n');

    // Source code where problematic patterns are ONLY inside comments
    const sourceWithComments = `
      // Note: for local development you can connect to http://localhost:8080
      /*
       * Remember to check process.env.UNMAPPED_ENV_KEY before deployment
       * NEXT_PUBLIC_DATABASE_PASSWORD = "insecure-password"
       * process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
       * rejectUnauthorized: false
       */
      export const serverUrl = "https://api.example.com";
      export const db = process.env.DATABASE_URL;
    `;
    fs.writeFileSync(path.join(testDir, 'src', 'index.ts'), sourceWithComments);

    const report = await runAudit(testDir);

    // No false positive findings should be produced from comments
    const urlFindings = report.findings.filter((f) => f.ruleId === 'URL001');
    const envFindings = report.findings.filter((f) => f.ruleId === 'ENV001');
    const tlsFindings = report.findings.filter((f) => f.ruleId === 'CFG001');
    const clientSecretFindings = report.findings.filter((f) => f.ruleId === 'CFG002');
    const indexFindings = report.findings.filter((f) => f.file?.includes('index.ts'));

    expect(urlFindings).toHaveLength(0);
    expect(envFindings).toHaveLength(0);
    expect(tlsFindings).toHaveLength(0);
    expect(clientSecretFindings).toHaveLength(0);
    expect(indexFindings).toHaveLength(0);
  });

  it('detects genuine AST-level TLS insecurity and client-exposed secrets', async () => {
    const testDir = path.join(tempAppDir, 'ast-security-app');
    fs.mkdirSync(path.join(testDir, 'src'), { recursive: true });

    fs.writeFileSync(
      path.join(testDir, 'package.json'),
      JSON.stringify({
        name: 'ast-security-app',
        version: '1.0.0',
        scripts: { test: 'vitest run', build: 'tsc' },
      }),
    );

    const insecureCode = `
      import https from 'https';

      // Genuine TLS vulnerability
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

      // Genuine agent TLS vulnerability
      export const customAgent = new https.Agent({
        rejectUnauthorized: false
      });

      // Genuine client-exposed secret
      export const NEXT_PUBLIC_FIREBASE_API_KEY_SECRET = "AIzaSySecretKey";
    `;
    fs.writeFileSync(path.join(testDir, 'src', 'client.ts'), insecureCode);

    const report = await runAudit(testDir);

    const tlsFindings = report.findings.filter((f) => f.ruleId === 'CFG001');
    const clientSecretFindings = report.findings.filter((f) => f.ruleId === 'CFG002');

    expect(tlsFindings.length).toBeGreaterThanOrEqual(2);
    expect(clientSecretFindings).toHaveLength(1);
    expect(clientSecretFindings[0]?.message).toContain('NEXT_PUBLIC_FIREBASE_API_KEY_SECRET');
  });

  it('handles syntax errors gracefully without crashing and records diagnostics in skippedFiles', async () => {
    const testDir = path.join(tempAppDir, 'syntax-error-app');
    fs.mkdirSync(path.join(testDir, 'src'), { recursive: true });

    fs.writeFileSync(
      path.join(testDir, 'package.json'),
      JSON.stringify({
        name: 'syntax-error-app',
        version: '1.0.0',
        scripts: { test: 'vitest run', build: 'tsc' },
      }),
    );

    // Intentionally broken syntax
    fs.writeFileSync(
      path.join(testDir, 'src', 'broken.ts'),
      'const a = ;;; function ( { return ???',
    );

    // Valid file in the same project
    fs.writeFileSync(
      path.join(testDir, 'src', 'valid.ts'),
      'export const validUrl = "http://localhost:4000";',
    );

    // The audit must complete successfully without throwing
    const report = await runAudit(testDir);

    expect(report).toBeDefined();
    // The broken file's diagnostic should be logged in skippedFiles
    const brokenSkipped = report.skippedFiles.find((s) => s.path.includes('broken.ts'));
    expect(brokenSkipped).toBeDefined();
    expect(brokenSkipped?.reason.toLowerCase()).toContain('syntax');

    // The valid file should still be analyzed correctly
    const localhostFinding = report.findings.find(
      (f) => f.ruleId === 'URL001' && f.file?.includes('valid.ts'),
    );
    expect(localhostFinding).toBeDefined();
    expect(localhostFinding?.line).toBe(1);
  });

  it('formats AST findings accurately in JSON, Markdown, and Terminal reports', async () => {
    const testDir = path.join(tempAppDir, 'report-format-app');
    fs.mkdirSync(path.join(testDir, 'src'), { recursive: true });

    fs.writeFileSync(
      path.join(testDir, 'package.json'),
      JSON.stringify({
        name: 'report-format-app',
        version: '1.0.0',
        scripts: { test: 'vitest run' },
      }),
    );

    fs.writeFileSync(
      path.join(testDir, 'src', 'app.ts'),
      'export const backend = "http://localhost:5000";\n',
    );

    const report = await runAudit(testDir);

    // 1. JSON Report
    const jsonOutput = formatJsonReport(report);
    const parsedJson = JSON.parse(jsonOutput);
    expect(parsedJson.summary.totalFindings).toBeGreaterThan(0);
    expect(parsedJson.findings[0].file).toBe('src/app.ts');
    expect(parsedJson.findings[0].line).toBe(1);

    // 2. Markdown Report
    const mdOutput = formatMarkdownReport(report);
    expect(mdOutput).toContain('# Production Readiness Audit Report');
    expect(mdOutput).toContain('URL001');
    expect(mdOutput).toContain('src/app.ts');

    // 3. Terminal Report
    const textOutput = formatTerminalReport(report);
    expect(textOutput).toContain('AI APP PRODUCTION AUDITOR');
    expect(textOutput).toContain('URL001');
    expect(textOutput).toContain('src/app.ts:1');
  });

  it('guarantees zero duplicate findings between AST analysis and non-script regex fallbacks', async () => {
    const testDir = path.join(tempAppDir, 'dedup-app');
    fs.mkdirSync(path.join(testDir, 'src'), { recursive: true });

    fs.writeFileSync(
      path.join(testDir, 'package.json'),
      JSON.stringify({
        name: 'dedup-app',
        version: '1.0.0',
        scripts: { test: 'vitest run' },
      }),
    );

    // TypeScript script file
    fs.writeFileSync(
      path.join(testDir, 'src', 'index.ts'),
      'export const url = "http://127.0.0.1:3000";\n',
    );

    // Non-script configuration file (YAML)
    fs.writeFileSync(path.join(testDir, 'config.yaml'), 'server:\n  url: http://127.0.0.1:3000\n');

    const report = await runAudit(testDir);
    const urlFindings = report.findings.filter((f) => f.ruleId === 'URL001');

    // One finding for index.ts (AST) and one finding for config.yaml (regex)
    expect(urlFindings).toHaveLength(2);

    const tsFindings = urlFindings.filter((f) => f.file === 'src/index.ts');
    const yamlFindings = urlFindings.filter((f) => f.file === 'config.yaml');

    expect(tsFindings).toHaveLength(1);
    expect(yamlFindings).toHaveLength(1);
  });

  it('does not flag external subdomains like localhost.example.com or 127.0.0.1.nip.io during project audit', async () => {
    const testDir = path.join(tempAppDir, 'subdomain-app');
    fs.mkdirSync(path.join(testDir, 'src'), { recursive: true });

    fs.writeFileSync(
      path.join(testDir, 'package.json'),
      JSON.stringify({
        name: 'subdomain-app',
        version: '1.0.0',
        scripts: { test: 'vitest run' },
      }),
    );

    fs.writeFileSync(
      path.join(testDir, 'src', 'api.ts'),
      'export const staging = "http://localhost.example.com";\nexport const nip = "http://127.0.0.1.nip.io";\n',
    );

    const report = await runAudit(testDir);
    const urlFindings = report.findings.filter((f) => f.ruleId === 'URL001');

    expect(urlFindings).toHaveLength(0);
  });

  it('does not report destructuring rest property as an undeclared environment variable during project audit', async () => {
    const testDir = path.join(tempAppDir, 'destruct-rest-app');
    fs.mkdirSync(path.join(testDir, 'src'), { recursive: true });

    fs.writeFileSync(
      path.join(testDir, 'package.json'),
      JSON.stringify({
        name: 'destruct-rest-app',
        version: '1.0.0',
        scripts: { test: 'vitest run' },
      }),
    );

    fs.writeFileSync(
      path.join(testDir, '.env.example'),
      'PORT=3000\nDATABASE_URL=postgres://...\n',
    );

    fs.writeFileSync(
      path.join(testDir, 'src', 'config.ts'),
      'export const { PORT, DATABASE_URL, ...rest } = process.env;\n',
    );

    const report = await runAudit(testDir);
    const envFindings = report.findings.filter((f) => f.ruleId === 'ENV001');

    // No finding should be emitted for 'rest'
    expect(envFindings).toHaveLength(0);
  });
});
