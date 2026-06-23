import {
  buildReadinessReport,
  getBlockingReadinessIssues,
} from './readiness';

describe('readiness report', () => {
  it('marks core runtime variables as blocking when missing', () => {
    const report = buildReadinessReport({});

    expect(report.status).toBe('blocked');
    expect(getBlockingReadinessIssues(report)).toEqual(
      expect.arrayContaining([
        'NEXT_PUBLIC_SUPABASE_URL',
        'NEXT_PUBLIC_SUPABASE_ANON_KEY',
        'SUPABASE_SERVICE_ROLE_KEY',
        'SESSION_SECRET',
        'ADMIN_PASSWORD',
        'NEXT_PUBLIC_APP_URL',
      ])
    );
  });

  it('keeps external integrations separate from core readiness', () => {
    const report = buildReadinessReport({
      NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'x'.repeat(40),
      SUPABASE_SERVICE_ROLE_KEY: 'y'.repeat(40),
      SESSION_SECRET: 'z'.repeat(40),
      ADMIN_PASSWORD: 'senha-admin-real',
      NEXT_PUBLIC_APP_URL: 'https://sandexpress.com.br',
    });

    expect(report.status).toBe('degraded');
    expect(report.required.every((item) => item.status === 'ok')).toBe(true);
    expect(report.external.filter((item) => item.status === 'missing').map((item) => item.name)).toEqual(
      expect.arrayContaining(['META_WHATSAPP_PHONE_NUMBER_ID', 'META_WHATSAPP_ACCESS_TOKEN', 'OTP_PEPPER'])
    );
  });

  it('does not expose configured secret values', () => {
    const report = buildReadinessReport({
      NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-secret-value-that-must-not-leak',
      SUPABASE_SERVICE_ROLE_KEY: 'service-secret-value-that-must-not-leak',
      SESSION_SECRET: 'session-secret-value-that-must-not-leak',
      ADMIN_PASSWORD: 'admin-secret-value',
      NEXT_PUBLIC_APP_URL: 'https://sandexpress.com.br',
      META_WHATSAPP_PHONE_NUMBER_ID: '123456',
      META_WHATSAPP_ACCESS_TOKEN: 'meta-token-that-must-not-leak',
      OTP_PEPPER: 'pepper-secret-value-that-must-not-leak',
    });

    expect(JSON.stringify(report)).not.toContain('must-not-leak');
    expect(JSON.stringify(report)).not.toContain('admin-secret-value');
  });
});
