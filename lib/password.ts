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

