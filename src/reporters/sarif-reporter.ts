import type { AuditReport } from '../models/report.js';
import type { Severity } from '../models/finding.js';

function severityToSarifLevel(severity: Severity): 'error' | 'warning' | 'note' {
  switch (severity) {
    case 'critical':
    case 'high':
      return 'error';
    case 'medium':
      return 'warning';
    case 'low':
    case 'info':
    default:
      return 'note';
  }
}

export function formatSarifReport(report: AuditReport): string {
  // Collect unique rules from report findings and completed checks
  const ruleMap = new Map<
    string,
    {
      id: string;
      name: string;
      shortDescription: { text: string };
      helpUri?: string;
      defaultConfiguration: { level: 'error' | 'warning' | 'note' };
    }
  >();

  for (const check of report.checks) {
    ruleMap.set(check.id, {
      id: check.id,
      name: check.name,
      shortDescription: { text: check.description },
      defaultConfiguration: { level: 'warning' },
    });
  }

  for (const f of report.findings) {
    if (!ruleMap.has(f.ruleId)) {
      ruleMap.set(f.ruleId, {
        id: f.ruleId,
        name: f.title,
        shortDescription: { text: f.message },
        helpUri: f.documentationUrl ?? undefined,
        defaultConfiguration: { level: severityToSarifLevel(f.severity) },
      });
    }
  }

  const sarifRules = Array.from(ruleMap.values());

  const sarifResults = report.findings.map((f) => {
    const level = severityToSarifLevel(f.severity);
    const locationUri = f.file || 'project-root';

    return {
      ruleId: f.ruleId,
      level,
      message: {
        text: `${f.title}: ${f.message}`,
      },
      locations: [
        {
          physicalLocation: {
            artifactLocation: {
              uri: locationUri,
              uriBaseId: '%SRCROOT%',
            },
            region: {
              startLine: f.line && f.line > 0 ? f.line : 1,
              startColumn: f.column && f.column > 0 ? f.column : 1,
            },
          },
        },
      ],
    };
  });

  const sarifLog = {
    $schema:
      'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
    version: '2.1.0',
    runs: [
      {
        tool: {
          driver: {
            name: report.tool.name,
            version: report.tool.version,
            informationUri: report.tool.homepage,
            rules: sarifRules,
          },
        },
        results: sarifResults,
      },
    ],
  };

  return JSON.stringify(sarifLog, null, 2);
}
