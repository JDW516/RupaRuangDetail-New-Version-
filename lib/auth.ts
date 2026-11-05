import { getSession, type SessionPayload } from './session';
import { prisma } from './prisma';

export type { SessionPayload };

/** Returns the current session payload or null */
export async function getActiveSession(): Promise<SessionPayload | null> {
  return getSession();
}

/** Returns the active user from DB or null */
export async function getActiveUser() {
  const session = await getSession();
  if (!session) return null;
  return prisma.appUser.findUnique({ where: { id: session.userId, active: true } });
}

/** Throws a redirect-like error if no active session, otherwise returns session */
export async function assertSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) throw new Error('UNAUTHENTICATED');
  return session;
}

/** Throws if not SUPERADMIN or OWNER */
export async function requireAdminOrOwner(): Promise<SessionPayload> {
  const session = await assertSession();
  if (session.role !== 'SUPERADMIN' && session.role !== 'OWNER') {
    throw new Error('FORBIDDEN');
  }
  return session;
}

/** Throws if not SUPERADMIN */
export async function requireSuperAdmin(): Promise<SessionPayload> {
  const session = await assertSession();
  if (session.role !== 'SUPERADMIN') throw new Error('FORBIDDEN');
  return session;
}

/** Module access check: SUPERADMIN/OWNER bypass, others check access list */
export function canAccess(session: SessionPayload, moduleId: string): boolean {
  if (session.role === 'SUPERADMIN' || session.role === 'OWNER') return true;
  return session.access.includes(moduleId);
}

/** Default module access per role */
export const ROLE_DEFAULT_ACCESS: Record<string, string[]> = {
  SUPERADMIN: ['dashboard', 'contacts', 'crm', 'inventory', 'sales', 'purchase', 'pos', 'invoicing', 'accounting'],
  OWNER: ['dashboard', 'contacts', 'crm', 'inventory', 'sales', 'purchase', 'pos', 'invoicing', 'accounting'],
  SALES: ['contacts', 'crm', 'sales', 'inventory'],
  WAREHOUSE: ['inventory', 'purchase'],
  FINANCE: ['invoicing', 'accounting'],
  PURCHASING: ['purchase', 'contacts'],
  CASHIER: ['pos'],
  STAFF: [],
};

