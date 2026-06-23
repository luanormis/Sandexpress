import { hashPassword, verifyVendorPassword } from './vendor-password';

describe('verifyVendorPassword', () => {
  it('validates the real kiosk password hash used at registration', async () => {
    const hash = await hashPassword('SenhaForte123!');

    await expect(verifyVendorPassword('SenhaForte123!', hash)).resolves.toBe(true);
    await expect(verifyVendorPassword('senha-errada', hash)).resolves.toBe(false);
  });

  it('rejects empty or malformed hashes', async () => {
    await expect(verifyVendorPassword('SenhaForte123!', '')).resolves.toBe(false);
    await expect(verifyVendorPassword('SenhaForte123!', 'hash-invalido')).resolves.toBe(false);
  });
});
