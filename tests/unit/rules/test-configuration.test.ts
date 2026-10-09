import { describe, it, expect } from 'vitest';
import { TestConfigurationRule } from '../../../src/rules/test-configuration.rule.js';
import type { RuleContext } from '../../../src/models/rule.js';
import type { ProjectInfo } from '../../../src/discovery/types.js';

describe('TestConfigurationRule', () => {
  it('flags missing test script in package.json', () => {
    const rule = new TestConfigurationRule();
    const project: ProjectInfo = {
      name: 'no-test-app',
      version: '1.0.0',
      type: 'javascript',
      frameworks: [],
      tools: [],
      isMonorepo: false,
      packageCount: 1,
      hasPackageJson: true,
      packageJsonRaw: {
        scripts: {
          build: 'vite build',
        },
      },
    };

    const context: RuleContext = {
      targetDir: '/fake',
      project,
      files: [],
      config: {},
      getFileContent: () => null,
      hasFile: () => false,
    };

    const result = rule.execute(context);
    const testFinding = result.findings.find((f) => f.ruleId === 'TST001');
    expect(testFinding).toBeDefined();
    expect(testFinding?.title).toContain('Missing "test" script');
  });

  it('flags default npm placeholder test script', () => {
    const rule = new TestConfigurationRule();
    const project: ProjectInfo = {
      name: 'placeholder-test-app',
      version: '1.0.0',
      type: 'javascript',
      frameworks: [],
      tools: [],
      isMonorepo: false,
      packageCount: 1,
      hasPackageJson: true,
      packageJsonRaw: {
        scripts: {
          test: 'echo "Error: no test specified" && exit 1',
        },
      },
    };

    const context: RuleContext = {
      targetDir: '/fake',
      project,
      files: [],
      config: {},
      getFileContent: () => null,
      hasFile: () => false,
    };

    const result = rule.execute(context);
    const placeholderFinding = result.findings.find((f) => f.ruleId === 'TST001');
    expect(placeholderFinding).toBeDefined();
    expect(placeholderFinding?.title).toContain('Default placeholder test script');
  });

  it('passes cleanly when test script and framework configuration are valid', () => {
    const rule = new TestConfigurationRule();
    const project: ProjectInfo = {
      name: 'tested-app',
      version: '1.0.0',
      type: 'typescript',
      frameworks: [],
      tools: ['Vitest'],
      isMonorepo: false,
      packageCount: 1,
      hasPackageJson: true,
      packageJsonRaw: {
        scripts: {
          test: 'vitest run',
        },
        devDependencies: {
          vitest: '^2.1.3',
        },
      },
    };

    const context: RuleContext = {
      targetDir: '/fake',
      project,
      files: [],
      config: {},
      getFileContent: () => null,
      hasFile: (file) => file === 'vitest.config.ts',
    };

    const result = rule.execute(context);
    expect(result.findings).toHaveLength(0);
  });
});
