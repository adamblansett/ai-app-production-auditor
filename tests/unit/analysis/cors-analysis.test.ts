import { describe, it, expect } from 'vitest';
import ts from 'typescript';
import { findCorsMisconfigurationInAst } from '../../../src/analysis/visitors/security-visitor.js';

function parseSource(code: string): ts.SourceFile {
  return ts.createSourceFile('src/server.ts', code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}

describe('findCorsMisconfigurationInAst', () => {
  it('detects wildcard origin with credentials: true', () => {
    const code = 'app.use(cors({ origin: "*", credentials: true }));';
    const sf = parseSource(code);
    const matches = findCorsMisconfigurationInAst(sf);

    expect(matches).toHaveLength(1);
    expect(matches[0]!.explanation).toContain('origin: "*" with credentials: true');
  });

  it('detects dynamic reflect-all origin: true with credentials: true', () => {
    const code = 'app.use(cors({ origin: true, credentials: true }));';
    const sf = parseSource(code);
    const matches = findCorsMisconfigurationInAst(sf);

    expect(matches).toHaveLength(1);
    expect(matches[0]!.explanation).toContain('origin: true with credentials: true');
  });

  it('does not flag specific domain whitelist with credentials', () => {
    const code = 'app.use(cors({ origin: "https://trusted.app.com", credentials: true }));';
    const sf = parseSource(code);
    const matches = findCorsMisconfigurationInAst(sf);

    expect(matches).toHaveLength(0);
  });
});
