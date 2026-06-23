import { buildPasswordResetEmail, buildVendorVerificationEmail } from './email-templates';

describe('email templates brand logo', () => {
  const previousPublicUrl = process.env.NEXT_PUBLIC_APP_URL;

  afterEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = previousPublicUrl;
  });

  it('uses the public SandExpress PNG logo with the configured domain', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.sandexpress.com.br/';

    const email = buildVendorVerificationEmail({
      vendorName: 'Quiosque Teste',
      ownerName: 'Maria',
      login: '11999999999',
      verificationUrl: 'https://app.sandexpress.com.br/api/vendors/verify-email?token=abc',
    });

    expect(email.html).toContain('https://app.sandexpress.com.br/logo-sandexpress.png');
    expect(email.html).toContain('alt="SandExpress"');
    expect(email.html).toContain('width="128" height="72"');
  });

  it('uses the same brand logo in password recovery emails', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.sandexpress.com.br';

    const email = buildPasswordResetEmail({
      vendorName: 'Quiosque Teste',
      resetUrl: 'https://app.sandexpress.com.br/vendor/reset-password?token=abc',
      expiresIn: '1 hora',
    });

    expect(email.html).toContain('https://app.sandexpress.com.br/logo-sandexpress.png');
  });
});
