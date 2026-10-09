# Contributing to AI App Production Auditor

Thank you for your interest in contributing to AI App Production Auditor.

We welcome contributions that improve the accuracy, reliability, and security of production-readiness checks for modern applications.

## Development Setup

### Prerequisites

- Node.js >= 20.0.0 (LTS)
- npm >= 10.0.0

### Getting Started

1. Clone the repository:

   ```bash
   git clone https://github.com/adamblansett/ai-app-production-auditor.git
   cd ai-app-production-auditor
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Run the test suite:

   ```bash
   npm test
   ```

4. Build the TypeScript package:
   ```bash
   npm run build
   ```

## Contribution Workflow

Before submitting a pull request, ensure all verification checks pass:

```bash
npm run format:check  # Verifies Prettier code formatting
npm run lint          # Runs ESLint checks
npm run typecheck     # Validates TypeScript types strictly
npm test              # Executes Vitest unit and integration tests
npm run build         # Validates compilation output in dist/
```

### Adding New Diagnostic Rules

When proposing a new diagnostic check:

1. **Evidence-Based:** Tie every finding to observable static files, configuration, or code patterns.
2. **Stable Identifier:** Assign a clear, stable rule ID (e.g., `SEC003`, `CFG005`).
3. **Appropriate Severity:** Never classify informational or low-risk patterns as critical. Distinguish impact and certainty.
4. **Never Disclose Secrets:** Always use the redaction utilities (`redactSecret`, `redactEvidence`) when handling potential credentials.
5. **Add Comprehensive Tests:** Include positive test cases, negative test cases, and edge cases in `tests/unit/rules/`.
6. **Synthetic Fixtures Only:** Never commit real secrets, private keys, or actual credentials in test files or fixtures. Use synthetic test tokens.

## Code of Conduct

Please note that this project is released with a Contributor Code of Conduct. By participating in this project, you agree to abide by its terms.
