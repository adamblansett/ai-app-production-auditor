import { z } from 'zod';

export const RuleConfigSchema = z.object({
  enabled: z.boolean().optional(),
  severity: z.enum(['critical', 'high', 'medium', 'low', 'info']).optional(),
});

export const AuditorConfigSchema = z.object({
  schemaVersion: z.literal(1).default(1),
  severityThreshold: z
    .enum(['critical', 'high', 'medium', 'low', 'info', 'none'])
    .default('high')
    .optional(),
  rules: z.record(z.string(), RuleConfigSchema).optional().default({}),
  ignorePaths: z.array(z.string()).optional().default([]),
  limits: z
    .object({
      maxFiles: z.number().int().positive().optional(),
      maxFileSizeBytes: z.number().int().positive().optional(),
    })
    .optional(),
  followSymlinks: z.boolean().optional().default(false),
});

export type AuditorConfig = z.infer<typeof AuditorConfigSchema>;
export type RuleConfig = z.infer<typeof RuleConfigSchema>;
