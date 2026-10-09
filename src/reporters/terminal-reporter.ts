import type { AuditReport } from '../models/report.js';
import type { Finding, Severity } from '../models/finding.js';
import { c } from '../utils/text.js';

export function formatTerminalReport(report: AuditReport, verbose = false): string {
  const lines: string[] = [];

  // Header Banner
  lines.push('');
  lines.push(c.bold(c.cyan('========================================================')));
  lines.push(c.bold(c.cyan('              AI APP PRODUCTION AUDITOR                 ')));
  lines.push(c.bold(c.cyan('========================================================')));
  lines.push('');

  // Project Info
  lines.push(
    c.bold('Project: ') +
      c.cyan(report.project.name) +
      (report.project.version ? ` (v${report.project.version})` : ''),
  );
  lines.push(c.bold('Type:    ') + report.project.type);
  if (report.project.frameworks.length > 0) {
    lines.push(c.bold('Stack:   ') + report.project.frameworks.join(', '));
  }
  if (report.project.tools.length > 0) {
    lines.push(c.bold('Tools:   ') + report.project.tools.join(', '));
  }
  lines.push(c.bold('Target:  ') + c.dim(report.scan.targetDirectory));
  lines.push('');

  // Summary Counts
  lines.push(c.bold('AUDIT SUMMARY'));
  lines.push(
    `  Files Scanned: ${report.summary.filesScanned} | Duration: ${report.summary.durationMs}ms`,
  );
  lines.push(
    `  Checks Run:    ${report.summary.passedChecks} completed, ${report.summary.skippedChecks} skipped, ${report.summary.failedChecks} failed`,
  );
  lines.push('');

  const s = report.summary;
  lines.push(
    `  ${c.bold('Total Findings:')} ${s.totalFindings}  [` +
      (s.critical > 0 ? c.bold(c.red(`Critical: ${s.critical}`)) : c.dim('Critical: 0')) +
      ', ' +
      (s.high > 0 ? c.bold(c.red(`High: ${s.high}`)) : c.dim('High: 0')) +
      ', ' +
      (s.medium > 0 ? c.bold(c.yellow(`Medium: ${s.medium}`)) : c.dim('Medium: 0')) +
      ', ' +
      (s.low > 0 ? c.blue(`Low: ${s.low}`) : c.dim('Low: 0')) +
      ', ' +
      (s.info > 0 ? c.dim(`Info: ${s.info}`) : c.dim('Info: 0')) +
      ']',
  );
  lines.push('');

  // Findings Grouped by Severity
  if (report.findings.length === 0) {
    lines.push(c.bold(c.green('✓ No production-readiness issues detected!')));
    lines.push('');
  } else {
    lines.push(c.bold('FINDINGS'));
    lines.push('');

    const severityOrder: Severity[] = ['critical', 'high', 'medium', 'low', 'info'];

    for (const sev of severityOrder) {
      const matching = report.findings.filter((f) => f.severity === sev);
      if (matching.length === 0) continue;

      for (const finding of matching) {
        lines.push(formatFinding(finding));
      }
    }
  }

  // Checks Completed & Skipped
  if (verbose) {
    lines.push(c.bold('CHECKS BREAKDOWN'));
    for (const check of report.checks) {
      const mark =
        check.status === 'completed'
          ? c.green('✓')
          : check.status === 'skipped'
            ? c.yellow('⊘')
            : c.red('✗');
      const reason = check.skippedReason ? ` (${check.skippedReason})` : '';
      lines.push(`  ${mark} [${check.id}] ${check.name}${c.dim(reason)}`);
    }
    lines.push('');

    if (report.skippedFiles.length > 0) {
      lines.push(c.bold(`SKIPPED FILES (${report.skippedFiles.length})`));
      for (const skipped of report.skippedFiles.slice(0, 10)) {
        lines.push(`  ${c.dim('•')} ${skipped.path} - ${c.dim(skipped.reason)}`);
      }
      if (report.skippedFiles.length > 10) {
        lines.push(`  ${c.dim(`... and ${report.skippedFiles.length - 10} more files`)}`);
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}

function formatFinding(finding: Finding): string {
  const lines: string[] = [];
  const sevBadge = formatSeverityBadge(finding.severity);
  const loc = finding.file
    ? `${finding.file}${finding.line ? `:${finding.line}` : ''}${finding.column ? `:${finding.column}` : ''}`
    : 'project root';

  lines.push(`${sevBadge} ${c.bold(finding.title)} ${c.dim(`[${finding.ruleId}]`)}`);
  lines.push(`  ${c.bold('Location:')} ${loc}`);
  lines.push(`  ${c.bold('Issue:')}    ${finding.message}`);

  if (finding.evidence) {
    lines.push(`  ${c.bold('Evidence:')} ${c.dim(finding.evidence)}`);
  }

  lines.push(`  ${c.bold('Action:')}   ${c.cyan(finding.remediation)}`);
  lines.push('');
  return lines.join('\n');
}

function formatSeverityBadge(severity: Severity): string {
  switch (severity) {
    case 'critical':
      return c.bold(c.red('[CRITICAL]'));
    case 'high':
      return c.bold(c.red('[HIGH]    '));
    case 'medium':
      return c.bold(c.yellow('[MEDIUM]  '));
    case 'low':
      return c.bold(c.blue('[LOW]     '));
    case 'info':
      return c.dim('[INFO]    ');
  }
}
