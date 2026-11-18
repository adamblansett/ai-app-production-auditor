import fs from 'node:fs';
import path from 'node:path';
import type { Finding } from '../models/finding.js';
import type { RuleContext } from '../models/rule.js';

export interface FixResult {
  ruleId: string;
  description: string;
  fileModified: string;
}

export function applyRemediations(
  targetDir: string,
  findings: Finding[],
  context?: RuleContext,
): FixResult[] {
  const fixes: FixResult[] = [];
  const resolvedTarget = path.resolve(targetDir);

  // 1. Remediate ENV001 / ENV002 (Missing or incomplete .env.example)
  const hasEnvIssue = findings.some((f) => f.ruleId === 'ENV001' || f.ruleId === 'ENV002');
  if (hasEnvIssue && context) {
    const envVars = new Set<string>();

    for (const file of context.files) {
      if (context.analyzer?.isEligibleForAst(file.relativePath)) {
        const refs = context.analyzer.analyzeEnvironmentVariables(file);
        for (const r of refs) {
          if (!r.isDynamic && r.name && !r.name.startsWith('NODE_')) {
            envVars.add(r.name);
          }
        }
      } else {
        const content = context.getFileContent(file.relativePath);
        if (content) {
          const matches = content.matchAll(/\b(?:process\.env|import\.meta\.env)\.([A-Z0-9_]+)\b/g);
          for (const m of matches) {
            if (m[1] && !m[1].startsWith('NODE_')) envVars.add(m[1]);
          }
        }
      }
    }

    const envExamplePath = path.join(resolvedTarget, '.env.example');
    if (!fs.existsSync(envExamplePath)) {
      if (envVars.size > 0) {
        const sorted = Array.from(envVars).sort();
        const content = [
          '# Environment variables template',
          '# Generated automatically by ai-app-production-auditor',
          '',
          ...sorted.map((v) => `${v}=`),
          '',
        ].join('\n');

        fs.writeFileSync(envExamplePath, content, 'utf8');
        fixes.push({
          ruleId: 'ENV002',
          description: `Created .env.example declaring ${sorted.length} environment variables`,
          fileModified: '.env.example',
        });
      }
    } else {
      const existing = fs.readFileSync(envExamplePath, 'utf8');
      const existingKeys = new Set(
        existing
          .split('\n')
          .map((l) => l.trim())
          .filter((l) => l && !l.startsWith('#') && l.includes('='))
          .map((l) => l.split('=')[0]?.trim())
          .filter(Boolean),
      );

      const missing = Array.from(envVars)
        .filter((v) => !existingKeys.has(v))
        .sort();

      if (missing.length > 0) {
        const appendText = [
          '',
          '# Additional variables added by ai-app-production-auditor',
          ...missing.map((v) => `${v}=`),
          '',
        ].join('\n');

        fs.writeFileSync(envExamplePath, existing.trimEnd() + '\n' + appendText, 'utf8');
        fixes.push({
          ruleId: 'ENV001',
          description: `Appended ${missing.length} missing environment variables to .env.example`,
          fileModified: '.env.example',
        });
      }
    }
  }

  // 2. Remediate CFG003 (Missing or incomplete .gitignore)
  const hasGitignoreIssue = findings.some((f) => f.ruleId === 'CFG003');
  if (hasGitignoreIssue) {
    const gitignorePath = path.join(resolvedTarget, '.gitignore');
    if (!fs.existsSync(gitignorePath)) {
      const defaultGitignore = [
        '# Node & Build artifacts',
        'node_modules/',
        'dist/',
        '',
        '# Environment files',
        '.env',
        '.env.local',
        '.env.*.local',
        '',
        '# Logs',
        '*.log',
        '',
      ].join('\n');

      fs.writeFileSync(gitignorePath, defaultGitignore, 'utf8');
      fixes.push({
        ruleId: 'CFG003',
        description: 'Created .gitignore with critical node_modules and .env ignore rules',
        fileModified: '.gitignore',
      });
    } else {
      const existing = fs.readFileSync(gitignorePath, 'utf8');
      const lines = existing.split('\n').map((l) => l.trim().replace(/\/$/, ''));
      const toAppend: string[] = [];

      if (!lines.includes('node_modules')) toAppend.push('node_modules/');
      if (!lines.includes('.env') && !lines.includes('*.env')) toAppend.push('.env');

      if (toAppend.length > 0) {
        const appendText = ['', '# Added by ai-app-production-auditor', ...toAppend, ''].join('\n');
        fs.writeFileSync(gitignorePath, existing.trimEnd() + '\n' + appendText, 'utf8');
        fixes.push({
          ruleId: 'CFG003',
          description: `Appended ${toAppend.join(', ')} to .gitignore`,
          fileModified: '.gitignore',
        });
      }
    }
  }

  // 3. Remediate CFG004 (Unpinned dependencies in package.json)
  const hasWildcardDeps = findings.some((f) => f.ruleId === 'CFG004');
  if (hasWildcardDeps) {
    const pkgPath = path.join(resolvedTarget, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const raw = fs.readFileSync(pkgPath, 'utf8');
        const pkg = JSON.parse(raw);
        let modified = false;

        // Try reading package-lock.json to find resolved versions
        let lockPackages: Record<string, { version?: string }> = {};
        const lockPath = path.join(resolvedTarget, 'package-lock.json');
        if (fs.existsSync(lockPath)) {
          try {
            const lockData = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
            lockPackages = lockData.packages || {};
          } catch {
            // ignore lock parsing failure
          }
        }

        const pinDeps = (depsRecord?: Record<string, string>) => {
          if (!depsRecord) return;
          for (const [name, version] of Object.entries(depsRecord)) {
            if (version === '*' || version === 'latest') {
              const locked = lockPackages[`node_modules/${name}`]?.version;
              // Only pin when a concrete resolved version is known; never invent a version.
              if (locked) {
                depsRecord[name] = `^${locked}`;
                modified = true;
              }
            }
          }
        };

        pinDeps(pkg.dependencies);
        pinDeps(pkg.devDependencies);

        if (modified) {
          fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
          fixes.push({
            ruleId: 'CFG004',
            description: 'Pinned wildcard dependency versions in package.json',
            fileModified: 'package.json',
          });
        }
      } catch {
        // ignore package.json write error during fix
      }
    }
  }

  return fixes;
}
