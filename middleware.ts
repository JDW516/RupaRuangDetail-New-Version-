import { NextRequest, NextResponse } from 'next/server';

const ADMIN_ROUTES = ['/admin'];

/** Module-to-route mapping for access control */
const MODULE_ROUTES: Record<string, string> = {
  '/dashboard': 'dashboard',
  '/contacts': 'contacts',
  '/crm': 'crm',
  '/inventory': 'inventory',
  '/sales': 'sales',
  '/purchase': 'purchase',
  '/pos': 'pos',
  '/invoicing': 'invoicing',
  '/accounting': 'accounting',
};

const SECRET = process.env.AUTH_SECRET ?? 'ruparuang-erp-secret-key-2024-jwt';

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Edge-compatible session verifier: cek tanda tangan HMAC-SHA256 (Web Crypto)
 * sebelum payload dipercaya, sehingga cookie palsu tidak bisa lolos.
 */
async function parseSessionCookie(
  token: string
): Promise<{ role: string; access: string[]; name?: string } | null> {
  try {
    const [data, sig] = token.split('.');
    if (!data || !sig) return null;

    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const expected = toHex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data)));
    if (expected !== sig) return null;

    const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const payload = JSON.parse(atob(padded));
    if (!payload || !payload.role) return null;
    return {
      role: payload.role,
      access: Array.isArray(payload.access) ? payload.access : [],
      name: payload.name,
    };
  } catch {
    return null;
  }
}

function denied(request: NextRequest, moduleId: string) {
  const url = new URL('/', request.url);
  url.searchParams.set('denied', moduleId);
  return NextResponse.redirect(url);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Static assets & internal Next.js requests bypass
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/api/health')
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get('rr_session')?.value;
  const session = token ? await parseSessionCookie(token) : null;

  // Handle Odoo /web legacy route
  if (pathname === '/web' || pathname.startsWith('/web/')) {
    if (!session) return NextResponse.redirect(new URL('/login', request.url));
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Already logged in trying to access /login -> redirect to home
  if (pathname === '/login') {
    if (session) return NextResponse.redirect(new URL('/', request.url));
    return NextResponse.next();
  }

  // Public auth API routes bypass
  if (pathname.startsWith('/api/auth/login') || pathname.startsWith('/api/auth/logout')) {
    return NextResponse.next();
  }

  // Not logged in -> STRICT REDIRECT TO /login
  if (!session) {
    const loginUrl = new URL('/login', request.url);
    if (pathname !== '/') loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Admin routes: SUPERADMIN & OWNER only
  if (ADMIN_ROUTES.some((r) => pathname.startsWith(r))) {
    if (session.role !== 'SUPERADMIN' && session.role !== 'OWNER') {
      return denied(request, 'admin');
    }
    return NextResponse.next();
  }

  // Module access control for non-SUPERADMIN / non-OWNER
  if (session.role !== 'SUPERADMIN' && session.role !== 'OWNER') {
    for (const [route, moduleId] of Object.entries(MODULE_ROUTES)) {
      if (pathname === route || pathname.startsWith(route + '/')) {
        if (!session.access.includes(moduleId)) {
          return denied(request, moduleId);
        }
        break;
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
