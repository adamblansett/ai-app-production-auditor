# AI App Production Auditor

**Find configuration problems, missing quality checks, and production-readiness issues in web applications before deployment.**

AI coding assistants make prototyping and rapid development faster than ever. However, a working prototype or local development preview does not guarantee that an application is safe, consistent, and ready for production.

**AI App Production Auditor** is an open-source, offline TypeScript command-line tool that inspects web applications for common configuration oversights, missing quality controls, exposed secrets, and deployment failure patterns—particularly in applications generated or accelerated by AI tools.

The auditor runs **100% locally and offline**. It requires **no LLM APIs, no paid subscriptions, no cloud services, and no external network access**. It prioritizes reliable, evidence-backed diagnostics over speculation.

---

## Current Status

- **Version:** `0.1.0`
- **Release Stage:** Initial Production Release
- **Environment:** Node.js `>= 20.0.0` (LTS)
- **Supported Languages:** TypeScript and JavaScript web applications

All diagnostic rules, file safeguards, configuration loaders, exit codes, and report formats documented below are **implemented and verified** with automated unit and integration test suites.

---

## Why This Tool Exists

Applications developed with AI coding assistants frequently suffer from characteristic deployment traps:

1. **Hardcoded Localhost Endpoints:** Frontend code directly targeting `http://localhost:3000` or `127.0.0.1` that silently fails when deployed to end-user browsers.
2. **Inconsistent Environment Configuration:** Code accessing `process.env.VAR` or `import.meta.env.VAR` without declaring the variable in `.env.example` or `.env.template`.
3. **Missing Automated Quality Scripts:** Missing or placeholder test scripts (`"echo \"Error: no test specified\" && exit 1"`), missing production build commands, or absent typecheck scripts.
4. **Accidentally Tracked Credentials:** Real `.env` files, API tokens, AWS keys, or private keys committed to the repository.
5. **Insecure Production Defaults:** Disabled TLS validation (`rejectUnauthorized: false`), public client exposure of private keys via `NEXT_PUBLIC_*` or `VITE_*` prefixes, or unpinned wildcard dependencies.

The auditor provides an automated, repeatable sanity check to catch these preventable issues early.

---

## Implemented Diagnostic Checks

Every check produces an evidence-backed diagnostic result with stable identifier, severity, file location, line snippet, explanation, and remediation advice.

| Rule ID  | Name                                   | Category      | Default Severity | Description                                                                                                             |
| :------- | :------------------------------------- | :------------ | :--------------- | :---------------------------------------------------------------------------------------------------------------------- |
| `PRJ001` | Project Structure & Manifest Integrity | Configuration | High             | Validates `package.json` syntax, detects project structure, and identifies monorepo workspaces.                         |
| `URL001` | Hardcoded Localhost URL Detection      | Configuration | Medium           | Detects hardcoded `localhost`, `127.0.0.1`, `[::1]`, and loopback URLs in application source code.                      |
| `ENV001` | Environment Variable Consistency       | Configuration | Medium           | Identifies variables referenced in code (`process.env`, `import.meta.env`) that are missing from `.env.example`.        |
| `ENV002` | Missing Example Environment File       | Configuration | Medium           | Flags projects referencing custom environment variables when no `.env.example` or `.env.template` exists.               |
| `TST001` | Automated Test Script Verification     | Testing       | Medium           | Flags missing test scripts or default npm placeholder test commands in `package.json`.                                  |
| `TST002` | Test Framework Detection               | Testing       | Low              | Notes projects without a recognized testing framework (Vitest, Jest, Playwright, Cypress, Mocha).                       |
| `BLD001` | Production Build Script Verification   | Quality       | High             | Flags compiled projects (TypeScript, Next.js, Vite, Nuxt) lacking a `build` script in `package.json`.                   |
| `BLD002` | Type-Check Script Verification         | Quality       | Low              | Recommends adding a `typecheck` script (`tsc --noEmit`) to TypeScript projects.                                         |
| `BLD003` | Lint Script Verification               | Quality       | Low              | Identifies projects without an automated linting command.                                                               |
| `SEC001` | Embedded Secret & Credential Detection | Security      | Critical         | Detects AWS access keys, GitHub tokens, Slack tokens, private keys, and high-entropy API secrets with strict redaction. |
| `SEC002` | Sensitive `.env` File in Repository    | Security      | Critical         | Flags actual `.env` or `.env.local` files present in the repository root instead of being ignored.                      |
| `CFG001` | Insecure TLS Bypass Detection          | Security      | High             | Detects disabled TLS certificate validation (`rejectUnauthorized: false` or `NODE_TLS_REJECT_UNAUTHORIZED = '0'`).      |
| `CFG002` | Leaked Client-Side Secret Prefix       | Security      | High             | Detects secrets prefixed with public identifiers (`NEXT_PUBLIC_*SECRET*`, `VITE_*PASSWORD*`).                           |
| `CFG003` | `.gitignore` Completeness Verification | Configuration | Medium           | Identifies missing `.gitignore` files or `.gitignore` files missing `node_modules` or `.env`.                           |
| `CFG004` | Unpinned Wildcard Dependencies         | Configuration | Low              | Flags wildcard dependencies (`"*"`, `"latest"`) in `package.json`.                                                      |

---

## Severity Model

Findings are categorized into five standard severity levels reflecting operational impact:

- **Critical:** Immediate security vulnerability or guaranteed production failure (e.g., exposed credentials, committed `.env` secrets).
- **High:** Substantial deployment blocker or high-risk misconfiguration (e.g., missing build script in compiled project, disabled TLS validation, malformed package manifest).
- **Medium:** Configuration mismatch or potential client failure (e.g., hardcoded localhost URL, undeclared environment variable in example file, placeholder test script).
- **Low:** Quality hygiene recommendation (e.g., unpinned wildcard dependencies, missing typecheck or lint script).
- **Info:** Contextual observation about project architecture (e.g., monorepo workspace scope).

---

## Installation and Quick Start

### Local Development / Direct Usage

Clone the repository and build the CLI locally:

```bash
git clone https://github.com/adamblansett/ai-app-production-auditor.git
cd ai-app-production-auditor
npm ci
npm run build
```

Run the auditor against any target directory:

```bash
# Basic terminal report
node dist/cli.js ./my-app

# Markdown report written to file
node dist/cli.js ./my-app --format markdown --output readiness-report.md

# Machine-readable JSON report
node dist/cli.js ./my-app --format json
```

### CLI Command Options

```text
Usage: ai-app-production-auditor [options] [target-dir]

Static production-readiness auditor for web applications built with AI coding assistants.

Arguments:
  target-dir              Path to the project directory to audit (default: ".")

Options:
  -V, --version           Output the version number
  -f, --format <format>   Output format: "text", "markdown", or "json" (default: "text")
  -o, --output <file>     Path to write report output
  -w, --force             Overwrite output file if it already exists (default: false)
  -s, --severity <level>  Minimum finding severity to cause a failure exit code
                          (critical, high, medium, low, info, none) (default: "high")
  -c, --config <file>     Path to custom auditor configuration file
  -v, --verbose           Output detailed diagnostic and check information (default: false)
  --no-color              Disable colored terminal output
  -h, --help              Display help for command
```

---

## Exit Codes

The CLI returns predictable exit codes for automation and CI/CD pipelines:

| Exit Code | Meaning                                                                                                |
| :-------: | :----------------------------------------------------------------------------------------------------- |
|    `0`    | **Success:** Audit completed with no findings meeting or exceeding the configured failure threshold.   |
|    `1`    | **Failure:** Audit completed with findings meeting or exceeding the configured failure threshold.      |
|    `2`    | **Usage / Configuration Error:** Invalid CLI arguments or malformed configuration file.                |
|    `3`    | **Operational Error:** Target path does not exist, inaccessible directory, or fatal file-system error. |

By default, the failure threshold is `high` (causing failure only on `high` and `critical` findings). Informational and medium findings do not fail CI by default unless `--severity medium` or a custom configuration is provided.

---

## Configuration File

You can customize rules, severity thresholds, and ignore paths using a `.auditorrc.json` file in the root of your audited project, or via `--config <path>`.

### Example `.auditorrc.json`:

```json
{
  "schemaVersion": 1,
  "severityThreshold": "high",
  "rules": {
    "URL001": {
      "severity": "high"
    },
    "TST002": {
      "enabled": false
    }
  },
  "ignorePaths": ["legacy/**", "docs/**"],
  "limits": {
    "maxFiles": 5000,
    "maxFileSizeBytes": 1048576
  },
  "followSymlinks": false
}
```

---

## Report Formats

### 1. Terminal Output

Formatted for human readability with ANSI colors (when supported), clear severity badges, file line references, and remediation guidance:

```text
========================================================
              AI APP PRODUCTION AUDITOR
========================================================

Project: example-app (v1.0.0)
Type:    typescript
Stack:   React, Next.js
Tools:   Vitest, ESLint
Target:  /workspace/example-app

AUDIT SUMMARY
  Files Scanned: 24 | Duration: 18ms
  Checks Run:    7 completed, 0 skipped, 0 failed

  Total Findings: 1  [Critical: 0, High: 0, Medium: 1, Low: 0, Info: 0]

FINDINGS

[MEDIUM]   Hardcoded localhost URL detected [URL001]
  Location: src/lib/api.ts:12:25
  Issue:    A hardcoded development URL (http://localhost:8000) was detected in src/lib/api.ts.
  Evidence: const API_ENDPOINT = 'http://localhost:8000';
  Action:   Replace the hardcoded URL with a dynamic environment variable (e.g. process.env.API_URL).
```

### 2. GitHub-Flavored Markdown Report

Designed for attaching to pull requests or GitHub issues. Includes summary tables, expandable check details, and formatted code blocks:

```bash
node dist/cli.js ./my-app --format markdown --output audit-report.md
```

### 3. Machine-Readable JSON Report

Conforms to a versioned schema (`schemaVersion: 1.0.0`) suitable for programmatic consumption in CI workflows:

```bash
node dist/cli.js ./my-app --format json > audit-report.json
```

---

## Security & Reliability Safeguards

When auditing third-party or untrusted codebases, the auditor adheres to strict defensive design:

1. **Strictly Non-Destructive:** The scanner **never modifies files**, executes project scripts, or installs packages during an audit.
2. **Offline & Network-Isolated:** The core engine makes zero HTTP requests and sends no telemetry or source code to external servers.
3. **Secret Redaction:** Potential secrets and credentials detected by `SEC001` are **always redacted** in all report outputs (e.g., `AKIA****...****PLE`). Raw secret values are never printed.
4. **Path & Symlink Traversal Protection:** The crawler does not follow symbolic links by default to prevent directory traversal loops or escaping the project root.
5. **Scanning Bounds:** Configurable file limits (default: 5,000 files) and per-file size limits (default: 1 MB) protect against memory exhaustion on large repositories.
6. **Binary Detection:** Automatically detects and skips compiled binary files via null-byte inspection.
7. **Report Overwrite Protection:** Will not overwrite existing report files on disk unless `--force` (`-w`) is explicitly passed.

---

## Known Limitations

- **Static Analysis Scope:** The auditor inspects static text and configuration files. It does not execute JavaScript or perform dynamic runtime evaluation.
- **Dynamic Property Access:** Indirect or computed environment variable access (e.g., `process.env[dynamicVariable]`) cannot always be extracted statically.
- **Secret Detection Heuristics:** Secret detection relies on conservative pattern matching and well-known provider formats. It is not an exhaustive substitute for enterprise secret scanning tools (such as TruffleHog or Gitleaks).
- **Not a Production Guarantee:** No automated static tool can guarantee that an application is free of bugs, scalable, or secure. Use this tool alongside automated tests, staging environments, code review, and production observability.

---

## Testing & Quality Verification

AI App Production Auditor includes a comprehensive Vitest test suite and synthetic fixture applications covering:

- Healthy reference applications
- Hardcoded localhost endpoints
- Inconsistent environment variable declarations
- Incomplete and placeholder test configurations
- Synthetic credentials and complete redaction
- Malformed `package.json` manifests
- Monorepositories and subpackages
- Path traversal, symlinks, binary files, and size limits
- Report serializers and CLI exit codes

### Running Verification Locally

```bash
# Verify formatting
npm run format:check

# Run ESLint
npm run lint

# Run strict TypeScript type check
npm run typecheck

# Run unit and integration tests
npm test

# Build production package
npm run build
```

---

## Continuous Integration

GitHub Actions workflow is located at [`.github/workflows/ci.yml`](.github/workflows/ci.yml).
The workflow executes:

- Multi-version Node.js matrix (`20.x`, `22.x`)
- Formatting verification (`prettier --check`)
- Linting (`eslint`)
- Strict type checking (`tsc --noEmit`)
- Complete Vitest test suite (`vitest run`)
- Production compilation (`tsc -p tsconfig.build.json`)
- CLI binary execution smoke tests

---

## License

This project is licensed under the [MIT License](LICENSE).

---

## Author

Created by **Adam Blansett**

- **Website:** [https://adamblansett.com](https://adamblansett.com)
- **GitHub:** [https://github.com/adamblansett](https://github.com/adamblansett)
