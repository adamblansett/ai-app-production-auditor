import type { Rule, RuleContext, RuleResult } from '../models/rule.js';
import { createFinding, type Finding } from '../models/finding.js';
import { getLocationFromIndex } from '../utils/text.js';

// Matches http://localhost, https://localhost, 127.0.0.1, [::1], 0.0.0.0 with optional port and path
const LOCALHOST_URL_REGEX =
  /\bhttps?:\/\/(?:localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)(?::\d{1,5})?(?:\/[^\s"'`<>)]*)?/gi;

const EXCLUDED_EXTENSIONS = new Set([
  '.md',
  '.markdown',
  '.txt',
  '.lock',
  '.log',
  '.svg',
  '.png',
  '.jpg',
  '.jpeg',
]);

export class LocalhostUrlRule implements Rule {
  readonly id = 'URL001';
  readonly name = 'Hardcoded Localhost URL in Application Code';
  readonly description =
    'Detects hardcoded localhost and loopback IP addresses in application source and configuration files.';
  readonly category = 'configuration';
  readonly defaultSeverity = 'medium';
  readonly documentationUrl =
    'https://github.com/adamblansett/ai-app-production-auditor#localhost-urls';

  execute(context: RuleContext): RuleResult {
    const findings: Finding[] = [];

    for (const file of context.files) {
      if (EXCLUDED_EXTENSIONS.has(file.extension)) {
        continue;
      }

      // Check if file is a test file or fixture
      const isTestFile =
        file.relativePath.includes('__tests__/') ||
        file.relativePath.includes('/fixtures/') ||
        file.relativePath.startsWith('fixtures/') ||
        /\.(test|spec)\.[a-z0-9]+$/i.test(file.relativePath);

      if (isTestFile) {
        // Skip test files to avoid false positives on mock servers
        continue;
      }

      const content = context.getFileContent(file.relativePath);
      if (!content) continue;

      let match: RegExpExecArray | null;
      LOCALHOST_URL_REGEX.lastIndex = 0;

      while ((match = LOCALHOST_URL_REGEX.exec(content)) !== null) {
        const url = match[0];
        const index = match.index;
        const loc = getLocationFromIndex(content, index);

        findings.push(
          createFinding({
            ruleId: this.id,
            title: 'Hardcoded localhost URL detected',
            severity: 'medium',
            category: this.category,
            message: `A hardcoded development URL (${url}) was detected in ${file.relativePath}. If deployed to production, client requests will target the end-user's local machine or fail to resolve.`,
            evidence: loc.lineSnippet || url,
            file: file.relativePath,
            line: loc.line,
            column: loc.column,
            remediation:
              'Replace the hardcoded URL with a dynamic environment variable (e.g. process.env.API_URL or NEXT_PUBLIC_API_URL) or a relative path.',
            confidence: 'high',
            documentationUrl: this.documentationUrl,
          }),
        );
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
