import type { Rule, RuleContext, RuleResult } from '../models/rule.js';
import { createFinding, type Finding } from '../models/finding.js';

export class AiSafetyRule implements Rule {
  readonly id = 'AI001';
  readonly name = 'AI-Generated Application Safety and Hygiene';
  readonly description =
    'Identifies AI application anti-patterns including dangerouslyAllowBrowser bypasses, direct client-side LLM SDK usage, raw stream DOM injection (XSS), and unfinished AI scaffolding stubs.';
  readonly category = 'security';
  readonly defaultSeverity = 'high';
  readonly documentationUrl =
    'https://github.com/adamblansett/ai-app-production-auditor#ai-safety-heuristics';

  execute(context: RuleContext): RuleResult {
    const findings: Finding[] = [];

    for (const file of context.files) {
      if (context.analyzer?.isEligibleForAst(file.relativePath)) {
        const matches = context.analyzer.analyzeAiSafety(file);

        for (const match of matches) {
          switch (match.issueType) {
            case 'client_browser_guard_bypass':
              findings.push(
                createFinding({
                  ruleId: 'AI001',
                  title: 'Client-side AI model execution / browser guard bypass',
                  severity: 'high',
                  category: this.category,
                  message: match.explanation,
                  evidence: match.snippet,
                  file: file.relativePath,
                  line: match.location.line,
                  column: match.location.column,
                  remediation:
                    'Execute AI model requests server-side via backend API routes. Never expose API keys or enable dangerouslyAllowBrowser in client code.',
                  confidence: match.confidence,
                  documentationUrl: this.documentationUrl,
                }),
              );
              break;

            case 'raw_stream_dom_injection':
              findings.push(
                createFinding({
                  ruleId: 'AI002',
                  title: 'Unsanitized AI response / stream rendered to DOM (XSS risk)',
                  severity: 'high',
                  category: this.category,
                  message: match.explanation,
                  evidence: match.snippet,
                  file: file.relativePath,
                  line: match.location.line,
                  column: match.location.column,
                  remediation:
                    'Sanitize AI output using a trusted HTML sanitizer (e.g. DOMPurify.sanitize) before rendering to the DOM.',
                  confidence: match.confidence,
                  documentationUrl: this.documentationUrl,
                }),
              );
              break;

            case 'unimplemented_stub':
              findings.push(
                createFinding({
                  ruleId: 'AI003',
                  title: 'Unimplemented AI scaffolding stub in production file',
                  severity: 'medium',
                  category: 'quality',
                  message: match.explanation,
                  evidence: match.snippet,
                  file: file.relativePath,
                  line: match.location.line,
                  column: match.location.column,
                  remediation:
                    'Complete the scaffolded function or route handler with production logic before deployment.',
                  confidence: match.confidence,
                  documentationUrl: this.documentationUrl,
                }),
              );
              break;

            case 'dummy_credential':
              findings.push(
                createFinding({
                  ruleId: 'AI003',
                  title: 'Placeholder or dummy credential in application source',
                  severity: 'medium',
                  category: 'security',
                  message: match.explanation,
                  evidence: match.snippet,
                  file: file.relativePath,
                  line: match.location.line,
                  column: match.location.column,
                  remediation:
                    'Replace placeholder or dummy credentials with production secret management or environment variables.',
                  confidence: match.confidence,
                  documentationUrl: this.documentationUrl,
                }),
              );
              break;
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
