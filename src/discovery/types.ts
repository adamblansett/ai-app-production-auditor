export interface ProjectInfo {
  name: string;
  version: string | null;
  type: 'typescript' | 'javascript' | 'unknown';
  frameworks: string[];
  tools: string[];
  isMonorepo: boolean;
  packageCount: number;
  hasPackageJson: boolean;
  packageJsonRaw: Record<string, unknown> | null;
  packageJsonError?: string | null;
}
