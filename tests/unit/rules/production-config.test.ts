import { describe, it, expect } from 'vitest';
import { ProductionConfigRule } from '../../../src/rules/production-config.rule.js';
import type { RuleContext } from '../../../src/models/rule.js';
import type { ProjectInfo } from '../../../src/discovery/types.js';

describe('ProductionConfigRule', () => {
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

  it('detects disabled TLS validation in source or configuration', () => {
    const rule = new ProductionConfigRule();
    const sourceCode = 'process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";';

    const context: RuleContext = {
      targetDir: '/fake',
      project: dummyProject,
      files: [
        {
          relativePath: 'src/fetch.ts',
          absolutePath: '/fake/src/fetch.ts',
          size: sourceCode.length,
          extension: '.ts',
        },
      ],
      config: {},
      getFileContent: () => sourceCode,
      hasFile: () => true,
    };

    const result = rule.execute(context);
    const tlsFinding = result.findings.find((f) => f.ruleId === 'CFG001');
    expect(tlsFinding).toBeDefined();
    expect(tlsFinding?.severity).toBe('high');
    expect(tlsFinding?.title).toContain('TLS certificate validation disabled');
  });

  it('detects sensitive secrets using client-exposed public prefixes (NEXT_PUBLIC_*, VITE_*)', () => {
    const rule = new ProductionConfigRule();
    const sourceCode = 'export const secret = process.env.NEXT_PUBLIC_STRIPE_SECRET_KEY;';

    const context: RuleContext = {
      targetDir: '/fake',
      project: dummyProject,
      files: [
        {
          relativePath: 'src/env.ts',
          absolutePath: '/fake/src/env.ts',
          size: sourceCode.length,
          extension: '.ts',
        },
      ],
      config: {},
      getFileContent: () => sourceCode,
      hasFile: () => true,
    };

    const result = rule.execute(context);
    const pubFinding = result.findings.find((f) => f.ruleId === 'CFG002');
    expect(pubFinding).toBeDefined();
    expect(pubFinding?.severity).toBe('high');
    expect(pubFinding?.title).toContain('client-side public variable prefix');
  });

  it('detects missing or incomplete .gitignore missing node_modules and .env', () => {
    const rule = new ProductionConfigRule();
    const gitignoreContent = 'dist\n'; // Missing node_modules and .env

    const context: RuleContext = {
      targetDir: '/fake',
      project: dummyProject,
      files: [],
      config: {},
      getFileContent: (p) => (p === '.gitignore' ? gitignoreContent : null),
      hasFile: (p) => p === '.gitignore',
    };

    const result = rule.execute(context);
    const gitignoreFinding = result.findings.find((f) => f.ruleId === 'CFG003');
    expect(gitignoreFinding).toBeDefined();
    expect(gitignoreFinding?.message).toContain('node_modules, .env');
  });

  it('detects unpinned wildcard dependencies in package.json', () => {
    const rule = new ProductionConfigRule();
    const projectWithWildcard: ProjectInfo = {
      ...dummyProject,
      packageJsonRaw: {
        dependencies: {
          express: '*',
          lodash: 'latest',
        },
      },
    };

    const context: RuleContext = {
      targetDir: '/fake',
      project: projectWithWildcard,
      files: [],
      config: {},
      getFileContent: () => null,
      hasFile: () => true,
    };

    const result = rule.execute(context);
    const wildcardFindings = result.findings.filter((f) => f.ruleId === 'CFG004');
    expect(wildcardFindings).toHaveLength(2);
    expect(wildcardFindings[0]?.severity).toBe('low');
  });
});
