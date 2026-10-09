import { describe, it, expect } from 'vitest';
import {
  parseSource,
  isSupportedScriptFile,
  getScriptKindForPath,
  getNodeLocation,
} from '../../../src/analysis/parser.js';
import ts from 'typescript';

describe('AST Parser Subsystem', () => {
  it('identifies supported script extensions and script kinds', () => {
    expect(isSupportedScriptFile('app.ts')).toBe(true);
    expect(isSupportedScriptFile('component.tsx')).toBe(true);
    expect(isSupportedScriptFile('server.js')).toBe(true);
    expect(isSupportedScriptFile('view.jsx')).toBe(true);
    expect(isSupportedScriptFile('index.mjs')).toBe(true);
    expect(isSupportedScriptFile('config.cjs')).toBe(true);
    expect(isSupportedScriptFile('module.mts')).toBe(true);
    expect(isSupportedScriptFile('types.cts')).toBe(true);
    expect(isSupportedScriptFile('readme.md')).toBe(false);
    expect(isSupportedScriptFile('styles.css')).toBe(false);
    expect(isSupportedScriptFile('data.json')).toBe(false);

    expect(getScriptKindForPath('test.ts')).toBe(ts.ScriptKind.TS);
    expect(getScriptKindForPath('test.tsx')).toBe(ts.ScriptKind.TSX);
    expect(getScriptKindForPath('test.js')).toBe(ts.ScriptKind.JS);
    expect(getScriptKindForPath('test.jsx')).toBe(ts.ScriptKind.JSX);
  });

  it('parses valid JavaScript and TypeScript code successfully', () => {
    const tsCode = 'const x: number = 42; export function getX(): number { return x; }';
    const parsedTs = parseSource('example.ts', '/path/example.ts', tsCode);
    expect(parsedTs.hasSyntaxErrors).toBe(false);
    expect(parsedTs.syntaxDiagnostics).toHaveLength(0);
    expect(parsedTs.sourceFile.statements).toHaveLength(2);

    const jsCode = 'const a = 1; module.exports = { a };';
    const parsedJs = parseSource('example.js', '/path/example.js', jsCode);
    expect(parsedJs.hasSyntaxErrors).toBe(false);
    expect(parsedJs.sourceFile.statements).toHaveLength(2);
  });

  it('parses JSX and TSX syntax cleanly', () => {
    const tsxCode = `
      import React from 'react';
      export const Button = ({ label }: { label: string }) => <button className="btn">{label}</button>;
    `;
    const parsed = parseSource('Button.tsx', '/path/Button.tsx', tsxCode);
    expect(parsed.hasSyntaxErrors).toBe(false);
    expect(parsed.sourceFile.statements.length).toBeGreaterThan(0);
  });

  it('handles malformed syntax gracefully without throwing exceptions', () => {
    const brokenCode = 'function broken( { const x = ;';
    const parsed = parseSource('broken.ts', '/path/broken.ts', brokenCode);
    expect(parsed.hasSyntaxErrors).toBe(true);
    expect(parsed.syntaxDiagnostics.length).toBeGreaterThan(0);
    expect(parsed.sourceFile).toBeDefined();
  });

  it('handles empty source files cleanly', () => {
    const parsed = parseSource('empty.ts', '/path/empty.ts', '');
    expect(parsed.hasSyntaxErrors).toBe(false);
    expect(parsed.sourceFile.statements).toHaveLength(0);
  });

  it('computes exact 1-based line, column, and snippet from AST nodes', () => {
    const code = `
      // Line 1
      const target = "test-value";
    `;
    const parsed = parseSource('test.ts', '/path/test.ts', code);
    const stmt = parsed.sourceFile.statements[0] as ts.VariableStatement;
    const decl = stmt.declarationList.declarations[0]!;
    const loc = getNodeLocation(parsed.sourceFile, decl.initializer!);

    expect(loc.line).toBe(3);
    expect(loc.snippet).toContain('const target = "test-value";');
  });

  it('computes accurate 1-indexed line and column for CRLF line endings', () => {
    const crlfCode = 'const a = 1;\r\nconst b = "crlf-target";\r\nconst c = 3;\r\n';
    const parsed = parseSource('crlf.ts', '/path/crlf.ts', crlfCode);
    const stmt = parsed.sourceFile.statements[1] as ts.VariableStatement;
    const decl = stmt.declarationList.declarations[0]!;
    const loc = getNodeLocation(parsed.sourceFile, decl.initializer!);

    expect(loc.line).toBe(2);
    expect(loc.column).toBe(11);
    expect(loc.snippet).toBe('const b = "crlf-target";');
  });

  it('handles Unicode characters in source code without distorting locations', () => {
    const unicodeCode = 'const greeting = "👋 Hello World!";\nconst next = "target";\n';
    const parsed = parseSource('unicode.ts', '/path/unicode.ts', unicodeCode);
    const stmt = parsed.sourceFile.statements[1] as ts.VariableStatement;
    const decl = stmt.declarationList.declarations[0]!;
    const loc = getNodeLocation(parsed.sourceFile, decl.initializer!);

    expect(loc.line).toBe(2);
    expect(loc.column).toBe(14);
    expect(loc.snippet).toBe('const next = "target";');
  });
});
