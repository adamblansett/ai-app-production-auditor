import type { Rule, RuleContext, RuleResult } from '../models/rule.js';
import { createFinding, type Finding } from '../models/finding.js';
import { getLocationFromIndex } from '../utils/text.js';

// Standard system and platform-supplied variables to exclude from example file requirements
const IGNORED_ENV_VARS = new Set([
  'NODE_ENV',
  'PORT',
  'CI',
  'TZ',
  'DEBUG',
  'HOME',
  'PATH',
  'PWD',
  'SHELL',
  'USER',
  'HOSTNAME',
  // Vite built-ins
  'BASE_URL',
  'MODE',
  'DEV',
  'PROD',
  'SSR',
  // Next.js / Vercel built-ins
  'VERCEL',
  'VERCEL_ENV',
  'VERCEL_URL',
  'VERCEL_REGION',
  'VERCEL_GIT_COMMIT_SHA',
  'NEXT_RUNTIME',
]);

const PROCESS_ENV_REGEX =
  /(?:process\.env(?:\.([A-Z0-9_]+)|\[['"]([A-Z0-9_]+)['"]\])|import\.meta\.env(?:\.([A-Z0-9_]+)|\[['"]([A-Z0-9_]+)['"]\]))/g;

const SOURCE_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.vue',
  '.svelte',
]);

export class EnvConsistencyRule implements Rule {
  readonly id = 'ENV001';
  readonly name = 'Environment Variable Missing from Example Configuration';
  readonly description =
    'Identifies environment variables referenced in application source that are missing from example environment files (.env.example, .env.template).';
  readonly category = 'configuration';
  readonly defaultSeverity = 'medium';
  readonly documentationUrl =
    'https://github.com/adamblansett/ai-app-production-auditor#env-consistency';

  execute(context: RuleContext): RuleResult {
    const findings: Finding[] = [];

    // Find example environment file (.env.example or .env.template or .env.sample)
    const exampleFileCandidates = ['.env.example', '.env.template', '.env.sample'];
    let exampleFilePath: string | null = null;
    let declaredVariables = new Set<string>();

    for (const candidate of exampleFileCandidates) {
      if (context.hasFile(candidate)) {
        exampleFilePath = candidate;
        const content = context.getFileContent(candidate);
        if (content) {
          declaredVariables = parseEnvKeys(content);
        }
        break;
      }
    }

    // Collect all referenced environment variables from source files
    const referencedVars = new Map<
      string,
      { file: string; line: number; column: number; snippet: string }[]
    >();

    for (const file of context.files) {
      if (!SOURCE_EXTENSIONS.has(file.extension)) continue;

      // Skip test files and fixtures
      if (
        file.relativePath.includes('__tests__/') ||
        file.relativePath.includes('/fixtures/') ||
        file.relativePath.startsWith('fixtures/') ||
        /\.(test|spec)\.[a-z0-9]+$/i.test(file.relativePath)
      ) {
        continue;
      }

      const content = context.getFileContent(file.relativePath);
      if (!content) continue;

      PROCESS_ENV_REGEX.lastIndex = 0;
      let match: RegExpExecArray | null;

      while ((match = PROCESS_ENV_REGEX.exec(content)) !== null) {
        const varName = match[1] || match[2] || match[3] || match[4];
        if (!varName) continue;

        if (IGNORED_ENV_VARS.has(varName)) {
          continue;
        }

        const loc = getLocationFromIndex(content, match.index);
        const occurrences = referencedVars.get(varName) ?? [];
        occurrences.push({
          file: file.relativePath,
          line: loc.line,
          column: loc.column,
          snippet: loc.lineSnippet,
        });
        referencedVars.set(varName, occurrences);
      }
    }

    // If source references custom variables but NO example file exists at all
    if (referencedVars.size > 0 && !exampleFilePath) {
      findings.push(
        createFinding({
          ruleId: 'ENV002',
          title: 'Missing example environment configuration file (.env.example)',
          severity: 'medium',
          category: this.category,
          message: `The application references ${referencedVars.size} environment variable(s) (such as ${[...referencedVars.keys()].slice(0, 3).join(', ')}), but no .env.example or .env.template file was found.`,
          evidence: `Source files reference: ${[...referencedVars.keys()].slice(0, 5).join(', ')}`,
          file: null,
          remediation:
            'Create a .env.example file documenting all required environment variables with placeholder values.',
          confidence: 'high',
          documentationUrl: this.documentationUrl,
        }),
      );
    } else if (exampleFilePath) {
      // Check for variables referenced in code but missing from example file
      for (const [varName, occurrences] of referencedVars.entries()) {
        if (!declaredVariables.has(varName)) {
          const firstOccur = occurrences[0];
          findings.push(
            createFinding({
              ruleId: this.id,
              title: `Environment variable "${varName}" missing from ${exampleFilePath}`,
              severity: 'medium',
              category: this.category,
              message: `The variable "${varName}" is referenced in ${occurrences.length} place(s) in source code, but is not declared in ${exampleFilePath}.`,
              evidence: firstOccur?.snippet || `process.env.${varName}`,
              file: firstOccur?.file ?? exampleFilePath,
              line: firstOccur?.line ?? null,
              column: firstOccur?.column ?? null,
              remediation: `Add "${varName}=your_${varName.toLowerCase()}_here" to ${exampleFilePath} to document expected configuration.`,
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

function parseEnvKeys(content: string): Set<string> {
  const keys = new Set<string>();
  const lines = content.split('\n');
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    // Format: KEY=VALUE or export KEY=VALUE
    const cleanLine = line.startsWith('export ') ? line.slice(7).trim() : line;
    const eqIndex = cleanLine.indexOf('=');
    if (eqIndex > 0) {
      const key = cleanLine.slice(0, eqIndex).trim();
      if (/^[A-Za-z0-9_]+$/.test(key)) {
        keys.add(key);
      }
    } else if (/^[A-Za-z0-9_]+$/.test(cleanLine)) {
      keys.add(cleanLine);
    }
  }
  return keys;
}
