import ts from 'typescript';
import type { AiSafetyMatch, SqlInjectionMatch } from '../types.js';
import { getNodeLocation } from '../parser.js';

const DUMMY_PASSWORDS = new Set([
  'admin',
  'password',
  'password123',
  'secret',
  'secret123',
  '123456',
  '12345678',
  'root',
  'toor',
  'test',
  'dummy',
]);

const RAW_SQL_METHODS = new Set(['queryrawunsafe', 'executerawunsafe', 'raw']);

export function findAiSafetyIssuesInAst(
  sourceFile: ts.SourceFile,
  relativePath: string,
): AiSafetyMatch[] {
  const matches: AiSafetyMatch[] = [];
  const isTestFile =
    relativePath.includes('.test.') ||
    relativePath.includes('.spec.') ||
    relativePath.includes('__tests__') ||
    relativePath.includes('/test/') ||
    relativePath.includes('/tests/');

  // Check if file is client-side code
  const isClientFile =
    sourceFile.text.includes('"use client"') ||
    sourceFile.text.includes("'use client'") ||
    relativePath.endsWith('.tsx') ||
    relativePath.endsWith('.jsx');

  function visit(node: ts.Node): void {
    // 1. dangerouslyAllowBrowser: true
    if (ts.isPropertyAssignment(node)) {
      const propName =
        node.name && (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name))
          ? node.name.text
          : '';

      if (propName === 'dangerouslyAllowBrowser') {
        if (node.initializer.kind === ts.SyntaxKind.TrueKeyword) {
          matches.push({
            issueType: 'client_browser_guard_bypass',
            explanation:
              'Detected "dangerouslyAllowBrowser: true". This bypasses client-side protection and exposes server-side LLM API keys directly to browser clients.',
            location: getNodeLocation(sourceFile, node),
            confidence: 'high',
            snippet: node.getText(sourceFile),
          });
        }
      }

      // 4. Dummy credentials in production code
      if (!isTestFile) {
        const lowerName = propName.toLowerCase();
        if (
          (lowerName === 'password' ||
            lowerName === 'secret' ||
            lowerName === 'apikey' ||
            lowerName === 'api_key' ||
            lowerName === 'auth_token' ||
            lowerName === 'authtoken') &&
          ts.isStringLiteral(node.initializer)
        ) {
          const val = node.initializer.text.toLowerCase().trim();
          if (DUMMY_PASSWORDS.has(val)) {
            matches.push({
              issueType: 'dummy_credential',
              explanation: `Hardcoded dummy/placeholder credential "${node.initializer.text}" found assigned to "${propName}". Ensure production uses verified secrets.`,
              location: getNodeLocation(sourceFile, node),
              confidence: 'high',
              snippet: node.getText(sourceFile),
            });
          }
        }
      }
    }

    // 1b. Direct LLM SDK instantiation in client component ("use client" / JSX / TSX)
    if (isClientFile && ts.isNewExpression(node)) {
      const exprText = node.expression.getText(sourceFile);
      if (
        exprText === 'OpenAI' ||
        exprText === 'Anthropic' ||
        exprText === 'GoogleGenAI' ||
        exprText === 'GoogleGenerativeAI'
      ) {
        matches.push({
          issueType: 'client_browser_guard_bypass',
          explanation: `Direct instantiation of "${exprText}" in client-side component (${relativePath}). AI provider SDKs should be executed server-side via API routes to prevent key leakage.`,
          location: getNodeLocation(sourceFile, node),
          confidence: 'high',
          snippet: node.getText(sourceFile),
        });
      }
    }

    // 2. Raw AI Stream / Output rendering via dangerouslySetInnerHTML
    if (
      ts.isJsxAttribute(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === 'dangerouslySetInnerHTML'
    ) {
      const init = node.initializer;
      if (
        init &&
        ts.isJsxExpression(init) &&
        init.expression &&
        ts.isObjectLiteralExpression(init.expression)
      ) {
        for (const prop of init.expression.properties) {
          if (
            ts.isPropertyAssignment(prop) &&
            prop.name &&
            (ts.isIdentifier(prop.name) || ts.isStringLiteral(prop.name)) &&
            prop.name.text === '__html'
          ) {
            const htmlExpr = prop.initializer.getText(sourceFile);
            const lowerExpr = htmlExpr.toLowerCase();
            const isAiStreamVar =
              lowerExpr.includes('stream') ||
              lowerExpr.includes('completion') ||
              lowerExpr.includes('message') ||
              lowerExpr.includes('response') ||
              lowerExpr.includes('output') ||
              lowerExpr.includes('airesponse') ||
              lowerExpr.includes('markdown');

            const hasSanitizer =
              lowerExpr.includes('dompurify') ||
              lowerExpr.includes('sanitize') ||
              lowerExpr.includes('escape') ||
              lowerExpr.includes('xss');

            if (isAiStreamVar && !hasSanitizer) {
              matches.push({
                issueType: 'raw_stream_dom_injection',
                explanation: `Unsanitized AI response or stream "${htmlExpr}" rendered via dangerouslySetInnerHTML. This creates a stored or reflected Cross-Site Scripting (XSS) vulnerability.`,
                location: getNodeLocation(sourceFile, node),
                confidence: 'high',
                snippet: node.getText(sourceFile),
              });
            }
          }
        }
      }
    }

    // 3. Unimplemented stubs / placeholders in non-test production code
    if (!isTestFile && ts.isThrowStatement(node) && node.expression) {
      if (ts.isNewExpression(node.expression)) {
        const errorType = node.expression.expression.getText(sourceFile);
        if (errorType === 'Error' || errorType.endsWith('Error')) {
          const firstArg = node.expression.arguments?.[0];
          if (firstArg && ts.isStringLiteral(firstArg)) {
            const msg = firstArg.text.toLowerCase().trim();
            if (
              msg === 'not implemented' ||
              msg === 'todo' ||
              msg === 'placeholder' ||
              msg.startsWith('todo:') ||
              msg.startsWith('not implemented:')
            ) {
              matches.push({
                issueType: 'unimplemented_stub',
                explanation: `Unimplemented stub "${firstArg.text}" thrown in production file. Unfinished AI scaffolding should be completed before deployment.`,
                location: getNodeLocation(sourceFile, node),
                confidence: 'high',
                snippet: node.getText(sourceFile),
              });
            }
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return matches;
}

export function findSqlInjectionInAst(sourceFile: ts.SourceFile): SqlInjectionMatch[] {
  const matches: SqlInjectionMatch[] = [];

  function visit(node: ts.Node): void {
    if (ts.isCallExpression(node)) {
      let isSqlCall = false;
      let methodText = '';

      if (ts.isPropertyAccessExpression(node.expression)) {
        methodText = node.expression.name.text.toLowerCase();
        const objText = node.expression.expression.getText(sourceFile).toLowerCase();

        if (
          RAW_SQL_METHODS.has(methodText) ||
          (methodText === 'query' &&
            (objText.includes('db') ||
              objText.includes('client') ||
              objText.includes('pool') ||
              objText.includes('sql') ||
              objText.includes('connection')))
        ) {
          isSqlCall = true;
        }
      }

      if (isSqlCall && node.arguments.length > 0) {
        const firstArg = node.arguments[0];
        if (!firstArg) return;

        // Check if first arg is a template literal with substitutions
        if (ts.isTemplateExpression(firstArg) && firstArg.templateSpans.length > 0) {
          matches.push({
            location: getNodeLocation(sourceFile, firstArg),
            explanation: `Raw SQL query method "${methodText}" called with interpolated template string. Use parameterized queries ($1, ? or Prisma.sql) instead of direct string interpolation.`,
            confidence: 'high',
            snippet: firstArg.getText(sourceFile),
          });
        }
        // Check if first arg is binary string concatenation ('SELECT ...' + id)
        else if (
          ts.isBinaryExpression(firstArg) &&
          firstArg.operatorToken.kind === ts.SyntaxKind.PlusToken
        ) {
          const argText = firstArg.getText(sourceFile);
          if (/\b(?:SELECT|INSERT|UPDATE|DELETE|DROP|ALTER|FROM|WHERE)\b/i.test(argText)) {
            matches.push({
              location: getNodeLocation(sourceFile, firstArg),
              explanation: `Raw SQL query method "${methodText}" called with concatenated string query. Use parameterized queries ($1, ? or Prisma.sql) instead of string concatenation.`,
              confidence: 'high',
              snippet: argText,
            });
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return matches;
}
