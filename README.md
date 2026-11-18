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

| Rule ID  | Name                                    | Category      | Default Severity | Description                                                                                                                                                                                 |
| :------- | :-------------------------------------- | :------------ | :--------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `PRJ001` | Project Structure & Manifest Integrity  | Configuration | High             | Validates `package.json` syntax, detects project structure, and identifies monorepo workspaces.                                                                                             |
| `URL001` | Hardcoded Localhost URL Detection       | Configuration | Medium           | Detects hardcoded `localhost`, `127.0.0.1`, `[::1]`, and loopback URLs in application source code.                                                                                          |
| `ENV001` | Environment Variable Consistency        | Configuration | Medium           | Identifies variables referenced in code (`process.env`, `import.meta.env`) that are missing from `.env.example`.                                                                            |
| `ENV002` | Missing Example Environment File        | Configuration | Medium           | Flags projects referencing custom environment variables when no `.env.example` or `.env.template` exists.                                                                                   |
| `TST001` | Automated Test Script Verification      | Testing       | Medium           | Flags missing test scripts or default npm placeholder test commands in `package.json`.                                                                                                      |
| `TST002` | Test Framework Detection                | Testing       | Low              | Notes projects without a recognized testing framework (Vitest, Jest, Playwright, Cypress, Mocha).                                                                                           |
| `BLD001` | Production Build Script Verification    | Quality       | High             | Flags compiled projects (TypeScript, Next.js, Vite, Nuxt) lacking a `build` script in `package.json`.                                                                                       |
| `BLD002` | Type-Check Script Verification          | Quality       | Low              | Recommends adding a `typecheck` script (`tsc --noEmit`) to TypeScript projects.                                                                                                             |
| `BLD003` | Lint Script Verification                | Quality       | Low              | Identifies projects without an automated linting command.                                                                                                                                   |
| `SEC001` | Embedded Secret & Credential Detection  | Security      | Critical         | Detects AWS access keys, GitHub tokens, Slack tokens, Google Cloud/Gemini keys, Stripe keys, Twilio SIDs, DB credentials, private keys, and high-entropy API secrets with strict redaction. |
| `SEC002` | Sensitive `.env` File in Repository     | Security      | Critical         | Flags actual `.env` or `.env.local` files present in the repository root instead of being ignored.                                                                                          |
| `SEC003` | Dangerous Dynamic Code Execution        | Security      | High             | Detects dynamic code execution via `eval()`, `window.eval()`, `globalThis.eval()`, `new Function()`, or Node.js `vm` module (arbitrary code execution / RCE risk).                          |
| `CFG001` | Insecure TLS Bypass Detection           | Security      | High             | Detects disabled TLS certificate validation (`rejectUnauthorized: false` or `NODE_TLS_REJECT_UNAUTHORIZED = '0'`).                                                                          |
| `CFG002` | Leaked Client-Side Secret Prefix        | Security      | High             | Detects secrets prefixed with public identifiers (`NEXT_PUBLIC_*SECRET*`, `VITE_*PASSWORD*`).                                                                                               |
| `CFG003` | `.gitignore` Completeness Verification  | Configuration | Medium           | Identifies missing `.gitignore` files or `.gitignore` files missing `node_modules` or `.env`.                                                                                               |
| `CFG004` | Unpinned Wildcard Dependencies          | Configuration | Low              | Flags wildcard dependencies (`"*"`, `"latest"`) in `package.json`.                                                                                                                          |
| `CFG005` | Container & Docker Security             | Security      | Medium           | Detects Dockerfiles running as root and missing or incomplete `.dockerignore` files.                                                                                                        |
| `CFG006` | SQL Injection / Raw Query Interpolation | Security      | High             | Detects string interpolation and concatenation in raw database and ORM query methods.                                                                                                       |
| `CFG007` | Insecure CORS Misconfiguration          | Security      | High             | Detects wildcard (`origin: "*"`) or reflection (`origin: true`) combined with `credentials: true` exposing authenticated endpoints to CSRF/data theft.                                      |
| `AI001`  | AI Browser Guard Bypass Detection       | Security      | High             | Detects `dangerouslyAllowBrowser: true` and direct client-side instantiations of AI provider SDKs.                                                                                          |
| `AI002`  | Unsanitized AI Stream DOM Injection     | Security      | High             | Detects raw AI responses and stream completions rendered directly into the DOM via `dangerouslySetInnerHTML` (XSS).                                                                         |
| `AI003`  | AI Stubs & Scaffolding Artifacts        | Quality       | Medium           | Flags unimplemented error stubs (`throw new Error("Not implemented")`) and placeholder dummy credentials in source.                                                                         |

---

## AST-Powered Static Analysis Engine

The auditor uses a dedicated Abstract Syntax Tree (AST) analysis subsystem powered by the **TypeScript Compiler API** (`ts.createSourceFile`). This brings compiler-grade precision to source code inspection:

### 1. Supported File Formats & Dialects

- **TypeScript:** `.ts`, `.tsx`, `.mts`, `.cts`
- **JavaScript:** `.js`, `.jsx`, `.mjs`, `.cjs`
- **Non-Script Files:** Structured regex/pattern matching is retained as a fallback for non-script files (such as `.env`, `.json`, `.yaml`, `.yml`, `.toml`, `.md`).

### 2. Elimination of False Positives

- **Comments & Documentation Ignored:** Code comments (`// ...`, `/* ... */`) and JSDoc blocks mentioning development URLs (e.g. `// Connect to http://localhost:3000`) or environment variables are excluded because they do not form executable AST nodes.
- **Context-Sensitive Matching:** TLS options like `rejectUnauthorized: false` are only flagged when associated with network clients, `https.Agent` instantiations, or TLS socket configuration—avoiding false positives on unrelated application domain objects.

### 3. Syntax Recognition Capabilities

- **Environment Variables:** Analyzes `process.env.VAR`, `process.env['VAR']`, `import.meta.env.VAR`, and object destructuring declarations and assignments (`const { API_KEY } = process.env`). Computed accesses without static literals are safely flagged as dynamic without generating false identifier names.
- **Localhost & Loopback URLs:** Inspects string literals, untagged template literals, and template expression heads/spans for `http://localhost`, `https://localhost`, `127.0.0.1`, and IPv6 `[::1]`.
- **Client-Side Secret Exposure:** Flags frontend framework configurations and client files where public prefixes (`NEXT_PUBLIC_*`, `VITE_*`) are combined with sensitive tokens (`SECRET`, `PRIVATE`, `PASSWORD`, `API_KEY`, `TOKEN`).
- **Insecure TLS Settings:** Flags assignments to `process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'` and context-validated `rejectUnauthorized: false`.
- **Dangerous Dynamic Code Execution:** Flags direct and indirect invocations of `eval()`, `window.eval()`, `globalThis.eval()`, `new Function()`, and Node.js `vm` execution functions.
- **Insecure CORS Configuration:** Detects permissive CORS policies combining wildcard (`*`) or reflective (`true`) origins with credentials enabled.

### 4. Safety & Robustness Guarantees

- **Zero Execution:** Target source files are parsed statically into AST nodes; code is **never dynamically imported, evaluated, or executed**.
- **No Dependency Requirements:** Scanning does not require `node_modules` or dependencies to be installed in the target repository.
- **Graceful Syntax Error Handling:** Files containing syntax errors or incomplete code are reported with non-fatal diagnostics in `skippedFiles`, allowing the rest of the project audit to continue uninterrupted.
- **Caching & Deduplication:** Abstract syntax trees are memoized per file across rules during each audit run, ensuring fast execution and guaranteeing zero duplicate findings between AST rules and non-script regex fallbacks.

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

# SARIF report for GitHub Code Scanning
node dist/cli.js ./my-app --format sarif --output results.sarif

# Automatically remediate safe mechanical issues (.env.example, .gitignore, package.json)
node dist/cli.js ./my-app --fix
```

### CLI Command Options

```text
Usage: ai-app-production-auditor [options] [target-dir]

Static production-readiness auditor for web applications built with AI coding assistants.

Arguments:
  target-dir              Path to the project directory to audit (default: ".")

Options:
  -V, --version           Output the version number
  -f, --format <format>   Output format: "text", "markdown", "json", or "sarif" (default: "text")
  -o, --output <file>     Path to write report output
  -w, --force             Overwrite output file if it already exists (default: false)
  -s, --severity <level>  Minimum finding severity to cause a failure exit code
                          (critical, high, medium, low, info, none) (default: "high")
  -c, --config <file>     Path to custom auditor configuration file
  --fix                   Automatically remediate safe, mechanical findings (.env.example, .gitignore, package.json) (default: false)
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

### 4. SARIF Report (GitHub Code Scanning)

Conforms to the OASIS Static Analysis Results Interchange Format (SARIF v2.1.0) standard. Directly uploadable to GitHub Code Scanning:

```bash
node dist/cli.js . --format sarif --output results.sarif
```

```yaml
# In .github/workflows/audit.yml:
- name: Run Production Auditor
  run: npx ai-app-production-auditor . --format sarif --output results.sarif --severity none

- name: Upload SARIF report
  uses: github/codeql-action/upload-sarif@v3
  with:
    sarif_file: results.sarif
```

---

## Inline Rule Suppressions

Teams can suppress specific rules directly in code comments when an exception is intentional:

```typescript
// Suppress next line for a specific rule:
// auditor-disable-next-line URL001 -- local dev proxy intentional here
const proxyTarget = "http://localhost:8080";

// Suppress multiple rules on next line:
// auditor-disable-next-line URL001, SEC001

// Block suppression:
/* auditor-disable URL001 */
const local1 = "http://localhost:3000";
const local2 = "http://localhost:3001";
/* auditor-enable URL001 */

# Hash-style comment for Dockerfiles, shell scripts, and YAML:
# auditor-disable-next-line CFG005
USER root
```

---

## Automated Remediation (`--fix`)

Run with `--fix` to automatically repair safe, mechanical findings without manual edits:

```bash
ai-app-production-auditor . --fix
```

Mechanically remediates:

- **`ENV002` / `ENV001`**: Automatically creates or synchronizes `.env.example` with blank keys for all environment variables detected in source code.
- **`CFG003`**: Automatically creates `.gitignore` with standard patterns (`node_modules/`, `.env`, `.env.local`, `dist/`) or appends missing entries.
- **`CFG004`**: Pins unpinned wildcard dependencies (`"*"`, `"latest"`) in `package.json` to the version resolved in `package-lock.json`. Dependencies with no resolved lockfile version are left unchanged.

---

## Custom Rule Authoring API

Organizations can define custom rules using the typed `defineRule` helper:

```typescript
import { defineRule, createFinding } from 'ai-app-production-auditor';

export const internalTelemetryRule = defineRule({
  id: 'ORG001',
  name: 'Enforce Internal Telemetry Wrapper',
  description: 'Ensures fetch calls use internal client wrapper',
  category: 'architecture',
  defaultSeverity: 'high',
  execute(context) {
    const findings = [];
    // Custom AST or regex inspection logic
    return {
      ruleId: 'ORG001',
      name: 'Enforce Internal Telemetry Wrapper',
      description: 'Ensures fetch calls use internal client wrapper',
      findings,
    };
  },
});
```

---

## Security & Reliability Safeguards

When auditing third-party or untrusted codebases, the auditor adheres to strict defensive design:

1. **Non-Destructive by Default:** A standard audit **never modifies files**, executes project scripts, or installs packages. Files are written only when you explicitly pass `--fix` (limited to `.env.example`, `.gitignore`, and `package.json`) or `--output`.
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

## ⚖️ Legal Disclaimer & Limitation of Liability

### 1. "AS IS" and Express Warranty Disclaimer

This software, documentation, and all associated audit reports, scoring outputs, and recommendations are provided strictly on an **"AS IS"** and **"AS AVAILABLE"** basis, **WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND**, either express, implied, statutory, or otherwise. To the maximum extent permitted by applicable law, the author, copyright holders, and contributors expressly disclaim all warranties, including but not limited to:

- Implied warranties of merchantability, fitness for a particular purpose, title, quiet enjoyment, and non-infringement.
- Any warranty that the software will meet your specific business or engineering requirements, operate without interruption, be defect-free, error-free, secure, or free from bugs, vulnerabilities, or malicious code.
- Any warranty regarding the accuracy, completeness, reliability, or timeliness of any audit findings, risk scores, or diagnostic reports.

### 2. Not a Formal Security Audit or Regulatory Certification

- **Informational & Diagnostic Scope:** AI App Production Auditor is a heuristic static analysis tool designed to aid developer code reviews. An audit score of "100%", zero detected findings, or a passing status does **not** constitute a formal cybersecurity audit, penetration test, or software security certification.
- **No Regulatory Compliance Guarantee:** This tool does **not** certify compliance with any regulatory standard, legal framework, or industry benchmark, including but not limited to SOC 2, ISO/IEC 27001, HIPAA, PCI-DSS, GDPR, CCPA, or NIST SP 800-53. The absence of findings does not guarantee immunity from cyberattacks, data breaches, unauthorized access, or regulatory enforcement actions.
- **Not Legal Counsel:** Findings, explanations, and remediation advice do not constitute legal or regulatory advice. Users are solely responsible for engaging qualified security assessors and legal counsel to evaluate their software before production deployment.

### 3. Automated Remediation & Safe File Modification Notice

- Where automated repair or remediation features (`--fix`) are invoked, the tool applies heuristic text and configuration transformations to source files.
- Users are strictly required to verify all proposed modifications (using `--dry-run` or version control diffs) and maintain independent, verified backups prior to applying changes.
- The author and contributors accept no responsibility or liability for lost files, corrupted configuration syntax, unintended code modifications, broken builds, operational downtime, or data corruption resulting from the application of automated fixes.

### 4. Limitation of Liability

To the maximum extent permitted by applicable law, **IN NO EVENT SHALL THE AUTHOR, COPYRIGHT HOLDERS, OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, PUNITIVE, OR CONSEQUENTIAL DAMAGES** (including, but not limited to, loss of use, data, revenue, profits, business, goodwill, or anticipated savings; system downtime; security breaches; data corruption; or procurement of substitute goods or services), however caused and on any theory of liability, whether in contract, strict liability, tort (including negligence or otherwise), or statute, arising in any way out of the use, reproduction, modification, distribution, or reliance upon this software, even if advised of the possibility of such damages.

### 5. Third-Party Trademarks & Non-Affiliation

All product names, logos, brands, and registered trademarks mentioned within this project (including Next.js, React, Node.js, Express, FastAPI, Django, Flutter, Prisma, Supabase, Firebase, Stripe, AWS, Google, and OpenAI) are the property of their respective owners. Reference to any specific company, platform, product, or service does not constitute or imply endorsement, sponsorship, or affiliation with the author.

---

## License

This project is licensed under the [MIT License](LICENSE).

---

## Author

Created by **Adam Blansett**

- **Website:** [https://adamblansett.com](https://adamblansett.com)
- **GitHub:** [https://github.com/adamblansett](https://github.com/adamblansett)
