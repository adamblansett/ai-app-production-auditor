import type { Finding } from './finding.js';
import type { Severity } from './finding.js';
import type { ProjectInfo } from '../discovery/types.js';
import type { CollectedFile } from '../fs/file-collector.js';

export interface RuleContext {
  targetDir: string;
  project: ProjectInfo;
  files: readonly CollectedFile[];
  config: RuleConfigMap;
  getFileContent(relativePath: string): string | null;
  hasFile(relativePath: string): boolean;
}

export type RuleConfigMap = Record<
  string,
  {
    enabled?: boolean;
    severity?: Severity;
  }
>;

export interface CheckStatus {
  id: string;
  name: string;
  description: string;
  status: 'completed' | 'skipped' | 'failed';
  skippedReason?: string | null;
}

export interface RuleResult {
  ruleId: string;
  name: string;
  description: string;
  findings: Finding[];
  skipped?: boolean;
  skippedReason?: string;
}

export interface Rule {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly category: string;
  readonly defaultSeverity: Severity;
  readonly documentationUrl?: string;

  execute(context: RuleContext): Promise<RuleResult> | RuleResult;
}
