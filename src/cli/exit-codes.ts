import type { Finding, Severity } from '../models/finding.js';
import { SEVERITY_WEIGHT } from '../models/finding.js';

export const ExitCode = {
  OK: 0,
  FAILURE: 1,
  INVALID_CONFIG_OR_USAGE: 2,
  OPERATIONAL_ERROR: 3,
} as const;

export type ExitCodeValue = (typeof ExitCode)[keyof typeof ExitCode];

export type FailureThreshold = Severity | 'none';

export function determineExitCode(
  findings: readonly Finding[],
  threshold: FailureThreshold = 'high',
): ExitCodeValue {
  if (threshold === 'none') {
    return ExitCode.OK;
  }

  const thresholdWeight = SEVERITY_WEIGHT[threshold];
  const hasFailingFindings = findings.some(
    (finding) => SEVERITY_WEIGHT[finding.severity] >= thresholdWeight,
  );

  return hasFailingFindings ? ExitCode.FAILURE : ExitCode.OK;
}
