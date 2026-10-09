import type { Rule, RuleContext, RuleResult } from '../models/rule.js';
import { createFinding, type Finding } from '../models/finding.js';
import { getLocationFromIndex } from '../utils/text.js';

const TLS_BYPASS_REGEX =
  /(?:NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*['"]0['"]|rejectUnauthorized\s*:\s*false)/gi;

const PUBLIC_SECRET_PREFIX_REGEX =
  /(?:NEXT_PUBLIC_|VITE_)[A-Z0-9_]*(?:SECRET|PRIVATE|PASSWORD|API_KEY)[A-Z0-9_]*/gi;

const SOURCE_CONFIG_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
  '.env',
  '.env.example',
]);

export class ProductionConfigRule implements Rule {
  readonly id = 'CFG001';
  readonly name = 'Production Configuration and Security Heuristics';
  readonly description =
    'Identifies unsafe configuration patterns including disabled TLS validation, leaked frontend secrets, and missing gitignore entries.';
  readonly category = 'security';
  readonly defaultSeverity = 'high';
  readonly documentationUrl =
    'https://github.com/adamblansett/ai-app-production-auditor#configuration-heuristics';

  execute(context: RuleContext): RuleResult {
    const findings: Finding[] = [];

    // CFG001 & CFG002: Inspect files for TLS bypass and public secret prefixes
    for (const file of context.files) {
      if (!SOURCE_CONFIG_EXTENSIONS.has(file.extension)) continue;

      const content = context.getFileContent(file.relativePath);
      if (!content) continue;

      // Check for TLS rejection bypass
      TLS_BYPASS_REGEX.lastIndex = 0;
      let tlsMatch: RegExpExecArray | null;
      while ((tlsMatch = TLS_BYPASS_REGEX.exec(content)) !== null) {
        const loc = getLocationFromIndex(content, tlsMatch.index);
        findings.push(
          createFinding({
            ruleId: 'CFG001',
            title: 'TLS certificate validation disabled',
            severity: 'high',
            category: this.category,
            message: `TLS certificate verification appears disabled via "${tlsMatch[0]}" in ${file.relativePath}. This exposes network connections to man-in-the-middle attacks.`,
            evidence: loc.lineSnippet || tlsMatch[0],
            file: file.relativePath,
            line: loc.line,
            column: loc.column,
            remediation: 'Enable standard TLS certificate validation for production environments.',
            confidence: 'high',
            documentationUrl: this.documentationUrl,
          }),
        );
      }

      // Check for frontend exposed secrets via public prefixes
      PUBLIC_SECRET_PREFIX_REGEX.lastIndex = 0;
      let pubMatch: RegExpExecArray | null;
      while ((pubMatch = PUBLIC_SECRET_PREFIX_REGEX.exec(content)) !== null) {
        const varName = pubMatch[0];
        const loc = getLocationFromIndex(content, pubMatch.index);
        findings.push(
          createFinding({
            ruleId: 'CFG002',
            title: 'Potential secret exposed via client-side public variable prefix',
            severity: 'high',
            category: this.category,
            message: `The variable "${varName}" uses a client-accessible prefix (NEXT_PUBLIC_ or VITE_) alongside a sensitive identifier (SECRET, PRIVATE, or PASSWORD). This will bundle the secret into client-side assets visible to end-users.`,
            evidence: loc.lineSnippet || varName,
            file: file.relativePath,
            line: loc.line,
            column: loc.column,
            remediation:
              'Move private API keys and secrets to server-side environment variables without client-exposed prefixes.',
            confidence: 'high',
            documentationUrl: this.documentationUrl,
          }),
        );
      }
    }

    // CFG003: Check .gitignore completeness
    if (!context.hasFile('.gitignore')) {
      findings.push(
        createFinding({
          ruleId: 'CFG003',
          title: 'Missing .gitignore file in project root',
          severity: 'medium',
          category: 'configuration',
          message:
            'No .gitignore file was found in the project root. This creates a high risk of accidentally committing node_modules, build artifacts, or secret environment files.',
          evidence: '.gitignore does not exist in project root',
          file: null,
          remediation:
            'Create a .gitignore file and ignore node_modules, dist, and local .env files.',
          confidence: 'high',
          documentationUrl: this.documentationUrl,
        }),
      );
    } else {
      const gitignoreContent = context.getFileContent('.gitignore');
      if (gitignoreContent) {
        const lines = gitignoreContent.split('\n').map((l) => l.trim().replace(/\/$/, ''));
        const ignoresNodeModules = lines.some((l) => l === 'node_modules');
        const ignoresEnv = lines.some((l) => l === '.env' || l === '*.env');

        if (!ignoresNodeModules || !ignoresEnv) {
          const missingItems: string[] = [];
          if (!ignoresNodeModules) missingItems.push('node_modules');
          if (!ignoresEnv) missingItems.push('.env');

          findings.push(
            createFinding({
              ruleId: 'CFG003',
              title: '.gitignore is missing critical ignore patterns',
              severity: 'medium',
              category: 'configuration',
              message: `.gitignore is missing entries for: ${missingItems.join(', ')}.`,
              evidence: `Missing patterns: ${missingItems.join(', ')}`,
              file: '.gitignore',
              line: 1,
              column: 1,
              remediation: `Add ${missingItems.join(', ')} to your .gitignore file.`,
              confidence: 'high',
              documentationUrl: this.documentationUrl,
            }),
          );
        }
      }
    }

    // CFG004: Check for wildcard or unpinned dependencies in package.json
    if (context.project.packageJsonRaw) {
      const deps = {
        ...(context.project.packageJsonRaw.dependencies as Record<string, string> | undefined),
        ...(context.project.packageJsonRaw.devDependencies as Record<string, string> | undefined),
      };

      for (const [depName, depVersion] of Object.entries(deps)) {
        if (depVersion === '*' || depVersion === 'latest') {
          findings.push(
            createFinding({
              ruleId: 'CFG004',
              title: `Unpinned dependency "${depName}" in package.json`,
              severity: 'low',
              category: 'configuration',
              message: `Dependency "${depName}" is configured with wildcard version "${depVersion}". This can cause unpredictable production builds and supply-chain drift.`,
              evidence: `"${depName}": "${depVersion}"`,
              file: 'package.json',
              line: 1,
              column: 1,
              remediation: `Pin "${depName}" to an explicit version or version range in package.json.`,
              confidence: 'high',
              documentationUrl: this.documentationUrl,
            }),
          );
        }
      }
    }

    return {
      ruleId: this.id,
      name: this.name,
      description: this.description,
      findings,
    };
  }
}
