import fs from 'node:fs';
import path from 'node:path';
import { AuditorConfigSchema, type AuditorConfig } from './schema.js';

export const DEFAULT_CONFIG: AuditorConfig = {
  schemaVersion: 1,
  severityThreshold: 'high',
  rules: {},
  ignorePaths: [],
  limits: {
    maxFiles: 5000,
    maxFileSizeBytes: 1024 * 1024,
  },
  followSymlinks: false,
};

export interface ConfigLoadResult {
  config: AuditorConfig;
  configFilePath: string | null;
}

export function loadConfig(targetDir: string, explicitConfigPath?: string): ConfigLoadResult {
  if (explicitConfigPath) {
    const resolvedPath = path.resolve(explicitConfigPath);
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Configuration file not found: ${explicitConfigPath}`);
    }

    return readAndValidateConfigFile(resolvedPath);
  }

  // Look for configuration candidates in the target directory
  const candidateNames = ['.auditorrc.json', '.auditorrc', 'auditor.config.json'];
  for (const name of candidateNames) {
    const candidatePath = path.join(targetDir, name);
    if (fs.existsSync(candidatePath)) {
      return readAndValidateConfigFile(candidatePath);
    }
  }

  // Check package.json for an "auditor" configuration section
  const packageJsonPath = path.join(targetDir, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    try {
      const rawText = fs.readFileSync(packageJsonPath, 'utf8');
      const parsed = JSON.parse(rawText);
      if (parsed && typeof parsed === 'object' && parsed.auditor) {
        const parseResult = AuditorConfigSchema.safeParse(parsed.auditor);
        if (parseResult.success) {
          return {
            config: parseResult.data,
            configFilePath: packageJsonPath,
          };
        }
      }
    } catch {
      // Continue to default config if package.json cannot be read as config
    }
  }

  return {
    config: DEFAULT_CONFIG,
    configFilePath: null,
  };
}

function readAndValidateConfigFile(filePath: string): ConfigLoadResult {
  let rawText: string;
  try {
    rawText = fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    throw new Error(
      `Failed to read configuration file at ${filePath}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawText);
  } catch (err) {
    throw new Error(
      `Malformed JSON in configuration file at ${filePath}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const parseResult = AuditorConfigSchema.safeParse(parsedJson);
  if (!parseResult.success) {
    const formattedErrors = parseResult.error.issues
      .map((issue) => `  - ${issue.path.join('.') || 'root'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid configuration in ${filePath}:\n${formattedErrors}`);
  }

  return {
    config: parseResult.data,
    configFilePath: filePath,
  };
}
