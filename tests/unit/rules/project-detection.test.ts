import { describe, it, expect } from 'vitest';
import { ProjectDetectionRule } from '../../../src/rules/project-detection.rule.js';
import type { RuleContext } from '../../../src/models/rule.js';
import type { ProjectInfo } from '../../../src/discovery/types.js';

describe('ProjectDetectionRule', () => {
  it('flags malformed package.json syntax error with high severity', () => {
    const rule = new ProjectDetectionRule();
    const project: ProjectInfo = {
      name: 'broken-app',
      version: null,
      type: 'javascript',
      frameworks: [],
      tools: [],
      isMonorepo: false,
      packageCount: 1,
      hasPackageJson: true,
      packageJsonRaw: null,
      packageJsonError: 'Unexpected token at line 3',
    };

    const context: RuleContext = {
      targetDir: '/fake',
      project,
      files: [],
      config: {},
      getFileContent: () => null,
      hasFile: () => true,
    };

    const result = rule.execute(context);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]?.ruleId).toBe('PRJ001');
    expect(result.findings[0]?.severity).toBe('high');
    expect(result.findings[0]?.message).toContain('Unexpected token');
  });

  it('reports missing package.json when no manifest exists', () => {
    const rule = new ProjectDetectionRule();
    const project: ProjectInfo = {
      name: 'bare-dir',
      version: null,
      type: 'unknown',
      frameworks: [],
      tools: [],
      isMonorepo: false,
      packageCount: 0,
      hasPackageJson: false,
      packageJsonRaw: null,
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
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]?.title).toContain('Missing package.json');
  });

  it('documents monorepo structure with info finding', () => {
    const rule = new ProjectDetectionRule();
    const project: ProjectInfo = {
      name: 'monorepo',
      version: '1.0.0',
      type: 'typescript',
      frameworks: [],
      tools: [],
      isMonorepo: true,
      packageCount: 4,
      hasPackageJson: true,
      packageJsonRaw: {},
    };

    const context: RuleContext = {
      targetDir: '/fake',
      project,
      files: [],
      config: {},
      getFileContent: () => null,
      hasFile: () => true,
    };

    const result = rule.execute(context);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]?.severity).toBe('info');
    expect(result.findings[0]?.message).toContain('monorepo workspace');
  });
});
