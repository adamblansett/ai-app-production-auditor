import { describe, it, expect } from 'vitest';
import { formatSarifReport } from '../../../src/reporters/sarif-reporter.js';
import type { AuditReport } from '../../../src/models/report.js';

describe('formatSarifReport', () => {
  const sampleReport: AuditReport = {
    schemaVersion: '1.0.0',
    tool: {
      name: 'ai-app-production-auditor',
      version: '0.1.0',
      author: 'Adam Blansett',
      homepage: 'https://adamblansett.com',
    },
    scan: {
      timestamp: '2026-10-09T00:00:00.000Z',
      targetDirectory: '/workspace',
      durationMs: 42,
    },
    project: {
      name: 'test-project',
      version: '1.0.0',
      type: 'typescript',
      frameworks: [],
      tools: [],
      isMonorepo: false,
      packageCount: 1,
      hasPackageJson: true,
    },
    summary: {
      totalFindings: 2,
      critical: 1,
      high: 1,
      medium: 0,
      low: 0,
      info: 0,
      passedChecks: 7,
      failedChecks: 0,
      skippedChecks: 0,
      filesScanned: 10,
      durationMs: 42,
      suppressedFindings: 0,
    },
    findings: [
      {
        id: 'SEC001-f1-L10:C5-abc',
        ruleId: 'SEC001',
        title: 'Hardcoded secret detected',
        severity: 'critical',
        category: 'security',
        message: 'AWS key detected',
        evidence: 'AKIA****',
        file: 'src/config.ts',
        line: 10,
        column: 5,
        remediation: 'Remove the secret',
        confidence: 'high',
        documentationUrl: 'https://example.com/sec001',
      },
      {
        id: 'URL001-f2-L20:C1-def',
        ruleId: 'URL001',
        title: 'Hardcoded localhost URL',
        severity: 'medium',
        category: 'configuration',
        message: 'Localhost URL found',
        evidence: 'http://localhost:3000',
        file: 'src/api.ts',
        line: 20,
        column: 1,
        remediation: 'Use env var',
        confidence: 'high',
        documentationUrl: null,
      },
    ],
    checks: [
      {
        id: 'SEC001',
        name: 'Secrets Check',
        description: 'Scans for hardcoded secrets',
        status: 'completed',
      },
    ],
    skippedFiles: [],
    fixesApplied: [],
  };

  it('outputs valid JSON conforming to SARIF v2.1.0 schema', () => {
    const output = formatSarifReport(sampleReport);
    const parsed = JSON.parse(output);

    expect(parsed.version).toBe('2.1.0');
    expect(parsed.$schema).toContain('sarif-schema-2.1.0.json');
    expect(parsed.runs).toHaveLength(1);

    const run = parsed.runs[0]!;
    expect(run.tool.driver.name).toBe('ai-app-production-auditor');
    expect(run.tool.driver.rules.length).toBeGreaterThanOrEqual(1);

    expect(run.results).toHaveLength(2);
    // Critical maps to error
    expect(run.results[0]!.level).toBe('error');
    expect(run.results[0]!.locations[0]!.physicalLocation.artifactLocation.uri).toBe(
      'src/config.ts',
    );
    expect(run.results[0]!.locations[0]!.physicalLocation.region.startLine).toBe(10);

    // Medium maps to warning
    expect(run.results[1]!.level).toBe('warning');
    expect(run.results[1]!.locations[0]!.physicalLocation.artifactLocation.uri).toBe('src/api.ts');
    expect(run.results[1]!.locations[0]!.physicalLocation.region.startLine).toBe(20);
  });
});
