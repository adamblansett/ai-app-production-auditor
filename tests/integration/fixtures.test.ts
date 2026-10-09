import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { runAudit } from '../../src/core/engine.js';

describe('Synthetic Fixture Applications Audit Integration', () => {
  const fixturesDir = path.resolve(__dirname, '../../fixtures');

  it('audits healthy-app and returns 0 findings', async () => {
    const report = await runAudit(path.join(fixturesDir, 'healthy-app'));
    expect(report.project.name).toBe('healthy-sample-app');
    expect(report.project.type).toBe('typescript');
    expect(report.project.frameworks).toContain('React');
    expect(report.project.tools).toContain('Vite');
    expect(report.summary.totalFindings).toBe(0);
    expect(report.findings).toHaveLength(0);
  });

  it('audits localhost-app and detects hardcoded localhost URL', async () => {
    const report = await runAudit(path.join(fixturesDir, 'localhost-app'));
    expect(report.project.name).toBe('localhost-sample-app');
    const urlFinding = report.findings.find((f) => f.ruleId === 'URL001');
    expect(urlFinding).toBeDefined();
    expect(urlFinding?.severity).toBe('medium');
    expect(urlFinding?.file).toBe('src/api.ts');
    expect(urlFinding?.line).toBe(1);
    expect(urlFinding?.evidence).toContain('http://localhost:3000/api/v1');
  });

  it('audits env-inconsistent-app and detects missing environment variable in .env.example', async () => {
    const report = await runAudit(path.join(fixturesDir, 'env-inconsistent-app'));
    const envFinding = report.findings.find((f) => f.ruleId === 'ENV001');
    expect(envFinding).toBeDefined();
    expect(envFinding?.title).toContain('AUTH_SECRET');
    expect(envFinding?.file).toBe('src/db.ts');
  });

  it('audits incomplete-test-app and detects default placeholder test script', async () => {
    const report = await runAudit(path.join(fixturesDir, 'incomplete-test-app'));
    const testFinding = report.findings.find((f) => f.ruleId === 'TST001');
    expect(testFinding).toBeDefined();
    expect(testFinding?.title).toContain('Default placeholder test script');
  });

  it('audits synthetic-credential-app and detects synthetic credentials with complete redaction', async () => {
    const report = await runAudit(path.join(fixturesDir, 'synthetic-credential-app'));
    const secretFindings = report.findings.filter((f) => f.ruleId === 'SEC001');
    expect(secretFindings.length).toBeGreaterThanOrEqual(2);

    for (const finding of secretFindings) {
      expect(finding.severity).toBe('critical');
      // Verify raw secrets are never exposed
      expect(finding.message).not.toContain('IOSFODNN7EXAMPLE');
      expect(finding.message).not.toContain('FakeSyntheticSecretTokenForTesting');
      expect(finding.evidence).not.toContain('IOSFODNN7EXAMPLE');
      expect(finding.evidence).not.toContain('FakeSyntheticSecretTokenForTesting');
      // Verify redaction asterisks are present
      expect(finding.evidence).toContain('****');
    }
  });

  it('audits malformed-config-app and gracefully reports malformed package.json', async () => {
    const report = await runAudit(path.join(fixturesDir, 'malformed-config-app'));
    const prjFinding = report.findings.find((f) => f.ruleId === 'PRJ001');
    expect(prjFinding).toBeDefined();
    expect(prjFinding?.severity).toBe('high');
    expect(prjFinding?.title).toContain('Malformed package.json');
  });

  it('audits monorepo-app and detects workspace structure with subpackages', async () => {
    const report = await runAudit(path.join(fixturesDir, 'monorepo-app'));
    expect(report.project.isMonorepo).toBe(true);
    expect(report.project.packageCount).toBeGreaterThanOrEqual(2);
    const monoFinding = report.findings.find((f) => f.ruleId === 'PRJ001');
    expect(monoFinding).toBeDefined();
    expect(monoFinding?.severity).toBe('info');
    expect(monoFinding?.message).toContain('monorepo workspace');
  });
});
