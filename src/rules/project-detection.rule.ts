import type { Rule, RuleContext, RuleResult } from '../models/rule.js';
import { createFinding, type Finding } from '../models/finding.js';

export class ProjectDetectionRule implements Rule {
  readonly id = 'PRJ001';
  readonly name = 'Project Structure and Manifest Integrity';
  readonly description = 'Validates project manifest presence, syntax, and monorepo structure.';
  readonly category = 'configuration';
  readonly defaultSeverity = 'high';
  readonly documentationUrl =
    'https://github.com/adamblansett/ai-app-production-auditor#project-detection';

  execute(context: RuleContext): RuleResult {
    const findings: Finding[] = [];
    const project = context.project;

    // Check for malformed package.json
    if (project.packageJsonError) {
      findings.push(
        createFinding({
          ruleId: this.id,
          title: 'Malformed package.json manifest',
          severity: 'high',
          category: this.category,
          message: `The project package.json could not be parsed: ${project.packageJsonError}`,
          evidence: project.packageJsonError,
          file: 'package.json',
          line: 1,
          column: 1,
          remediation:
            'Fix the JSON syntax errors in package.json to allow package managers and tooling to operate correctly.',
          confidence: 'high',
          documentationUrl: this.documentationUrl,
        }),
      );
      return {
        ruleId: this.id,
        name: this.name,
        description: this.description,
        findings,
      };
    }

    // Check for missing package.json
    if (!project.hasPackageJson) {
      findings.push(
        createFinding({
          ruleId: this.id,
          title: 'Missing package.json manifest',
          severity: 'low',
          category: this.category,
          message:
            'No package.json file was detected in the project root. The auditor cannot verify package scripts or dependencies.',
          evidence: 'package.json was not found in project root',
          file: null,
          remediation:
            'Run "npm init" or configure a package manifest if this is a Node.js / TypeScript project.',
          confidence: 'medium',
          documentationUrl: this.documentationUrl,
        }),
      );
    } else if (project.isMonorepo) {
      findings.push(
        createFinding({
          ruleId: this.id,
          title: 'Monorepo workspace structure detected',
          severity: 'info',
          category: this.category,
          message: `The project appears to be a monorepo workspace containing approximately ${project.packageCount} package(s). Scanning is scoped to the specified directory.`,
          evidence: `Monorepo markers present (workspaces, lerna, pnpm-workspace, or turbo); packages found: ${project.packageCount}`,
          file: 'package.json',
          remediation:
            'Ensure individual workspace packages are audited separately if they possess distinct production configurations.',
          confidence: 'high',
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
