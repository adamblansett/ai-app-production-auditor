import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { formatTerminalReport } from '../../../src/reporters/terminal-reporter.js';
import { formatMarkdownReport } from '../../../src/reporters/markdown-reporter.js';
import { formatJsonReport } from '../../../src/reporters/json-reporter.js';
import { writeReportToFile } from '../../../src/reporters/writer.js';
import { createFinding } from '../../../src/models/finding.js';
import type { AuditReport } from '../../../src/models/report.js';

describe('Report Generators and Serializers', () => {
  let tempDir: string;

  beforeAll(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'auditor-report-test-'));
  });

  afterAll(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
  });

  const sampleReport: AuditReport = {
    schemaVersion: '1.0.0',
    tool: {
      name: 'ai-app-production-auditor',
      version: '0.1.0',
      author: 'Adam Blansett',
      homepage: 'https://adamblansett.com',
    },
    scan: {
      timestamp: '2026-10-09T20:00:00.000Z',
      targetDirectory: '/projects/my-app',
      durationMs: 42,
    },
    project: {
      name: 'my-app',
      version: '1.0.0',
      type: 'typescript',
      frameworks: ['React', 'Next.js'],
      tools: ['Vitest'],
      isMonorepo: false,
      packageCount: 1,
      hasPackageJson: true,
    },
    summary: {
      totalFindings: 1,
      critical: 0,
      high: 0,
      medium: 1,
      low: 0,
      info: 0,
      passedChecks: 7,
      failedChecks: 0,
      skippedChecks: 0,
      filesScanned: 10,
      durationMs: 42,
    },
    findings: [
      createFinding({
        ruleId: 'URL001',
        title: 'Hardcoded localhost URL in source',
        severity: 'medium',
        category: 'configuration',
        message: 'Endpoint targets localhost:3000 directly.',
        evidence: 'const url = "http://localhost:3000"; // Test with Unicode: 🚀 & quotes \'"',
        file: 'src/api.ts',
        line: 5,
        column: 12,
        remediation: 'Use process.env.API_URL instead.',
        confidence: 'high',
      }),
    ],
    checks: [
      {
        id: 'URL001',
        name: 'Hardcoded Localhost URL Check',
        description: 'Detects localhost in source',
        status: 'completed',
      },
    ],
    skippedFiles: [
      {
        path: 'src/large.bin',
        reason: 'Binary file skipped',
      },
    ],
  };

  it('generates readable terminal output', () => {
    const text = formatTerminalReport(sampleReport, true);
    expect(text).toContain('AI APP PRODUCTION AUDITOR');
    expect(text).toContain('my-app');
    expect(text).toContain('URL001');
    expect(text).toContain('src/api.ts:5:12');
    expect(text).toContain('CHECKS BREAKDOWN');
  });

  it('generates valid Markdown report with tables and evidence blocks', () => {
    const markdown = formatMarkdownReport(sampleReport);
    expect(markdown).toContain('# Production Readiness Audit Report');
    expect(markdown).toContain('| **Total Findings** | **1** |');
    expect(markdown).toContain('#### [URL001] Hardcoded localhost URL in source');
    expect(markdown).toContain('`src/api.ts:5:12`');
    expect(markdown).toContain('🚀');
  });

  it('generates valid JSON report escaping Unicode, quotes, and special characters', () => {
    const jsonStr = formatJsonReport(sampleReport);
    expect(() => JSON.parse(jsonStr)).not.toThrow();

    const parsed = JSON.parse(jsonStr);
    expect(parsed.schemaVersion).toBe('1.0.0');
    expect(parsed.findings[0].evidence).toContain('🚀');
    expect(parsed.findings[0].evidence).toContain('quotes \'"');
  });

  it('writeReportToFile prevents accidental overwrite unless force is set', () => {
    const reportPath = path.join(tempDir, 'test-report.md');
    fs.writeFileSync(reportPath, 'Initial content');

    expect(() =>
      writeReportToFile({
        outputPath: reportPath,
        content: 'New content',
        force: false,
      }),
    ).toThrow('Output file already exists');

    // With force: true, overwrite succeeds
    writeReportToFile({
      outputPath: reportPath,
      content: 'New content',
      force: true,
    });

    expect(fs.readFileSync(reportPath, 'utf8')).toBe('New content');
  });
});
