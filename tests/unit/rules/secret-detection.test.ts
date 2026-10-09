import { describe, it, expect } from 'vitest';
import { SecretDetectionRule } from '../../../src/rules/secret-detection.rule.js';
import type { RuleContext } from '../../../src/models/rule.js';
import type { ProjectInfo } from '../../../src/discovery/types.js';

describe('SecretDetectionRule', () => {
  const dummyProject: ProjectInfo = {
    name: 'test-app',
    version: '1.0.0',
    type: 'typescript',
    frameworks: [],
    tools: [],
    isMonorepo: false,
    packageCount: 1,
    hasPackageJson: true,
    packageJsonRaw: {},
  };

  it('detects AWS access key IDs and redacts the secret in evidence and message', () => {
    const rule = new SecretDetectionRule();
    const fakeKey = 'AKIAIOSFODNN7EXAMPLE';
    const content = `const client = new AWS.Client({ accessKeyId: "${fakeKey}" });`;

    const context: RuleContext = {
      targetDir: '/fake',
      project: dummyProject,
      files: [
        {
          relativePath: 'src/aws.ts',
          absolutePath: '/fake/src/aws.ts',
          size: content.length,
          extension: '.ts',
        },
      ],
      config: {},
      getFileContent: () => content,
      hasFile: () => false,
    };

    const result = rule.execute(context);
    expect(result.findings).toHaveLength(1);
    const finding = result.findings[0]!;
    expect(finding.ruleId).toBe('SEC001');
    expect(finding.severity).toBe('critical');
    // Ensure the raw unmasked key is never present anywhere in the finding
    expect(finding.message).not.toContain('IOSFODNN7EXAM');
    expect(finding.evidence).not.toContain('IOSFODNN7EXAM');
    expect(finding.evidence).toContain('AKIA****...****PLE');
  });

  it('detects GitHub personal access tokens with complete redaction', () => {
    const rule = new SecretDetectionRule();
    const fakeToken = 'ghp_SyntheticTestTokenForAuditor12345678';
    const content = `const authHeader = "Bearer ${fakeToken}";`;

    const context: RuleContext = {
      targetDir: '/fake',
      project: dummyProject,
      files: [
        {
          relativePath: 'src/github.ts',
          absolutePath: '/fake/src/github.ts',
          size: content.length,
          extension: '.ts',
        },
      ],
      config: {},
      getFileContent: () => content,
      hasFile: () => false,
    };

    const result = rule.execute(context);
    expect(result.findings).toHaveLength(1);
    const finding = result.findings[0]!;
    expect(finding.ruleId).toBe('SEC001');
    expect(finding.message).not.toContain('SyntheticTestTokenForAuditor');
    expect(finding.evidence).toContain('ghp_****...****678');
  });

  it('detects private key blocks in application files', () => {
    const rule = new SecretDetectionRule();
    const privKeyContent =
      '-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA0...\n-----END RSA PRIVATE KEY-----';

    const context: RuleContext = {
      targetDir: '/fake',
      project: dummyProject,
      files: [
        {
          relativePath: 'certs/server.key',
          absolutePath: '/fake/certs/server.key',
          size: privKeyContent.length,
          extension: '.key',
        },
      ],
      config: {},
      getFileContent: () => privKeyContent,
      hasFile: () => false,
    };

    const result = rule.execute(context);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]?.ruleId).toBe('SEC001');
    expect(result.findings[0]?.severity).toBe('critical');
  });

  it('flags presence of actual local .env file in repository root', () => {
    const rule = new SecretDetectionRule();
    const envContent = 'SECRET_KEY=supersecretproductionkey12345678\n';

    const context: RuleContext = {
      targetDir: '/fake',
      project: dummyProject,
      files: [],
      config: {},
      getFileContent: (p) => (p === '.env' ? envContent : null),
      hasFile: (p) => p === '.env',
    };

    const result = rule.execute(context);
    const envFinding = result.findings.find((f) => f.ruleId === 'SEC002');
    expect(envFinding).toBeDefined();
    expect(envFinding?.severity).toBe('critical');
    expect(envFinding?.title).toContain('Sensitive environment file ".env"');
  });

  it('does not flag placeholder values in example files (.env.example)', () => {
    const rule = new SecretDetectionRule();
    const exampleContent = 'API_KEY=your_api_key_here\n';

    const context: RuleContext = {
      targetDir: '/fake',
      project: dummyProject,
      files: [
        {
          relativePath: '.env.example',
          absolutePath: '/fake/.env.example',
          size: exampleContent.length,
          extension: '.example',
        },
      ],
      config: {},
      getFileContent: () => exampleContent,
      hasFile: () => false,
    };

    const result = rule.execute(context);
    expect(result.findings).toHaveLength(0);
  });
});
