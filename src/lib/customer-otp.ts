/**
 * OTP em memória (instância única do servidor).
 * Em produção com múltiplas réplicas, use Redis ou tabela no Supabase.
 */
type OtpEntry = { code: string; expiresAt: number };

const store = new Map<string, OtpEntry>();

function key(phone: string, vendorId: string) {
  return `${vendorId}:${phone.replace(/\D/g, '')}`;
}

export function setCustomerOtp(phone: string, vendorId: string, code: string, ttlMs: number) {
  store.set(key(phone, vendorId), { code, expiresAt: Date.now() + ttlMs });
}

export function verifyCustomerOtp(phone: string, vendorId: string, code: string): boolean {
  const k = key(phone, vendorId);
  const entry = store.get(k);
  if (!entry || entry.expiresAt < Date.now()) {
    store.delete(k);
    return false;
  }
  const ok = entry.code === code.replace(/\D/g, '');
  if (ok) store.delete(k);
  return ok;
}

export function getOtpMode(): 'dev' | 'required' {
  const m = process.env.CUSTOMER_OTP_MODE;
  if (m === 'dev') return 'dev';
  if (m === 'required') return 'required';
  return process.env.NODE_ENV === 'production' ? 'required' : 'dev';
}
