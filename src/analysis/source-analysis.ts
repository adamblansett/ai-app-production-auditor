import type { CollectedFile, FileCollectionResult } from '../fs/file-collector.js';
import { isSupportedScriptFile, parseSource } from './parser.js';
import type {
  ParsedSourceFile,
  LocalhostUrlMatch,
  EnvVarReference,
  InsecureTlsMatch,
  ClientSecretExposure,
  SecretLiteralMatch,
} from './types.js';
import { findLocalhostUrlsInAst } from './visitors/url-visitor.js';
import { findEnvironmentVariablesInAst } from './visitors/environment-visitor.js';
import {
  findInsecureTlsInAst,
  findClientExposedSecretsInAst,
  findSecretLiteralsInAst,
} from './visitors/security-visitor.js';

export class SourceAnalyzer {
  private readonly fileCollection: FileCollectionResult;
  private readonly parsedFiles = new Map<string, ParsedSourceFile | null>();

  // Cached analysis results per file
  private readonly localhostCache = new Map<string, LocalhostUrlMatch[]>();
  private readonly envVarCache = new Map<string, EnvVarReference[]>();
  private readonly tlsCache = new Map<string, InsecureTlsMatch[]>();
  private readonly clientExposureCache = new Map<string, ClientSecretExposure[]>();
  private readonly secretLiteralCache = new Map<string, SecretLiteralMatch[]>();

  constructor(fileCollection: FileCollectionResult) {
    this.fileCollection = fileCollection;
  }

  isEligibleForAst(relativePath: string): boolean {
    return isSupportedScriptFile(relativePath);
  }

  getParsedSource(relativePath: string): ParsedSourceFile | null {
    if (!this.isEligibleForAst(relativePath)) {
      return null;
    }

    if (this.parsedFiles.has(relativePath)) {
      return this.parsedFiles.get(relativePath) ?? null;
    }

    const content = this.fileCollection.getFileContent(relativePath);
    if (content === null) {
      this.parsedFiles.set(relativePath, null);
      return null;
    }

    const file = this.fileCollection.files.find((f) => f.relativePath === relativePath);
    const absolutePath = file ? file.absolutePath : relativePath;

    const parsed = parseSource(relativePath, absolutePath, content);
    this.parsedFiles.set(relativePath, parsed);
    return parsed;
  }

  analyzeLocalhostUrls(file: CollectedFile): LocalhostUrlMatch[] {
    if (!this.isEligibleForAst(file.relativePath)) return [];
    if (this.localhostCache.has(file.relativePath)) {
      return this.localhostCache.get(file.relativePath)!;
    }

    const parsed = this.getParsedSource(file.relativePath);
    if (!parsed) return [];

    const results = findLocalhostUrlsInAst(parsed.sourceFile);
    this.localhostCache.set(file.relativePath, results);
    return results;
  }

  analyzeEnvironmentVariables(file: CollectedFile): EnvVarReference[] {
    if (!this.isEligibleForAst(file.relativePath)) return [];
    if (this.envVarCache.has(file.relativePath)) {
      return this.envVarCache.get(file.relativePath)!;
    }

    const parsed = this.getParsedSource(file.relativePath);
    if (!parsed) return [];

    const results = findEnvironmentVariablesInAst(parsed.sourceFile);
    this.envVarCache.set(file.relativePath, results);
    return results;
  }

  analyzeTlsConfiguration(file: CollectedFile): InsecureTlsMatch[] {
    if (!this.isEligibleForAst(file.relativePath)) return [];
    if (this.tlsCache.has(file.relativePath)) {
      return this.tlsCache.get(file.relativePath)!;
    }

    const parsed = this.getParsedSource(file.relativePath);
    if (!parsed) return [];

    const results = findInsecureTlsInAst(parsed.sourceFile);
    this.tlsCache.set(file.relativePath, results);
    return results;
  }

  analyzeClientExposure(file: CollectedFile): ClientSecretExposure[] {
    if (!this.isEligibleForAst(file.relativePath)) return [];
    if (this.clientExposureCache.has(file.relativePath)) {
      return this.clientExposureCache.get(file.relativePath)!;
    }

    const parsed = this.getParsedSource(file.relativePath);
    if (!parsed) return [];

    const results = findClientExposedSecretsInAst(parsed.sourceFile);
    this.clientExposureCache.set(file.relativePath, results);
    return results;
  }

  analyzeSecretLiterals(file: CollectedFile): SecretLiteralMatch[] {
    if (!this.isEligibleForAst(file.relativePath)) return [];
    if (this.secretLiteralCache.has(file.relativePath)) {
      return this.secretLiteralCache.get(file.relativePath)!;
    }

    const parsed = this.getParsedSource(file.relativePath);
    if (!parsed) return [];

    const results = findSecretLiteralsInAst(parsed.sourceFile);
    this.secretLiteralCache.set(file.relativePath, results);
    return results;
  }

  getParseDiagnostics(): Array<{ path: string; message: string }> {
    const list: Array<{ path: string; message: string }> = [];
    for (const [path, parsed] of this.parsedFiles.entries()) {
      if (parsed?.hasSyntaxErrors && parsed.syntaxDiagnostics.length > 0) {
        for (const diag of parsed.syntaxDiagnostics) {
          list.push({ path, message: diag });
        }
      }
    }
    return list;
  }
}
