import type ts from 'typescript';

export interface SourceLocation {
  line: number;
  column: number;
  snippet: string;
}

export interface ParsedSourceFile {
  readonly relativePath: string;
  readonly absolutePath: string;
  readonly sourceFile: ts.SourceFile;
  readonly hasSyntaxErrors: boolean;
  readonly syntaxDiagnostics: readonly string[];
}

export interface LocalhostUrlMatch {
  readonly url: string;
  readonly location: SourceLocation;
  readonly node: ts.Node;
}

export interface EnvVarReference {
  readonly name: string;
  readonly location: SourceLocation;
  readonly isDynamic: boolean;
  readonly isDestructured: boolean;
  readonly rawExpression: string;
}

export interface InsecureTlsMatch {
  readonly pattern: string;
  readonly location: SourceLocation;
  readonly confidence: 'high' | 'medium';
  readonly explanation: string;
}

export interface ClientSecretExposure {
  readonly variableName: string;
  readonly location: SourceLocation;
  readonly rawValue?: string;
  readonly confidence: 'high' | 'medium';
}

export interface SecretLiteralMatch {
  readonly secretType: string;
  readonly matchedValue: string;
  readonly location: SourceLocation;
}
