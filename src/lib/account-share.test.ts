import { accountShare, registeredPeople } from './account-share';

describe('shared bill', () => {
  it('keeps the original share after each payment', () => {
    expect(accountShare(120, 120, 4)).toBe(30);
    expect(accountShare(120, 90, 4)).toBe(30);
    expect(accountShare(120, 60, 4)).toBe(30);
    expect(accountShare(120, 30, 4)).toBe(30);
    expect(accountShare(120, 0, 4)).toBe(0);
  });
  it('settles cent remainders without overcharging', () => {
    let remaining = 100;
    const payments = Array.from({ length: 3 }, () => {
      const share = accountShare(100, remaining, 3);
      remaining = Math.round((remaining - share) * 100) / 100;
      return share;
    });
    expect(payments).toEqual([33.34, 33.34, 33.32]);
    expect(remaining).toBe(0);
  });
  it('caps a share when someone already paid a custom amount', () => {
    expect(accountShare(100, 12.5, 3)).toBe(12.5);
  });
  it('validates registered headcount', () => {
    expect(registeredPeople(5)).toBe(5);
    for (const value of [0, -1, 1.5, 51, null, undefined, 'invalid']) expect(registeredPeople(value)).toBe(1);
    expect(accountShare(NaN, 10, 2)).toBe(0);
  });
});
