import { z } from 'zod';
import { FindingSchema } from './finding.js';

export const CheckStatusSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  status: z.enum(['completed', 'skipped', 'failed']),
  skippedReason: z.string().nullable().optional(),
});

export const ProjectSummarySchema = z.object({
  name: z.string(),
  version: z.string().nullable(),
  type: z.enum(['typescript', 'javascript', 'unknown']),
  frameworks: z.array(z.string()),
  tools: z.array(z.string()),
  isMonorepo: z.boolean(),
  packageCount: z.number().int().nonnegative(),
  hasPackageJson: z.boolean(),
});

export const ScanSummarySchema = z.object({
  totalFindings: z.number().int().nonnegative(),
  critical: z.number().int().nonnegative(),
  high: z.number().int().nonnegative(),
  medium: z.number().int().nonnegative(),
  low: z.number().int().nonnegative(),
  info: z.number().int().nonnegative(),
  passedChecks: z.number().int().nonnegative(),
  failedChecks: z.number().int().nonnegative(),
  skippedChecks: z.number().int().nonnegative(),
  filesScanned: z.number().int().nonnegative(),
  durationMs: z.number().nonnegative(),
});

export const AuditReportSchema = z.object({
  schemaVersion: z.string(),
  tool: z.object({
    name: z.string(),
    version: z.string(),
    author: z.string(),
    homepage: z.string(),
  }),
  scan: z.object({
    timestamp: z.string(),
    targetDirectory: z.string(),
    durationMs: z.number().nonnegative(),
  }),
  project: ProjectSummarySchema,
  summary: ScanSummarySchema,
  findings: z.array(FindingSchema),
  checks: z.array(CheckStatusSchema),
  skippedFiles: z.array(
    z.object({
      path: z.string(),
      reason: z.string(),
    }),
  ),
});

export type AuditReport = z.infer<typeof AuditReportSchema>;
export type ProjectSummary = z.infer<typeof ProjectSummarySchema>;
export type ScanSummary = z.infer<typeof ScanSummarySchema>;
