import {
  buildOtpExpiry,
  generateOtpCode,
  hashOtpCode,
  normalizeBrazilPhoneE164,
  verifyOtpHash,
} from './otp';

describe('otp helpers', () => {
  it('normalizes Brazilian phones to E.164', () => {
    expect(normalizeBrazilPhoneE164('(11) 99999-9999')).toBe('+5511999999999');
    expect(normalizeBrazilPhoneE164('5511999999999')).toBe('+5511999999999');
  });

  it('rejects invalid phone numbers', () => {
    expect(() => normalizeBrazilPhoneE164('123')).toThrow('Telefone inválido para envio de OTP.');
  });

  it('generates a six digit numeric code', () => {
    expect(generateOtpCode()).toMatch(/^[0-9]{6}$/);
  });

  it('hashes and verifies without storing the raw code', () => {
    const hash = hashOtpCode('123456', 'pepper-real-com-tamanho-seguro-2026');
    expect(hash).not.toContain('123456');
    expect(verifyOtpHash('123456', hash, 'pepper-real-com-tamanho-seguro-2026')).toBe(true);
    expect(verifyOtpHash('000000', hash, 'pepper-real-com-tamanho-seguro-2026')).toBe(false);
  });

  it('builds expiry from ttl seconds', () => {
    const now = new Date('2026-06-17T12:00:00.000Z');
    expect(buildOtpExpiry(300, now).toISOString()).toBe('2026-06-17T12:05:00.000Z');
  });
});
