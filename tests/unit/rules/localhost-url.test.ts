import { describe, it, expect } from 'vitest';
import { LocalhostUrlRule } from '../../../src/rules/localhost-url.rule.js';
import type { RuleContext } from '../../../src/models/rule.js';
import type { ProjectInfo } from '../../../src/discovery/types.js';

describe('LocalhostUrlRule', () => {
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

  it('detects http://localhost, 127.0.0.1, and [::1] in application source files', () => {
    const rule = new LocalhostUrlRule();
    const sourceCode = `
      export const API = "http://localhost:8080/api";
      export const IPV4 = "http://127.0.0.1:4000";
      export const IPV6 = "http://[::1]:9000/health";
    `;

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
      ],
      config: {},
      getFileContent: () => sourceCode,
      hasFile: () => true,
    };

    const result = rule.execute(context);
    expect(result.findings).toHaveLength(3);
    expect(result.findings[0]?.ruleId).toBe('URL001');
    expect(result.findings[0]?.file).toBe('src/config.ts');
    expect(result.findings[0]?.line).toBe(2);
    expect(result.findings[0]?.severity).toBe('medium');
    expect(result.findings[0]?.evidence).toContain('http://localhost:8080/api');
  });

  it('ignores localhost URLs inside documentation files (.md)', () => {
    const rule = new LocalhostUrlRule();
    const markdown = '# Setup\nRun the app at http://localhost:3000 to preview.';

    const context: RuleContext = {
      targetDir: '/fake',
      project: dummyProject,
      files: [
        {
          relativePath: 'README.md',
          absolutePath: '/fake/README.md',
          size: markdown.length,
          extension: '.md',
        },
      ],
      config: {},
      getFileContent: () => markdown,
      hasFile: () => true,
    };

    const result = rule.execute(context);
    expect(result.findings).toHaveLength(0);
  });

  it('ignores localhost URLs in test files to prevent false positives on mock servers', () => {
    const rule = new LocalhostUrlRule();
    const testCode = 'test("fetches from mock server", () => { fetch("http://localhost:3000"); });';

    const context: RuleContext = {
      targetDir: '/fake',
      project: dummyProject,
      files: [
        {
          relativePath: 'src/__tests__/api.test.ts',
          absolutePath: '/fake/src/__tests__/api.test.ts',
          size: testCode.length,
          extension: '.ts',
        },
      ],
      config: {},
      getFileContent: () => testCode,
      hasFile: () => true,
    };

    const result = rule.execute(context);
    expect(result.findings).toHaveLength(0);
  });
});
