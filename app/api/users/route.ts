import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword, validatePasswordPolicy } from '@/lib/password';
import { getSession } from '@/lib/session';

function requireAdminOrOwner(session: Awaited<ReturnType<typeof getSession>>) {
  if (!session || (session.role !== 'SUPERADMIN' && session.role !== 'OWNER')) {
    return NextResponse.json(
      { error: 'Akses ditolak. Hanya SUPERADMIN atau OWNER yang dapat mengakses modul ini.' },
      { status: 403 }
    );
  }
  return null;
}

/** GET /api/users - list all users */
export async function GET(_request: NextRequest) {
  const session = await getSession();
  const denied = requireAdminOrOwner(session);
  if (denied) return denied;

  const users = await prisma.appUser.findMany({
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      email: true,
      username: true,
      name: true,
      role: true,
      access: true,
      active: true,
      createdAt: true,
    },
  });
  return NextResponse.json(users);
}

/** POST /api/users - create new user */
export async function POST(request: NextRequest) {
  const session = await getSession();
  const denied = requireAdminOrOwner(session);
  if (denied) return denied;

  const body = await request.json();
  const { email, username, password, name, role, access } = body as {
    email?: string;
    username?: string;
    password?: string;
    name?: string;
    role?: string;
    access?: string[];
  };

  if (!email || !username || !password || !name || !role) {
    return NextResponse.json({ error: 'Semua field wajib diisi.' }, { status: 400 });
  }
  const pwError = validatePasswordPolicy(password);
  if (pwError) {
    return NextResponse.json({ error: pwError }, { status: 400 });
  }

  const existing = await prisma.appUser.findFirst({
    where: {
      OR: [
        { email: { equals: email.toLowerCase(), mode: 'insensitive' } },
        { username: { equals: username, mode: 'insensitive' } },
      ],
    },
  });
  if (existing) {
    return NextResponse.json({ error: 'Email atau username sudah terdaftar.' }, { status: 409 });
  }

  const user = await prisma.appUser.create({
    data: {
      email: email.toLowerCase(),
      username,
      passwordHash: hashPassword(password),
      name,
      role,
      access: (access ?? []).join(','),
      active: true,
    },
    select: {
      id: true,
      email: true,
      username: true,
      name: true,
      role: true,
      access: true,
      active: true,
    },
  });
  return NextResponse.json(user, { status: 201 });
}
