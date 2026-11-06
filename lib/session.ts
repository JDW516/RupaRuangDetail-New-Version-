import { createHmac, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';

const SECRET = process.env.AUTH_SECRET ?? 'ruparuang-erp-secret-key-2024-jwt';
const COOKIE_NAME = 'rr_session';
const SESSION_MAX_AGE = 60 * 60 * 8; // 8 hours

export interface SessionPayload {
  userId: string;
  email: string;
  name: string;
  role: string;
  access: string[]; // array of module IDs
}

/** Sign a payload into a token: base64url(payload).HMAC-SHA256(hex) */
function sign(payload: SessionPayload): string {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createHmac('sha256', SECRET).update(data).digest('hex');
  return `${data}.${sig}`;
}

/** Verify & decode a token, returns null if invalid/tampered */
export function unsign(token: string): SessionPayload | null {
  try {
    const [data, sig] = token.split('.');
    if (!data || !sig) return null;
    const expected = createHmac('sha256', SECRET).update(data).digest('hex');
    const a = Buffer.from(expected);
    const b = Buffer.from(sig);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    return JSON.parse(Buffer.from(data, 'base64url').toString('utf8')) as SessionPayload;
  } catch {
    return null;
  }
}

/** Create a session cookie from a payload */
export async function createSession(payload: SessionPayload): Promise<void> {
  const token = sign(payload);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE,
    path: '/',
  });
}

/** Read & verify the current session cookie */
export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return unsign(token);
}

/** Delete the session cookie */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
