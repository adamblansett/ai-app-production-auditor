import type { Rule, RuleContext, RuleResult } from '../models/rule.js';
import { createFinding, type Finding } from '../models/finding.js';

const RECOGNIZED_TEST_FRAMEWORKS = [
  'vitest',
  'jest',
  'mocha',
  'playwright',
  '@playwright/test',
  'cypress',
  'ava',
  'jasmine',
  'tape',
  'node:test',
];

export class TestConfigurationRule implements Rule {
  readonly id = 'TST001';
  readonly name = 'Automated Test Script and Framework Configuration';
  readonly description =
    'Inspects project manifests and configuration files to identify configured test scripts and testing frameworks.';
  readonly category = 'testing';
  readonly defaultSeverity = 'medium';
  readonly documentationUrl = 'https://github.com/adamblansett/ai-app-production-auditor#testing';

  execute(context: RuleContext): RuleResult {
    const findings: Finding[] = [];
    const project = context.project;

    if (!project.hasPackageJson || !project.packageJsonRaw) {
      return {
        ruleId: this.id,
        name: this.name,
        description: this.description,
        findings,
        skipped: true,
        skippedReason: 'No valid package.json found to inspect test configuration',
      };
    }

    const scripts = (project.packageJsonRaw.scripts as Record<string, string> | undefined) ?? {};
    const testScript = scripts['test'];

    // Check if test script exists and is not the npm default placeholder
    if (!testScript) {
      findings.push(
        createFinding({
          ruleId: this.id,
          title: 'Missing "test" script in package.json',
          severity: 'medium',
          category: this.category,
          message:
            'No automated "test" script was detected in package.json. Automated tests are critical to verify application stability prior to production deployment.',
          evidence: 'scripts.test is undefined in package.json',
          file: 'package.json',
          line: 1,
          column: 1,
          remediation:
            'Add an automated test script (e.g. "test": "vitest run" or "test": "jest") to package.json scripts.',
          confidence: 'high',
          documentationUrl: this.documentationUrl,
        }),
      );
    } else if (testScript.includes('no test specified')) {
      findings.push(
        createFinding({
          ruleId: this.id,
          title: 'Default placeholder test script detected',
          severity: 'medium',
          category: this.category,
          message: `The "test" script in package.json contains the default npm placeholder: "${testScript}".`,
          evidence: `"test": "${testScript}"`,
          file: 'package.json',
          line: 1,
          column: 1,
          remediation:
            'Configure an active test runner such as Vitest or Jest instead of the default placeholder.',
          confidence: 'high',
          documentationUrl: this.documentationUrl,
        }),
      );
    }

    // Check for recognized test framework dependency or config
    const dependencies = {
      ...(project.packageJsonRaw.dependencies as Record<string, string> | undefined),
      ...(project.packageJsonRaw.devDependencies as Record<string, string> | undefined),
    };

    const hasTestFramework = RECOGNIZED_TEST_FRAMEWORKS.some(
      (fw) => dependencies[fw] !== undefined,
    );

    const hasTestConfigFile =
      context.hasFile('vitest.config.ts') ||
      context.hasFile('vitest.config.js') ||
      context.hasFile('jest.config.js') ||
      context.hasFile('jest.config.ts') ||
      context.hasFile('playwright.config.ts') ||
      context.hasFile('cypress.config.ts');

    if (!hasTestFramework && !hasTestConfigFile) {
      findings.push(
        createFinding({
          ruleId: 'TST002',
          title: 'No recognized testing framework detected',
          severity: 'low',
          category: this.category,
          message:
            'No standard testing framework (Vitest, Jest, Playwright, Cypress, Mocha, etc.) was identified in project dependencies or configuration files.',
          evidence:
            'No recognized test framework dependency in package.json or test config file detected',
          file: 'package.json',
          remediation:
            'Install and configure a modern test runner (e.g., npm install -D vitest) to support unit and integration tests.',
          confidence: 'medium',
          documentationUrl: this.documentationUrl,
        }),
      );
    }

    return {
      ruleId: this.id,
      name: this.name,
      description: this.description,
      findings,
    };
  }
}
