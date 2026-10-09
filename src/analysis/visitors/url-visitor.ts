import ts from 'typescript';
import type { LocalhostUrlMatch } from '../types.js';
import { getNodeLocation } from '../parser.js';

const LOCALHOST_PATTERN =
  /\bhttps?:\/\/(?:localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)(?![a-zA-Z0-9.-])(?::\d{1,5})?(?:[/?#][^\s"'`<>)]*)?/gi;

export function findLocalhostUrlsInAst(sourceFile: ts.SourceFile): LocalhostUrlMatch[] {
  const matches: LocalhostUrlMatch[] = [];

  function visit(node: ts.Node): void {
    // 1. String Literals
    if (ts.isStringLiteral(node)) {
      LOCALHOST_PATTERN.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = LOCALHOST_PATTERN.exec(node.text)) !== null) {
        matches.push({
          url: m[0],
          location: getNodeLocation(sourceFile, node),
          node,
        });
      }
    }
    // 2. Template Literals without substitution: `http://localhost:3000`
    else if (ts.isNoSubstitutionTemplateLiteral(node)) {
      LOCALHOST_PATTERN.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = LOCALHOST_PATTERN.exec(node.text)) !== null) {
        matches.push({
          url: m[0],
          location: getNodeLocation(sourceFile, node),
          node,
        });
      }
    }
    // 3. Template Expressions with substitutions: `http://localhost:3000/${endpoint}`
    else if (ts.isTemplateExpression(node)) {
      // Check head
      LOCALHOST_PATTERN.lastIndex = 0;
      let headMatch: RegExpExecArray | null;
      while ((headMatch = LOCALHOST_PATTERN.exec(node.head.text)) !== null) {
        matches.push({
          url: headMatch[0],
          location: getNodeLocation(sourceFile, node),
          node,
        });
      }

      // Check template spans literal text
      for (const span of node.templateSpans) {
        LOCALHOST_PATTERN.lastIndex = 0;
        let spanMatch: RegExpExecArray | null;
        while ((spanMatch = LOCALHOST_PATTERN.exec(span.literal.text)) !== null) {
          matches.push({
            url: spanMatch[0],
            location: getNodeLocation(sourceFile, span.literal),
            node: span.literal,
          });
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return matches;
}
