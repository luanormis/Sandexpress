import crypto from 'crypto';

export const OTP_PURPOSES = [
  'customer_login',
  'vendor_register',
  'vendor_login',
  'password_reset',
] as const;

export type OtpPurpose = typeof OTP_PURPOSES[number];

export function isOtpPurpose(value: unknown): value is OtpPurpose {
  return (OTP_PURPOSES as readonly string[]).includes(String(value || ''));
}

export function normalizeBrazilPhoneE164(input: string) {
  const digits = String(input || '').replace(/\D/g, '');
  const withCountry = digits.startsWith('55') ? digits : `55${digits}`;
  if (!/^55\d{10,11}$/.test(withCountry)) {
    throw new Error('Telefone inválido para envio de OTP.');
  }
  return `+${withCountry}`;
}

export function generateOtpCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

export function getStaticOtpCode() {
  const configured = process.env.OTP_STATIC_CODE?.trim();
  return /^\d{6}$/.test(configured || '') ? configured! : '102121';
}

export function hashOtpCode(code: string, pepper: string) {
  if (!pepper || pepper.length < 32) {
    throw new Error('OTP_PEPPER deve ter pelo menos 32 caracteres.');
  }
  return crypto.createHmac('sha256', pepper).update(code).digest('hex');
}

export function verifyOtpHash(code: string, expectedHash: string, pepper: string) {
  const actual = Buffer.from(hashOtpCode(code, pepper), 'hex');
  const expected = Buffer.from(String(expectedHash || ''), 'hex');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

export function buildOtpExpiry(ttlSeconds: number, now = new Date()) {
  const ttl = Number.isFinite(ttlSeconds) && ttlSeconds > 0 ? ttlSeconds : 300;
  return new Date(now.getTime() + ttl * 1000);
}

export function getOtpPepper() {
  const value = process.env.OTP_PEPPER?.trim();
  if (!value || value.length < 32) {
    throw new Error('OTP_PEPPER deve ter pelo menos 32 caracteres.');
  }
  return value;
}
