import { describe, it, expect } from 'vitest';
import { determineExitCode, ExitCode } from '../../../src/cli/exit-codes.js';
import { createFinding, type Finding } from '../../../src/models/finding.js';

describe('Exit Code Determination', () => {
  const infoFinding: Finding = createFinding({
    ruleId: 'TST001',
    title: 'Info Finding',
    severity: 'info',
    category: 'testing',
    message: 'Test message',
    evidence: 'evidence',
    remediation: 'fix',
  });

  const lowFinding: Finding = createFinding({
    ruleId: 'TST002',
    title: 'Low Finding',
    severity: 'low',
    category: 'testing',
    message: 'Test message',
    evidence: 'evidence',
    remediation: 'fix',
  });

  const mediumFinding: Finding = createFinding({
    ruleId: 'URL001',
    title: 'Medium Finding',
    severity: 'medium',
    category: 'configuration',
    message: 'Test message',
    evidence: 'evidence',
    remediation: 'fix',
  });

  const highFinding: Finding = createFinding({
    ruleId: 'BLD001',
    title: 'High Finding',
    severity: 'high',
    category: 'quality',
    message: 'Test message',
    evidence: 'evidence',
    remediation: 'fix',
  });

  const criticalFinding: Finding = createFinding({
    ruleId: 'SEC001',
    title: 'Critical Finding',
    severity: 'critical',
    category: 'security',
    message: 'Test message',
    evidence: 'evidence',
    remediation: 'fix',
  });

  it('returns OK (0) when findings list is empty', () => {
    expect(determineExitCode([], 'high')).toBe(ExitCode.OK);
    expect(determineExitCode([], 'low')).toBe(ExitCode.OK);
  });

  it('returns OK (0) when findings are below the default "high" threshold', () => {
    expect(determineExitCode([infoFinding, lowFinding, mediumFinding], 'high')).toBe(ExitCode.OK);
  });

  it('returns FAILURE (1) when findings meet the "high" threshold', () => {
    expect(determineExitCode([mediumFinding, highFinding], 'high')).toBe(ExitCode.FAILURE);
    expect(determineExitCode([criticalFinding], 'high')).toBe(ExitCode.FAILURE);
  });

  it('respects custom "medium" threshold', () => {
    expect(determineExitCode([lowFinding], 'medium')).toBe(ExitCode.OK);
    expect(determineExitCode([mediumFinding], 'medium')).toBe(ExitCode.FAILURE);
  });

  it('respects custom "critical" threshold', () => {
    expect(determineExitCode([highFinding], 'critical')).toBe(ExitCode.OK);
    expect(determineExitCode([criticalFinding], 'critical')).toBe(ExitCode.FAILURE);
  });

  it('returns OK (0) when threshold is set to "none"', () => {
    expect(determineExitCode([criticalFinding, highFinding], 'none')).toBe(ExitCode.OK);
  });
});
