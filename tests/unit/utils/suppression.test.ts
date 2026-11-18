import { describe, it, expect } from 'vitest';
import { parseSuppressions } from '../../../src/utils/suppression.js';

describe('parseSuppressions', () => {
  it('suppresses next line for specific rule using //', () => {
    const code = [
      'const a = 1;',
      '// auditor-disable-next-line URL001',
      'const url = "http://localhost:3000";',
      'const b = 2;',
    ].join('\n');

    const map = parseSuppressions(code);

    expect(map.isSuppressed(3, 'URL001')).toBe(true);
    expect(map.isSuppressed(3, 'SEC001')).toBe(false);
    expect(map.isSuppressed(4, 'URL001')).toBe(false);
  });

  it('suppresses next line for multiple rules with explanation comment', () => {
    const code = [
      '// auditor-disable-next-line URL001, SEC001 -- safe local test url',
      'const api = "http://localhost:8080";',
    ].join('\n');

    const map = parseSuppressions(code);

    expect(map.isSuppressed(2, 'URL001')).toBe(true);
    expect(map.isSuppressed(2, 'SEC001')).toBe(true);
    expect(map.isSuppressed(2, 'CFG001')).toBe(false);
  });

  it('suppresses all rules on next line when no rule is specified', () => {
    const code = ['// auditor-disable-next-line', 'const anything = "http://localhost:3000";'].join(
      '\n',
    );

    const map = parseSuppressions(code);

    expect(map.isSuppressed(2, 'URL001')).toBe(true);
    expect(map.isSuppressed(2, 'ANY_RULE')).toBe(true);
  });

  it('supports block disable and enable ranges', () => {
    const code = [
      '/* auditor-disable URL001 */',
      'const a = "http://localhost:3000";',
      'const b = "http://localhost:3001";',
      '/* auditor-enable URL001 */',
      'const c = "http://localhost:3002";',
    ].join('\n');

    const map = parseSuppressions(code);

    expect(map.isSuppressed(2, 'URL001')).toBe(true);
    expect(map.isSuppressed(3, 'URL001')).toBe(true);
    expect(map.isSuppressed(5, 'URL001')).toBe(false);
  });

  it('supports hash comment style for shell, Dockerfile and YAML files', () => {
    const code = ['# auditor-disable-next-line CFG005', 'USER root'].join('\n');

    const map = parseSuppressions(code);

    expect(map.isSuppressed(2, 'CFG005')).toBe(true);
  });
});
