import path from 'node:path';
import ts from 'typescript';
import type { ParsedSourceFile, SourceLocation } from './types.js';

const SUPPORTED_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.mts',
  '.cts',
]);

export function isSupportedScriptFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return SUPPORTED_EXTENSIONS.has(ext);
}

export function getScriptKindForPath(filePath: string): ts.ScriptKind {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.ts':
    case '.mts':
    case '.cts':
      return ts.ScriptKind.TS;
    case '.tsx':
      return ts.ScriptKind.TSX;
    case '.js':
    case '.mjs':
    case '.cjs':
      return ts.ScriptKind.JS;
    case '.jsx':
      return ts.ScriptKind.JSX;
    default:
      return ts.ScriptKind.Unknown;
  }
}

export function parseSource(
  relativePath: string,
  absolutePath: string,
  content: string,
): ParsedSourceFile {
  const scriptKind = getScriptKindForPath(relativePath);

  try {
    const sourceFile = ts.createSourceFile(
      relativePath,
      content,
      ts.ScriptTarget.Latest,
      true, // setParentNodes
      scriptKind,
    );

    // Collect parse diagnostics if any exist on the sourceFile
    const diagnostics: string[] = [];
    const parseDiagnostics = (sourceFile as unknown as { parseDiagnostics?: ts.Diagnostic[] })
      .parseDiagnostics;

    if (parseDiagnostics && parseDiagnostics.length > 0) {
      for (const diag of parseDiagnostics) {
        const msg =
          typeof diag.messageText === 'string' ? diag.messageText : diag.messageText.messageText;
        diagnostics.push(msg);
      }
    }

    return {
      relativePath,
      absolutePath,
      sourceFile,
      hasSyntaxErrors: diagnostics.length > 0,
      syntaxDiagnostics: diagnostics,
    };
  } catch (err) {
    // If ts.createSourceFile throws an unexpected error, build an empty sourceFile
    const fallbackSource = ts.createSourceFile(
      relativePath,
      '',
      ts.ScriptTarget.Latest,
      false,
      ts.ScriptKind.Unknown,
    );

    return {
      relativePath,
      absolutePath,
      sourceFile: fallbackSource,
      hasSyntaxErrors: true,
      syntaxDiagnostics: [`Parser failure: ${err instanceof Error ? err.message : String(err)}`],
    };
  }
}

export function getNodeLocation(sourceFile: ts.SourceFile, node: ts.Node): SourceLocation {
  const start = node.getStart(sourceFile);
  const { line, character } = sourceFile.getLineAndCharacterOfPosition(start);
  const lineNum = line + 1; // 1-indexed
  const colNum = character + 1; // 1-indexed

  // Extract snippet line via getLineStarts without splitting the entire source
  const lineStarts = sourceFile.getLineStarts();
  const lineStart = lineStarts[line] ?? 0;
  const nextLineStart =
    line + 1 < lineStarts.length ? lineStarts[line + 1]! : sourceFile.text.length;
  const lineSnippet = sourceFile.text.slice(lineStart, nextLineStart).trim();

  return {
    line: lineNum,
    column: colNum,
    snippet: lineSnippet,
  };
}
