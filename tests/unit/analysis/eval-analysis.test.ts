import { describe, it, expect } from 'vitest';
import ts from 'typescript';
import { findDangerousEvalInAst } from '../../../src/analysis/visitors/security-visitor.js';

function parseSource(code: string): ts.SourceFile {
  return ts.createSourceFile('src/test.ts', code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}

describe('findDangerousEvalInAst', () => {
  it('detects direct eval() invocation', () => {
    const code = 'const result = eval("2 + 2");';
    const sf = parseSource(code);
    const matches = findDangerousEvalInAst(sf);

    expect(matches).toHaveLength(1);
    expect(matches[0]!.pattern).toBe('eval()');
    expect(matches[0]!.explanation).toContain('arbitrary code execution (RCE)');
  });

  it('detects window.eval and globalThis.eval', () => {
    const code = 'window.eval("alert(1)"); globalThis.eval("process.exit(1)");';
    const sf = parseSource(code);
    const matches = findDangerousEvalInAst(sf);

    expect(matches).toHaveLength(2);
    expect(matches[0]!.pattern).toBe('window.eval()');
    expect(matches[1]!.pattern).toBe('globalThis.eval()');
  });

  it('detects new Function() constructor', () => {
    const code = 'const fn = new Function("a", "b", "return a + b");';
    const sf = parseSource(code);
    const matches = findDangerousEvalInAst(sf);

    expect(matches).toHaveLength(1);
    expect(matches[0]!.pattern).toBe('new Function()');
  });

  it('detects Node.js vm.runInNewContext()', () => {
    const code = 'import vm from "node:vm"; vm.runInNewContext("x = 1");';
    const sf = parseSource(code);
    const matches = findDangerousEvalInAst(sf);

    expect(matches).toHaveLength(1);
    expect(matches[0]!.pattern).toBe('vm.runInNewContext()');
  });

  it('does not flag ordinary function calls or evaluate methods', () => {
    const code = 'const score = calculateScore(); evaluator.evaluate(input);';
    const sf = parseSource(code);
    const matches = findDangerousEvalInAst(sf);

    expect(matches).toHaveLength(0);
  });
});
