import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_ROUTES = ['/login', '/api/auth/login', '/api/auth/logout'];
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

/**
 * Edge-compatible session cookie parser (no Node crypto needed).
 * Decodes base64 / base64url payload and extracts role & access.
 */
function parseSessionCookie(token: string): { role: string; access: string[]; name?: string } | null {
  try {
    const [data] = token.split('.');
    if (!data) return null;
    const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, '=');
    const json = atob(padded);
    const payload = JSON.parse(json);
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

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Static assets & internal Next.js requests bypass
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/api/health')
  ) {
    return NextResponse.next();
  }

  // Handle Odoo /web legacy route
  if (pathname === '/web' || pathname.startsWith('/web/')) {
    const token = request.cookies.get('rr_session')?.value;
    const session = token ? parseSessionCookie(token) : null;
    if (!session) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Read session cookie
  const token = request.cookies.get('rr_session')?.value;
  const session = token ? parseSessionCookie(token) : null;

  // Already logged in trying to access /login -> redirect to home
  if (pathname === '/login') {
    if (session) {
      return NextResponse.redirect(new URL('/', request.url));
    }
    return NextResponse.next();
  }

  // Public auth API routes bypass
  if (pathname.startsWith('/api/auth/login') || pathname.startsWith('/api/auth/logout')) {
    return NextResponse.next();
  }

  // Not logged in -> STRICT REDIRECT TO /login
  if (!session) {
    const loginUrl = new URL('/login', request.url);
    if (pathname !== '/') {
      loginUrl.searchParams.set('from', pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  // Admin routes: SUPERADMIN & OWNER only
  if (ADMIN_ROUTES.some((r) => pathname.startsWith(r))) {
    if (session.role !== 'SUPERADMIN' && session.role !== 'OWNER') {
      return NextResponse.redirect(new URL('/', request.url));
    }
    return NextResponse.next();
  }

  // Module access control for non-SUPERADMIN / non-OWNER
  if (session.role !== 'SUPERADMIN' && session.role !== 'OWNER') {
    for (const [route, moduleId] of Object.entries(MODULE_ROUTES)) {
      if (pathname.startsWith(route)) {
        if (!session.access.includes(moduleId)) {
          return NextResponse.redirect(new URL('/', request.url));
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
