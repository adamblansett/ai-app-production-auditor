import { z } from 'zod';

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type Confidence = 'high' | 'medium' | 'low';

export const SEVERITY_LEVELS: readonly Severity[] = [
  'critical',
  'high',
  'medium',
  'low',
  'info',
] as const;

export const SEVERITY_WEIGHT: Record<Severity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
  info: 0,
};

export const CONFIDENCE_LEVELS: readonly Confidence[] = ['high', 'medium', 'low'] as const;

export const FindingSchema = z.object({
  id: z.string(),
  ruleId: z.string(),
  title: z.string(),
  severity: z.enum(['critical', 'high', 'medium', 'low', 'info']),
  category: z.string(),
  message: z.string(),
  evidence: z.string(),
  file: z.string().nullable(),
  line: z.number().int().positive().nullable(),
  column: z.number().int().positive().nullable(),
  remediation: z.string(),
  confidence: z.enum(['high', 'medium', 'low']),
  documentationUrl: z.string().nullable(),
});

export type Finding = z.infer<typeof FindingSchema>;

export interface FindingInput {
  ruleId: string;
  title: string;
  severity: Severity;
  category: string;
  message: string;
  evidence: string;
  file?: string | null;
  line?: number | null;
  column?: number | null;
  remediation: string;
  confidence?: Confidence;
  documentationUrl?: string | null;
}

export function createFinding(input: FindingInput): Finding {
  const filePart = input.file ? input.file.replace(/[^a-zA-Z0-9_-]/g, '_') : 'root';
  const linePart = input.line ? `L${input.line}` : '0';
  const colPart = input.column ? `C${input.column}` : '0';
  const hash = Math.abs(simpleHash(`${input.ruleId}:${input.message}:${input.evidence}`)).toString(
    36,
  );
  const id = `${input.ruleId}-${filePart}-${linePart}:${colPart}-${hash}`;

  return FindingSchema.parse({
    id,
    ruleId: input.ruleId,
    title: input.title,
    severity: input.severity,
    category: input.category,
    message: input.message,
    evidence: input.evidence,
    file: input.file ?? null,
    line: input.line ?? null,
    column: input.column ?? null,
    remediation: input.remediation,
    confidence: input.confidence ?? 'high',
    documentationUrl: input.documentationUrl ?? null,
  });
}

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return hash;
}
