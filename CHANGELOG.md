# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-10-09

### Added

- Initial release of the **AI App Production Auditor** TypeScript CLI.
- Modular core architecture: discovery, safe file collection, diagnostic rules, models, and reporters.
- Safe file traversal engine preventing path traversal, symlink escapes, excessive file counts, and binary scanning.
- Core diagnostic rules:
  - `PRJ001`: Project manifest integrity, structure, and monorepo workspace detection.
  - `URL001`: Hardcoded localhost and loopback IPv4/IPv6 URL detection with location tracking.
  - `ENV001` & `ENV002`: Environment variable consistency and missing `.env.example` checks.
  - `TST001` & `TST002`: Automated test script and test framework configuration checks.
  - `BLD001`, `BLD002`, `BLD003`: Build, type-check, and lint script verification.
  - `SEC001` & `SEC002`: Conservative secret detection with strict redaction across all reports (including AWS, GitHub, Slack, OpenAI, Anthropic, and Hugging Face keys).
  - `CFG001`, `CFG002`, `CFG003`, `CFG004`, `CFG005`, `CFG006`: Production configuration heuristics (TLS verification, frontend secret exposure, `.gitignore` validation, unpinned dependencies, Dockerfile root checks, SQL injection interpolation).
  - `AI001`, `AI002`, `AI003`: AI application safety and hygiene diagnostics (dangerouslyAllowBrowser bypasses, raw stream DOM injection XSS, unimplemented stubs and placeholder credentials).
- Multi-format report generation:
  - Readable terminal output with ANSI styling, severity grouping, and remediation logs.
  - GitHub-flavored Markdown reports for PRs and issues.
  - Versioned machine-readable JSON schema output (`schemaVersion: 1.0.0`).
  - SARIF v2.1.0 report format (`--format sarif`) for native GitHub Code Scanning integration.
- Automated mechanical remediation mode (`--fix`):
  - Automatic creation and synchronization of `.env.example` from AST-discovered environment variables.
  - Automatic creation and repair of `.gitignore` with critical ignore patterns.
  - Pinned resolution of wildcard dependencies in `package.json`.
- Inline rule comment suppressions:
  - Support for `// auditor-disable-next-line RULE_ID`, block disables (`/* auditor-disable */`), and hash-style comments (`# auditor-disable-next-line`).
- Configuration auto-discovery:
  - Automatic discovery of `.auditorrc`, `.auditorrc.json`, `auditor.config.json`, and `"auditor"` section in `package.json`.
- Custom rule authoring API (`defineRule`).
- Dedicated AST static analysis subsystem powered by the TypeScript Compiler API:
  - Syntax-aware parsing for TypeScript and JavaScript dialects (`.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs`, `.mts`, `.cts`).
  - Complete elimination of false positives from comments, documentation, and un-executed tokens.
  - Context-sensitive TLS security checks (`https.Agent`, connection options, `NODE_TLS_REJECT_UNAUTHORIZED = '0'`).
  - AST-level environment variable detection (direct access, bracket notation, `import.meta.env`, and object destructuring).
  - Client-side secret exposure detection for `NEXT_PUBLIC_*` and `VITE_*` public variables.
  - Source file AST caching and visitor query memoization for audit performance.
  - Resilient syntax diagnostic collection into `skippedFiles` preventing audit crashes on broken code.
  - Dual-mode rule architecture guaranteeing zero duplicate findings with non-script regex fallbacks.
- Configurable severity thresholds for exit codes (`0`, `1`, `2`, `3`).
- Overwrite protection for report generation on disk (`--force`).
- Versioned configuration file support (`.auditorrc.json`).
- Synthetic test fixtures and full test suite covering rules, edge cases, safeguards, and CLI execution.
