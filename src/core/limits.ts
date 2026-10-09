export interface ScanLimits {
  readonly maxFiles: number;
  readonly maxFileSizeBytes: number;
}

export const DEFAULT_LIMITS: ScanLimits = {
  maxFiles: 5000,
  maxFileSizeBytes: 1024 * 1024, // 1 MB
};
