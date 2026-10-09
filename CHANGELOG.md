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
  - `SEC001` & `SEC002`: Conservative secret detection with strict redaction across all reports.
  - `CFG001`, `CFG002`, `CFG003`, `CFG004`: Production configuration heuristics (TLS verification, frontend secret exposure, `.gitignore` validation, unpinned dependencies).
- Multi-format report generation:
  - Readable terminal output with ANSI styling and severity grouping.
  - GitHub-flavored Markdown reports for PRs and issues.
  - Versioned machine-readable JSON schema output (`schemaVersion: 1.0.0`).
- Configurable severity thresholds for exit codes (`0`, `1`, `2`, `3`).
- Overwrite protection for report generation on disk (`--force`).
- Versioned configuration file support (`.auditorrc.json`).
- Synthetic test fixtures and full test suite covering rules, edge cases, safeguards, and CLI execution.
