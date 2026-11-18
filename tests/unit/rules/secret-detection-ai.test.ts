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

describe('SecretDetectionRule (AI Provider Secret Signatures)', () => {
  const rule = new SecretDetectionRule();

  it('detects OpenAI project API key and redacts it in evidence', () => {
    const rawKey = 'sk-proj-abc1234567890abcdef1234567890abcdef1234567890';
    const context = createMockContext({
      'src/ai.ts': `const key = "${rawKey}";`,
    });

    const result = rule.execute(context);
    expect(result.findings.some((f) => f.title.includes('OpenAI API Key'))).toBe(true);
    const finding = result.findings[0]!;
    expect(finding.evidence).not.toContain(rawKey);
    expect(finding.evidence).toContain('sk-p****');
  });

  it('detects Anthropic API key and redacts it in evidence', () => {
    const rawKey =
      'sk-ant-api03-abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
    const context = createMockContext({
      'src/anthropic.ts': `const anthropicKey = "${rawKey}";`,
    });

    const result = rule.execute(context);
    expect(result.findings.some((f) => f.title.includes('Anthropic API Key'))).toBe(true);
    const finding = result.findings[0]!;
    expect(finding.evidence).not.toContain(rawKey);
  });

  it('detects Hugging Face token in non-script configuration files', () => {
    const rawToken = 'hf_abcdef1234567890abcdef1234567890ab';
    const context = createMockContext({
      'config.yaml': `token: "${rawToken}"\n`,
    });

    const result = rule.execute(context);
    expect(result.findings.some((f) => f.title.includes('Hugging Face Access Token'))).toBe(true);
  });
});
