import type { Rule, RuleContext, RuleResult } from '../models/rule.js';
import { createFinding, type Finding } from '../models/finding.js';
import { getLocationFromIndex } from '../utils/text.js';
import { redactSecret, redactEvidence } from '../utils/redaction.js';

interface SecretPattern {
  name: string;
  regex: RegExp;
  extractValue?: (match: RegExpExecArray) => string;
}

const SECRET_PATTERNS: SecretPattern[] = [
  {
    name: 'Private Key Block',
    regex:
      /-----BEGIN (?:[A-Z0-9 ]+ )?PRIVATE KEY-----[\s\S]*?-----END (?:[A-Z0-9 ]+ )?PRIVATE KEY-----/g,
    extractValue: (m) => m[0].slice(0, 30),
  },
  {
    name: 'AWS Access Key ID',
    regex: /\b(AKIA|ABIA|ACCA|ASIA)[0-9A-Z]{16}\b/g,
    extractValue: (m) => m[0],
  },
  {
    name: 'GitHub Personal Access Token',
    regex: /\b(?:gh[pousr]_[0-9a-zA-Z]{36,255}|github_pat_[0-9a-zA-Z_]{82})\b/g,
    extractValue: (m) => m[0],
  },
  {
    name: 'Slack Token',
    regex: /\bxox[baprs]-[0-9a-zA-Z]{10,48}\b/g,
    extractValue: (m) => m[0],
  },
  {
    name: 'Hardcoded API Secret Assignment',
    regex:
      /(?:api[_-]?key|secret|password|auth[_-]?token|access[_-]?token|private[_-]?key)\s*[:=]\s*["']([A-Za-z0-9_\-+/]{24,})["']/gi,
    extractValue: (m) => m[1] ?? m[0],
  },
];

const IGNORED_SECRET_PLACEHOLDERS = new Set([
  'your_api_key_here',
  'change_me',
  'placeholder',
  'example',
  'dummy_key',
  '000000000000000000000000',
  '123456789012345678901234',
]);

const EXCLUDED_EXTENSIONS = new Set([
  '.md',
  '.markdown',
  '.txt',
  '.lock',
  '.log',
  '.svg',
  '.png',
  '.jpg',
]);

export class SecretDetectionRule implements Rule {
  readonly id = 'SEC001';
  readonly name = 'Hardcoded Secrets and Private Credentials';
  readonly description =
    'Scans application source and configuration files for exposed API tokens, private keys, and cloud credentials using conservative pattern matching.';
  readonly category = 'security';
  readonly defaultSeverity = 'critical';
  readonly documentationUrl =
    'https://github.com/adamblansett/ai-app-production-auditor#secret-detection';

  execute(context: RuleContext): RuleResult {
    const findings: Finding[] = [];

    // Check for presence of real .env files in repository (SEC002)
    const sensitiveEnvFiles = ['.env', '.env.local', '.env.production', '.env.development.local'];
    for (const envFile of sensitiveEnvFiles) {
      if (context.hasFile(envFile)) {
        const content = context.getFileContent(envFile);
        if (content && content.trim().length > 0) {
          findings.push(
            createFinding({
              ruleId: 'SEC002',
              title: `Sensitive environment file "${envFile}" present in repository`,
              severity: 'critical',
              category: this.category,
              message: `The file "${envFile}" was detected in the project. Local environment files containing secrets must never be tracked or committed to version control.`,
              evidence: `File exists: ${envFile} (size: ${content.length} bytes)`,
              file: envFile,
              line: 1,
              column: 1,
              remediation: `Add "${envFile}" to .gitignore and ensure all sensitive values are rotated immediately if this repository was shared.`,
              confidence: 'high',
              documentationUrl: this.documentationUrl,
            }),
          );
        }
      }
    }

    // Inspect files for secret patterns
    for (const file of context.files) {
      if (EXCLUDED_EXTENSIONS.has(file.extension)) continue;

      // Skip example and template files to avoid false positives on placeholders
      if (
        file.relativePath.endsWith('.example') ||
        file.relativePath.endsWith('.template') ||
        file.relativePath.endsWith('.sample')
      ) {
        continue;
      }

      // Inspect script files with AST to avoid false positives on comments
      if (context.analyzer?.isEligibleForAst(file.relativePath)) {
        const matches = context.analyzer.analyzeSecretLiterals(file);
        for (const m of matches) {
          const redactedValue = redactSecret(m.matchedValue);
          const safeEvidence = redactEvidence(m.location.snippet || redactedValue, [
            m.matchedValue,
          ]);

          findings.push(
            createFinding({
              ruleId: this.id,
              title: `Potential credential detected: ${m.secretType}`,
              severity: 'critical',
              category: this.category,
              message: `A potential credential matching pattern "${m.secretType}" was detected in ${file.relativePath}. Value masked: ${redactedValue}.`,
              evidence: safeEvidence,
              file: file.relativePath,
              line: m.location.line,
              column: m.location.column,
              remediation:
                'Remove the credential immediately, rotate the key in the provider dashboard, and store it securely using environment variables or a secret manager.',
              confidence: 'high',
              documentationUrl: this.documentationUrl,
            }),
          );
        }
      } else {
        const content = context.getFileContent(file.relativePath);
        if (!content) continue;

        for (const pattern of SECRET_PATTERNS) {
          pattern.regex.lastIndex = 0;
          let match: RegExpExecArray | null;

          while ((match = pattern.regex.exec(content)) !== null) {
            const secretValue = pattern.extractValue ? pattern.extractValue(match) : match[0];

            if (IGNORED_SECRET_PLACEHOLDERS.has(secretValue.toLowerCase())) {
              continue;
            }

            const loc = getLocationFromIndex(content, match.index);
            const redactedValue = redactSecret(secretValue);
            const safeEvidence = redactEvidence(loc.lineSnippet || redactedValue, [secretValue]);

            findings.push(
              createFinding({
                ruleId: this.id,
                title: `Potential credential detected: ${pattern.name}`,
                severity: 'critical',
                category: this.category,
                message: `A potential credential matching pattern "${pattern.name}" was detected in ${file.relativePath}. Value masked: ${redactedValue}.`,
                evidence: safeEvidence,
                file: file.relativePath,
                line: loc.line,
                column: loc.column,
                remediation:
                  'Remove the credential immediately, rotate the key in the provider dashboard, and store it securely using environment variables or a secret manager.',
                confidence: 'high',
                documentationUrl: this.documentationUrl,
              }),
            );
          }
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
