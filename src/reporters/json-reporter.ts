import type { AuditReport } from '../models/report.js';

export function formatJsonReport(report: AuditReport): string {
  return JSON.stringify(report, null, 2);
}
