import crypto from 'crypto';

export async function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = (await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (err, key) => {
      if (err) reject(err);
      else resolve(key);
    });
  })) as Buffer;
  return `${salt}:${derivedKey.toString('hex')}`;
}

export async function verifyVendorPassword(password: string, storedHash: string) {
  const [salt, key] = String(storedHash || '').split(':');
  if (!salt || !key) return false;

  let storedBuffer: Buffer;
  try {
    storedBuffer = Buffer.from(key, 'hex');
  } catch {
    return false;
  }

  const derivedKey = (await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (err, derived) => {
      if (err) reject(err);
      else resolve(derived);
    });
  })) as Buffer;

  return storedBuffer.length === derivedKey.length && crypto.timingSafeEqual(storedBuffer, derivedKey);
}
