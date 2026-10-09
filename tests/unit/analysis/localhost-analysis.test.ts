import { describe, it, expect } from 'vitest';
import { parseSource } from '../../../src/analysis/parser.js';
import { findLocalhostUrlsInAst } from '../../../src/analysis/visitors/url-visitor.js';

describe('AST Localhost URL Visitor', () => {
  it('detects string literals containing localhost, 127.0.0.1, [::1], and 0.0.0.0', () => {
    const code = `
      export const LOCAL = "http://localhost:3000/api";
      export const IPV4 = "http://127.0.0.1:8000/health";
      export const IPV6 = "http://[::1]:9000";
      export const ZERO = "http://0.0.0.0:4000/metrics";
    `;
    const parsed = parseSource('test.ts', '/path/test.ts', code);
    const matches = findLocalhostUrlsInAst(parsed.sourceFile);

    expect(matches).toHaveLength(4);
    expect(matches[0]?.url).toBe('http://localhost:3000/api');
    expect(matches[0]?.location.line).toBe(2);
    expect(matches[1]?.url).toBe('http://127.0.0.1:8000/health');
    expect(matches[2]?.url).toBe('http://[::1]:9000');
    expect(matches[3]?.url).toBe('http://0.0.0.0:4000/metrics');
  });

  it('detects no-substitution template literals', () => {
    const code = 'const url = `http://localhost:5000/v1`;';
    const parsed = parseSource('test.ts', '/path/test.ts', code);
    const matches = findLocalhostUrlsInAst(parsed.sourceFile);

    expect(matches).toHaveLength(1);
    expect(matches[0]?.url).toBe('http://localhost:5000/v1');
  });

  it('detects template expressions containing hardcoded localhost fragments in head', () => {
    const code = 'const getEndpoint = (path) => `http://localhost:3000/${path}`;';
    const parsed = parseSource('test.ts', '/path/test.ts', code);
    const matches = findLocalhostUrlsInAst(parsed.sourceFile);

    expect(matches).toHaveLength(1);
    expect(matches[0]?.url).toBe('http://localhost:3000/');
  });

  it('does NOT flag dynamic template literals when host and port are variables', () => {
    const code = `
      const host = "api.production.com";
      const port = 443;
      const url = \`http://\${host}:\${port}/api\`;
    `;
    const parsed = parseSource('test.ts', '/path/test.ts', code);
    const matches = findLocalhostUrlsInAst(parsed.sourceFile);

    expect(matches).toHaveLength(0);
  });

  it('does NOT flag localhost URLs occurring inside comments or JSDoc documentation', () => {
    const code = `
      // Example endpoint: http://localhost:3000/api
      /*
       * Development server:
       * http://127.0.0.1:8080
       */
      /**
       * @see http://localhost:9000
       */
      export const productionUrl = "https://api.myapp.com";
    `;
    const parsed = parseSource('test.ts', '/path/test.ts', code);
    const matches = findLocalhostUrlsInAst(parsed.sourceFile);
    expect(matches).toHaveLength(0);
  });

  it('does NOT flag similar but non-loopback domain names such as localhost.example.com', () => {
    const code = `
      export const externalDomain = "http://localhost.example.com";
      export const stagingDomain = "http://localhost-staging.com";
      export const nipDomain = "http://127.0.0.1.nip.io";
    `;
    const parsed = parseSource('domains.ts', '/path/domains.ts', code);
    const matches = findLocalhostUrlsInAst(parsed.sourceFile);

    expect(matches).toHaveLength(0);
  });

  it('detects uppercase URL schemes, hostnames, and URLs with queries and fragments', () => {
    const code = `
      export const upper = "HTTP://LOCALHOST:3000/API";
      export const query = "http://localhost:8080?search=test&mode=active";
      export const fragment = "http://localhost:9000#debug";
    `;
    const parsed = parseSource('upper.ts', '/path/upper.ts', code);
    const matches = findLocalhostUrlsInAst(parsed.sourceFile);

    expect(matches).toHaveLength(3);
    expect(matches[0]?.url).toBe('HTTP://LOCALHOST:3000/API');
    expect(matches[1]?.url).toBe('http://localhost:8080?search=test&mode=active');
    expect(matches[2]?.url).toBe('http://localhost:9000#debug');
  });
});
