#!/usr/bin/env node
import { createCliCommand } from './cli/options.js';
import { loadConfig } from './config/loader.js';
import { runAudit } from './core/engine.js';
import { formatTerminalReport } from './reporters/terminal-reporter.js';
import { formatMarkdownReport } from './reporters/markdown-reporter.js';
import { formatJsonReport } from './reporters/json-reporter.js';
import { writeReportToFile } from './reporters/writer.js';
import { determineExitCode, ExitCode, type FailureThreshold } from './cli/exit-codes.js';
import { setColorsEnabled } from './utils/text.js';

export async function runCli(argv = process.argv): Promise<number> {
  const program = createCliCommand();

  try {
    program.parse(argv);
  } catch (err) {
    process.stderr.write(
      `Error parsing command-line options: ${err instanceof Error ? err.message : String(err)}\n`,
    );
    return ExitCode.INVALID_CONFIG_OR_USAGE;
  }

  const opts = program.opts();
  const [targetDir = '.'] = program.args;

  // Handle color disabling
  if (opts.color === false || opts.noColor) {
    setColorsEnabled(false);
  }

  // Validate format
  const format = (opts.format || 'text').toLowerCase();
  if (!['text', 'markdown', 'json'].includes(format)) {
    process.stderr.write(
      `Error: Invalid format "${format}". Supported formats: text, markdown, json.\n`,
    );
    return ExitCode.INVALID_CONFIG_OR_USAGE;
  }

  // Validate severity option if provided
  const allowedSeverities = ['critical', 'high', 'medium', 'low', 'info', 'none'];
  if (opts.severity && !allowedSeverities.includes(opts.severity.toLowerCase())) {
    process.stderr.write(
      `Error: Invalid severity threshold "${opts.severity}". Supported levels: ${allowedSeverities.join(', ')}.\n`,
    );
    return ExitCode.INVALID_CONFIG_OR_USAGE;
  }

  // Load configuration
  let configLoadResult;
  try {
    configLoadResult = loadConfig(targetDir, opts.config);
  } catch (err) {
    process.stderr.write(
      `Configuration Error: ${err instanceof Error ? err.message : String(err)}\n`,
    );
    return ExitCode.INVALID_CONFIG_OR_USAGE;
  }

  const config = configLoadResult.config;

  // Determine effective severity threshold (CLI argument takes precedence over config)
  const threshold: FailureThreshold =
    (opts.severity?.toLowerCase() as FailureThreshold | undefined) ??
    config.severityThreshold ??
    'high';

  // Run audit engine
  let report;
  try {
    report = await runAudit(targetDir, { config });
  } catch (err) {
    process.stderr.write(
      `Operational Error: ${err instanceof Error ? err.message : String(err)}\n`,
    );
    return ExitCode.OPERATIONAL_ERROR;
  }

  // Generate output in the requested format
  let outputContent = '';
  switch (format) {
    case 'text':
      outputContent = formatTerminalReport(report, opts.verbose ?? false);
      break;
    case 'markdown':
      outputContent = formatMarkdownReport(report);
      break;
    case 'json':
      outputContent = formatJsonReport(report);
      break;
  }

  // Write to output file if requested
  if (opts.output) {
    try {
      writeReportToFile({
        outputPath: opts.output,
        content: outputContent,
        force: opts.force ?? false,
      });
      process.stdout.write(`Audit report written to: ${opts.output}\n`);
    } catch (err) {
      process.stderr.write(
        `Error writing report: ${err instanceof Error ? err.message : String(err)}\n`,
      );
      return ExitCode.OPERATIONAL_ERROR;
    }
  } else {
    process.stdout.write(`${outputContent}\n`);
  }

  // Determine exit code
  return determineExitCode(report.findings, threshold);
}

// When invoked directly from the CLI
if (
  process.env.NODE_ENV !== 'test' &&
  (import.meta.url === `file://${process.argv[1]}` ||
    process.argv[1]?.endsWith('cli.js') ||
    process.argv[1]?.endsWith('ai-app-production-auditor'))
) {
  runCli().then((code) => {
    process.exit(code);
  });
}
