import { Command } from 'commander';

export interface CliOptions {
  targetDir: string;
  format: 'text' | 'markdown' | 'json';
  output?: string;
  force?: boolean;
  severity?: 'critical' | 'high' | 'medium' | 'low' | 'info' | 'none';
  config?: string;
  verbose?: boolean;
  color: boolean;
}

export function createCliCommand(): Command {
  const program = new Command();

  program
    .name('ai-app-production-auditor')
    .description(
      'Static production-readiness auditor for web applications built with AI coding assistants.',
    )
    .version('0.1.0', '-V, --version', 'Output the version number')
    .argument('[target-dir]', 'Path to the project directory to audit', '.')
    .option('-f, --format <format>', 'Output format: "text", "markdown", or "json"', 'text')
    .option('-o, --output <file>', 'Path to write report output')
    .option('-w, --force', 'Overwrite output file if it already exists', false)
    .option(
      '-s, --severity <level>',
      'Minimum finding severity to cause a failure exit code (critical, high, medium, low, info, none)',
    )
    .option('-c, --config <file>', 'Path to custom auditor configuration file')
    .option('-v, --verbose', 'Output detailed diagnostic and check information', false)
    .option('--no-color', 'Disable colored terminal output');

  return program;
}
