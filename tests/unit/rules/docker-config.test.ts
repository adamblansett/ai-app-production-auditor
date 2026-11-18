import { describe, it, expect } from 'vitest';
import { ProductionConfigRule } from '../../../src/rules/production-config.rule.js';
import type { RuleContext } from '../../../src/models/rule.js';
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
  };
}

describe('Docker Configuration Checks (CFG005)', () => {
  const rule = new ProductionConfigRule();

  it('reports CFG005 when Dockerfile runs as root (missing USER)', () => {
    const context = createMockContext({
      Dockerfile: `
        FROM node:20-alpine
        WORKDIR /app
        COPY . .
        CMD ["node", "index.js"]
      `,
      '.gitignore': 'node_modules\n.env\n',
    });

    const result = rule.execute(context);
    const rootUserFinding = result.findings.find(
      (f) => f.ruleId === 'CFG005' && f.title.includes('root user'),
    );
    expect(rootUserFinding).toBeDefined();
    expect(rootUserFinding!.severity).toBe('medium');
  });

  it('reports CFG005 when Dockerfile exists but .dockerignore is missing', () => {
    const context = createMockContext({
      Dockerfile: `
        FROM node:20-alpine
        USER node
        WORKDIR /app
        CMD ["node", "index.js"]
      `,
      '.gitignore': 'node_modules\n.env\n',
    });

    const result = rule.execute(context);
    const dockerignoreFinding = result.findings.find(
      (f) => f.ruleId === 'CFG005' && f.title.includes('Missing .dockerignore'),
    );
    expect(dockerignoreFinding).toBeDefined();
  });

  it('passes cleanly when Dockerfile specifies USER and .dockerignore ignores node_modules and .env', () => {
    const context = createMockContext({
      Dockerfile: `
        FROM node:20-alpine
        WORKDIR /app
        USER node
        CMD ["node", "index.js"]
      `,
      '.dockerignore': 'node_modules\n.env\n',
      '.gitignore': 'node_modules\n.env\n',
    });

    const result = rule.execute(context);
    const dockerFindings = result.findings.filter((f) => f.ruleId === 'CFG005');
    expect(dockerFindings).toHaveLength(0);
  });
});
