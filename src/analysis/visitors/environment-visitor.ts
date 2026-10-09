import ts from 'typescript';
import type { EnvVarReference } from '../types.js';
import { getNodeLocation } from '../parser.js';

function isProcessIdentifier(expr: ts.Expression): boolean {
  if (ts.isIdentifier(expr) && expr.text === 'process') {
    return true;
  }
  if (
    ts.isPropertyAccessExpression(expr) &&
    expr.name.text === 'process' &&
    ts.isIdentifier(expr.expression) &&
    (expr.expression.text === 'globalThis' || expr.expression.text === 'global')
  ) {
    return true;
  }
  return false;
}

export function isProcessEnv(expr: ts.Expression): boolean {
  if (ts.isPropertyAccessExpression(expr)) {
    return expr.name.text === 'env' && isProcessIdentifier(expr.expression);
  }
  if (ts.isElementAccessExpression(expr)) {
    return (
      ts.isStringLiteral(expr.argumentExpression) &&
      expr.argumentExpression.text === 'env' &&
      isProcessIdentifier(expr.expression)
    );
  }
  return false;
}

function isImportMetaEnv(expr: ts.Expression): boolean {
  if (ts.isPropertyAccessExpression(expr)) {
    if (expr.name.text !== 'env') return false;
    const base = expr.expression;
    if (ts.isMetaProperty(base)) {
      return base.keywordToken === ts.SyntaxKind.ImportKeyword && base.name.text === 'meta';
    }
  }
  return false;
}

function isEnvObject(expr: ts.Expression): boolean {
  return isProcessEnv(expr) || isImportMetaEnv(expr);
}

export function findEnvironmentVariablesInAst(sourceFile: ts.SourceFile): EnvVarReference[] {
  const references: EnvVarReference[] = [];

  function visit(node: ts.Node): void {
    // 1. Property access: process.env.VAR_NAME or import.meta.env.VAR_NAME
    if (ts.isPropertyAccessExpression(node)) {
      if (isEnvObject(node.expression)) {
        const varName = node.name.text;
        if (/^[A-Z0-9_]+$/i.test(varName)) {
          references.push({
            name: varName,
            location: getNodeLocation(sourceFile, node),
            isDynamic: false,
            isDestructured: false,
            rawExpression: node.getText(sourceFile),
          });
        }
      }
    }
    // 2. Element access: process.env["VAR_NAME"] or process.env[dynamicKey]
    else if (ts.isElementAccessExpression(node)) {
      if (isEnvObject(node.expression)) {
        if (ts.isStringLiteral(node.argumentExpression)) {
          const varName = node.argumentExpression.text;
          if (/^[A-Z0-9_]+$/i.test(varName)) {
            references.push({
              name: varName,
              location: getNodeLocation(sourceFile, node),
              isDynamic: false,
              isDestructured: false,
              rawExpression: node.getText(sourceFile),
            });
          }
        } else {
          // Dynamic access: process.env[getVar()]
          references.push({
            name: '<dynamic>',
            location: getNodeLocation(sourceFile, node),
            isDynamic: true,
            isDestructured: false,
            rawExpression: node.getText(sourceFile),
          });
        }
      }
    }
    // 3. Destructuring in variable declaration: const { API_KEY, PORT: customPort, ...rest } = process.env;
    else if (ts.isVariableDeclaration(node) && node.initializer && isEnvObject(node.initializer)) {
      if (ts.isObjectBindingPattern(node.name)) {
        for (const element of node.name.elements) {
          if (element.dotDotDotToken) {
            continue; // Skip rest properties (...rest)
          }

          const propertyName = element.propertyName
            ? ts.isIdentifier(element.propertyName) || ts.isStringLiteral(element.propertyName)
              ? element.propertyName.text
              : null
            : ts.isIdentifier(element.name)
              ? element.name.text
              : null;

          if (propertyName && /^[A-Z0-9_]+$/i.test(propertyName)) {
            references.push({
              name: propertyName,
              location: getNodeLocation(sourceFile, element),
              isDynamic: false,
              isDestructured: true,
              rawExpression: element.getText(sourceFile),
            });
          }
        }
      }
    }
    // 4. Destructuring in assignment: ({ API_KEY } = process.env);
    else if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      isEnvObject(node.right)
    ) {
      if (ts.isObjectLiteralExpression(node.left)) {
        for (const prop of node.left.properties) {
          if (ts.isShorthandPropertyAssignment(prop)) {
            const varName = prop.name.text;
            if (/^[A-Z0-9_]+$/i.test(varName)) {
              references.push({
                name: varName,
                location: getNodeLocation(sourceFile, prop),
                isDynamic: false,
                isDestructured: true,
                rawExpression: prop.getText(sourceFile),
              });
            }
          } else if (
            ts.isPropertyAssignment(prop) &&
            (ts.isIdentifier(prop.name) || ts.isStringLiteral(prop.name))
          ) {
            const varName = prop.name.text;
            if (/^[A-Z0-9_]+$/i.test(varName)) {
              references.push({
                name: varName,
                location: getNodeLocation(sourceFile, prop),
                isDynamic: false,
                isDestructured: true,
                rawExpression: prop.getText(sourceFile),
              });
            }
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return references;
}
