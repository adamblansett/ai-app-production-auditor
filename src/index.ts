export { runAudit, type AuditOptions } from './core/engine.js';
export { detectProject } from './discovery/project-detector.js';
export type { ProjectInfo } from './discovery/types.js';

export { loadConfig, DEFAULT_CONFIG, type ConfigLoadResult } from './config/loader.js';
export { AuditorConfigSchema, type AuditorConfig, type RuleConfig } from './config/schema.js';

export {
  FindingSchema,
  createFinding,
  type Finding,
  type FindingInput,
  type Severity,
  type Confidence,
  SEVERITY_LEVELS,
  SEVERITY_WEIGHT,
  CONFIDENCE_LEVELS,
} from './models/finding.js';

export {
  AuditReportSchema,
  type AuditReport,
  type ProjectSummary,
  type ScanSummary,
} from './models/report.js';

export type { Rule, RuleContext, RuleResult, CheckStatus } from './models/rule.js';
export { createDefaultRules } from './rules/rule-registry.js';
export * from './rules/index.js';

export {
  ExitCode,
  determineExitCode,
  type ExitCodeValue,
  type FailureThreshold,
} from './cli/exit-codes.js';

export { formatTerminalReport } from './reporters/terminal-reporter.js';
export { formatMarkdownReport } from './reporters/markdown-reporter.js';
export { formatJsonReport } from './reporters/json-reporter.js';
export { writeReportToFile, type WriteReportOptions } from './reporters/writer.js';

export { redactSecret, redactEvidence, maskSensitiveValue } from './utils/redaction.js';
export { collectFiles, type CollectedFile, type SkippedFile } from './fs/file-collector.js';
export { validateDirectory, isPathInside, normalizePath } from './fs/path-utils.js';
export * from './analysis/index.js';
