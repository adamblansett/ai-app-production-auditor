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

export interface AiSafetyMatch {
  readonly issueType:
    | 'client_browser_guard_bypass'
    | 'raw_stream_dom_injection'
    | 'unimplemented_stub'
    | 'dummy_credential';
  readonly explanation: string;
  readonly location: SourceLocation;
  readonly confidence: 'high' | 'medium';
  readonly snippet: string;
}

export interface SqlInjectionMatch {
  readonly location: SourceLocation;
  readonly explanation: string;
  readonly confidence: 'high' | 'medium';
  readonly snippet: string;
}

export interface DangerousEvalMatch {
  readonly pattern: string;
  readonly explanation: string;
  readonly location: SourceLocation;
  readonly confidence: 'high' | 'medium';
}

export interface CorsMisconfigMatch {
  readonly explanation: string;
  readonly location: SourceLocation;
  readonly confidence: 'high';
  readonly snippet: string;
}
