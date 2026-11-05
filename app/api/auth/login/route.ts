import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyPassword } from '@/lib/password';
import { createSession } from '@/lib/session';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { identifier, email, username, password } = body as {
      identifier?: string;
      email?: string;
      username?: string;
      password?: string;
    };

    const loginId = (identifier || email || username || '').trim();

    if (!loginId || !password) {
      return NextResponse.json(
        { error: 'Email/Username dan Password wajib diisi.' },
        { status: 400 }
      );
    }

    // Cari user berdasarkan email ATAU username (case-insensitive)
    const user = await prisma.appUser.findFirst({
      where: {
        OR: [
          { email: { equals: loginId, mode: 'insensitive' } },
          { username: { equals: loginId, mode: 'insensitive' } },
        ],
      },
    });

    if (!user || !user.active) {
      return NextResponse.json(
        { error: 'Email/Username atau password salah atau akun nonaktif.' },
        { status: 401 }
      );
    }

    const valid = verifyPassword(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json(
        { error: 'Email/Username atau password salah.' },
        { status: 401 }
      );
    }

    const accessArr = user.access ? user.access.split(',').filter(Boolean) : [];

    await createSession({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      access: accessArr,
    });

    return NextResponse.json({ ok: true, name: user.name, role: user.role });
  } catch (err) {
    console.error('[login error]', err);
    return NextResponse.json({ error: 'Terjadi kesalahan server.' }, { status: 500 });
  }
}
