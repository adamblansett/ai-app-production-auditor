import { describe, it, expect } from 'vitest';
import { parseSource } from '../../../src/analysis/parser.js';
import { findClientExposedSecretsInAst } from '../../../src/analysis/visitors/security-visitor.js';

describe('AST Client-Side Secret Exposure Visitor', () => {
  it('detects variable declarations with client-exposed prefixes and sensitive names', () => {
    const code = `
      export const NEXT_PUBLIC_API_SECRET = "some-secret-token";
      export const VITE_ADMIN_PASSWORD = "admin_password_123";
    `;
    const parsed = parseSource('config.ts', '/path/config.ts', code);
    const exposures = findClientExposedSecretsInAst(parsed.sourceFile);

    expect(exposures).toHaveLength(2);
    expect(exposures[0]?.variableName).toBe('NEXT_PUBLIC_API_SECRET');
    expect(exposures[0]?.rawValue).toBe('some-secret-token');
    expect(exposures[1]?.variableName).toBe('VITE_ADMIN_PASSWORD');
  });

  it('detects object literal properties in configuration definitions', () => {
    const code = `
      module.exports = {
        env: {
          NEXT_PUBLIC_STRIPE_SECRET_KEY: process.env.STRIPE_SECRET,
        }
      };
    `;
    const parsed = parseSource('next.config.js', '/path/next.config.js', code);
    const exposures = findClientExposedSecretsInAst(parsed.sourceFile);

    expect(exposures).toHaveLength(1);
    expect(exposures[0]?.variableName).toBe('NEXT_PUBLIC_STRIPE_SECRET_KEY');
  });

  it('detects property access of public client secrets', () => {
    const code = 'const key = process.env.NEXT_PUBLIC_FIREBASE_PRIVATE_KEY;';
    const parsed = parseSource('client.ts', '/path/client.ts', code);
    const exposures = findClientExposedSecretsInAst(parsed.sourceFile);

    expect(exposures).toHaveLength(1);
    expect(exposures[0]?.variableName).toBe('NEXT_PUBLIC_FIREBASE_PRIVATE_KEY');
  });

  it('does NOT flag public non-sensitive configuration variables', () => {
    const code = `
      export const NEXT_PUBLIC_APP_NAME = "My Awesome App";
      export const NEXT_PUBLIC_SITE_URL = "https://example.com";
      export const NEXT_PUBLIC_GA_MEASUREMENT_ID = "G-12345678";
      export const VITE_API_ENDPOINT = "/api/v1";
    `;
    const parsed = parseSource('env.ts', '/path/env.ts', code);
    const exposures = findClientExposedSecretsInAst(parsed.sourceFile);

    expect(exposures).toHaveLength(0);
  });

  it('does NOT flag server-only private variables that do not use client-exposed prefixes', () => {
    const code = `
      const dbPassword = process.env.DB_PASSWORD;
      const apiSecret = process.env.INTERNAL_API_SECRET;
    `;
    const parsed = parseSource('server.ts', '/path/server.ts', code);
    const exposures = findClientExposedSecretsInAst(parsed.sourceFile);

    expect(exposures).toHaveLength(0);
  });

  it('does NOT flag client-exposure patterns occurring inside comments', () => {
    const code = `
      // Warning: do not define NEXT_PUBLIC_API_SECRET here
      /*
       * VITE_ADMIN_PASSWORD should never be exposed to the client
       */
      export const NEXT_PUBLIC_THEME = "dark";
    `;
    const parsed = parseSource('app.ts', '/path/app.ts', code);
    const exposures = findClientExposedSecretsInAst(parsed.sourceFile);

    expect(exposures).toHaveLength(0);
  });

  it('detects client exposure with template literals and quoted property names', () => {
    const code = `
      export const NEXT_PUBLIC_AUTH_TOKEN = \`token_value_abc\`;
      const config = {
        "NEXT_PUBLIC_SERVICE_TOKEN": "service_token_value",
      };
    `;
    const parsed = parseSource('tpl.ts', '/path/tpl.ts', code);
    const exposures = findClientExposedSecretsInAst(parsed.sourceFile);

    expect(exposures).toHaveLength(2);
    expect(exposures[0]?.variableName).toBe('NEXT_PUBLIC_AUTH_TOKEN');
    expect(exposures[0]?.rawValue).toBe('token_value_abc');
    expect(exposures[1]?.variableName).toBe('NEXT_PUBLIC_SERVICE_TOKEN');
    expect(exposures[1]?.rawValue).toBe('service_token_value');
  });
});
