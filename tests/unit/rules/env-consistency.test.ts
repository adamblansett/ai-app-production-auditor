import { describe, it, expect } from 'vitest';
import { EnvConsistencyRule } from '../../../src/rules/env-consistency.rule.js';
import type { RuleContext } from '../../../src/models/rule.js';
import type { ProjectInfo } from '../../../src/discovery/types.js';

describe('EnvConsistencyRule', () => {
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

  it('detects when variables in source are missing from .env.example', () => {
    const rule = new EnvConsistencyRule();
    const sourceCode = `
      const dbUrl = process.env.DATABASE_URL;
      const apiToken = process.env.API_SECRET_KEY;
      const port = process.env.PORT; // Should be ignored
    `;
    const envExample = 'DATABASE_URL=postgres://localhost:5432/db\n';

    const context: RuleContext = {
      targetDir: '/fake',
      project: dummyProject,
      files: [
        {
          relativePath: 'src/config.ts',
          absolutePath: '/fake/src/config.ts',
          size: sourceCode.length,
          extension: '.ts',
        },
        {
          relativePath: '.env.example',
          absolutePath: '/fake/.env.example',
          size: envExample.length,
          extension: '.example',
        },
      ],
      config: {},
      getFileContent: (path) => {
        if (path === 'src/config.ts') return sourceCode;
        if (path === '.env.example') return envExample;
        return null;
      },
      hasFile: (path) => path === '.env.example' || path === 'src/config.ts',
    };

    const result = rule.execute(context);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]?.ruleId).toBe('ENV001');
    expect(result.findings[0]?.title).toContain('API_SECRET_KEY');
    expect(result.findings[0]?.file).toBe('src/config.ts');
  });

  it('flags missing .env.example file when source references custom variables', () => {
    const rule = new EnvConsistencyRule();
    const sourceCode = 'const stripeKey = import.meta.env.STRIPE_PUBLIC_KEY;';

    const context: RuleContext = {
      targetDir: '/fake',
      project: dummyProject,
      files: [
        {
          relativePath: 'src/payment.ts',
          absolutePath: '/fake/src/payment.ts',
          size: sourceCode.length,
          extension: '.ts',
        },
      ],
      config: {},
      getFileContent: () => sourceCode,
      hasFile: () => false,
    };

    const result = rule.execute(context);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]?.ruleId).toBe('ENV002');
    expect(result.findings[0]?.title).toContain('.env.example');
  });

  it('passes cleanly when all custom variables are declared in .env.example', () => {
    const rule = new EnvConsistencyRule();
    const sourceCode = 'const key = process.env.SERVICE_KEY;';
    const envExample = 'SERVICE_KEY=your_key_here\n';

    const context: RuleContext = {
      targetDir: '/fake',
      project: dummyProject,
      files: [
        {
          relativePath: 'src/service.ts',
          absolutePath: '/fake/src/service.ts',
          size: sourceCode.length,
          extension: '.ts',
        },
      ],
      config: {},
      getFileContent: (path) => (path === '.env.example' ? envExample : sourceCode),
      hasFile: (path) => path === '.env.example',
    };

    const result = rule.execute(context);
    expect(result.findings).toHaveLength(0);
  });
});
