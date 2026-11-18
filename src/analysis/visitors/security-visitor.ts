import ts from 'typescript';
import type { InsecureTlsMatch, ClientSecretExposure, SecretLiteralMatch } from '../types.js';
import { getNodeLocation } from '../parser.js';
import { isProcessEnv } from './environment-visitor.js';

// Sensitive naming tokens for public client-side variables
const SENSITIVE_NAME_PATTERN =
  /(?:NEXT_PUBLIC_|VITE_)[A-Z0-9_]*(?:SECRET|PRIVATE|PASSWORD|API_KEY|TOKEN|CREDENTIAL|AUTH_KEY)[A-Z0-9_]*/i;

// Sibling or parent property names that signify TLS/network context
const TLS_CONTEXT_KEYWORDS = new Set([
  'agent',
  'httpsagent',
  'tls',
  'ssl',
  'https',
  'proxy',
  'dispatcher',
  'server',
  'transport',
  'ca',
  'cert',
  'key',
  'passphrase',
  'ciphers',
  'secureprotocol',
  'pfx',
  'servername',
  'checkserveridentity',
  'keepalive',
  'maxsockets',
  'request',
  'axios',
  'fetch',
  'socket',
  'client',
  'connection',
  'options',
  'config',
  'http',
]);

const SECRET_PATTERNS = [
  {
    name: 'AWS Access Key ID',
    regex: /\b(AKIA|ABIA|ACCA|ASIA)[0-9A-Z]{16}\b/g,
  },
  {
    name: 'GitHub Personal Access Token',
    regex: /\b(?:gh[pousr]_[0-9a-zA-Z]{36,255}|github_pat_[0-9a-zA-Z_]{82})\b/g,
  },
  {
    name: 'Slack Token',
    regex: /\bxox[baprs]-[0-9a-zA-Z]{10,48}\b/g,
  },
  {
    name: 'Private Key Block',
    regex: /-----BEGIN (?:[A-Z0-9 ]+ )?PRIVATE KEY-----/g,
  },
  {
    name: 'OpenAI API Key',
    regex: /\b(?:sk-[a-zA-Z0-9]{20,}|sk-proj-[-a-zA-Z0-9_]{40,})\b/g,
  },
  {
    name: 'Anthropic API Key',
    regex: /\bsk-ant-api[0-9]{2}-[-a-zA-Z0-9_]{80,}\b/g,
  },
  {
    name: 'Hugging Face Access Token',
    regex: /\bhf_[a-zA-Z0-9]{34,}\b/g,
  },
];

function isNodeTlsRejectUnauthorized(expr: ts.Expression): boolean {
  if (ts.isPropertyAccessExpression(expr)) {
    return expr.name.text === 'NODE_TLS_REJECT_UNAUTHORIZED' && isProcessEnv(expr.expression);
  } else if (ts.isElementAccessExpression(expr)) {
    return (
      ts.isStringLiteral(expr.argumentExpression) &&
      expr.argumentExpression.text === 'NODE_TLS_REJECT_UNAUTHORIZED' &&
      isProcessEnv(expr.expression)
    );
  }
  return false;
}

function isTlsNetworkContext(node: ts.PropertyAssignment): boolean {
  const parentObj = node.parent;
  if (!ts.isObjectLiteralExpression(parentObj)) return false;

  // 1. Check sibling properties
  for (const prop of parentObj.properties) {
    if (prop === node) continue;
    const propName =
      prop.name && (ts.isIdentifier(prop.name) || ts.isStringLiteral(prop.name))
        ? prop.name.text.toLowerCase()
        : '';
    if (TLS_CONTEXT_KEYWORDS.has(propName)) {
      return true;
    }
  }

  // 2. Check parent node (e.g. new https.Agent({ rejectUnauthorized: false }))
  let current: ts.Node = parentObj;
  for (let depth = 0; depth < 3; depth++) {
    const parent: ts.Node | undefined = current.parent;
    if (!parent) break;

    if (ts.isNewExpression(parent) || ts.isCallExpression(parent)) {
      const exprText = parent.expression.getText().toLowerCase();
      for (const kw of TLS_CONTEXT_KEYWORDS) {
        if (exprText.includes(kw)) return true;
      }
    }

    if (
      ts.isPropertyAssignment(parent) &&
      (ts.isIdentifier(parent.name) || ts.isStringLiteral(parent.name))
    ) {
      const parentPropName = parent.name.text.toLowerCase();
      if (TLS_CONTEXT_KEYWORDS.has(parentPropName)) return true;
    }

    if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) {
      const varName = parent.name.text.toLowerCase();
      for (const kw of TLS_CONTEXT_KEYWORDS) {
        if (varName.includes(kw)) return true;
      }
    }

    current = parent;
  }

  return false;
}

export function findInsecureTlsInAst(sourceFile: ts.SourceFile): InsecureTlsMatch[] {
  const matches: InsecureTlsMatch[] = [];

  function visit(node: ts.Node): void {
    // Case 1: process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      isNodeTlsRejectUnauthorized(node.left)
    ) {
      const val = node.right.getText(sourceFile).replace(/['"`]/g, '').trim();
      if (val === '0') {
        matches.push({
          pattern: node.getText(sourceFile),
          location: getNodeLocation(sourceFile, node),
          confidence: 'high',
          explanation:
            'NODE_TLS_REJECT_UNAUTHORIZED is explicitly set to "0", completely disabling TLS certificate verification.',
        });
      }
    }

    // Case 2: { rejectUnauthorized: false }
    if (ts.isPropertyAssignment(node)) {
      const propName =
        node.name && (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name))
          ? node.name.text
          : '';
      if (
        propName === 'rejectUnauthorized' &&
        node.initializer.kind === ts.SyntaxKind.FalseKeyword
      ) {
        if (isTlsNetworkContext(node)) {
          matches.push({
            pattern: node.getText(sourceFile),
            location: getNodeLocation(sourceFile, node),
            confidence: 'high',
            explanation:
              'rejectUnauthorized is set to false in a network/TLS connection configuration, disabling certificate validation.',
          });
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return matches;
}

export function findClientExposedSecretsInAst(sourceFile: ts.SourceFile): ClientSecretExposure[] {
  const exposures: ClientSecretExposure[] = [];

  function checkName(name: string, node: ts.Node, rawVal?: string): void {
    if (SENSITIVE_NAME_PATTERN.test(name)) {
      exposures.push({
        variableName: name,
        location: getNodeLocation(sourceFile, node),
        rawValue: rawVal,
        confidence: 'high',
      });
    }
  }

  function visit(node: ts.Node): void {
    // 1. Variable Declaration: const NEXT_PUBLIC_API_SECRET = '...'
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
      const rawVal =
        node.initializer &&
        (ts.isStringLiteral(node.initializer) ||
          ts.isNoSubstitutionTemplateLiteral(node.initializer))
          ? node.initializer.text
          : undefined;
      checkName(node.name.text, node, rawVal);
    }
    // 2. Property Assignment in config object: { NEXT_PUBLIC_SECRET_KEY: '...' }
    else if (ts.isPropertyAssignment(node)) {
      const propName = ts.isIdentifier(node.name)
        ? node.name.text
        : ts.isStringLiteral(node.name)
          ? node.name.text
          : '';
      const rawVal =
        ts.isStringLiteral(node.initializer) || ts.isNoSubstitutionTemplateLiteral(node.initializer)
          ? node.initializer.text
          : undefined;
      checkName(propName, node, rawVal);
    }
    // 3. Property access: process.env.NEXT_PUBLIC_STRIPE_SECRET_KEY
    else if (ts.isPropertyAccessExpression(node)) {
      checkName(node.name.text, node);
    }
    // 4. Element access: process.env["NEXT_PUBLIC_STRIPE_SECRET_KEY"]
    else if (ts.isElementAccessExpression(node) && ts.isStringLiteral(node.argumentExpression)) {
      checkName(node.argumentExpression.text, node);
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return exposures;
}

const IGNORED_PLACEHOLDERS = new Set([
  'your_api_key_here',
  'change_me',
  'placeholder',
  'example',
  'dummy_key',
  '000000000000000000000000',
  '123456789012345678901234',
]);

const SENSITIVE_VAR_REGEX =
  /(?:api[_-]?key|secret|password|auth[_-]?token|access[_-]?token|private[_-]?key)/i;

export function findSecretLiteralsInAst(sourceFile: ts.SourceFile): SecretLiteralMatch[] {
  const matches: SecretLiteralMatch[] = [];

  function visit(node: ts.Node): void {
    let textToScan = '';

    if (ts.isStringLiteral(node)) {
      textToScan = node.text;
    } else if (ts.isNoSubstitutionTemplateLiteral(node)) {
      textToScan = node.text;
    }

    if (textToScan && !IGNORED_PLACEHOLDERS.has(textToScan.toLowerCase())) {
      // 1. Direct pattern matching (AWS, GitHub, Slack, Private Keys)
      for (const pattern of SECRET_PATTERNS) {
        pattern.regex.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = pattern.regex.exec(textToScan)) !== null) {
          matches.push({
            secretType: pattern.name,
            matchedValue: match[0],
            location: getNodeLocation(sourceFile, node),
          });
        }
      }

      // 2. Variable or property assignment with sensitive name and high-entropy value
      const parent = node.parent;
      let varOrPropName = '';
      if (parent && ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) {
        varOrPropName = parent.name.text;
      } else if (
        parent &&
        ts.isPropertyAssignment(parent) &&
        (ts.isIdentifier(parent.name) || ts.isStringLiteral(parent.name))
      ) {
        varOrPropName = parent.name.text;
      }

      if (
        varOrPropName &&
        SENSITIVE_VAR_REGEX.test(varOrPropName) &&
        textToScan.length >= 24 &&
        !matches.some((m) => m.matchedValue === textToScan)
      ) {
        matches.push({
          secretType: 'Hardcoded API Secret Assignment',
          matchedValue: textToScan,
          location: getNodeLocation(sourceFile, node),
        });
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return matches;
}
