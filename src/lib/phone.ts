export function cleanPhoneDigits(input: unknown) {
  return String(input || '').replace(/\D/g, '');
}

export function stripBrazilCountryCode(input: unknown) {
  const digits = cleanPhoneDigits(input);
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) {
    return digits.slice(2);
  }
  return digits;
}

export function isValidBrazilPhoneWithDdd(input: unknown) {
  const digits = stripBrazilCountryCode(input);
  if (!/^\d{10,11}$/.test(digits)) return false;

  const ddd = Number(digits.slice(0, 2));
  const subscriber = digits.slice(2);
  if (ddd < 11 || ddd > 99) return false;
  if (/^(\d)\1+$/.test(digits)) return false;
  if (/^(\d)\1+$/.test(subscriber)) return false;

  return subscriber.length === 8 || (subscriber.length === 9 && subscriber.startsWith('9'));
}

export function normalizeBrazilPhoneWithDdd(input: unknown) {
  const digits = stripBrazilCountryCode(input);
  if (!isValidBrazilPhoneWithDdd(digits)) {
    throw new Error('Informe um telefone valido com DDD. Exemplo: 1196041957.');
  }
  return digits;
}
