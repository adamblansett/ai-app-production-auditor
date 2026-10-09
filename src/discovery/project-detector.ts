import fs from 'node:fs';
import path from 'node:path';
import type { ProjectInfo } from './types.js';

export function detectProject(targetDir: string): ProjectInfo {
  const pkgPath = path.join(targetDir, 'package.json');
  let hasPackageJson = false;
  let packageJsonRaw: Record<string, unknown> | null = null;
  let packageJsonError: string | null = null;

  if (fs.existsSync(pkgPath)) {
    hasPackageJson = true;
    try {
      const content = fs.readFileSync(pkgPath, 'utf8');
      packageJsonRaw = JSON.parse(content) as Record<string, unknown>;
    } catch (err) {
      packageJsonError = `Malformed package.json: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  const name =
    typeof packageJsonRaw?.name === 'string'
      ? packageJsonRaw.name
      : path.basename(path.resolve(targetDir)) || 'unknown-project';

  const version = typeof packageJsonRaw?.version === 'string' ? packageJsonRaw.version : null;

  // Gather all dependencies
  const dependencies = {
    ...(packageJsonRaw?.dependencies as Record<string, string> | undefined),
    ...(packageJsonRaw?.devDependencies as Record<string, string> | undefined),
  };

  // Detect language / project type
  const hasTsConfig =
    fs.existsSync(path.join(targetDir, 'tsconfig.json')) ||
    fs.existsSync(path.join(targetDir, 'tsconfig.base.json'));
  const hasTsDependency = Boolean(dependencies['typescript']);
  const projectType: 'typescript' | 'javascript' | 'unknown' =
    hasTsConfig || hasTsDependency ? 'typescript' : hasPackageJson ? 'javascript' : 'unknown';

  const frameworks: string[] = [];
  const tools: string[] = [];

  // Framework detection based on concrete evidence
  if (
    dependencies['next'] ||
    fileExistsAny(targetDir, ['next.config.js', 'next.config.mjs', 'next.config.ts'])
  ) {
    frameworks.push('Next.js');
  }
  if (dependencies['react'] || dependencies['react-dom']) {
    frameworks.push('React');
  }
  if (dependencies['vue'] || fileExistsAny(targetDir, ['vue.config.js', 'vue.config.ts'])) {
    frameworks.push('Vue.js');
  }
  if (dependencies['nuxt'] || fileExistsAny(targetDir, ['nuxt.config.js', 'nuxt.config.ts'])) {
    frameworks.push('Nuxt');
  }
  if (dependencies['@angular/core'] || fs.existsSync(path.join(targetDir, 'angular.json'))) {
    frameworks.push('Angular');
  }
  if (
    dependencies['@sveltejs/kit'] ||
    dependencies['svelte'] ||
    fs.existsSync(path.join(targetDir, 'svelte.config.js'))
  ) {
    frameworks.push('Svelte');
  }
  if (dependencies['@remix-run/react'] || fileExistsAny(targetDir, ['remix.config.js'])) {
    frameworks.push('Remix');
  }
  if (dependencies['express']) {
    frameworks.push('Express');
  }
  if (dependencies['fastify']) {
    frameworks.push('Fastify');
  }
  if (dependencies['@nestjs/core'] || fs.existsSync(path.join(targetDir, 'nest-cli.json'))) {
    frameworks.push('NestJS');
  }

  // Tooling detection
  if (
    dependencies['vite'] ||
    fileExistsAny(targetDir, ['vite.config.js', 'vite.config.ts', 'vite.config.mjs'])
  ) {
    tools.push('Vite');
  }
  if (
    dependencies['webpack'] ||
    fileExistsAny(targetDir, ['webpack.config.js', 'webpack.config.ts'])
  ) {
    tools.push('Webpack');
  }
  if (
    dependencies['tailwindcss'] ||
    fileExistsAny(targetDir, ['tailwind.config.js', 'tailwind.config.ts'])
  ) {
    tools.push('Tailwind CSS');
  }
  if (
    dependencies['vitest'] ||
    fileExistsAny(targetDir, ['vitest.config.ts', 'vitest.config.js'])
  ) {
    tools.push('Vitest');
  }
  if (dependencies['jest'] || fileExistsAny(targetDir, ['jest.config.js', 'jest.config.ts'])) {
    tools.push('Jest');
  }
  if (
    dependencies['playwright'] ||
    dependencies['@playwright/test'] ||
    fileExistsAny(targetDir, ['playwright.config.ts', 'playwright.config.js'])
  ) {
    tools.push('Playwright');
  }
  if (
    dependencies['cypress'] ||
    fileExistsAny(targetDir, ['cypress.config.ts', 'cypress.config.js'])
  ) {
    tools.push('Cypress');
  }
  if (
    dependencies['eslint'] ||
    fileExistsAny(targetDir, ['eslint.config.js', '.eslintrc.json', '.eslintrc.js'])
  ) {
    tools.push('ESLint');
  }
  if (dependencies['prettier'] || fileExistsAny(targetDir, ['.prettierrc', '.prettierrc.json'])) {
    tools.push('Prettier');
  }

  // Monorepo detection
  const hasWorkspacesField =
    Array.isArray(packageJsonRaw?.workspaces) || typeof packageJsonRaw?.workspaces === 'object';
  const hasPnpmWorkspace = fs.existsSync(path.join(targetDir, 'pnpm-workspace.yaml'));
  const hasLerna = fs.existsSync(path.join(targetDir, 'lerna.json'));
  const hasTurborepo = fs.existsSync(path.join(targetDir, 'turbo.json'));
  const isMonorepo = hasWorkspacesField || hasPnpmWorkspace || hasLerna || hasTurborepo;

  let packageCount = 1;
  if (isMonorepo) {
    // Conservatively check packages or apps directories
    packageCount = countSubpackages(targetDir);
  }

  return {
    name,
    version,
    type: projectType,
    frameworks: [...new Set(frameworks)],
    tools: [...new Set(tools)],
    isMonorepo,
    packageCount,
    hasPackageJson,
    packageJsonRaw,
    packageJsonError,
  };
}

function fileExistsAny(targetDir: string, filenames: string[]): boolean {
  return filenames.some((file) => fs.existsSync(path.join(targetDir, file)));
}

function countSubpackages(targetDir: string): number {
  let count = 1;
  const candidateDirs = ['packages', 'apps', 'libs'];
  for (const dirName of candidateDirs) {
    const fullDir = path.join(targetDir, dirName);
    if (fs.existsSync(fullDir)) {
      try {
        const entries = fs.readdirSync(fullDir, { withFileTypes: true });
        for (const entry of entries) {
          if (
            entry.isDirectory() &&
            fs.existsSync(path.join(fullDir, entry.name, 'package.json'))
          ) {
            count++;
          }
        }
      } catch {
        // Ignore errors during directory traversal
      }
    }
  }
  return count;
}
