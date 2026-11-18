import { describe, it, expect } from 'vitest';
import { SecretDetectionRule } from '../../../src/rules/secret-detection.rule.js';
import type { RuleContext } from '../../../src/models/rule.js';
import { SourceAnalyzer } from '../../../src/analysis/source-analysis.js';
import type { FileCollectionResult } from '../../../src/fs/file-collector.js';

function createMockContext(files: Record<string, string>): RuleContext {
  const fileCollection: FileCollectionResult = {
    files: Object.keys(files).map((p) => ({
      relativePath: p,
      absolutePath: `/mock/${p}`,
      extension: p.slice(p.lastIndexOf('.')),
      size: files[p]!.length,
    })),
    skippedFiles: [],
    getFileContent: (p: string) => files[p] ?? null,
    hasFile: (p: string) => p in files,
  };

  const analyzer = new SourceAnalyzer(fileCollection);

  return {
    targetDir: '/mock',
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

describe('SecretDetectionRule (Extended Cloud & Security Signatures)', () => {
  const rule = new SecretDetectionRule();

  it('detects Google Gemini API key and redacts it', () => {
    const rawKey = ['AIzaSy', 'A1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q'].join('');
    const context = createMockContext({
      'src/gemini.ts': `const apiKey = "${rawKey}";`,
    });

    const result = rule.execute(context);
    const finding = result.findings.find((f) => f.title.includes('Google Cloud or Gemini'));
    expect(finding).toBeDefined();
    expect(finding!.evidence).not.toContain(rawKey);
    expect(finding!.evidence).toContain('AIza****');
  });

  it('detects Stripe live secret key and redacts it', () => {
    const rawKey = ['sk', 'live', '51AbCdEfGhIjKlMnOpQrStUvWxYz1234567890'].join('_');
    const context = createMockContext({
      'src/billing.ts': `const stripe = new Stripe("${rawKey}");`,
    });

    const result = rule.execute(context);
    const finding = result.findings.find((f) => f.title.includes('Stripe Live Secret'));
    expect(finding).toBeDefined();
    expect(finding!.evidence).not.toContain(rawKey);
    expect(finding!.evidence).toContain('sk_l****');
  });

  it('detects Twilio Account SID', () => {
    const rawSid = ['AC', '0123456789abcdef0123456789abcdef'].join('');
    const context = createMockContext({
      'src/sms.ts': `const client = twilio("${rawSid}", auth);`,
    });

    const result = rule.execute(context);
    const finding = result.findings.find((f) => f.title.includes('Twilio Account SID'));
    expect(finding).toBeDefined();
  });

  it('detects database connection string with credentials in config', () => {
    const dbUri = ['postgres://prod_user:', 'super_secret_password_123', '@db.prod.internal:5432/maindb'].join('');
    const context = createMockContext({
      'config.json': JSON.stringify({ database_url: dbUri }),
    });

    const result = rule.execute(context);
    const finding = result.findings.find((f) => f.title.includes('Database Connection String'));
    expect(finding).toBeDefined();
    expect(finding!.evidence).not.toContain('super_secret_password_123');
  });

  it('detects dangerous dynamic eval (SEC003)', () => {
    const context = createMockContext({
      'src/calculator.ts': 'export function compute(formula: string) { return eval(formula); }',
    });

    const result = rule.execute(context);
    const evalFinding = result.findings.find((f) => f.ruleId === 'SEC003');
    expect(evalFinding).toBeDefined();
    expect(evalFinding!.severity).toBe('high');
  });
});
