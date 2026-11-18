import { describe, it, expect } from 'vitest';
import ts from 'typescript';
import {
  findAiSafetyIssuesInAst,
  findSqlInjectionInAst,
} from '../../../src/analysis/visitors/ai-safety-visitor.js';

function parseSource(code: string, fileName: string): ts.SourceFile {
  return ts.createSourceFile(
    fileName,
    code,
    ts.ScriptTarget.Latest,
    true,
    fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
}

describe('findAiSafetyIssuesInAst', () => {
  it('detects dangerouslyAllowBrowser: true', () => {
    const code = `
      import OpenAI from 'openai';
      const client = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
        dangerouslyAllowBrowser: true,
      });
    `;
    const sf = parseSource(code, 'src/api.ts');
    const issues = findAiSafetyIssuesInAst(sf, 'src/api.ts');

    expect(issues.length).toBe(1);
    expect(issues[0]!.issueType).toBe('client_browser_guard_bypass');
    expect(issues[0]!.snippet).toContain('dangerouslyAllowBrowser: true');
  });

  it('does not flag dangerouslyAllowBrowser: false', () => {
    const code = `
      const client = new OpenAI({
        dangerouslyAllowBrowser: false,
      });
    `;
    const sf = parseSource(code, 'src/api.ts');
    const issues = findAiSafetyIssuesInAst(sf, 'src/api.ts');

    expect(issues.length).toBe(0);
  });

  it('detects direct AI SDK instantiation in client components', () => {
    const code = `
      'use client';
      import { OpenAI } from 'openai';
      export function ChatComponent() {
        const ai = new OpenAI();
        return <div>Chat</div>;
      }
    `;
    const sf = parseSource(code, 'src/Chat.tsx');
    const issues = findAiSafetyIssuesInAst(sf, 'src/Chat.tsx');

    expect(issues.some((i) => i.issueType === 'client_browser_guard_bypass')).toBe(true);
  });

  it('does not flag AI SDK instantiation in server routes', () => {
    const code = `
      import { OpenAI } from 'openai';
      export async function POST() {
        const ai = new OpenAI();
        return new Response("ok");
      }
    `;
    const sf = parseSource(code, 'src/app/api/chat/route.ts');
    const issues = findAiSafetyIssuesInAst(sf, 'src/app/api/chat/route.ts');

    expect(issues.length).toBe(0);
  });

  it('flags unsanitized AI stream rendering in dangerouslySetInnerHTML', () => {
    const code = `
      export function Message({ streamOutput }: { streamOutput: string }) {
        return <div dangerouslySetInnerHTML={{ __html: streamOutput }} />;
      }
    `;
    const sf = parseSource(code, 'src/Message.tsx');
    const issues = findAiSafetyIssuesInAst(sf, 'src/Message.tsx');

    expect(issues.length).toBe(1);
    expect(issues[0]!.issueType).toBe('raw_stream_dom_injection');
  });

  it('does not flag dangerouslySetInnerHTML when sanitized with DOMPurify', () => {
    const code = `
      import DOMPurify from 'dompurify';
      export function Message({ streamOutput }: { streamOutput: string }) {
        return <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(streamOutput) }} />;
      }
    `;
    const sf = parseSource(code, 'src/Message.tsx');
    const issues = findAiSafetyIssuesInAst(sf, 'src/Message.tsx');

    expect(issues.length).toBe(0);
  });

  it('detects unimplemented stubs in production files', () => {
    const code = `
      export function handlePayment() {
        throw new Error("Not implemented");
      }
    `;
    const sf = parseSource(code, 'src/services/payment.ts');
    const issues = findAiSafetyIssuesInAst(sf, 'src/services/payment.ts');

    expect(issues.length).toBe(1);
    expect(issues[0]!.issueType).toBe('unimplemented_stub');
  });

  it('ignores unimplemented stubs in test files', () => {
    const code = `
      it('should fail', () => {
        throw new Error("Not implemented");
      });
    `;
    const sf = parseSource(code, 'tests/payment.test.ts');
    const issues = findAiSafetyIssuesInAst(sf, 'tests/payment.test.ts');

    expect(issues.length).toBe(0);
  });

  it('detects hardcoded dummy passwords in production code', () => {
    const code = `
      export const authConfig = {
        username: "admin",
        password: "password123",
      };
    `;
    const sf = parseSource(code, 'src/config/auth.ts');
    const issues = findAiSafetyIssuesInAst(sf, 'src/config/auth.ts');

    expect(issues.length).toBe(1);
    expect(issues[0]!.issueType).toBe('dummy_credential');
  });
});

describe('findSqlInjectionInAst', () => {
  it('detects interpolated template literals in raw SQL queries', () => {
    const code = `
      export async function getUser(db: any, id: string) {
        return db.query(\`SELECT * FROM users WHERE id = '\${id}'\`);
      }
    `;
    const sf = parseSource(code, 'src/db.ts');
    const matches = findSqlInjectionInAst(sf);

    expect(matches.length).toBe(1);
    expect(matches[0]!.explanation).toContain('parameterized queries');
  });

  it('detects raw string concatenation in queries', () => {
    const code = `
      export async function deleteUser(pool: any, id: string) {
        return pool.query("DELETE FROM users WHERE id = " + id);
      }
    `;
    const sf = parseSource(code, 'src/db.ts');
    const matches = findSqlInjectionInAst(sf);

    expect(matches.length).toBe(1);
  });

  it('does not flag parameterized queries', () => {
    const code = `
      export async function getUser(db: any, id: string) {
        return db.query('SELECT * FROM users WHERE id = $1', [id]);
      }
    `;
    const sf = parseSource(code, 'src/db.ts');
    const matches = findSqlInjectionInAst(sf);

    expect(matches.length).toBe(0);
  });
});
