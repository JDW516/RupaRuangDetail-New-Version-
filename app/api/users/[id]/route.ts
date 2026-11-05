import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/password';
import { getSession } from '@/lib/session';

function requireAdminOrOwner(session: Awaited<ReturnType<typeof getSession>>) {
  if (!session || (session.role !== 'SUPERADMIN' && session.role !== 'OWNER')) {
    return NextResponse.json(
      { error: 'Akses ditolak. Hanya SUPERADMIN atau OWNER.' },
      { status: 403 }
    );
  }
  return null;
}

/** PATCH /api/users/[id] - update user (toggle active, reset password) */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  const denied = requireAdminOrOwner(session);
  if (denied) return denied;

  const { id } = await params;
  const body = await request.json();

  // Reset password
  if (body.action === 'reset_password') {
    const { newPassword } = body as { newPassword?: string };
    if (!newPassword || newPassword.length < 8) {
      return NextResponse.json({ error: 'Password baru minimal 8 karakter.' }, { status: 400 });
    }
    const user = await prisma.appUser.update({
      where: { id },
      data: { passwordHash: hashPassword(newPassword) },
      select: { id: true, name: true },
    });
    return NextResponse.json({ ok: true, message: `Password ${user.name} berhasil direset.` });
  }

  // Toggle active status
  if (body.action === 'toggle_active') {
    const user = await prisma.appUser.findUnique({ where: { id } });
    if (!user) return NextResponse.json({ error: 'User tidak ditemukan.' }, { status: 404 });
    if (user.role === 'SUPERADMIN') {
      return NextResponse.json({ error: 'Tidak bisa menonaktifkan akun SUPERADMIN.' }, { status: 403 });
    }
    const updated = await prisma.appUser.update({
      where: { id },
      data: { active: !user.active },
      select: { id: true, active: true, name: true },
    });
    return NextResponse.json({ ok: true, active: updated.active });
  }

  return NextResponse.json({ error: 'Aksi tidak dikenal.' }, { status: 400 });
}

/** DELETE /api/users/[id] - delete user */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  const denied = requireAdminOrOwner(session);
  if (denied) return denied;

  const { id } = await params;
  const user = await prisma.appUser.findUnique({ where: { id } });
  if (!user) return NextResponse.json({ error: 'User tidak ditemukan.' }, { status: 404 });
  if (user.role === 'SUPERADMIN') {
    return NextResponse.json({ error: 'Tidak bisa menghapus akun SUPERADMIN.' }, { status: 403 });
  }

  await prisma.appUser.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
