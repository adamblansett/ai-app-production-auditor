import fs from 'node:fs';
import path from 'node:path';

export interface WriteReportOptions {
  outputPath: string;
  content: string;
  force?: boolean;
}

export function writeReportToFile(options: WriteReportOptions): void {
  const resolved = path.resolve(options.outputPath);

  // Check if target file already exists
  if (fs.existsSync(resolved) && !options.force) {
    throw new Error(
      `Output file already exists at "${resolved}". Specify --force to overwrite existing files.`,
    );
  }

  // Ensure parent directory exists
  const parentDir = path.dirname(resolved);
  if (!fs.existsSync(parentDir)) {
    fs.mkdirSync(parentDir, { recursive: true });
  }

  // Write content safely
  fs.writeFileSync(resolved, options.content, 'utf8');
}
