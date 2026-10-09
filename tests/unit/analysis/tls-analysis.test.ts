import { describe, it, expect } from 'vitest';
import { parseSource } from '../../../src/analysis/parser.js';
import { findInsecureTlsInAst } from '../../../src/analysis/visitors/security-visitor.js';

describe('AST Insecure TLS Analysis Visitor', () => {
  it('detects process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"', () => {
    const code = `
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    `;
    const parsed = parseSource('server.ts', '/path/server.ts', code);
    const matches = findInsecureTlsInAst(parsed.sourceFile);

    expect(matches).toHaveLength(1);
    expect(matches[0]?.pattern).toContain('NODE_TLS_REJECT_UNAUTHORIZED');
    expect(matches[0]?.confidence).toBe('high');
    expect(matches[0]?.location.line).toBe(2);
  });

  it('detects bracket access process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = "0"', () => {
    const code = `
      process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = "0";
    `;
    const parsed = parseSource('server.js', '/path/server.js', code);
    const matches = findInsecureTlsInAst(parsed.sourceFile);

    expect(matches).toHaveLength(1);
    expect(matches[0]?.pattern).toContain('NODE_TLS_REJECT_UNAUTHORIZED');
  });

  it('detects rejectUnauthorized: false inside https.Agent instantiation', () => {
    const code = `
      import https from 'https';
      const agent = new https.Agent({
        rejectUnauthorized: false
      });
    `;
    const parsed = parseSource('agent.ts', '/path/agent.ts', code);
    const matches = findInsecureTlsInAst(parsed.sourceFile);

    expect(matches).toHaveLength(1);
    expect(matches[0]?.pattern).toContain('rejectUnauthorized: false');
    expect(matches[0]?.confidence).toBe('high');
  });

  it('detects rejectUnauthorized: false with TLS sibling properties', () => {
    const code = `
      const config = {
        rejectUnauthorized: false,
        ca: [myCert],
      };
    `;
    const parsed = parseSource('config.ts', '/path/config.ts', code);
    const matches = findInsecureTlsInAst(parsed.sourceFile);

    expect(matches).toHaveLength(1);
    expect(matches[0]?.pattern).toContain('rejectUnauthorized: false');
  });

  it('detects rejectUnauthorized: false within network client configuration variable', () => {
    const code = `
      const agentOptions = {
        rejectUnauthorized: false,
      };
    `;
    const parsed = parseSource('fetch.ts', '/path/fetch.ts', code);
    const matches = findInsecureTlsInAst(parsed.sourceFile);

    expect(matches).toHaveLength(1);
    expect(matches[0]?.pattern).toContain('rejectUnauthorized: false');
  });

  it('does NOT flag rejectUnauthorized: true (secure setting)', () => {
    const code = `
      import https from 'https';
      const agent = new https.Agent({
        rejectUnauthorized: true
      });
    `;
    const parsed = parseSource('secure.ts', '/path/secure.ts', code);
    const matches = findInsecureTlsInAst(parsed.sourceFile);

    expect(matches).toHaveLength(0);
  });

  it('does NOT flag rejectUnauthorized: false on an unrelated business object without network context', () => {
    const code = `
      const permissionCheck = {
        rejectUnauthorized: false,
        userRole: 'guest',
        allowAnonymous: true,
      };
    `;
    const parsed = parseSource('auth.ts', '/path/auth.ts', code);
    const matches = findInsecureTlsInAst(parsed.sourceFile);

    expect(matches).toHaveLength(0);
  });

  it('does NOT flag insecure TLS patterns in comments or string literals', () => {
    const code = `
      // Insecure setting: process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
      /*
       * rejectUnauthorized: false
       */
      const note = "rejectUnauthorized: false is dangerous in production";
    `;
    const parsed = parseSource('docs.ts', '/path/docs.ts', code);
    const matches = findInsecureTlsInAst(parsed.sourceFile);

    expect(matches).toHaveLength(0);
  });

  it('detects template literal and globalThis assignments to NODE_TLS_REJECT_UNAUTHORIZED', () => {
    const code = `
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = \`0\`;
      globalThis.process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
      process["env"]["NODE_TLS_REJECT_UNAUTHORIZED"] = '0';
    `;
    const parsed = parseSource('tls-variants.ts', '/path/tls-variants.ts', code);
    const matches = findInsecureTlsInAst(parsed.sourceFile);

    expect(matches).toHaveLength(3);
  });

  it('detects quoted rejectUnauthorized: false and TLSSocket contexts', () => {
    const code = `
      import tls from 'tls';
      const socket = new tls.TLSSocket(stream, {
        "rejectUnauthorized": false,
      });
    `;
    const parsed = parseSource('tls-socket.ts', '/path/tls-socket.ts', code);
    const matches = findInsecureTlsInAst(parsed.sourceFile);

    expect(matches).toHaveLength(1);
    expect(matches[0]?.pattern).toContain('rejectUnauthorized');
  });
});
