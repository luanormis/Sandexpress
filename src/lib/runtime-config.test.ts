import {
  getRequiredEnvValue,
  rejectUnsafeSecret,
} from './runtime-config';

describe('runtime config', () => {
  it('rejects missing values instead of returning fake fallbacks', () => {
    expect(() => getRequiredEnvValue('ADMIN_PASSWORD', {})).toThrow('ADMIN_PASSWORD');
  });

  it('rejects known local fallback secrets', () => {
    expect(() => rejectUnsafeSecret('ADMIN_PASSWORD', '95732', { minLength: 8 })).toThrow('ADMIN_PASSWORD');
    expect(() => rejectUnsafeSecret('SESSION_SECRET', 'sandexpress-mvp-session-secret-change-this-in-vercel', { minLength: 32 })).toThrow('SESSION_SECRET');
  });

  it('accepts real configured secrets that meet the minimum length', () => {
    expect(rejectUnsafeSecret('ADMIN_PASSWORD', 'senha-admin-real-2026', { minLength: 8 })).toBe('senha-admin-real-2026');
  });
});
