import path from 'node:path';
import type { AuditorConfig } from '../config/schema.js';
import { DEFAULT_CONFIG } from '../config/loader.js';
import { validateDirectory } from '../fs/path-utils.js';
import { collectFiles } from '../fs/file-collector.js';
import { detectProject } from '../discovery/project-detector.js';
import { createDefaultRules } from '../rules/rule-registry.js';
import type { RuleContext, CheckStatus } from '../models/rule.js';
import { AuditReportSchema, type AuditReport, type ScanSummary } from '../models/report.js';
import type { Finding, Severity } from '../models/finding.js';
import { SourceAnalyzer } from '../analysis/source-analysis.js';

export interface AuditOptions {
  config?: AuditorConfig;
  rules?: ReturnType<typeof createDefaultRules>;
}

export async function runAudit(
  targetDir: string,
  options: AuditOptions = {},
): Promise<AuditReport> {
  const startTime = Date.now();

  const dirValidation = validateDirectory(targetDir);
  if (!dirValidation.valid) {
    throw new Error(dirValidation.error || `Invalid target directory: ${targetDir}`);
  }

  const resolvedTarget = dirValidation.resolvedPath;
  const config = options.config ?? DEFAULT_CONFIG;

  // Safe file collection with bounds and limits
  const fileCollection = collectFiles(resolvedTarget, {
    limits: {
      maxFiles: config.limits?.maxFiles ?? 5000,
      maxFileSizeBytes: config.limits?.maxFileSizeBytes ?? 1024 * 1024,
    },
    ignorePaths: config.ignorePaths,
    followSymlinks: config.followSymlinks ?? false,
  });

  // Project discovery
  const project = detectProject(resolvedTarget);

  // Initialize AST source analyzer for syntax-aware static analysis
  const analyzer = new SourceAnalyzer(fileCollection);

  // Build rule context
  const ruleContext: RuleContext = {
    targetDir: resolvedTarget,
    project,
    files: fileCollection.files,
    config: config.rules ?? {},
    getFileContent: fileCollection.getFileContent,
    hasFile: fileCollection.hasFile,
    analyzer,
  };

  const rules = options.rules ?? createDefaultRules();
  const allFindings: Finding[] = [];
  const checks: CheckStatus[] = [];

  for (const rule of rules) {
    const ruleConfig = config.rules?.[rule.id];
    if (ruleConfig?.enabled === false) {
      checks.push({
        id: rule.id,
        name: rule.name,
        description: rule.description,
        status: 'skipped',
        skippedReason: 'Disabled in auditor configuration',
      });
      continue;
    }

    try {
      const result = await rule.execute(ruleContext);

      if (result.skipped) {
        checks.push({
          id: rule.id,
          name: rule.name,
          description: rule.description,
          status: 'skipped',
          skippedReason: result.skippedReason ?? 'Condition not applicable',
        });
        continue;
      }

      // Apply severity override if configured
      const findingsWithOverrides = result.findings.map((f) => {
        if (ruleConfig?.severity) {
          return { ...f, severity: ruleConfig.severity as Severity };
        }
        return f;
      });

      allFindings.push(...findingsWithOverrides);

      checks.push({
        id: rule.id,
        name: rule.name,
        description: rule.description,
        status: 'completed',
      });
    } catch (err) {
      checks.push({
        id: rule.id,
        name: rule.name,
        description: rule.description,
        status: 'failed',
        skippedReason: `Rule execution failed: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  // Calculate scan summary
  const severityCounts: Record<Severity, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
  };

  for (const finding of allFindings) {
    severityCounts[finding.severity] = (severityCounts[finding.severity] || 0) + 1;
  }

  const completedChecks = checks.filter((c) => c.status === 'completed');
  const skippedChecks = checks.filter((c) => c.status === 'skipped');
  const failedCheckCount = checks.filter((c) => c.status === 'failed').length;

  const summary: ScanSummary = {
    totalFindings: allFindings.length,
    critical: severityCounts.critical,
    high: severityCounts.high,
    medium: severityCounts.medium,
    low: severityCounts.low,
    info: severityCounts.info,
    passedChecks: completedChecks.length,
    failedChecks: failedCheckCount,
    skippedChecks: skippedChecks.length,
    filesScanned: fileCollection.files.length,
    durationMs: Date.now() - startTime,
  };

  const report: AuditReport = {
    schemaVersion: '1.0.0',
    tool: {
      name: 'ai-app-production-auditor',
      version: '0.1.0',
      author: 'Adam Blansett',
      homepage: 'https://adamblansett.com',
    },
    scan: {
      timestamp: new Date().toISOString(),
      targetDirectory: path.resolve(targetDir),
      durationMs: summary.durationMs,
    },
    project: {
      name: project.name,
      version: project.version,
      type: project.type,
      frameworks: project.frameworks,
      tools: project.tools,
      isMonorepo: project.isMonorepo,
      packageCount: project.packageCount,
      hasPackageJson: project.hasPackageJson,
    },
    summary,
    findings: allFindings,
    checks,
    skippedFiles: [
      ...fileCollection.skippedFiles.map((s) => ({
        path: s.path,
        reason: s.reason,
      })),
      ...analyzer.getParseDiagnostics().map((d) => ({
        path: d.path,
        reason: `Source parsing syntax warning: ${d.message}`,
      })),
    ],
  };

  // Validate the final report structure against the Zod schema
  return AuditReportSchema.parse(report);
}
