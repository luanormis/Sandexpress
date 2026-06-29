import { customerNeedsOtpForLogin } from './customer-auth';

describe('customer login otp policy', () => {
  it('requires OTP when the customer does not exist yet', () => {
    expect(customerNeedsOtpForLogin(null)).toBe(true);
  });

  it('does not require OTP when the phone is already saved for future login', () => {
    expect(customerNeedsOtpForLogin({ id: 'customer-1' })).toBe(false);
  });
});
