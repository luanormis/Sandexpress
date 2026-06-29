import { cleanPhoneDigits, isValidBrazilPhoneWithDdd, normalizeBrazilPhoneWithDdd } from './phone';

describe('phone helpers', () => {
  it('accepts Brazilian phones with DDD in the requested format', () => {
    expect(isValidBrazilPhoneWithDdd('1196041957')).toBe(true);
    expect(isValidBrazilPhoneWithDdd('(11) 99604-1957')).toBe(true);
    expect(normalizeBrazilPhoneWithDdd('(11) 9604-1957')).toBe('1196041957');
  });

  it('rejects phones without DDD or fake repeated digits', () => {
    expect(cleanPhoneDigits('(11) 9604-1957')).toBe('1196041957');
    expect(isValidBrazilPhoneWithDdd('96041957')).toBe(false);
    expect(isValidBrazilPhoneWithDdd('1100000000')).toBe(false);
    expect(isValidBrazilPhoneWithDdd('11111111111')).toBe(false);
  });
});
