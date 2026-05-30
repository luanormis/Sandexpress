export const DEFAULT_ADMIN_USERNAME = 'luanormis';
export const DEFAULT_ADMIN_PASSWORD = '95732';

export function getAdminUsername() {
  return process.env.ADMIN_USERNAME || DEFAULT_ADMIN_USERNAME;
}

export function getAdminPassword() {
  return process.env.ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD;
}

export function verifyAdminCredentials(username?: string | null, password?: string | null) {
  return username === getAdminUsername() && password === getAdminPassword();
}
