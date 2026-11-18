import { describe, it, expect } from 'vitest';
import { AiSafetyRule } from '../../../src/rules/ai-safety.rule.js';
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

describe('AiSafetyRule', () => {
  const rule = new AiSafetyRule();

  it('reports AI001 when dangerouslyAllowBrowser is enabled', () => {
    const context = createMockContext({
      'src/ai.ts': `
        import OpenAI from 'openai';
        export const ai = new OpenAI({ dangerouslyAllowBrowser: true });
      `,
    });

    const result = rule.execute(context);
    expect(result.findings.some((f) => f.ruleId === 'AI001')).toBe(true);
    expect(result.findings[0]!.severity).toBe('high');
  });

  it('reports AI002 when unsanitized AI stream is rendered to DOM', () => {
    const context = createMockContext({
      'src/components/Chat.tsx': `
        export function Chat({ messageStream }: { messageStream: string }) {
          return <div dangerouslySetInnerHTML={{ __html: messageStream }} />;
        }
      `,
    });

    const result = rule.execute(context);
    expect(result.findings.some((f) => f.ruleId === 'AI002')).toBe(true);
  });

  it('reports AI003 for unimplemented stubs in production routes', () => {
    const context = createMockContext({
      'src/routes/export.ts': `
        export function exportData() {
          throw new Error("Not implemented");
        }
      `,
    });

    const result = rule.execute(context);
    expect(result.findings.some((f) => f.ruleId === 'AI003')).toBe(true);
  });

  it('passes cleanly when AI practices are safe and completed', () => {
    const context = createMockContext({
      'src/routes/ai.ts': `
        import { OpenAI } from 'openai';
        export async function POST() {
          const ai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
          return new Response("ok");
        }
      `,
    });

    const result = rule.execute(context);
    expect(result.findings.length).toBe(0);
  });
});
