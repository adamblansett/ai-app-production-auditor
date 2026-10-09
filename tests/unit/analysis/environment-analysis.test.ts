import { describe, it, expect } from 'vitest';
import { parseSource } from '../../../src/analysis/parser.js';
import { findEnvironmentVariablesInAst } from '../../../src/analysis/visitors/environment-visitor.js';

describe('AST Environment Variable Visitor', () => {
  it('extracts dot-property access from process.env and import.meta.env', () => {
    const code = `
      const dbUrl = process.env.DATABASE_URL;
      const viteKey = import.meta.env.VITE_STRIPE_KEY;
    `;
    const parsed = parseSource('test.ts', '/path/test.ts', code);
    const refs = findEnvironmentVariablesInAst(parsed.sourceFile);

    expect(refs).toHaveLength(2);
    expect(refs[0]?.name).toBe('DATABASE_URL');
    expect(refs[0]?.isDynamic).toBe(false);
    expect(refs[0]?.isDestructured).toBe(false);
    expect(refs[1]?.name).toBe('VITE_STRIPE_KEY');
  });

  it('extracts bracket-property access with string literals', () => {
    const code = `
      const secret = process.env["AUTH_SECRET"];
      const client = import.meta.env['VITE_CLIENT_ID'];
    `;
    const parsed = parseSource('test.ts', '/path/test.ts', code);
    const refs = findEnvironmentVariablesInAst(parsed.sourceFile);

    expect(refs).toHaveLength(2);
    expect(refs[0]?.name).toBe('AUTH_SECRET');
    expect(refs[1]?.name).toBe('VITE_CLIENT_ID');
  });

  it('extracts destructuring declarations from process.env and import.meta.env', () => {
    const code = `
      const { DB_HOST, DB_PORT: customPort, REDIS_URL } = process.env;
      const { VITE_API_BASE } = import.meta.env;
    `;
    const parsed = parseSource('test.ts', '/path/test.ts', code);
    const refs = findEnvironmentVariablesInAst(parsed.sourceFile);

    expect(refs).toHaveLength(4);
    const names = refs.map((r) => r.name);
    expect(names).toContain('DB_HOST');
    expect(names).toContain('DB_PORT');
    expect(names).toContain('REDIS_URL');
    expect(names).toContain('VITE_API_BASE');
    expect(refs[0]?.isDestructured).toBe(true);
  });

  it('extracts destructuring assignments', () => {
    const code = '({ AWS_REGION, SQS_QUEUE } = process.env);';
    const parsed = parseSource('test.ts', '/path/test.ts', code);
    const refs = findEnvironmentVariablesInAst(parsed.sourceFile);

    expect(refs).toHaveLength(2);
    expect(refs[0]?.name).toBe('AWS_REGION');
    expect(refs[1]?.name).toBe('SQS_QUEUE');
    expect(refs[0]?.isDestructured).toBe(true);
  });

  it('flags dynamic computed indexing without inventing a false variable name', () => {
    const code = `
      function get(varName: string) {
        return process.env[varName];
      }
    `;
    const parsed = parseSource('test.ts', '/path/test.ts', code);
    const refs = findEnvironmentVariablesInAst(parsed.sourceFile);

    expect(refs).toHaveLength(1);
    expect(refs[0]?.isDynamic).toBe(true);
    expect(refs[0]?.name).toBe('<dynamic>');
  });

  it('does NOT extract references from comments or string literals', () => {
    const code = `
      // const secret = process.env.COMMENTED_SECRET;
      /*
       * Instructions: Set process.env.DOCS_VAR in .env
       */
      const instructions = "Please configure process.env.STRING_VAR";
    `;
    const parsed = parseSource('test.ts', '/path/test.ts', code);
    const refs = findEnvironmentVariablesInAst(parsed.sourceFile);

    expect(refs).toHaveLength(0);
  });

  it('extracts variables from process["env"], process[\'env\'], and globalThis.process.env', () => {
    const code = `
      const a = process["env"].ACCESS_KEY;
      const b = process['env'].SECRET_KEY;
      const c = globalThis.process.env.GLOBAL_VAR;
    `;
    const parsed = parseSource('variants.ts', '/path/variants.ts', code);
    const refs = findEnvironmentVariablesInAst(parsed.sourceFile);

    expect(refs).toHaveLength(3);
    const names = refs.map((r) => r.name);
    expect(names).toContain('ACCESS_KEY');
    expect(names).toContain('SECRET_KEY');
    expect(names).toContain('GLOBAL_VAR');
  });

  it('handles destructuring aliases, quoted keys, and excludes rest properties (...rest)', () => {
    const code = `
      const { API_KEY: myKey, "QUOTED_KEY": qVal, ...rest } = process.env;
      ({ "ASSIGNED_QUOTED": aVal } = process.env);
    `;
    const parsed = parseSource('destruct.ts', '/path/destruct.ts', code);
    const refs = findEnvironmentVariablesInAst(parsed.sourceFile);

    const names = refs.map((r) => r.name);
    expect(names).toContain('API_KEY');
    expect(names).toContain('QUOTED_KEY');
    expect(names).toContain('ASSIGNED_QUOTED');
    // Verify rest variable is NOT treated as an environment variable
    expect(names).not.toContain('rest');
    expect(refs).toHaveLength(3);
  });
});
