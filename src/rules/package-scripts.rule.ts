import type { Rule, RuleContext, RuleResult } from '../models/rule.js';
import { createFinding, type Finding } from '../models/finding.js';

export class PackageScriptsRule implements Rule {
  readonly id = 'BLD001';
  readonly name = 'Production Build and Quality Verification Scripts';
  readonly description =
    'Inspects package.json scripts to verify the presence of production build and static quality-check scripts.';
  readonly category = 'quality';
  readonly defaultSeverity = 'high';
  readonly documentationUrl =
    'https://github.com/adamblansett/ai-app-production-auditor#build-scripts';

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
        skippedReason: 'No valid package.json found to inspect scripts',
      };
    }

    const scripts = (project.packageJsonRaw.scripts as Record<string, string> | undefined) ?? {};

    // Check for build script when project uses a framework or TypeScript
    const needsBuild =
      project.type === 'typescript' ||
      project.frameworks.length > 0 ||
      project.tools.includes('Vite') ||
      project.tools.includes('Webpack');

    if (needsBuild && !scripts['build']) {
      findings.push(
        createFinding({
          ruleId: 'BLD001',
          title: 'Missing "build" script in package.json',
          severity: 'high',
          category: this.category,
          message:
            'The project utilizes frameworks or TypeScript that require a compilation step, but no "build" script was found in package.json.',
          evidence: `scripts: ${JSON.stringify(Object.keys(scripts))}; project type: ${project.type}; frameworks: ${project.frameworks.join(', ') || 'none'}`,
          file: 'package.json',
          line: 1,
          column: 1,
          remediation:
            'Add a production build script to package.json (e.g. "build": "next build" or "build": "vite build" or "build": "tsc").',
          confidence: 'high',
          documentationUrl: this.documentationUrl,
        }),
      );
    }

    // Check for TypeScript typecheck script
    if (project.type === 'typescript') {
      const hasTypeCheckScript =
        Boolean(scripts['typecheck']) ||
        Boolean(scripts['type-check']) ||
        Boolean(scripts['check']) ||
        Boolean(scripts['tsc']);

      if (!hasTypeCheckScript) {
        findings.push(
          createFinding({
            ruleId: 'BLD002',
            title: 'Missing type-check script in TypeScript project',
            severity: 'low',
            category: this.category,
            message:
              'The project uses TypeScript, but package.json has no dedicated script for type-checking without emitting files.',
            evidence: `Available scripts: [${Object.keys(scripts).join(', ')}]`,
            file: 'package.json',
            remediation:
              'Add a type-checking script to package.json (e.g. "typecheck": "tsc --noEmit") to allow CI/CD pipelines to verify type safety.',
            confidence: 'medium',
            documentationUrl: this.documentationUrl,
          }),
        );
      }
    }

    // Check for lint script
    if (!scripts['lint']) {
      findings.push(
        createFinding({
          ruleId: 'BLD003',
          title: 'Missing "lint" script in package.json',
          severity: 'low',
          category: this.category,
          message:
            'No "lint" script was detected in package.json. Automated linting helps prevent syntax errors and code smells before deployment.',
          evidence: `Available scripts: [${Object.keys(scripts).join(', ')}]`,
          file: 'package.json',
          remediation:
            'Configure a linter such as ESLint and add a script (e.g. "lint": "eslint .") to package.json.',
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
