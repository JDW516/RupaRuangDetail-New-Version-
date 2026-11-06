import { createHash } from 'crypto';

/**
 * Hash a plain-text password using SHA-256 + salt.
 * NOTE: In production use bcrypt/argon2 instead.
 */
export function hashPassword(plain: string): string {
  const salt = 'ruparuang-salt-2024';
  return createHash('sha256').update(salt + plain).digest('hex');
}

export function verifyPassword(plain: string, hash: string): boolean {
  return hashPassword(plain) === hash;
}

/**
 * Kebijakan password: min. 8 karakter, ada huruf besar, huruf kecil,
 * angka, dan simbol. Return pesan error, atau null jika valid.
 */
export function validatePasswordPolicy(pw: string): string | null {
  if (!pw || pw.length < 8) return 'Password minimal 8 karakter.';
  if (!/[A-Z]/.test(pw)) return 'Password harus mengandung minimal 1 huruf besar (A-Z).';
  if (!/[a-z]/.test(pw)) return 'Password harus mengandung minimal 1 huruf kecil (a-z).';
  if (!/[0-9]/.test(pw)) return 'Password harus mengandung minimal 1 angka (0-9).';
  if (!/[^A-Za-z0-9]/.test(pw)) return 'Password harus mengandung minimal 1 simbol (contoh: ! @ # $ %).';
  return null;
}
