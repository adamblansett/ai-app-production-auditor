import { describe, it, expect } from 'vitest';
import { PackageScriptsRule } from '../../../src/rules/package-scripts.rule.js';
import type { RuleContext } from '../../../src/models/rule.js';
import type { ProjectInfo } from '../../../src/discovery/types.js';

describe('PackageScriptsRule', () => {
  it('flags missing build script in a TypeScript project requiring compilation', () => {
    const rule = new PackageScriptsRule();
    const project: ProjectInfo = {
      name: 'ts-app',
      version: '1.0.0',
      type: 'typescript',
      frameworks: [],
      tools: [],
      isMonorepo: false,
      packageCount: 1,
      hasPackageJson: true,
      packageJsonRaw: {
        scripts: {
          test: 'vitest',
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
    const buildFinding = result.findings.find((f) => f.ruleId === 'BLD001');
    expect(buildFinding).toBeDefined();
    expect(buildFinding?.title).toContain('Missing "build" script');
  });

  it('flags missing type-check and lint scripts in TypeScript projects', () => {
    const rule = new PackageScriptsRule();
    const project: ProjectInfo = {
      name: 'ts-app',
      version: '1.0.0',
      type: 'typescript',
      frameworks: [],
      tools: [],
      isMonorepo: false,
      packageCount: 1,
      hasPackageJson: true,
      packageJsonRaw: {
        scripts: {
          build: 'tsc',
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
    expect(result.findings.some((f) => f.ruleId === 'BLD002')).toBe(true);
    expect(result.findings.some((f) => f.ruleId === 'BLD003')).toBe(true);
  });

  it('passes cleanly when build, typecheck, and lint scripts exist', () => {
    const rule = new PackageScriptsRule();
    const project: ProjectInfo = {
      name: 'ts-app',
      version: '1.0.0',
      type: 'typescript',
      frameworks: [],
      tools: [],
      isMonorepo: false,
      packageCount: 1,
      hasPackageJson: true,
      packageJsonRaw: {
        scripts: {
          build: 'tsc',
          typecheck: 'tsc --noEmit',
          lint: 'eslint .',
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
    expect(result.findings).toHaveLength(0);
  });
});
