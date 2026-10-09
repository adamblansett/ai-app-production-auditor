import { describe, it, expect } from 'vitest';
import { redactSecret, redactEvidence, maskSensitiveValue } from '../../../src/utils/redaction.js';

describe('Secret Redaction Utilities', () => {
  it('handles empty or short strings', () => {
    expect(redactSecret('')).toBe('');
    expect(redactSecret('abc')).toBe('******');
    expect(redactSecret('123456')).toBe('******');
  });

  it('masks medium strings (7-12 characters) with boundary preservation', () => {
    const masked = redactSecret('12345678');
    expect(masked).toBe('12****78');
    expect(masked).not.toContain('3456');
  });

  it('redacts long tokens with prefix and suffix while obscuring the body', () => {
    const awsKey = 'AKIAIOSFODNN7EXAMPLE';
    const masked = redactSecret(awsKey);
    expect(masked).toBe('AKIA****...****PLE');
    expect(masked).not.toContain('IOSFODNN7EXAM');

    const ghToken = 'ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ123456';
    const maskedGh = redactSecret(ghToken);
    expect(maskedGh).toBe('ghp_****...****456');
    expect(maskedGh).not.toContain('BCDEFGHIJKLMNOPQRSTUVWXY');
  });

  it('redacts multiple secrets within an evidence snippet without leaving plaintext', () => {
    const secret1 = 'AKIAIOSFODNN7EXAMPLE';
    const secret2 = 'ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ123456';
    const snippet = `const aws = "${secret1}"; const gh = "${secret2}";`;

    const redacted = redactEvidence(snippet, [secret1, secret2]);
    expect(redacted).not.toContain(secret1);
    expect(redacted).not.toContain(secret2);
    expect(redacted).toContain('AKIA****...****PLE');
    expect(redacted).toContain('ghp_****...****456');
  });

  it('masks sensitive values based on key names', () => {
    expect(maskSensitiveValue('api_key', 'my-super-secret-key-12345')).toContain('****');
    expect(maskSensitiveValue('nonSensitiveName', 'public-value')).toBe('public-value');
  });
});
