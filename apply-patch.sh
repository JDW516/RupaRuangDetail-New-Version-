#!/usr/bin/env bash
# RupaRuang ERP - patch RBAC, List View + Create, O2C/P2P, stok, POS, jurnal otomatis, password policy
# Jalankan dari ROOT proyek (folder yang berisi package.json):  bash apply-patch.sh
set -e
[ -f package.json ] && [ -d app ] || { echo "ERROR: jalankan dari root proyek (ada package.json & folder app)."; exit 1; }
BACKUP="../ruparuang-backup-$(date +%Y%m%d-%H%M%S)"
echo "Backup file lama ke $BACKUP"
for f in "app/admin/users/page.tsx" "app/api/users/[id]/route.ts" "app/api/users/route.ts" "app/dashboard/page.tsx" "app/inventory/page.tsx" "app/invoicing/page.tsx" "app/layout.tsx" "app/page.tsx" "app/pos/page.tsx" "app/purchase/page.tsx" "app/sales/page.tsx" "components/odoo/AppNavbar.tsx" "components/odoo/AppSwitcherModal.tsx" "lib/password.ts" "lib/session.ts" "middleware.ts" "prisma/schema.prisma" "prisma/seed.ts"; do
  if [ -f "$f" ]; then mkdir -p "$BACKUP/$(dirname "$f")"; cp "$f" "$BACKUP/$f"; fi
done

mkdir -p "app/actions"
cat > "app/actions/erp.ts" <<'RR_EOF'
'use server';

import { revalidatePath } from 'next/cache';
import { getSession, type SessionPayload } from '@/lib/session';
import { canAccess } from '@/lib/auth';
import * as erp from '@/lib/erp';
import type { LineInput } from '@/lib/erp';

export interface ActionResult {
  ok: boolean;
  message: string;
  redirectTo?: string;
}

const PATHS = ['/sales', '/purchase', '/inventory', '/invoicing', '/accounting', '/pos', '/dashboard'];

async function run(
  moduleId: string,
  fn: (session: SessionPayload) => Promise<{ message: string; redirectTo?: string }>
): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, message: 'Sesi berakhir. Silakan login kembali.' };
  if (!canAccess(session, moduleId)) return { ok: false, message: 'Akses Ditolak: Anda tidak memiliki izin untuk aksi ini.' };
  try {
    const r = await fn(session);
    for (const p of PATHS) revalidatePath(p, 'layout');
    return { ok: true, ...r };
  } catch (e) {
    if (e instanceof erp.ErpError) return { ok: false, message: e.message };
    console.error('[erp action]', e);
    return { ok: false, message: 'Terjadi kesalahan server. Coba lagi.' };
  }
}

// ---- Sales ----
export async function createQuotationAction(customerId: string, lines: LineInput[]) {
  return run('sales', async () => {
    const q = await erp.createQuotation(customerId, lines);
    return { message: `Quotation ${q.docNumber} berhasil dibuat.`, redirectTo: `/sales/${q.id}` };
  });
}
export async function confirmQuotationAction(id: string) {
  return run('sales', async () => {
    const r = await erp.confirmQuotation(id);
    return { message: r.message, redirectTo: `/sales/order/${r.soId}` };
  });
}
export async function approveCreditAction(soId: string) {
  return run('sales', async (s) => {
    if (!['SUPERADMIN', 'OWNER', 'FINANCE'].includes(s.role)) throw new erp.ErpError('Hanya Owner/Finance yang boleh menyetujui kredit.');
    return { message: await erp.approveCredit(soId) };
  });
}

// ---- Purchase ----
export async function createPurchaseOrderAction(vendorId: string, lines: LineInput[]) {
  return run('purchase', async () => {
    const po = await erp.createPurchaseOrder(vendorId, lines);
    return { message: `PO ${po.docNumber} berhasil dibuat.`, redirectTo: `/purchase/${po.id}` };
  });
}
export async function confirmPurchaseOrderAction(id: string) {
  return run('purchase', async () => ({ message: await erp.confirmPurchaseOrder(id) }));
}

// ---- Inventory ----
export async function validateDeliveryAction(id: string) {
  return run('inventory', async () => ({ message: await erp.validateDelivery(id) }));
}
export async function validateReceiptAction(id: string) {
  return run('inventory', async () => ({ message: await erp.validateReceipt(id) }));
}
export async function createProductAction(p: Parameters<typeof erp.createProduct>[0]) {
  return run('inventory', async () => ({ message: await erp.createProduct(p), redirectTo: `/inventory/product?sku=${p.sku.trim().toUpperCase()}` }));
}

// ---- Invoicing ----
export async function createInvoiceAction(soId: string) {
  return run('invoicing', async () => ({ message: await erp.createInvoiceFromSO(soId) }));
}
export async function createBillAction(poId: string) {
  return run('invoicing', async () => ({ message: await erp.createBillFromPO(poId) }));
}
export async function registerInvoicePaymentAction(id: string) {
  return run('invoicing', async () => ({ message: await erp.registerInvoicePayment(id) }));
}
export async function registerBillPaymentAction(id: string) {
  return run('invoicing', async () => ({ message: await erp.registerBillPayment(id) }));
}

// ---- POS ----
export async function posCheckoutAction(lines: LineInput[], cashPaid: number) {
  const session = await getSession();
  const name = session?.name ?? 'Kasir';
  const res = await run('pos', async () => {
    const r = await erp.posCheckout(lines, cashPaid, name);
    return {
      message: `Transaksi ${r.docNumber} berhasil. Total Rp ${r.total.toLocaleString('id-ID')} · Kembalian Rp ${r.change.toLocaleString('id-ID')}`,
    };
  });
  return res;
}
export async function closePosSessionAction(sessionId: string, counted?: number) {
  return run('pos', async () => ({ message: await erp.closePosSession(sessionId, counted), redirectTo: '/pos' }));
}
RR_EOF
echo "  ✓ app/actions/erp.ts"
mkdir -p "app/admin/users"
cat > "app/admin/users/page.tsx" <<'RR_EOF'
'use client';

import { useState, useEffect, FormEvent } from 'react';
import Link from 'next/link';
import { AppNavbar } from '@/components/odoo';

const ALL_MODULES = [
  { id: 'dashboard', label: 'Executive Dashboard' },
  { id: 'contacts', label: 'Master Contacts' },
  { id: 'crm', label: 'CRM & Pipeline' },
  { id: 'inventory', label: 'Inventory & Products' },
  { id: 'sales', label: 'Sales & Quotation' },
  { id: 'purchase', label: 'Purchase Order' },
  { id: 'pos', label: 'Point of Sale (POS)' },
  { id: 'invoicing', label: 'Invoicing & Bills' },
  { id: 'accounting', label: 'Accounting & Jurnal' },
];

const ROLES = [
  { value: 'STAFF', label: 'STAFF (Akses Terbatas)' },
  { value: 'CASHIER', label: 'CASHIER (Kasir POS)' },
  { value: 'SALES', label: 'SALES (Penjualan & CRM)' },
  { value: 'WAREHOUSE', label: 'WAREHOUSE (Gudang)' },
  { value: 'FINANCE', label: 'FINANCE (Keuangan)' },
  { value: 'PURCHASING', label: 'PURCHASING (Pengadaan)' },
  { value: 'OWNER', label: 'OWNER (Semua Akses)' },
  { value: 'SUPERADMIN', label: 'SUPERADMIN (Super Admin)' },
];

const ROLE_COLORS: Record<string, string> = {
  SUPERADMIN: 'bg-purple-100 text-purple-700 border-purple-200',
  OWNER: 'bg-blue-100 text-blue-700 border-blue-200',
  SALES: 'bg-green-100 text-green-700 border-green-200',
  WAREHOUSE: 'bg-orange-100 text-orange-700 border-orange-200',
  FINANCE: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  PURCHASING: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  CASHIER: 'bg-pink-100 text-pink-700 border-pink-200',
  STAFF: 'bg-gray-100 text-gray-600 border-gray-200',
};

interface User {
  id: string;
  email: string;
  username: string;
  name: string;
  role: string;
  access: string;
  active: boolean;
  createdAt: string;
}

/** Kebijakan password: min. 8 karakter, huruf besar, huruf kecil, angka, simbol */
function checkPassword(pw: string): string | null {
  if (!pw || pw.length < 8) return 'Password minimal 8 karakter.';
  if (!/[A-Z]/.test(pw)) return 'Password harus mengandung minimal 1 huruf besar (A-Z).';
  if (!/[a-z]/.test(pw)) return 'Password harus mengandung minimal 1 huruf kecil (a-z).';
  if (!/[0-9]/.test(pw)) return 'Password harus mengandung minimal 1 angka (0-9).';
  if (!/[^A-Za-z0-9]/.test(pw)) return 'Password harus mengandung minimal 1 simbol (contoh: ! @ # $ %).';
  return null;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Form state
  const [form, setForm] = useState({
    name: '', username: '', email: '', password: '', role: 'STAFF', access: [] as string[],
  });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');

  // Reset password modal state
  const [resetTarget, setResetTarget] = useState<User | null>(null);
  const [resetPw, setResetPw] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState('');

  async function fetchUsers() {
    setLoading(true);
    const res = await fetch('/api/users');
    if (res.ok) {
      const data = await res.json();
      setUsers(data);
    }
    setLoading(false);
  }

  useEffect(() => { fetchUsers(); }, []);

  function flash(type: 'ok' | 'err', text: string) {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 4000);
  }

  function toggleModule(id: string) {
    setForm((f) => ({
      ...f,
      access: f.access.includes(id) ? f.access.filter((x) => x !== id) : [...f.access, id],
    }));
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setFormError('');
    const pwErr = checkPassword(form.password);
    if (pwErr) {
      setFormError(pwErr);
      return;
    }
    setFormLoading(true);
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setFormLoading(false);
    if (!res.ok) {
      setFormError(data.error ?? 'Gagal menyimpan user.');
    } else {
      setForm({ name: '', username: '', email: '', password: '', role: 'STAFF', access: [] });
      flash('ok', `User "${data.name}" berhasil ditambahkan.`);
      fetchUsers();
    }
  }

  async function handleToggleActive(user: User) {
    const res = await fetch(`/api/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'toggle_active' }),
    });
    if (res.ok) {
      flash('ok', `Status ${user.name} berhasil diubah.`);
      fetchUsers();
    } else {
      const data = await res.json();
      flash('err', data.error ?? 'Gagal mengubah status.');
    }
  }

  async function handleDelete(user: User) {
    if (!confirm(`Hapus akun "${user.name}" (${user.email})? Tindakan ini tidak bisa dibatalkan.`)) return;
    const res = await fetch(`/api/users/${user.id}`, { method: 'DELETE' });
    if (res.ok) {
      flash('ok', `User "${user.name}" berhasil dihapus.`);
      fetchUsers();
    } else {
      const data = await res.json();
      flash('err', data.error ?? 'Gagal menghapus.');
    }
  }

  async function handleResetPassword(e: FormEvent) {
    e.preventDefault();
    setResetError('');
    const resetErr = checkPassword(resetPw);
    if (resetErr) {
      setResetError(resetErr);
      return;
    }
    setResetLoading(true);
    const res = await fetch(`/api/users/${resetTarget!.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reset_password', newPassword: resetPw }),
    });
    const data = await res.json();
    setResetLoading(false);
    if (!res.ok) {
      setResetError(data.error ?? 'Gagal reset password.');
    } else {
      flash('ok', data.message ?? 'Password berhasil direset.');
      setResetTarget(null);
      setResetPw('');
    }
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Top Navbar Odoo 17 with dynamic profile & theme toggle */}
      <AppNavbar currentModule="Panel Super Admin" />

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#0F172A]">Panel Super Admin - Kelola Pengguna</h1>
            <p className="text-sm text-[#64748B] mt-0.5">Atur siapa saja yang bisa masuk dan menu apa yang boleh diakses</p>
          </div>
          <Link
            href="/"
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[#E2E8F0] bg-white text-[#0F172A] text-sm font-medium hover:bg-[#F8FAFC] transition shadow-sm"
          >
            ← Kembali ke App Switcher
          </Link>
        </div>

        {/* Flash message */}
        {msg && (
          <div className={`px-4 py-3 rounded-lg text-sm font-medium border ${msg.type === 'ok' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
            {msg.type === 'ok' ? '✅ ' : '❌ '}{msg.text}
          </div>
        )}

        {/* Card 1: Add User Form */}
        <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
          <div className="bg-[#F8FAFC] border-b border-[#E2E8F0] px-6 py-4 flex items-center gap-2">
            <span className="text-[#3B82F6] text-lg">✦</span>
            <h2 className="font-bold text-[#0F172A]">Tambah Akun Anggota Baru</h2>
          </div>
          <form onSubmit={handleCreate} className="p-6 space-y-5">
            {/* Row 1: Name, Username, Password */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#64748B] mb-1.5">Nama Lengkap</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Contoh: Budi Kasir"
                  required
                  className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#CFFF30] focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#64748B] mb-1.5">Username</label>
                <input
                  type="text"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  placeholder="budi123"
                  required
                  className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#CFFF30] focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#64748B] mb-1.5">Password (min. 8, huruf besar, angka & simbol)</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="••••••••"
                  required
                  minLength={8}
                  className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#CFFF30] focus:border-transparent"
                />
              </div>
            </div>

            {/* Email + Role */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#64748B] mb-1.5">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="budi@ruparuang.com"
                  required
                  className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#CFFF30] focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#64748B] mb-1.5">Role / Peran</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] text-sm text-[#0F172A] bg-white focus:outline-none focus:ring-2 focus:ring-[#CFFF30] focus:border-transparent"
                >
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Module Checkboxes */}
            <div>
              <label className="block text-xs font-semibold text-[#64748B] mb-2">Pilih Hak Akses Modul:</label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {ALL_MODULES.map((mod) => (
                  <label
                    key={mod.id}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#E2E8F0] cursor-pointer hover:bg-[#F8FAFC] transition"
                  >
                    <input
                      type="checkbox"
                      checked={form.access.includes(mod.id)}
                      onChange={() => toggleModule(mod.id)}
                      className="accent-[#CFFF30] w-4 h-4"
                    />
                    <span className="text-xs text-[#0F172A]">{mod.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {formError && (
              <div className="text-sm text-[#EF4444] bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                ⚠️ {formError}
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={formLoading}
                className="bg-[#CFFF30] text-[#0F172A] font-bold px-6 py-2.5 rounded-lg text-sm hover:bg-[#b8e529] active:bg-[#a3cc24] transition disabled:opacity-60 shadow-sm"
              >
                {formLoading ? 'Menyimpan...' : '+ Simpan User Baru'}
              </button>
            </div>
          </form>
        </div>

        {/* Card 2: User List */}
        <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
          <div className="bg-[#F8FAFC] border-b border-[#E2E8F0] px-6 py-4 flex items-center gap-2">
            <span className="text-lg">📋</span>
            <h2 className="font-bold text-[#0F172A]">Daftar Akun Terdaftar</h2>
            <span className="ml-auto text-xs text-[#64748B] font-medium">{users.length} pengguna</span>
          </div>

          {loading ? (
            <div className="p-8 text-center text-[#64748B] text-sm">Memuat data pengguna...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E2E8F0] text-xs text-[#64748B] uppercase tracking-wide">
                    <th className="text-left px-6 py-3 font-semibold">Nama</th>
                    <th className="text-left px-4 py-3 font-semibold">Username</th>
                    <th className="text-left px-4 py-3 font-semibold">Email</th>
                    <th className="text-left px-4 py-3 font-semibold">Role</th>
                    <th className="text-left px-4 py-3 font-semibold">Status</th>
                    <th className="text-left px-4 py-3 font-semibold">Hak Akses Modul</th>
                    <th className="text-left px-4 py-3 font-semibold">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {users.map((user) => {
                    const accessModules = user.access ? user.access.split(',').filter(Boolean) : [];
                    const isAllAccess = user.role === 'SUPERADMIN' || user.role === 'OWNER';
                    return (
                      <tr key={user.id} className="hover:bg-[#F8FAFC] transition-colors">
                        <td className="px-6 py-4 font-semibold text-[#0F172A]">{user.name}</td>
                        <td className="px-4 py-4 text-[#64748B] font-mono text-xs">{user.username}</td>
                        <td className="px-4 py-4 text-[#64748B] text-xs">{user.email}</td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold border ${ROLE_COLORS[user.role] ?? ROLE_COLORS.STAFF}`}>
                            {user.role}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${user.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-500'}`}>
                            {user.active ? 'Aktif' : 'Nonaktif'}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-xs text-[#64748B]">
                          {isAllAccess ? (
                            <span className="text-[#3B82F6] font-medium">Semua Modul</span>
                          ) : accessModules.length === 0 ? (
                            <span className="text-[#94A3B8] italic">Tidak ada akses</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {accessModules.map((m) => {
                                const mod = ALL_MODULES.find((x) => x.id === m);
                                return (
                                  <span key={m} className="px-1.5 py-0.5 bg-[#F1F5F9] rounded text-[10px] text-[#475569]">
                                    {mod?.label ?? m}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => { setResetTarget(user); setResetPw(''); setResetError(''); }}
                              className="text-xs px-2.5 py-1 rounded border border-[#E2E8F0] text-[#0F172A] hover:bg-[#F1F5F9] transition font-medium"
                            >
                              Reset Password
                            </button>
                            {user.role !== 'SUPERADMIN' && (
                              <>
                                <button
                                  onClick={() => handleToggleActive(user)}
                                  className={`text-xs px-2.5 py-1 rounded border font-medium transition ${user.active ? 'border-orange-200 text-orange-600 hover:bg-orange-50' : 'border-green-200 text-green-600 hover:bg-green-50'}`}
                                >
                                  {user.active ? 'Nonaktifkan' : 'Aktifkan'}
                                </button>
                                <button
                                  onClick={() => handleDelete(user)}
                                  className="text-xs px-2.5 py-1 rounded border border-red-200 text-[#EF4444] hover:bg-red-50 transition font-medium"
                                >
                                  Hapus
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {users.length === 0 && (
                <div className="p-8 text-center text-[#64748B] text-sm">Belum ada pengguna terdaftar.</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Reset Password Modal */}
      {resetTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h3 className="font-bold text-[#0F172A] text-lg">Reset Password</h3>
            <p className="text-sm text-[#64748B]">
              Reset password untuk akun <strong>{resetTarget.name}</strong> ({resetTarget.email})
            </p>
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#64748B] mb-1.5">Password Baru (min. 8 karakter)</label>
                <input
                  type="password"
                  value={resetPw}
                  onChange={(e) => setResetPw(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={8}
                  className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] text-sm focus:outline-none focus:ring-2 focus:ring-[#CFFF30]"
                />
              </div>
              {resetError && <p className="text-xs text-[#EF4444]">⚠️ {resetError}</p>}
              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={resetLoading}
                  className="flex-1 bg-[#CFFF30] text-[#0F172A] font-bold py-2 rounded-lg text-sm hover:bg-[#b8e529] transition disabled:opacity-60"
                >
                  {resetLoading ? 'Menyimpan...' : 'Simpan Password Baru'}
                </button>
                <button
                  type="button"
                  onClick={() => setResetTarget(null)}
                  className="flex-1 border border-[#E2E8F0] text-[#64748B] font-medium py-2 rounded-lg text-sm hover:bg-[#F8FAFC] transition"
                >
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
RR_EOF
echo "  ✓ app/admin/users/page.tsx"
mkdir -p "app/api/users/[id]"
cat > "app/api/users/[id]/route.ts" <<'RR_EOF'
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword, validatePasswordPolicy } from '@/lib/password';
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
    const pwError = validatePasswordPolicy(newPassword ?? '');
    if (pwError) {
      return NextResponse.json({ error: pwError }, { status: 400 });
    }
    const user = await prisma.appUser.update({
      where: { id },
      data: { passwordHash: hashPassword(newPassword as string) },
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
RR_EOF
echo "  ✓ app/api/users/[id]/route.ts"
mkdir -p "app/api/users"
cat > "app/api/users/route.ts" <<'RR_EOF'
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
RR_EOF
echo "  ✓ app/api/users/route.ts"
mkdir -p "app/dashboard"
cat > "app/dashboard/page.tsx" <<'RR_EOF'
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import {
  AppNavbar,
  ControlPanel,
  Chatter,
} from '@/components/odoo';

export const revalidate = 0;

export default async function DashboardPage() {
  const contactCount = await prisma.contact.count();
  const productCount = await prisma.product.count();
  const quotationCount = await prisma.quotation.count();
  const poCount = await prisma.purchaseOrder.count();
  const accountCount = await prisma.account.count();
  const invoiceCount = await prisma.invoice.count();
  const stocks = await prisma.stock.findMany({
    include: { product: true },
  });

  const totalWhQty = stocks
    .filter((s) => s.locationId === 'WH')
    .reduce((acc, curr) => acc + curr.qtyOnHand, 0);

  const totalShopQty = stocks
    .filter((s) => s.locationId === 'SHOP')
    .reduce((acc, curr) => acc + curr.qtyOnHand, 0);

  const totalCompanyQty = totalWhQty + totalShopQty;

  // Nilai Persediaan Berdasarkan Biaya HPP (Standard Price Baseline B0 = Rp 29.009.000)
  const totalStockValuation = stocks.reduce((acc, curr) => {
    return acc + curr.qtyOnHand * curr.product.cost;
  }, 0);

  // Omzet Penjualan yang Terkonfirmasi (SO & Invoice Posted / POS, SR-15: Bukan Draft)
  const confirmedSalesOrders = await prisma.salesOrder.findMany({
    where: { status: 'Confirmed' },
  });
  const totalB2BOmzet = confirmedSalesOrders.reduce(
    (acc, so) => acc + so.totalAmount,
    0
  );

  const posOrders = await prisma.pOSOrder.findMany();
  const totalPosOmzet = posOrders.reduce((acc, po) => acc + po.totalAmount, 0);
  const grandTotalOmzet = totalB2BOmzet + totalPosOmzet;

  // Open PO Commitment
  const purchaseOrders = await prisma.purchaseOrder.findMany();
  const totalOpenPoValue = purchaseOrders.reduce(
    (acc, po) => acc + po.totalAmount,
    0
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans">
      {/* 1. App Navbar Odoo */}
      <AppNavbar currentModule="Management Dashboard (S-17)" />

      {/* 2. Control Panel Header */}
      <ControlPanel
        breadcrumbs={[
          { label: 'Home', href: '/' },
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Executive KPI Overview' },
        ]}
        searchPlaceholder="Cari metrik atau indikator bisnis..."
        pagerText="Periode: Semua Transaksi Aktif"
        availableViews={['graph', 'list']}
        currentView="graph"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30 px-3 py-1 rounded-md">
            Sistem: Live Operational
          </span>
        </div>
      </ControlPanel>

      {/* 3. Main Workspace: S-17 Executive KPI Dashboard */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-6 space-y-6">
        
        {/* Banner Welcome & Date Filter */}
        <div className="bg-[#1E293B] text-white rounded-2xl border border-slate-700 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#CFFF30]" />
              <span className="text-[11px] font-mono font-bold text-[#CFFF30] uppercase tracking-wider">
                S-17 Management Dashboard (F-18 / SR-15)
              </span>
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight mt-1">
              Executive Business Overview · PT RupaRuang Niaga
            </h1>
            <p className="text-xs text-slate-300 mt-0.5">
              Konsolidasi penjualan B2B, kasir ritel gerai, valuasi persediaan dua lokasi & komitmen pengadaan.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-slate-800/80 border border-slate-700 p-1.5 rounded-xl text-xs">
            <span className="text-slate-400 px-2 font-medium">Filter Periode:</span>
            <button
              type="button"
              className="bg-[#CFFF30] text-[#0F172A] font-extrabold px-3 py-1 rounded-lg"
            >
              Tahun Berjalan (YTD)
            </button>
            <button
              type="button"
              className="text-slate-300 hover:text-white px-3 py-1 rounded-lg"
            >
              Bulan Ini
            </button>
          </div>
        </div>

        {/* 4 KARTU KPI UTAMA (S-17 Area 3 & 4) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* KPI 1: Total Omzet Penjualan */}
          <div className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-xs relative overflow-hidden group hover:border-[#00F0FF] transition-all">
            <div className="flex justify-between items-start">
              <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">
                Total Omzet Sah (SR-15)
              </span>
              <span className="text-xl">💰</span>
            </div>
            <div className="text-2xl font-mono font-black text-[#0F172A] mt-2">
              Rp {grandTotalOmzet.toLocaleString('id-ID')}
            </div>
            <div className="mt-2 pt-2 border-t border-[#E2E8F0] text-[11px] text-[#10B981] font-semibold flex items-center justify-between">
              <span>B2B: Rp {totalB2BOmzet.toLocaleString('id-ID')}</span>
              <span>POS: Rp {totalPosOmzet.toLocaleString('id-ID')}</span>
            </div>
          </div>

          {/* KPI 2: Valuasi Persediaan (Baseline B0 = Rp 29.009.000) */}
          <div className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-xs relative overflow-hidden group hover:border-[#00F0FF] transition-all">
            <div className="flex justify-between items-start">
              <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">
                Nilai Persediaan (Stock Value)
              </span>
              <span className="text-xl">📦</span>
            </div>
            <div className="text-2xl font-mono font-black text-[#1E293B] mt-2">
              Rp {totalStockValuation.toLocaleString('id-ID')}
            </div>
            <div className="mt-2 pt-2 border-t border-[#E2E8F0] text-[11px] text-[#64748B] font-semibold flex items-center justify-between">
              <span>Total Fisik:</span>
              <span className="font-mono font-bold text-[#0F172A]">{totalCompanyQty} Unit</span>
            </div>
          </div>

          {/* KPI 3: Open PO Commitment */}
          <div className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-xs relative overflow-hidden group hover:border-[#00F0FF] transition-all">
            <div className="flex justify-between items-start">
              <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">
                Komitmen Pengadaan (PO)
              </span>
              <span className="text-xl">🛒</span>
            </div>
            <div className="text-2xl font-mono font-black text-[#F59E0B] mt-2">
              Rp {totalOpenPoValue.toLocaleString('id-ID')}
            </div>
            <div className="mt-2 pt-2 border-t border-[#E2E8F0] text-[11px] text-[#64748B] font-semibold flex items-center justify-between">
              <span>{poCount} Dokumen PO</span>
              <Link href="/purchase" className="text-[#00F0FF] hover:underline font-bold">
                Buka PO ➔
              </Link>
            </div>
          </div>

          {/* KPI 4: Master Data Health */}
          <div className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-xs relative overflow-hidden group hover:border-[#00F0FF] transition-all">
            <div className="flex justify-between items-start">
              <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">
                Kesehatan Sistem Master
              </span>
              <span className="text-xl">🛡️</span>
            </div>
            <div className="text-2xl font-mono font-black text-[#10B981] mt-2">
              100% Ready
            </div>
            <div className="mt-2 pt-2 border-t border-[#E2E8F0] text-[11px] text-[#64748B] font-semibold flex items-center justify-between">
              <span>{productCount} SKU Produk</span>
              <span>{contactCount} Kontak</span>
            </div>
          </div>
        </div>

        {/* SECTION METRIK DETAIL & GRAFIK VISUAL */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* KIRI: GRAFIK & DISTRIBUSI STOK MULTI-LOKASI */}
          <div className="lg:col-span-7 bg-white rounded-2xl border border-[#E2E8F0] p-6 shadow-xs space-y-4">
            <div className="flex justify-between items-center border-b border-[#E2E8F0] pb-3">
              <div>
                <h2 className="font-extrabold text-[#0F172A] text-sm">
                  Distribusi Stok Dua Lokasi (Gudang Utama vs Gerai Depok)
                </h2>
                <span className="text-xs text-[#64748B]">
                  Perbandingan unit fisik on-hand antar lokasi operasional
                </span>
              </div>
              <Link
                href="/inventory"
                className="text-xs font-bold text-[#1E293B] hover:text-[#00F0FF] transition-colors"
              >
                Lihat Detail Stok ➔
              </Link>
            </div>

            {/* Visual Bar Breakdown */}
            <div className="space-y-4 pt-2">
              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span className="flex items-center gap-1.5 text-[#0F172A]">
                    <span className="w-3 h-3 rounded-md bg-[#3B82F6]" />
                    <span>WH/JKT/Stock (Gudang Utama Jakarta Timur)</span>
                  </span>
                  <span className="font-mono font-bold text-[#0F172A]">
                    {totalWhQty} Unit ({totalCompanyQty > 0 ? Math.round((totalWhQty / totalCompanyQty) * 100) : 0}%)
                  </span>
                </div>
                <div className="w-full bg-[#F8FAFC] h-3 rounded-full overflow-hidden border border-[#E2E8F0]">
                  <div
                    className="bg-[#3B82F6] h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${totalCompanyQty > 0 ? (totalWhQty / totalCompanyQty) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span className="flex items-center gap-1.5 text-[#0F172A]">
                    <span className="w-3 h-3 rounded-md bg-[#10B981]" />
                    <span>SHOP/DPK/Stock (Gerai Penjualan Depok)</span>
                  </span>
                  <span className="font-mono font-bold text-[#0F172A]">
                    {totalShopQty} Unit ({totalCompanyQty > 0 ? Math.round((totalShopQty / totalCompanyQty) * 100) : 0}%)
                  </span>
                </div>
                <div className="w-full bg-[#F8FAFC] h-3 rounded-full overflow-hidden border border-[#E2E8F0]">
                  <div
                    className="bg-[#10B981] h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${totalCompanyQty > 0 ? (totalShopQty / totalCompanyQty) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Metric Insight Card */}
            <div className="mt-6 p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex justify-between items-center text-xs">
              <div>
                <span className="font-bold text-[#0F172A] block">
                  Metode Penilaian Persediaan Sesuai Handout:
                </span>
                <span className="text-[#64748B]">
                  Standard Cost Price tetap per SKU. Total valuasi saat ini (real-time dari database): <strong>Rp {totalStockValuation.toLocaleString('id-ID')}</strong>.
                </span>
              </div>
              <span className="font-mono font-black text-sm text-[#0F172A] bg-white px-3 py-1 rounded-lg border border-[#E2E8F0]">
                {totalCompanyQty.toLocaleString('id-ID')} Unit
              </span>
            </div>
          </div>

          {/* KANAN: STATUS ALUR DOKUMEN & QUICK SHORTCUTS */}
          <div className="lg:col-span-5 bg-white rounded-2xl border border-[#E2E8F0] p-6 shadow-xs space-y-4">
            <h2 className="font-extrabold text-[#0F172A] text-sm border-b border-[#E2E8F0] pb-3">
              Status Alur Transaksi Bisnis (Order-to-Cash & Procure-to-Pay)
            </h2>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0] flex justify-between items-center">
                <div>
                  <span className="font-bold text-[#0F172A] block">Sales Quotations (S-05)</span>
                  <span className="text-[11px] text-[#64748B]">{quotationCount} Dokumen Penawaran</span>
                </div>
                <Link
                  href="/sales"
                  className="bg-[#CFFF30] text-[#0F172A] font-extrabold px-3 py-1 rounded-lg text-xs hover:brightness-95"
                >
                  Buka SO ➔
                </Link>
              </div>

              <div className="p-3 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0] flex justify-between items-center">
                <div>
                  <span className="font-bold text-[#0F172A] block">Customer Invoices (S-11)</span>
                  <span className="text-[11px] text-[#64748B]">{invoiceCount} Faktur Pelanggan Terbit</span>
                </div>
                <Link
                  href="/invoicing"
                  className="bg-[#00F0FF]/15 text-[#0F172A] border border-[#00F0FF] font-bold px-3 py-1 rounded-lg text-xs hover:bg-[#00F0FF]/30"
                >
                  Buka Faktur ➔
                </Link>
              </div>

              <div className="p-3 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0] flex justify-between items-center">
                <div>
                  <span className="font-bold text-[#0F172A] block">Purchase Orders & Receipts (S-09)</span>
                  <span className="text-[11px] text-[#64748B]">{poCount} Pengadaan PO Vendor</span>
                </div>
                <Link
                  href="/purchase"
                  className="bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30 font-bold px-3 py-1 rounded-lg text-xs hover:bg-[#10B981]/30"
                >
                  Buka PO ➔
                </Link>
              </div>

              <div className="p-3 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0] flex justify-between items-center">
                <div>
                  <span className="font-bold text-[#0F172A] block">Chart of Accounts & Jurnal (S-14)</span>
                  <span className="text-[11px] text-[#64748B]">{accountCount} Akun COA Terdaftar</span>
                </div>
                <Link
                  href="/accounting"
                  className="bg-[#1E293B] text-white font-bold px-3 py-1 rounded-lg text-xs hover:bg-slate-800"
                >
                  Buka Jurnal ➔
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Section Chatter Log Audit Dashboard */}
        <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-xs p-2">
          <Chatter
            documentId="EXEC-DASHBOARD"
            documentType="Executive Management Dashboard"
            initialLogs={[
              {
                id: 'dash1',
                user: 'Hendra Wijaya (Business Owner)',
                role: 'Executive Owner',
                action: 'Tinjauan KPI Berkala & Kepatuhan Aturan Bisnis',
                timestamp: 'Hari ini, 11:00',
                message: `Nilai persediaan saat ini Rp${totalStockValuation.toLocaleString('id-ID')} dan omzet Rp${grandTotalOmzet.toLocaleString('id-ID')} dihitung langsung dari database.`,
              },
            ]}
          />
        </div>
      </main>
    </div>
  );
}
RR_EOF
echo "  ✓ app/dashboard/page.tsx"
mkdir -p "app/inventory/delivery/[id]"
cat > "app/inventory/delivery/[id]/page.tsx" <<'RR_EOF'
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { AppNavbar, ControlPanel, FormStatusBar, FormSheet, FormField, FormFieldGroup } from '@/components/odoo';
import ActionButton from '@/components/erp/ActionButton';
import { validateDeliveryAction } from '@/app/actions/erp';
import { StatusPill, fmtDate } from '@/components/erp/ui';

export const revalidate = 0;

export default async function DeliveryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = await prisma.deliveryOrder.findUnique({
    where: { id },
    include: { salesOrder: { include: { customer: true } }, lines: { include: { product: { include: { stocks: true } } } } },
  });
  if (!d) notFound();

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans">
      <AppNavbar currentModule="Delivery Order (S-07)" />
      <ControlPanel
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Inventory', href: '/inventory?tab=delivery' }, { label: d.docNumber }]}
        availableViews={['form']}
        currentView="form"
      />
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-6">
        <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-xs overflow-hidden">
          <FormStatusBar stages={['Ready', 'Done']} currentStage={d.status === 'Done' ? 'Done' : 'Ready'} actions={[]}>
            {d.status !== 'Done' && <ActionButton action={validateDeliveryAction.bind(null, d.id)} label="✓ Validate" confirmText={`Validasi ${d.docNumber}? Stok WH akan berkurang.`} />}
          </FormStatusBar>
          <FormSheet
            title={`Delivery Order ${d.docNumber}`}
            subtitle="Pengeluaran barang dari WH ke pelanggan"
            ribbon={{ text: d.status.toUpperCase(), variant: d.status === 'Done' ? 'success' : 'warning' }}
            smartButtons={[{ label: 'Sales Order', value: d.salesOrder.docNumber, icon: '💼', href: `/sales/order/${d.salesOrderId}` }]}
          >
            <FormFieldGroup columns={2}>
              <FormField label="Pelanggan"><span className="font-bold">{d.salesOrder.customer.name}</span></FormField>
              <FormField label="Tanggal"><span>{fmtDate(d.createdAt)}</span></FormField>
              <FormField label="Status"><StatusPill status={d.status} /></FormField>
              <FormField label="Lokasi Asal"><span className="font-mono">WH/JKT/Stock</span></FormField>
            </FormFieldGroup>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8FAFC] text-[#64748B] uppercase font-bold border-b border-[#E2E8F0]">
                  <tr>
                    <th className="px-3 py-2.5">Produk</th>
                    <th className="px-3 py-2.5 text-center">Qty Kirim</th>
                    <th className="px-3 py-2.5 text-center">Stok WH On-hand</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {d.lines.map((l) => {
                    const wh = l.product.stocks.find((s) => s.locationId === 'WH');
                    return (
                      <tr key={l.id}>
                        <td className="px-3 py-2.5 font-bold">{l.product.name} <span className="font-mono text-[10px] text-[#64748B]">{l.sku}</span></td>
                        <td className="px-3 py-2.5 text-center font-mono font-bold">{l.qtyDone}</td>
                        <td className="px-3 py-2.5 text-center font-mono">{wh?.qtyOnHand ?? 0}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-4 text-xs"><Link href="/inventory?tab=delivery" className="font-bold text-[#1E293B] hover:underline">← Kembali ke daftar Delivery Order</Link></div>
          </FormSheet>
        </div>
      </main>
    </div>
  );
}
RR_EOF
echo "  ✓ app/inventory/delivery/[id]/page.tsx"
mkdir -p "app/inventory"
cat > "app/inventory/page.tsx" <<'RR_EOF'
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { AppNavbar, ControlPanel } from '@/components/odoo';
import ProductCreateModal from '@/components/erp/ProductCreateModal';
import { ListTable, StatusPill, TabLinks, rp, fmtDate } from '@/components/erp/ui';

export const revalidate = 0;

export default async function InventoryListPage({ searchParams }: { searchParams?: Promise<{ tab?: string }> }) {
  const t = (searchParams ? await searchParams : {})?.tab;
  const tab = t === 'delivery' || t === 'receipt' ? t : 'stock';

  const [products, deliveries, receipts, vendors] = await Promise.all([
    prisma.product.findMany({ include: { stocks: true }, orderBy: { sku: 'asc' } }),
    prisma.deliveryOrder.findMany({ include: { salesOrder: { include: { customer: true } }, lines: true }, orderBy: { createdAt: 'desc' } }),
    prisma.receipt.findMany({ include: { purchaseOrder: { include: { vendor: true } }, lines: true }, orderBy: { createdAt: 'desc' } }),
    prisma.contact.findMany({ where: { type: 'VENDOR' }, orderBy: { contactId: 'asc' } }),
  ]);

  const qty = (p: (typeof products)[number], loc: string) => p.stocks.find((s) => s.locationId === loc);

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans">
      <AppNavbar currentModule="Inventory & Stock (S-03 & S-08)" />
      <ControlPanel
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Inventory', href: '/inventory' }, { label: tab === 'stock' ? 'Stok Produk' : tab === 'delivery' ? 'Delivery Orders' : 'Receipts' }]}
        searchPlaceholder="Cari SKU atau dokumen..."
        pagerText={`Produk: ${products.length} | DO: ${deliveries.length} | Receipt: ${receipts.length}`}
        availableViews={['list']}
        currentView="list"
      >
        <div className="flex items-center gap-3">
          <ProductCreateModal vendors={vendors.map((v) => ({ id: v.contactId, label: `${v.contactId} · ${v.name}` }))} />
          <TabLinks base="/inventory" active={tab} tabs={[{ id: 'stock', label: 'Stok Produk' }, { id: 'delivery', label: 'Delivery Orders' }, { id: 'receipt', label: 'Receipts' }]} />
        </div>
      </ControlPanel>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-6">
        {tab === 'stock' && (
          <ListTable
            headers={[{ label: 'SKU' }, { label: 'Produk' }, { label: 'WH On-hand', right: true }, { label: 'WH Reserved', right: true }, { label: 'SHOP On-hand', right: true }, { label: 'Biaya', right: true }]}
            empty="Belum ada produk."
          >
            {products.map((p) => (
              <tr key={p.sku} className="hover:bg-[#F8FAFC]">
                <td className="px-4 py-3 font-mono font-bold"><Link href={`/inventory/product?sku=${p.sku}`} className="text-[#1E293B] hover:underline">{p.sku}</Link></td>
                <td className="px-4 py-3">{p.name}</td>
                <td className="px-4 py-3 text-right font-mono font-bold">{qty(p, 'WH')?.qtyOnHand ?? 0}</td>
                <td className="px-4 py-3 text-right font-mono">{qty(p, 'WH')?.qtyReserved ?? 0}</td>
                <td className="px-4 py-3 text-right font-mono font-bold">{qty(p, 'SHOP')?.qtyOnHand ?? 0}</td>
                <td className="px-4 py-3 text-right font-mono">{rp(p.cost)}</td>
              </tr>
            ))}
          </ListTable>
        )}

        {tab === 'delivery' && (
          <ListTable headers={[{ label: 'Nomor DO' }, { label: 'Sales Order' }, { label: 'Pelanggan' }, { label: 'Tanggal' }, { label: 'Unit', right: true }, { label: 'Status' }]} empty="Belum ada Delivery Order. DO dibuat otomatis saat Quotation dikonfirmasi menjadi Sales Order.">
            {deliveries.map((d) => (
              <tr key={d.id} className="hover:bg-[#F8FAFC]">
                <td className="px-4 py-3 font-mono font-bold"><Link href={`/inventory/delivery/${d.id}`} className="text-[#1E293B] hover:underline">{d.docNumber}</Link></td>
                <td className="px-4 py-3 font-mono">{d.salesOrder.docNumber}</td>
                <td className="px-4 py-3">{d.salesOrder.customer.name}</td>
                <td className="px-4 py-3">{fmtDate(d.createdAt)}</td>
                <td className="px-4 py-3 text-right font-mono">{d.lines.reduce((s, l) => s + l.qtyDone, 0)}</td>
                <td className="px-4 py-3"><StatusPill status={d.status} /></td>
              </tr>
            ))}
          </ListTable>
        )}

        {tab === 'receipt' && (
          <ListTable headers={[{ label: 'Nomor Receipt' }, { label: 'PO' }, { label: 'Vendor' }, { label: 'Tanggal' }, { label: 'Unit', right: true }, { label: 'Status' }]} empty="Belum ada Receipt. Receipt dibuat otomatis saat PO dikonfirmasi.">
            {receipts.map((r) => (
              <tr key={r.id} className="hover:bg-[#F8FAFC]">
                <td className="px-4 py-3 font-mono font-bold"><Link href={`/inventory/receipt/${r.id}`} className="text-[#1E293B] hover:underline">{r.docNumber}</Link></td>
                <td className="px-4 py-3 font-mono">{r.purchaseOrder.docNumber}</td>
                <td className="px-4 py-3">{r.purchaseOrder.vendor.name}</td>
                <td className="px-4 py-3">{fmtDate(r.createdAt)}</td>
                <td className="px-4 py-3 text-right font-mono">{r.lines.reduce((s, l) => s + l.qtyDone, 0)}</td>
                <td className="px-4 py-3"><StatusPill status={r.status} /></td>
              </tr>
            ))}
          </ListTable>
        )}
      </main>
    </div>
  );
}
RR_EOF
echo "  ✓ app/inventory/page.tsx"
mkdir -p "app/inventory/product"
cat > "app/inventory/product/page.tsx" <<'RR_EOF'
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import {
  AppNavbar,
  ControlPanel,
  FormStatusBar,
  FormSheet,
  FormField,
  FormFieldGroup,
  FormNotebook,
  Chatter,
} from '@/components/odoo';

export const revalidate = 0;

export default async function InventoryPage({
  searchParams,
}: {
  searchParams?: Promise<{ sku?: string; location?: string; q?: string }>;
}) {
  const resolvedParams = searchParams ? await searchParams : {};
  const selectedSku = resolvedParams?.sku || 'P001';
  const filterLocation = resolvedParams?.location || 'ALL';
  const searchQuery = (resolvedParams?.q || '').toLowerCase();

  const products = await prisma.product.findMany({
    include: {
      stocks: {
        include: {
          warehouse: true,
        },
      },
    },
    orderBy: { sku: 'asc' },
  });

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      searchQuery === '' ||
      p.sku.toLowerCase().includes(searchQuery) ||
      p.name.toLowerCase().includes(searchQuery) ||
      p.defaultVendorId.toLowerCase().includes(searchQuery);

    return matchesSearch;
  });

  const currentProduct =
    products.find((p) => p.sku === selectedSku) || products[0];

  const currentWhStock =
    currentProduct?.stocks.find((s) => s.locationId === 'WH') || {
      qtyOnHand: 0,
      qtyReserved: 0,
    };
  const currentShopStock =
    currentProduct?.stocks.find((s) => s.locationId === 'SHOP') || {
      qtyOnHand: 0,
      qtyReserved: 0,
    };

  const totalWhCompany = products.reduce((sum, p) => {
    const s = p.stocks.find((x) => x.locationId === 'WH');
    return sum + (s?.qtyOnHand || 0);
  }, 0);

  const totalShopCompany = products.reduce((sum, p) => {
    const s = p.stocks.find((x) => x.locationId === 'SHOP');
    return sum + (s?.qtyOnHand || 0);
  }, 0);

  const totalStockCompany = totalWhCompany + totalShopCompany;

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans">
      {/* 1. App Navbar Odoo */}
      <AppNavbar currentModule="Inventory & Stock (S-03 & S-08)" />

      {/* 2. Control Panel Header Odoo */}
      <ControlPanel
        breadcrumbs={[
          { label: 'Home', href: '/' },
          { label: 'Inventory', href: '/inventory' },
          { label: `Produk ${currentProduct.sku} - ${currentProduct.name}` },
        ]}
        searchPlaceholder="Cari SKU (P001–P016) atau nama produk..."
        pagerText={`SKU 1-${products.length} / ${products.length}`}
        availableViews={['list', 'kanban']}
        currentView="list"
      >
        <div className="flex items-center gap-1.5 text-xs">
          <Link
            href="/inventory/product?location=ALL"
            className={`px-3 py-1 rounded-md font-semibold transition-colors ${
              filterLocation === 'ALL'
                ? 'bg-[#1E293B] text-[#CFFF30]'
                : 'bg-white border border-[#E2E8F0] text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            Semua Lokasi ({totalStockCompany} Unit)
          </Link>
          <Link
            href="/inventory/product?location=WH"
            className={`px-3 py-1 rounded-md font-semibold transition-colors ${
              filterLocation === 'WH'
                ? 'bg-[#1E293B] text-[#CFFF30]'
                : 'bg-white border border-[#E2E8F0] text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            WH Jakarta ({totalWhCompany} Unit)
          </Link>
          <Link
            href="/inventory/product?location=SHOP"
            className={`px-3 py-1 rounded-md font-semibold transition-colors ${
              filterLocation === 'SHOP'
                ? 'bg-[#1E293B] text-[#CFFF30]'
                : 'bg-white border border-[#E2E8F0] text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            SHOP Depok ({totalShopCompany} Unit)
          </Link>
        </div>
      </ControlPanel>

      {/* 3. Main Workspace: S-03 Product Form & S-08 Stock Overview */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-6 space-y-6">
        
        {/* S-03 PRODUCT FORM CARD DETAIL SHEET */}
        {currentProduct && (
          <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-xs overflow-hidden">
            {/* Status Bar Alur Produk */}
            <FormStatusBar
              stages={['Draft', 'Confirmed', 'Active In Stock']}
              currentStage="Active In Stock"
              actions={[
                { label: 'Update Biaya / HPP', variant: 'secondary' },
                { label: 'Transfer Antar Lokasi (WH ➔ SHOP)', variant: 'accent' },
                { label: 'Buat Reorder RFQ', variant: 'primary' },
              ]}
            />

            {/* Lembar Sheet Produk (S-03) */}
            <FormSheet
              title={`[${currentProduct.sku}] ${currentProduct.name}`}
              subtitle="Master Data SKU Produk (SR-06 & F-03)"
              ribbon={{ text: 'IN STOCK', variant: 'success' }}
              smartButtons={[
                {
                  label: 'Stok WH (Gudang)',
                  value: `${currentWhStock.qtyOnHand} Unit`,
                  icon: '🏭',
                  badge: currentWhStock.qtyOnHand > 0 ? 'Tersedia' : 'Kosong',
                },
                {
                  label: 'Stok SHOP (Gerai)',
                  value: `${currentShopStock.qtyOnHand} Unit`,
                  icon: '🏪',
                  badge: currentShopStock.qtyOnHand > 0 ? 'Tersedia' : 'Kosong',
                },
                {
                  label: 'Total Perusahaan',
                  value: `${currentWhStock.qtyOnHand + currentShopStock.qtyOnHand} Unit`,
                  icon: '📦',
                },
                {
                  label: 'Default Vendor',
                  value: currentProduct.defaultVendorId,
                  icon: '🤝',
                  href: `/contacts?contactId=${currentProduct.defaultVendorId}`,
                },
              ]}
            >
              {/* Metadata Grid Produk (S-03 Area 4 & 5) */}
              <div className="mt-4 p-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl">
                <h4 className="text-xs font-bold text-[#1E293B] uppercase tracking-wider mb-3 pb-1 border-b border-[#E2E8F0]">
                  [4] SKU, Nama, UoM &nbsp;|&nbsp; [5] Harga Jual, Biaya, Pajak (F-03)
                </h4>

                <FormFieldGroup columns={2}>
                  <FormField label="Nomor SKU">
                    <span className="font-mono font-bold text-sm bg-white px-2 py-0.5 rounded border border-[#E2E8F0] text-[#0F172A]">
                      {currentProduct.sku}
                    </span>
                  </FormField>

                  <FormField label="Satuan Ukur (UoM)">
                    <span className="font-semibold text-[#0F172A] bg-white px-2 py-0.5 rounded border border-[#E2E8F0]">
                      {currentProduct.uom}
                    </span>
                  </FormField>

                  <FormField label="Harga Jual Net (IDR)" required>
                    <span className="font-mono font-black text-sm text-[#0F172A]">
                      Rp {currentProduct.salesPrice.toLocaleString('id-ID')}
                    </span>
                  </FormField>

                  <FormField label="Harga Pokok / Cost (HPP)">
                    <span className="font-mono font-semibold text-xs text-[#64748B]">
                      Rp {currentProduct.cost.toLocaleString('id-ID')}
                    </span>
                  </FormField>

                  <FormField label="Kode Tarif Pajak">
                    <span className="font-mono font-bold text-xs bg-[#CFFF30]/40 text-[#0F172A] px-2 py-0.5 rounded border border-[#CFFF30]">
                      {currentProduct.taxCode} (Efektif 11%)
                    </span>
                  </FormField>

                  <FormField label="Pemasok Utama (Vendor)">
                    <span className="font-mono font-bold text-xs text-[#1E293B] bg-white px-2 py-0.5 rounded border border-[#E2E8F0]">
                      {currentProduct.defaultVendorId}
                    </span>
                  </FormField>
                </FormFieldGroup>
              </div>

              {/* Notebook S-08 Stock Overview & Movement */}
              <FormNotebook
                tabs={[
                  {
                    id: 'locations',
                    label: 'Ikhtisar Lokasi & Reservasi (S-08)',
                    badge: '2 Lokasi',
                    content: (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-[#F8FAFC] text-[#64748B] uppercase font-bold border-b border-[#E2E8F0]">
                            <tr>
                              <th className="px-3 py-2">Lokasi Gudang</th>
                              <th className="px-3 py-2">Tipe Lokasi</th>
                              <th className="px-3 py-2 text-center">Fisik On-Hand</th>
                              <th className="px-3 py-2 text-center">Tereservasi (Reserved)</th>
                              <th className="px-3 py-2 text-center font-bold text-[#0F172A]">Tersedia (Available)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#E2E8F0]">
                            <tr className="hover:bg-[#F8FAFC]">
                              <td className="px-3 py-2.5 font-bold text-[#0F172A]">
                                🏭 WH/JKT/Stock
                              </td>
                              <td className="px-3 py-2.5 text-[#64748B]">
                                Gudang Utama Jakarta Timur (B2B & Buffer)
                              </td>
                              <td className="px-3 py-2.5 text-center font-bold text-[#3B82F6]">
                                {currentWhStock.qtyOnHand}
                              </td>
                              <td className="px-3 py-2.5 text-center text-[#F59E0B]">
                                {currentWhStock.qtyReserved}
                              </td>
                              <td className="px-3 py-2.5 text-center font-black text-[#10B981] bg-[#10B981]/5">
                                {currentWhStock.qtyOnHand - currentWhStock.qtyReserved}
                              </td>
                            </tr>
                            <tr className="hover:bg-[#F8FAFC]">
                              <td className="px-3 py-2.5 font-bold text-[#0F172A]">
                                🏪 SHOP/DPK/Stock
                              </td>
                              <td className="px-3 py-2.5 text-[#64748B]">
                                Gerai Penjualan Depok (Point of Sale)
                              </td>
                              <td className="px-3 py-2.5 text-center font-bold text-[#3B82F6]">
                                {currentShopStock.qtyOnHand}
                              </td>
                              <td className="px-3 py-2.5 text-center text-[#F59E0B]">
                                {currentShopStock.qtyReserved}
                              </td>
                              <td className="px-3 py-2.5 text-center font-black text-[#10B981] bg-[#10B981]/5">
                                {currentShopStock.qtyOnHand - currentShopStock.qtyReserved}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    ),
                  },
                ]}
              />

              {/* Chatter Audit Log Produk (S-03 Area 7) */}
              <Chatter
                documentId={currentProduct.sku}
                documentType="Product Master"
                initialLogs={[
                  {
                    id: 'p1',
                    user: 'Doni Saputra (Kepala Gudang)',
                    role: 'Warehouse Lead',
                    action: 'Verifikasi stok fisik awal B0',
                    timestamp: 'Hari ini, 07:45',
                    message: `Stok awal diverifikasi: WH=${currentWhStock.qtyOnHand}, SHOP=${currentShopStock.qtyOnHand}. Kepatuhan aturan SR-02 ditegakkan.`,
                  },
                ]}
              />
            </FormSheet>
          </div>
        )}

        {/* S-08 STOCK OVERVIEW FULL TABLE */}
        <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-xs overflow-hidden">
          <div className="p-4 border-b border-[#E2E8F0] bg-[#F8FAFC] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-extrabold text-[#0F172A] text-sm">
                S-08 Stock Overview — Tabel Persediaan 16 SKU Produk (F-08 / SR-02)
              </h3>
              <p className="text-xs text-[#64748B] mt-0.5">
                On-hand vs Reserved vs Available di dua lokasi (WH/JKT/Stock & SHOP/DPK/Stock)
              </p>
            </div>
            <span className="text-xs font-mono font-bold bg-[#CFFF30] text-[#0F172A] px-3 py-1 rounded-md shadow-2xs">
              Total Unit Perusahaan: {totalStockCompany}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-[#64748B]">
              <thead className="bg-[#1E293B] text-white uppercase font-bold text-[11px] tracking-wider">
                <tr>
                  <th className="px-4 py-3">SKU</th>
                  <th className="px-4 py-3">Nama Produk</th>
                  <th className="px-4 py-3">Satuan</th>
                  <th className="px-4 py-3 text-right">Harga (IDR)</th>
                  <th className="px-4 py-3 text-right">HPP (IDR)</th>
                  <th className="px-4 py-3 text-center">Vendor</th>
                  <th className="px-4 py-3 text-center bg-blue-900/60 text-blue-200">WH On-Hand</th>
                  <th className="px-4 py-3 text-center bg-emerald-900/60 text-emerald-200">SHOP On-Hand</th>
                  <th className="px-4 py-3 text-center bg-slate-900 text-[#CFFF30]">Total Stok</th>
                  <th className="px-4 py-3 text-center">Aksi Form</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {filteredProducts.map((p) => {
                  const wh = p.stocks.find((s) => s.locationId === 'WH')?.qtyOnHand || 0;
                  const shop = p.stocks.find((s) => s.locationId === 'SHOP')?.qtyOnHand || 0;
                  const total = wh + shop;
                  const isCurrent = p.sku === currentProduct?.sku;

                  return (
                    <tr
                      key={p.sku}
                      className={`hover:bg-[#F8FAFC] transition-colors ${
                        isCurrent ? 'bg-[#00F0FF]/10 font-medium' : ''
                      }`}
                    >
                      <td className="px-4 py-3 font-mono font-bold text-[#0F172A]">
                        {p.sku}
                      </td>
                      <td className="px-4 py-3 font-semibold text-[#0F172A]">
                        {p.name}
                      </td>
                      <td className="px-4 py-3 text-[#64748B]">{p.uom}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-[#0F172A]">
                        Rp {p.salesPrice.toLocaleString('id-ID')}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-[#64748B]">
                        Rp {p.cost.toLocaleString('id-ID')}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="font-mono text-[10px] bg-[#F8FAFC] border border-[#E2E8F0] px-1.5 py-0.5 rounded font-bold">
                          {p.defaultVendorId}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center font-bold text-[#3B82F6] bg-blue-50/40 font-mono">
                        {wh}
                      </td>
                      <td className="px-4 py-3 text-center font-bold text-[#10B981] bg-emerald-50/40 font-mono">
                        {shop}
                      </td>
                      <td className="px-4 py-3 text-center font-black text-[#0F172A] bg-slate-100 font-mono">
                        {total}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Link
                          href={`/inventory/product?sku=${p.sku}`}
                          className={`text-[11px] font-bold px-2.5 py-1 rounded transition-colors ${
                            isCurrent
                              ? 'bg-[#1E293B] text-[#CFFF30]'
                              : 'bg-white border border-[#E2E8F0] text-[#64748B] hover:text-[#0F172A]'
                          }`}
                        >
                          Buka Form S-03 ➔
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
RR_EOF
echo "  ✓ app/inventory/product/page.tsx"
mkdir -p "app/inventory/receipt/[id]"
cat > "app/inventory/receipt/[id]/page.tsx" <<'RR_EOF'
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { AppNavbar, ControlPanel, FormStatusBar, FormSheet, FormField, FormFieldGroup } from '@/components/odoo';
import ActionButton from '@/components/erp/ActionButton';
import { validateReceiptAction } from '@/app/actions/erp';
import { StatusPill, fmtDate } from '@/components/erp/ui';

export const revalidate = 0;

export default async function ReceiptDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await prisma.receipt.findUnique({
    where: { id },
    include: { purchaseOrder: { include: { vendor: true } }, lines: { include: { product: { include: { stocks: true } } } } },
  });
  if (!r) notFound();

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans">
      <AppNavbar currentModule="Receipt (S-10)" />
      <ControlPanel
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Inventory', href: '/inventory?tab=receipt' }, { label: r.docNumber }]}
        availableViews={['form']}
        currentView="form"
      />
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-6">
        <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-xs overflow-hidden">
          <FormStatusBar stages={['Ready', 'Done']} currentStage={r.status === 'Done' ? 'Done' : 'Ready'} actions={[]}>
            {r.status !== 'Done' && <ActionButton action={validateReceiptAction.bind(null, r.id)} label="✓ Validate" confirmText={`Validasi ${r.docNumber}? Stok WH akan bertambah.`} />}
          </FormStatusBar>
          <FormSheet
            title={`Receipt ${r.docNumber}`}
            subtitle="Penerimaan barang dari vendor ke WH"
            ribbon={{ text: r.status.toUpperCase(), variant: r.status === 'Done' ? 'success' : 'warning' }}
            smartButtons={[{ label: 'Purchase Order', value: r.purchaseOrder.docNumber, icon: '🛒', href: `/purchase/${r.purchaseOrderId}` }]}
          >
            <FormFieldGroup columns={2}>
              <FormField label="Vendor"><span className="font-bold">{r.purchaseOrder.vendor.name}</span></FormField>
              <FormField label="Tanggal"><span>{fmtDate(r.createdAt)}</span></FormField>
              <FormField label="Status"><StatusPill status={r.status} /></FormField>
              <FormField label="Lokasi Tujuan"><span className="font-mono">WH/JKT/Stock</span></FormField>
            </FormFieldGroup>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8FAFC] text-[#64748B] uppercase font-bold border-b border-[#E2E8F0]">
                  <tr>
                    <th className="px-3 py-2.5">Produk</th>
                    <th className="px-3 py-2.5 text-center">Qty Masuk</th>
                    <th className="px-3 py-2.5 text-center">Stok WH On-hand</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {r.lines.map((l) => {
                    const wh = l.product.stocks.find((s) => s.locationId === 'WH');
                    return (
                      <tr key={l.id}>
                        <td className="px-3 py-2.5 font-bold">{l.product.name} <span className="font-mono text-[10px] text-[#64748B]">{l.sku}</span></td>
                        <td className="px-3 py-2.5 text-center font-mono font-bold">{l.qtyDone}</td>
                        <td className="px-3 py-2.5 text-center font-mono">{wh?.qtyOnHand ?? 0}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-4 text-xs"><Link href="/inventory?tab=receipt" className="font-bold text-[#1E293B] hover:underline">← Kembali ke daftar Receipt</Link></div>
          </FormSheet>
        </div>
      </main>
    </div>
  );
}
RR_EOF
echo "  ✓ app/inventory/receipt/[id]/page.tsx"
mkdir -p "app/invoicing"
cat > "app/invoicing/page.tsx" <<'RR_EOF'
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import ActionButton from '@/components/erp/ActionButton';
import {
  createInvoiceAction,
  createBillAction,
  registerInvoicePaymentAction,
  registerBillPaymentAction,
} from '@/app/actions/erp';
import {
  AppNavbar,
  ControlPanel,
} from '@/components/odoo';

export const revalidate = 0;

export default async function InvoicingPage() {
  // Logika bisnis (faktur, tagihan, pembayaran + jurnal otomatis) ada di lib/erp.ts
  // dan dipanggil lewat server actions di app/actions/erp.ts

  // ==========================================
  // 2. FETCH DATA KEUANGAN & BUKU BESAR
  // ==========================================
  const salesOrders = await prisma.salesOrder.findMany({ where: { status: 'Confirmed' }, include: { customer: true } });
  const purchaseOrders = await prisma.purchaseOrder.findMany({ include: { vendor: true } });
  const invoices = await prisma.invoice.findMany({
    include: { customer: true },
    orderBy: { createdAt: 'desc' },
  });
  const vendorBills = await prisma.vendorBill.findMany({
    include: { vendor: true },
    orderBy: { createdAt: 'desc' },
  });

  const journals = await prisma.journalEntry.findMany({
    include: { lines: { include: { account: true } } },
    orderBy: { createdAt: 'desc' },
  });

  const totalInvoiced = invoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
  const totalBilled = vendorBills.reduce((sum, b) => sum + b.totalAmount, 0);

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans">
      {/* 1. App Navbar Odoo */}
      <AppNavbar currentModule="Invoicing & Accounting (S-11 s.d S-14)" />

      {/* 2. Control Panel Header */}
      <ControlPanel
        breadcrumbs={[
          { label: 'Home', href: '/' },
          { label: 'Invoicing & Bills', href: '/invoicing' },
          { label: 'Accounting Workspace' },
        ]}
        searchPlaceholder="Cari nomor faktur (INV-SO00031), tagihan, atau jurnal..."
        pagerText={`Faktur: ${invoices.length} | Tagihan: ${vendorBills.length} | Jurnal: ${journals.length}`}
        availableViews={['list', 'form']}
        currentView="list"
      >
        <div className="flex items-center gap-3">
          <Link
            href="/accounting"
            className="px-3 py-1 bg-[#1E293B] text-[#00F0FF] hover:bg-slate-800 rounded-md text-xs font-bold transition-colors flex items-center gap-1.5"
          >
            <span>⚖️</span>
            <span>General Ledger & COA (S-14)</span>
          </Link>
        </div>
      </ControlPanel>

      {/* 3. Main Workspace Grid */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-6 space-y-8">
        
        {/* KPI Ringkasan Piutang & Hutang */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-2xs">
            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">
              Total Piutang Faktur Terbit (INV)
            </span>
            <div className="text-xl font-mono font-black text-[#0F172A] mt-1">
              Rp {totalInvoiced.toLocaleString('id-ID')}
            </div>
            <span className="text-[11px] text-[#3B82F6] font-semibold mt-1 block">
              {invoices.length} Faktur Posted (Debit 1100)
            </span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-2xs">
            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">
              Total Hutang Vendor Terbit (BILL)
            </span>
            <div className="text-xl font-mono font-black text-[#0F172A] mt-1">
              Rp {totalBilled.toLocaleString('id-ID')}
            </div>
            <span className="text-[11px] text-[#F59E0B] font-semibold mt-1 block">
              {vendorBills.length} Tagihan Posted (Kredit 2000)
            </span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-2xs">
            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">
              Entri Jurnal Berpasangan (S-14)
            </span>
            <div className="text-xl font-mono font-black text-[#10B981] mt-1">
              {journals.length} Dokumen
            </div>
            <span className="text-[11px] text-[#10B981] font-semibold mt-1 block">
              ✓ Keseimbangan Saldo: Debit == Kredit
            </span>
          </div>
        </div>

        {/* 2 Kolom: S-11 Customer Invoices & S-12 Vendor Bills */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* ======================================================== */}
          {/* S-11: CUSTOMER INVOICES (PIUTANG DAGANG)                */}
          {/* ======================================================== */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-xs overflow-hidden flex flex-col">
            <div className="p-4 border-b border-[#E2E8F0] bg-[#1E293B] text-white flex justify-between items-center">
              <div>
                <h2 className="font-extrabold text-sm text-[#00F0FF]">
                  S-11 Customer Invoices (Faktur B2B)
                </h2>
                <span className="text-xs text-slate-300">
                  Tagihan berbasis bukti terkirim (SR-04 / F-11)
                </span>
              </div>
              <span className="text-xs font-mono font-bold bg-[#3B82F6] px-2.5 py-0.5 rounded text-white">
                Akun: 1100 Trade Receivables
              </span>
            </div>

            <div className="p-5 space-y-4 flex-1">
              <div className="border border-[#E2E8F0] rounded-xl p-3 bg-[#F8FAFC]">
                <h3 className="font-bold text-[#0F172A] text-xs uppercase tracking-wider mb-2">
                  Antrean Penagihan Sales Order (To Invoice)
                </h3>

                {salesOrders.length === 0 ? (
                  <p className="text-xs text-[#64748B] italic py-2">
                    Belum ada Sales Order untuk ditagihkan.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {salesOrders.map((so) => {
                      const isBilled = invoices.some(
                        (inv) =>
                          inv.salesOrderId === so.id ||
                          inv.docNumber === 'INV-' + so.docNumber.replace(/\D/g, '')
                      );

                      return (
                        <div
                          key={so.id}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-lg border border-[#E2E8F0] shadow-2xs"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-xs text-[#0F172A]">
                                {so.docNumber}
                              </span>
                              <span className="text-[10px] bg-[#F8FAFC] text-[#64748B] px-1.5 py-0.5 rounded border border-[#E2E8F0]">
                                {so.customer.name}
                              </span>
                            </div>
                            <span className="font-mono font-extrabold text-xs text-[#10B981] mt-1 block">
                              Rp {so.totalAmount.toLocaleString('id-ID')}
                            </span>
                          </div>

                          {isBilled ? (
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-[#10B981] bg-[#10B981]/15 border border-[#10B981]/30 px-3 py-1.5 rounded-md">
                                ✓ Faktur Terbit (INV)
                              </span>
                            </div>
                          ) : (
                            <ActionButton action={createInvoiceAction.bind(null, so.id)} label="📄 Terbitkan Faktur" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Daftar Faktur Terbit */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-[#64748B] uppercase tracking-wider">
                  Faktur Berstatus Posted ({invoices.length})
                </h4>
                {invoices.map((inv) => (
                  <div
                    key={inv.id}
                    className="p-3 bg-[#F8FAFC] rounded-lg border border-[#E2E8F0] flex justify-between items-center text-xs"
                  >
                    <div>
                      <span className="font-mono font-bold text-[#0F172A] block">
                        {inv.docNumber}
                      </span>
                      <span className="text-[11px] text-[#64748B]">
                        Pelanggan: {inv.customer.name}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="font-mono font-bold text-[#0F172A] block">
                        Rp {inv.totalAmount.toLocaleString('id-ID')}
                      </span>
                      {inv.status === 'Paid' ? (
                        <span className="text-[10px] font-bold text-white bg-[#10B981] px-2 py-0.5 rounded">PAID</span>
                      ) : (
                        <div className="flex items-center justify-end gap-1.5 mt-1">
                          <span className="text-[10px] font-bold text-[#3B82F6] bg-[#3B82F6]/15 px-2 py-0.5 rounded">POSTED</span>
                          <ActionButton action={registerInvoicePaymentAction.bind(null, inv.id)} label="💰 Register Payment" className="bg-[#CFFF30] text-[#0F172A] font-extrabold text-[10px] px-2.5 py-1 rounded-md disabled:opacity-50" />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ======================================================== */}
          {/* S-12: VENDOR BILLS (HUTANG USAHA)                        */}
          {/* ======================================================== */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-xs overflow-hidden flex flex-col">
            <div className="p-4 border-b border-[#E2E8F0] bg-[#1E293B] text-white flex justify-between items-center">
              <div>
                <h2 className="font-extrabold text-sm text-[#CFFF30]">
                  S-12 Vendor Bills (Tagihan Pembelian)
                </h2>
                <span className="text-xs text-slate-300">
                  Pencocokan 3-Arah PO/Receipt/Bill (SR-09 / F-12)
                </span>
              </div>
              <span className="text-xs font-mono font-bold bg-[#F59E0B] px-2.5 py-0.5 rounded text-white">
                Akun: 2000 Trade Payables
              </span>
            </div>

            <div className="p-5 space-y-4 flex-1">
              <div className="border border-[#E2E8F0] rounded-xl p-3 bg-[#F8FAFC]">
                <h3 className="font-bold text-[#0F172A] text-xs uppercase tracking-wider mb-2">
                  Antrean Tagihan Vendor dari Penerimaan Gudang (To Bill)
                </h3>

                {purchaseOrders.filter((po) => po.status === 'Received').length === 0 ? (
                  <p className="text-xs text-[#64748B] italic py-2">
                    Belum ada barang masuk gudang yang siap dibill. Terima barang di modul Purchase dahulu!
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {purchaseOrders
                      .filter((po) => po.status === 'Received')
                      .map((po) => {
                        const isBilled = vendorBills.some(
                          (bill) =>
                            bill.purchaseOrderId === po.id ||
                            bill.docNumber === 'BILL-' + po.docNumber.replace(/\D/g, '')
                        );

                        return (
                          <div
                            key={po.id}
                            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-lg border border-[#E2E8F0] shadow-2xs"
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-xs text-[#0F172A]">
                                  {po.docNumber}
                                </span>
                                <span className="text-[10px] bg-[#F8FAFC] text-[#64748B] px-1.5 py-0.5 rounded border border-[#E2E8F0]">
                                  {po.vendor.name}
                                </span>
                              </div>
                              <span className="font-mono font-extrabold text-xs text-[#F59E0B] mt-1 block">
                                Rp {po.totalAmount.toLocaleString('id-ID')}
                              </span>
                            </div>

                            {isBilled ? (
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-bold text-[#10B981] bg-[#10B981]/15 border border-[#10B981]/30 px-3 py-1.5 rounded-md">
                                  ✓ Tagihan Terbit (BILL)
                                </span>
                              </div>
                            ) : (
                              <ActionButton action={createBillAction.bind(null, po.id)} label="📝 Terbitkan Tagihan (Bill)" />
                            )}
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>

              {/* Daftar Vendor Bills Terbit */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-[#64748B] uppercase tracking-wider">
                  Tagihan Vendor Berstatus Posted ({vendorBills.length})
                </h4>
                {vendorBills.map((b) => (
                  <div
                    key={b.id}
                    className="p-3 bg-[#F8FAFC] rounded-lg border border-[#E2E8F0] flex justify-between items-center text-xs"
                  >
                    <div>
                      <span className="font-mono font-bold text-[#0F172A] block">
                        {b.docNumber}
                      </span>
                      <span className="text-[11px] text-[#64748B]">
                        Vendor: {b.vendor.name}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="font-mono font-bold text-[#0F172A] block">
                        Rp {b.totalAmount.toLocaleString('id-ID')}
                      </span>
                      {b.status === 'Paid' ? (
                        <span className="text-[10px] font-bold text-white bg-[#10B981] px-2 py-0.5 rounded">PAID</span>
                      ) : (
                        <div className="flex items-center justify-end gap-1.5 mt-1">
                          <span className="text-[10px] font-bold text-[#3B82F6] bg-[#3B82F6]/15 px-2 py-0.5 rounded">POSTED</span>
                          <ActionButton action={registerBillPaymentAction.bind(null, b.id)} label="💰 Register Payment" className="bg-[#CFFF30] text-[#0F172A] font-extrabold text-[10px] px-2.5 py-1 rounded-md disabled:opacity-50" />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* S-14: GENERAL LEDGER / DOUBLE-ENTRY JOURNAL ENTRIES      */}
        {/* ======================================================== */}
        <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-xs overflow-hidden">
          <div className="p-4 border-b border-[#E2E8F0] bg-[#1E293B] text-white flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="font-extrabold text-sm text-[#CFFF30]">
                S-14 Journal Entries / General Ledger (F-14 / SR-11)
              </h2>
              <span className="text-xs text-slate-300">
                Pencatatan Berpasangan Otomatis: Total Saldo Debit == Total Saldo Kredit
              </span>
            </div>
            <span className="text-xs font-mono font-bold bg-[#10B981] text-white px-3 py-1 rounded-md self-start sm:self-auto">
              Debit == Kredit: BALANCED
            </span>
          </div>

          <div className="p-5">
            {journals.length === 0 ? (
              <div className="p-8 text-center text-[#64748B] space-y-2">
                <span className="text-3xl">⚖️</span>
                <p className="text-xs">
                  Belum ada jurnal transaksi. Terbitkan Faktur Pelanggan atau Tagihan Vendor di atas untuk memicu auto-journaling!
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {journals.map((journal) => {
                  const totalDebit = journal.lines.reduce((s, l) => s + l.debit, 0);
                  const totalCredit = journal.lines.reduce((s, l) => s + l.credit, 0);
                  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

                  return (
                    <div
                      key={journal.id}
                      className="border border-[#E2E8F0] rounded-xl overflow-hidden shadow-2xs"
                    >
                      {/* Header Jurnal Entry */}
                      <div className="bg-[#F8FAFC] px-4 py-3 border-b border-[#E2E8F0] flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-sm bg-white px-2 py-0.5 rounded border border-[#E2E8F0] text-[#0F172A]">
                            {journal.docNumber}
                          </span>
                          <span className="text-[#64748B] font-medium">
                            {journal.description}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-[#64748B]">
                            {new Date(journal.date).toLocaleDateString('id-ID', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </span>
                          <span
                            className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded ${
                              isBalanced
                                ? 'bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30'
                                : 'bg-[#EF4444]/15 text-[#EF4444]'
                            }`}
                          >
                            {isBalanced ? '✓ Balanced' : 'Unbalanced'}
                          </span>
                        </div>
                      </div>

                      {/* Tabel Baris Jurnal Debit/Kredit */}
                      <table className="w-full text-xs text-left">
                        <thead className="bg-[#FFFFFF] text-[#64748B] border-b border-[#E2E8F0] uppercase font-bold text-[10px]">
                          <tr>
                            <th className="px-4 py-2.5 w-1/2">Akun COA</th>
                            <th className="px-4 py-2.5 text-right">Debit (Rp)</th>
                            <th className="px-4 py-2.5 text-right">Kredit (Rp)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E2E8F0]">
                          {journal.lines.map((line) => (
                            <tr key={line.id} className="hover:bg-[#F8FAFC]">
                              <td className="px-4 py-2 text-[#0F172A]">
                                <span className="font-mono font-bold bg-[#F8FAFC] border border-[#E2E8F0] px-1.5 py-0.5 rounded text-[11px] mr-2">
                                  {line.accountCode}
                                </span>
                                <span className="font-medium">{line.account.name}</span>
                              </td>
                              <td className="px-4 py-2 text-right font-mono font-semibold text-[#0F172A]">
                                {line.debit > 0 ? line.debit.toLocaleString('id-ID') : '-'}
                              </td>
                              <td className="px-4 py-2 text-right font-mono font-semibold text-[#0F172A]">
                                {line.credit > 0 ? line.credit.toLocaleString('id-ID') : '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-[#F8FAFC] border-t border-[#E2E8F0] font-black text-xs">
                          <tr>
                            <td className="px-4 py-2 text-[#0F172A] uppercase">Total Keseimbangan:</td>
                            <td className="px-4 py-2 text-right font-mono text-[#0F172A]">
                              Rp {totalDebit.toLocaleString('id-ID')}
                            </td>
                            <td className="px-4 py-2 text-right font-mono text-[#0F172A]">
                              Rp {totalCredit.toLocaleString('id-ID')}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
RR_EOF
echo "  ✓ app/invoicing/page.tsx"
mkdir -p "app"
cat > "app/layout.tsx" <<'RR_EOF'
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ToastHost from "@/components/erp/Toast";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "RupaRuang ERP - PT RupaRuang Niaga",
  description: "Sistem ERP Retail berbasis Odoo Web 17.0 untuk PT RupaRuang Niaga",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        {/* Inline script to apply dark mode before first paint (prevents flash) */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var t = localStorage.getItem('rr_theme');
                if (t === 'dark') {
                  document.documentElement.classList.add('dark');
                }
              } catch(e) {}
            `,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <ToastHost />
      </body>
    </html>
  );
}
RR_EOF
echo "  ✓ app/layout.tsx"
mkdir -p "app"
cat > "app/page.tsx" <<'RR_EOF'
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { showToast } from '@/components/erp/Toast';
import { AppNavbar, ControlPanel } from '@/components/odoo';

interface UserSession {
  userId: string;
  email: string;
  name: string;
  role: string;
  access: string[];
}

export default function HomePage() {
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('ALL');
  const [session, setSession] = useState<UserSession | null>(null);

  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setSession(data);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  // Toast merah "Akses Ditolak" saat user di-redirect dari halaman terlarang
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const denied = params.get('denied');
    if (denied) {
      showToast('error', `Akses Ditolak: Anda tidak memiliki izin membuka modul "${denied}".`);
      window.history.replaceState(null, '', '/');
    }
  }, []);

  const canSee = (id: string) =>
    !!session && (session.role === 'SUPERADMIN' || session.role === 'OWNER' || session.access.includes(id));

  const isSuperOrOwner = session?.role === 'SUPERADMIN' || session?.role === 'OWNER';

  const baseApps = [
    {
      id: 'contacts',
      wireframe: 'S-02',
      title: 'Master Contacts',
      desc: 'Kartu Pelanggan C01–C06 & Vendor V01–V04, Limit Kredit & Termin',
      href: '/contacts',
      icon: '👥',
      color: 'bg-[#3B82F6] text-white',
      roles: ['Owner', 'Sales', 'Finance'],
      badge: 'Master Data',
    },
    {
      id: 'crm',
      wireframe: 'S-04',
      title: 'CRM Pipeline',
      desc: 'Papan Kanban Prospek 4 Tahap (New, Qualified, Proposition, Won)',
      href: '/crm',
      icon: '🎯',
      color: 'bg-[#8B5CF6] text-white',
      roles: ['Owner', 'Sales'],
      badge: 'Leads & Opps',
    },
    {
      id: 'sales',
      wireframe: 'S-05 & S-06',
      title: 'Sales & Quotations',
      desc: 'Quotation, Konfirmasi SO, Reservasi Stok & Cek Limit Kredit',
      href: '/sales',
      icon: '💼',
      color: 'bg-[#1E293B] text-[#CFFF30]',
      roles: ['Owner', 'Sales', 'Finance'],
      badge: 'Order-to-Cash',
    },
    {
      id: 'inventory',
      wireframe: 'S-03, S-07 & S-08',
      title: 'Inventory & Stocks',
      desc: '16 SKU Produk (P001–P016), Stok WH & SHOP (On-hand, Reserved, Available)',
      href: '/inventory',
      icon: '📦',
      color: 'bg-[#F59E0B] text-white',
      roles: ['Warehouse', 'Purchasing', 'Owner'],
      badge: 'Multi-Warehouse',
    },
    {
      id: 'purchase',
      wireframe: 'S-09 & S-10',
      title: 'Purchase & Receipts',
      desc: 'RFQ/PO ke Vendor, Pengadaan Barang & Penerimaan Gudang WH',
      href: '/purchase',
      icon: '🛒',
      color: 'bg-[#10B981] text-white',
      roles: ['Purchasing', 'Finance', 'Warehouse'],
      badge: 'Procure-to-Pay',
    },
    {
      id: 'invoicing',
      wireframe: 'S-11, S-12 & S-13',
      title: 'Invoicing & Bills',
      desc: 'Faktur Pelanggan B2B, Tagihan Vendor 3-Way Match & Registrasi Pembayaran',
      href: '/invoicing',
      icon: '📑',
      color: 'bg-[#00F0FF] text-[#0F172A]',
      roles: ['Finance', 'Sales', 'Purchasing'],
      badge: 'Accounting',
    },
    {
      id: 'accounting',
      wireframe: 'S-14',
      title: 'Accounting & Ledger',
      desc: 'Buku Besar Jurnal Berpasangan (Debit == Kredit) & Chart of Accounts',
      href: '/accounting',
      icon: '⚖️',
      color: 'bg-[#1E293B] text-[#00F0FF]',
      roles: ['Finance', 'Owner'],
      badge: 'General Ledger',
    },
    {
      id: 'pos',
      wireframe: 'S-15 & S-16',
      title: 'Point of Sale (POS)',
      desc: 'Mesin Kasir Gerai Depok, Struk Real-time & Rekonsiliasi Tutup Sesi Shift',
      href: '/pos',
      icon: '🏪',
      color: 'bg-[#EF4444] text-white',
      roles: ['Cashier', 'Owner', 'Finance'],
      badge: 'Retail Kasir',
    },
    {
      id: 'dashboard',
      wireframe: 'S-17',
      title: 'Management Dashboard',
      desc: 'Executive KPI Ringkasan Omzet, Nilai Persediaan & Filter Tanggal',
      href: '/dashboard',
      icon: '📊',
      color: 'bg-[#CFFF30] text-[#0F172A]',
      roles: ['Owner', 'Finance', 'Purchasing'],
      badge: 'Executive KPI',
    },
  ];

  // Injeksi Panel Super Admin untuk SUPERADMIN atau OWNER
  const adminApp = {
    id: 'admin',
    wireframe: 'ADM-01',
    title: 'Panel Super Admin',
    desc: 'Kelola Pengguna, Hak Akses 9 Modul, Status Aktif & Reset Password',
    href: '/admin/users',
    icon: '⚙️',
    color: 'bg-purple-600 text-white',
    roles: ['Superadmin', 'Owner'],
    badge: 'Administrasi',
  };

  // RBAC: hanya tampilkan modul yang boleh diakses user (Owner/Superadmin: semua)
  const visibleBase = baseApps.filter((app) => canSee(app.id));
  const apps = isSuperOrOwner ? [adminApp, ...visibleBase] : visibleBase;

  const filteredApps = apps.filter((app) => {
    const matchesSearch =
      search === '' ||
      app.title.toLowerCase().includes(search.toLowerCase()) ||
      app.desc.toLowerCase().includes(search.toLowerCase()) ||
      app.wireframe.toLowerCase().includes(search.toLowerCase());

    const matchesRole =
      filterRole === 'ALL' ||
      app.roles.map((r) => r.toLowerCase()).includes(filterRole.toLowerCase());

    return matchesSearch && matchesRole;
  });

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans">
      {/* 1. Odoo 17 Top Navbar */}
      <AppNavbar currentModule="Home / App Switcher" />

      {/* 2. Control Panel Header */}
      <ControlPanel
        breadcrumbs={[{ label: 'Home' }, { label: 'App Switcher (S-01)' }]}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Cari modul atau no wireframe (misal: S-04, Sales, Admin)..."
        onFilterClick={() => setFilterRole(filterRole === 'ALL' ? 'Sales' : 'ALL')}
        onGroupByClick={() => setFilterRole(filterRole === 'ALL' ? 'Finance' : 'ALL')}
        activeFilter={filterRole !== 'ALL' ? filterRole : undefined}
      >
        {/* Role Quick Filter Pills */}
        {isSuperOrOwner && (
        <div className="flex items-center gap-1 overflow-x-auto text-xs py-0.5">
          <span className="text-[11px] font-bold text-[#64748B] mr-1">Akses Role:</span>
          {['ALL', 'Owner', 'Sales', 'Warehouse', 'Finance', 'Purchasing', 'Cashier', ...(isSuperOrOwner ? ['Superadmin'] : [])].map((role) => (
            <button
              key={role}
              type="button"
              onClick={() => setFilterRole(role)}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${
                filterRole === role
                  ? 'bg-[#1E293B] text-[#CFFF30] shadow-xs'
                  : 'bg-[#FFFFFF] border border-[#E2E8F0] text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC]'
              }`}
            >
              {role}
            </button>
          ))}
        </div>
        )}
      </ControlPanel>

      {/* 3. Main Workspace Grid */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-6 md:p-8 space-y-6">
        {/* Banner Odoo System Header */}
        <div className="bg-[#FFFFFF] rounded-2xl border border-[#E2E8F0] p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#10B981]" />
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#64748B]">
                PT RupaRuang Niaga · Jakarta & Depok
              </span>
            </div>
            <h1 className="text-2xl font-black text-[#0F172A] tracking-tight">
              S-01 Home / App Switcher (Odoo Web 17.0)
            </h1>
            <p className="text-xs text-[#64748B]">
              Aplikasi Ritel Perlengkapan Rumah Tangga & Kebutuhan Harian Terintegrasi (Wireframe S-01 s.d S-17)
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {isSuperOrOwner && (
              <Link
                href="/admin/users"
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-3.5 py-2.5 rounded-xl text-xs transition-all shadow-xs flex items-center gap-1.5"
              >
                <span>⚙️</span>
                <span>Panel Super Admin</span>
              </Link>
            )}
            {canSee('pos') && (
              <Link
                href="/pos"
                className="bg-[#CFFF30] hover:brightness-95 text-[#0F172A] font-extrabold px-4 py-2.5 rounded-xl text-xs transition-all shadow-xs flex items-center gap-1.5"
              >
                <span>🏪</span>
                <span>Buka POS Gerai</span>
              </Link>
            )}
          </div>
        </div>

        {/* 4. App Grid ala Odoo Launcher */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredApps.map((app) => (
            <Link
              key={app.id}
              href={app.href}
              className="bg-[#FFFFFF] rounded-xl border border-[#E2E8F0] p-5 shadow-xs hover:border-[#00F0FF] hover:shadow-md transition-all flex flex-col justify-between group relative overflow-hidden"
            >
              {/* Highlight bar top */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-[#E2E8F0] group-hover:bg-[#CFFF30] transition-colors" />

              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl shadow-xs group-hover:scale-105 transition-transform ${app.color}`}
                  >
                    {app.icon}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-[10px] font-mono font-bold text-[#1E293B] bg-[#CFFF30]/40 px-2 py-0.5 rounded border border-[#CFFF30]">
                      {app.wireframe}
                    </span>
                    <span className="text-[10px] text-[#64748B] bg-[#F8FAFC] px-1.5 py-0.5 rounded border border-[#E2E8F0]">
                      {app.badge}
                    </span>
                  </div>
                </div>

                <h2 className="font-extrabold text-[#0F172A] text-base group-hover:text-[#1E293B] transition-colors">
                  {app.title}
                </h2>
                <p className="text-xs text-[#64748B] mt-1.5 leading-relaxed">
                  {app.desc}
                </p>
              </div>

              <div className="mt-5 pt-3 border-t border-[#E2E8F0] flex items-center justify-between text-xs">
                <div className="flex items-center gap-1 text-[10px] text-[#64748B]">
                  <span>Akses:</span>
                  <span className="font-medium text-[#0F172A] truncate max-w-[140px]">
                    {app.roles.join(', ')}
                  </span>
                </div>
                <span className="font-bold text-[#1E293B] group-hover:translate-x-1 transition-transform flex items-center gap-1 text-xs">
                  <span>Buka</span>
                  <span className="text-[#00F0FF]">➔</span>
                </span>
              </div>
            </Link>
          ))}
        </div>

        {!loaded && (
          <div className="text-center text-xs text-[#64748B] py-10">Memuat modul sesuai hak akses...</div>
        )}

        {loaded && filteredApps.length === 0 && (
          <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl p-12 text-center space-y-2">
            <span className="text-3xl">🔍</span>
            <h3 className="font-bold text-[#0F172A] text-sm">Tidak Ada Modul Ditemukan</h3>
            <p className="text-xs text-[#64748B]">
              Coba sesuaikan kata kunci pencarian atau reset filter role Anda.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setFilterRole('ALL');
              }}
              className="mt-2 px-3 py-1.5 bg-[#1E293B] text-white font-bold text-xs rounded-lg"
            >
              Reset Filter
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
RR_EOF
echo "  ✓ app/page.tsx"
mkdir -p "app/pos/close"
cat > "app/pos/close/page.tsx" <<'RR_EOF'
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { AppNavbar, ControlPanel } from '@/components/odoo';
import CloseSessionForm from '@/components/erp/CloseSessionForm';
import { ListTable, rp } from '@/components/erp/ui';

export const revalidate = 0;

export default async function ClosePosPage() {
  const session = await prisma.pOSSession.findFirst({
    where: { status: 'Open' },
    include: { orders: { include: { lines: { include: { product: true } } } } },
  });

  const sold = new Map<string, { name: string; qty: number; total: number }>();
  for (const o of session?.orders ?? []) {
    for (const l of o.lines) {
      const cur = sold.get(l.sku) ?? { name: l.product.name, qty: 0, total: 0 };
      cur.qty += l.qty;
      cur.total += l.subtotal;
      sold.set(l.sku, cur);
    }
  }
  const sales = session?.orders.reduce((s, o) => s + o.totalAmount, 0) ?? 0;
  const expected = (session?.startBalance ?? 0) + sales;

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans">
      <AppNavbar currentModule="Tutup Sesi POS (S-16)" />
      <ControlPanel
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Point of Sale', href: '/pos' }, { label: 'Tutup Sesi' }]}
        availableViews={['form']}
        currentView="form"
      />
      <main className="flex-1 max-w-4xl mx-auto w-full p-4 md:p-6 space-y-5">
        {!session ? (
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-10 text-center text-xs text-[#64748B] space-y-2">
            <p>Tidak ada sesi POS yang sedang terbuka.</p>
            <Link href="/pos" className="font-bold text-[#1E293B] hover:underline">← Kembali ke kasir</Link>
          </div>
        ) : (
          <>
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 space-y-1 text-xs">
              <h2 className="font-black text-base text-[#0F172A]">Sesi {session.sessionNumber}</h2>
              <div>Kasir: <strong>{session.cashierName}</strong> · Kas awal: <strong>{rp(session.startBalance)}</strong></div>
              <div>Jumlah transaksi: <strong>{session.orders.length}</strong> · Penjualan tunai: <strong>{rp(sales)}</strong></div>
              <div>Kas seharusnya (Expected): <strong className="font-mono">{rp(expected)}</strong></div>
            </div>

            <ListTable headers={[{ label: 'SKU' }, { label: 'Produk' }, { label: 'Terjual', right: true }, { label: 'Nilai', right: true }]} empty="Belum ada barang terjual di sesi ini.">
              {Array.from(sold, ([sku, v]) => (
                <tr key={sku}>
                  <td className="px-4 py-3 font-mono font-bold">{sku}</td>
                  <td className="px-4 py-3">{v.name}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold">{v.qty}</td>
                  <td className="px-4 py-3 text-right font-mono">{rp(v.total)}</td>
                </tr>
              ))}
            </ListTable>

            <div className="bg-white border border-[#E2E8F0] rounded-xl p-5">
              <CloseSessionForm sessionId={session.id} expected={expected} />
            </div>
          </>
        )}
      </main>
    </div>
  );
}
RR_EOF
echo "  ✓ app/pos/close/page.tsx"
mkdir -p "app/pos"
cat > "app/pos/page.tsx" <<'RR_EOF'
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { posAvailability } from '@/lib/erp';
import { AppNavbar, ControlPanel } from '@/components/odoo';
import PosTerminal from '@/components/erp/PosTerminal';
import { rp } from '@/components/erp/ui';

export const revalidate = 0;

export default async function POSPage() {
  const session = await prisma.pOSSession.findFirst({
    where: { status: 'Open' },
    include: { orders: true },
  });
  const [products, avail] = await Promise.all([
    prisma.product.findMany({ orderBy: { sku: 'asc' } }),
    posAvailability(),
  ]);
  const sales = session?.orders.reduce((s, o) => s + o.totalAmount, 0) ?? 0;

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans">
      <AppNavbar currentModule="Point of Sale (S-15 & S-16)" />
      <ControlPanel
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Point of Sale', href: '/pos' }, { label: 'Gerai Depok (SHOP) · Kasir' }]}
        pagerText={`Sesi: ${session?.sessionNumber ?? 'Belum dibuka'}`}
        availableViews={['kanban']}
        currentView="kanban"
      />
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-6 space-y-6">
        <div className="bg-[#1E293B] text-white p-4 rounded-2xl border border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-[#CFFF30]">{session?.sessionNumber ?? 'Belum ada sesi'}</span>
              <span className="text-[10px] bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/40 px-2 py-0.5 rounded font-bold">
                {session ? 'Status: Open' : 'Dibuka otomatis saat transaksi pertama'}
              </span>
            </div>
            <h2 className="text-base font-extrabold">SHOP/DPK/Stock — Gerai Penjualan Depok</h2>
            <span className="text-xs text-slate-400">
              Transaksi sesi ini: <strong>{session?.orders.length ?? 0}</strong> · Penjualan tunai: <strong>{rp(sales)}</strong>
            </span>
          </div>
          <Link href="/pos/close" className="bg-[#EF4444] hover:brightness-95 text-white font-extrabold text-xs px-4 py-2.5 rounded-lg text-center">
            Tutup Sesi (S-16) ➔
          </Link>
        </div>

        <PosTerminal products={products.map((p) => ({ sku: p.sku, name: p.name, price: p.salesPrice, avail: Math.max(0, avail[p.sku] ?? 0) }))} />
      </main>
    </div>
  );
}
RR_EOF
echo "  ✓ app/pos/page.tsx"
mkdir -p "app/purchase/[id]"
cat > "app/purchase/[id]/page.tsx" <<'RR_EOF'
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { AppNavbar, ControlPanel, FormStatusBar, FormSheet, FormField, FormFieldGroup } from '@/components/odoo';
import ActionButton from '@/components/erp/ActionButton';
import { confirmPurchaseOrderAction } from '@/app/actions/erp';
import { StatusPill, rp, fmtDate } from '@/components/erp/ui';

export const revalidate = 0;

export default async function PurchaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const po = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: { vendor: true, lines: { include: { product: true } }, receipts: true },
  });
  if (!po) notFound();

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans">
      <AppNavbar currentModule="Purchase Order (S-09)" />
      <ControlPanel
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Purchase', href: '/purchase' }, { label: po.docNumber }]}
        availableViews={['form']}
        currentView="form"
      />
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-6">
        <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-xs overflow-hidden">
          <FormStatusBar
            stages={['RFQ', 'Purchase Order', 'Received']}
            currentStage={po.status === 'Received' ? 'Received' : po.status === 'Confirmed' ? 'Purchase Order' : 'RFQ'}
            actions={[]}
          >
            {po.status === 'Draft' && <ActionButton action={confirmPurchaseOrderAction.bind(null, po.id)} label="✓ Confirm PO" />}
          </FormStatusBar>

          <FormSheet
            title={`Purchase Order ${po.docNumber}`}
            subtitle="S-09 RFQ / PO · Procure-to-Pay"
            ribbon={{ text: po.status.toUpperCase(), variant: po.status === 'Draft' ? 'warning' : 'success' }}
            smartButtons={po.receipts.map((r) => ({ label: 'Receipt', value: r.docNumber, icon: '📥', href: `/inventory/receipt/${r.id}` }))}
          >
            <FormFieldGroup columns={2}>
              <FormField label="Vendor"><span className="font-bold">{po.vendor.name} ({po.vendor.contactId})</span></FormField>
              <FormField label="Tanggal"><span>{fmtDate(po.createdAt)}</span></FormField>
              <FormField label="Status"><StatusPill status={po.status} /></FormField>
              <FormField label="Termin"><span className="font-mono">{po.vendor.paymentTerms}</span></FormField>
            </FormFieldGroup>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8FAFC] text-[#64748B] uppercase font-bold border-b border-[#E2E8F0]">
                  <tr>
                    <th className="px-3 py-2.5">Produk</th>
                    <th className="px-3 py-2.5 text-center">Dipesan</th>
                    <th className="px-3 py-2.5 text-center">Diterima</th>
                    <th className="px-3 py-2.5 text-right">Harga</th>
                    <th className="px-3 py-2.5 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {po.lines.map((l) => (
                    <tr key={l.id}>
                      <td className="px-3 py-2.5 font-bold">{l.product.name} <span className="font-mono text-[10px] text-[#64748B]">{l.sku}</span></td>
                      <td className="px-3 py-2.5 text-center font-mono">{l.qtyOrdered}</td>
                      <td className="px-3 py-2.5 text-center font-mono">{l.qtyReceived}</td>
                      <td className="px-3 py-2.5 text-right font-mono">{rp(l.unitPrice)}</td>
                      <td className="px-3 py-2.5 text-right font-mono font-bold">{rp(l.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-4 pt-4 border-t border-[#E2E8F0] flex justify-end">
                <div className="w-72 space-y-1.5 text-xs">
                  <div className="flex justify-between"><span>Subtotal</span><span className="font-mono font-bold">{rp(po.subtotal)}</span></div>
                  <div className="flex justify-between"><span>PPN 11%</span><span className="font-mono font-bold">{rp(po.taxAmount)}</span></div>
                  <div className="flex justify-between pt-2 border-t border-[#E2E8F0] text-sm font-black"><span>TOTAL</span><span className="font-mono">{rp(po.totalAmount)}</span></div>
                </div>
              </div>
            </div>
            <div className="mt-4 text-xs">
              <Link href="/purchase" className="font-bold text-[#1E293B] hover:underline">← Kembali ke daftar PO</Link>
            </div>
          </FormSheet>
        </div>
      </main>
    </div>
  );
}
RR_EOF
echo "  ✓ app/purchase/[id]/page.tsx"
mkdir -p "app/purchase"
cat > "app/purchase/page.tsx" <<'RR_EOF'
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { AppNavbar, ControlPanel } from '@/components/odoo';
import CreateDocModal from '@/components/erp/CreateDocModal';
import { ListTable, StatusPill, rp, fmtDate } from '@/components/erp/ui';

export const revalidate = 0;

export default async function PurchaseListPage() {
  const [orders, vendors, products] = await Promise.all([
    prisma.purchaseOrder.findMany({ include: { vendor: true }, orderBy: { createdAt: 'desc' } }),
    prisma.contact.findMany({ where: { type: 'VENDOR' }, orderBy: { contactId: 'asc' } }),
    prisma.product.findMany({ orderBy: { sku: 'asc' } }),
  ]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans">
      <AppNavbar currentModule="Purchase Orders & Receipts (S-09 & S-10)" />
      <ControlPanel
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Purchase', href: '/purchase' }, { label: 'Purchase Orders' }]}
        searchPlaceholder="Cari nomor PO atau vendor..."
        pagerText={`Total PO: ${orders.length}`}
        availableViews={['list']}
        currentView="list"
      >
        <CreateDocModal
          kind="purchase"
          partners={vendors.map((v) => ({ id: v.id, label: `${v.contactId} · ${v.name}`, hint: v.category ?? undefined }))}
          products={products.map((p) => ({ sku: p.sku, name: p.name, price: p.cost }))}
          buttonLabel="+ Create / Buat Baru"
        />
      </ControlPanel>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-6">
        <ListTable headers={[{ label: 'Nomor PO' }, { label: 'Vendor' }, { label: 'Tanggal' }, { label: 'Total', right: true }, { label: 'Status' }]} empty="Belum ada Purchase Order. Klik + Create / Buat Baru.">
          {orders.map((o) => (
            <tr key={o.id} className="hover:bg-[#F8FAFC]">
              <td className="px-4 py-3 font-mono font-bold"><Link href={`/purchase/${o.id}`} className="text-[#1E293B] hover:underline">{o.docNumber}</Link></td>
              <td className="px-4 py-3">{o.vendor.name}</td>
              <td className="px-4 py-3">{fmtDate(o.createdAt)}</td>
              <td className="px-4 py-3 text-right font-mono font-bold">{rp(o.totalAmount)}</td>
              <td className="px-4 py-3"><StatusPill status={o.status} /></td>
            </tr>
          ))}
        </ListTable>
      </main>
    </div>
  );
}
RR_EOF
echo "  ✓ app/purchase/page.tsx"
mkdir -p "app/sales/[id]"
cat > "app/sales/[id]/page.tsx" <<'RR_EOF'
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { AppNavbar, ControlPanel, FormStatusBar, FormSheet, FormField, FormFieldGroup } from '@/components/odoo';
import ActionButton from '@/components/erp/ActionButton';
import { confirmQuotationAction } from '@/app/actions/erp';
import { StatusPill, rp, fmtDate } from '@/components/erp/ui';

export const revalidate = 0;

export default async function QuotationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const q = await prisma.quotation.findUnique({
    where: { id },
    include: { customer: true, lines: { include: { product: true } } },
  });
  if (!q) notFound();
  const so = await prisma.salesOrder.findFirst({ where: { docNumber: 'SO' + q.docNumber.replace(/\D/g, '') } });

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans">
      <AppNavbar currentModule="Sales & Quotations (S-05)" />
      <ControlPanel
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Sales', href: '/sales' }, { label: q.docNumber }]}
        availableViews={['form']}
        currentView="form"
      />
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-6">
        <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-xs overflow-hidden">
          <FormStatusBar
            stages={['Draft', 'Quotation Sent', 'Sales Order']}
            currentStage={q.status === 'Draft' ? 'Draft' : 'Sales Order'}
            actions={[]}
          >
            {q.status === 'Draft' && (
              <ActionButton action={confirmQuotationAction.bind(null, q.id)} label="✓ Confirm to Sales Order" />
            )}
            {so && (
              <Link href={`/sales/order/${so.id}`} className="px-3.5 py-1.5 rounded-md border border-[#E2E8F0] text-xs font-bold hover:bg-[#F8FAFC]">
                Lihat {so.docNumber} ➔
              </Link>
            )}
          </FormStatusBar>

          <FormSheet
            title={`Quotation ${q.docNumber}`}
            subtitle="S-05 Penawaran Harga · Alur Order-to-Cash"
            ribbon={{ text: q.status.toUpperCase(), variant: q.status === 'Draft' ? 'warning' : 'success' }}
            smartButtons={[
              { label: 'Plafon Kredit', value: q.customer.creditLimit > 0 ? rp(q.customer.creditLimit) : 'Cash', icon: '💳', href: `/contacts?contactId=${q.customer.contactId}` },
              { label: 'Termin', value: q.customer.paymentTerms, icon: '⏳' },
            ]}
          >
            <FormFieldGroup columns={2}>
              <FormField label="Pelanggan" required>
                <span className="font-bold">{q.customer.name} ({q.customer.contactId})</span>
              </FormField>
              <FormField label="Tanggal"><span>{fmtDate(q.createdAt)}</span></FormField>
              <FormField label="Status"><StatusPill status={q.status} /></FormField>
            </FormFieldGroup>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8FAFC] text-[#64748B] uppercase font-bold border-b border-[#E2E8F0]">
                  <tr>
                    <th className="px-3 py-2.5">Produk</th>
                    <th className="px-3 py-2.5 text-center">Qty</th>
                    <th className="px-3 py-2.5 text-right">Harga</th>
                    <th className="px-3 py-2.5 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {q.lines.map((l) => (
                    <tr key={l.id}>
                      <td className="px-3 py-2.5"><div className="font-bold">{l.product.name}</div><div className="font-mono text-[10px] text-[#64748B]">{l.sku}</div></td>
                      <td className="px-3 py-2.5 text-center font-mono font-bold">{l.qty}</td>
                      <td className="px-3 py-2.5 text-right font-mono">{rp(l.unitPrice)}</td>
                      <td className="px-3 py-2.5 text-right font-mono font-bold">{rp(l.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-4 pt-4 border-t border-[#E2E8F0] flex justify-end">
                <div className="w-72 space-y-1.5 text-xs">
                  <div className="flex justify-between"><span>Subtotal</span><span className="font-mono font-bold">{rp(q.subtotal)}</span></div>
                  <div className="flex justify-between"><span>PPN 11%</span><span className="font-mono font-bold">{rp(q.taxAmount)}</span></div>
                  <div className="flex justify-between pt-2 border-t border-[#E2E8F0] text-sm font-black"><span>TOTAL</span><span className="font-mono">{rp(q.totalAmount)}</span></div>
                </div>
              </div>
            </div>
          </FormSheet>
        </div>
      </main>
    </div>
  );
}
RR_EOF
echo "  ✓ app/sales/[id]/page.tsx"
mkdir -p "app/sales/order/[id]"
cat > "app/sales/order/[id]/page.tsx" <<'RR_EOF'
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { AppNavbar, ControlPanel, FormStatusBar, FormSheet, FormField, FormFieldGroup } from '@/components/odoo';
import ActionButton from '@/components/erp/ActionButton';
import { approveCreditAction } from '@/app/actions/erp';
import { StatusPill, rp, fmtDate } from '@/components/erp/ui';

export const revalidate = 0;

export default async function SalesOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const so = await prisma.salesOrder.findUnique({
    where: { id },
    include: { customer: true, lines: { include: { product: true } }, deliveries: true, invoices: true },
  });
  if (!so) notFound();
  const session = await getSession();
  const canApprove = !!session && ['SUPERADMIN', 'OWNER', 'FINANCE'].includes(session.role);
  const held = so.status === 'Pending Credit Approval';

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans">
      <AppNavbar currentModule="Sales Order (S-06)" />
      <ControlPanel
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Sales', href: '/sales?tab=order' }, { label: so.docNumber }]}
        availableViews={['form']}
        currentView="form"
      />
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-6">
        <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-xs overflow-hidden">
          <FormStatusBar stages={['Draft', 'Sales Order']} currentStage="Sales Order" actions={[]}>
            {held && canApprove && (
              <ActionButton action={approveCreditAction.bind(null, so.id)} label="✓ Approve Credit" />
            )}
          </FormStatusBar>

          <FormSheet
            title={`Sales Order ${so.docNumber}`}
            subtitle="S-06 Sales Order · Credit Check (SR-11)"
            ribbon={{ text: so.status.toUpperCase(), variant: held ? 'danger' : 'success' }}
            smartButtons={[
              ...so.deliveries.map((d) => ({ label: 'Delivery Order', value: d.docNumber, icon: '📦', href: `/inventory/delivery/${d.id}` })),
              ...so.invoices.map((i) => ({ label: 'Faktur', value: i.docNumber, icon: '📑', href: '/invoicing' })),
              { label: 'Credit Check', value: held ? 'Ditahan' : 'Lolos', icon: '🛡️' },
            ]}
          >
            {held && (
              <div className="bg-red-50 border border-red-200 text-[#EF4444] text-xs font-semibold rounded-lg px-3.5 py-2.5 mb-3">
                ⚠️ Pending Credit Approval: total pesanan melebihi limit kredit {so.customer.name} ({rp(so.customer.creditLimit)}). Delivery Order belum dibuat sampai disetujui Owner/Finance.
              </div>
            )}
            <FormFieldGroup columns={2}>
              <FormField label="Pelanggan"><span className="font-bold">{so.customer.name} ({so.customer.contactId})</span></FormField>
              <FormField label="Tanggal"><span>{fmtDate(so.createdAt)}</span></FormField>
              <FormField label="Status"><StatusPill status={so.status} /></FormField>
              <FormField label="Total"><span className="font-mono font-black">{rp(so.totalAmount)}</span></FormField>
            </FormFieldGroup>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8FAFC] text-[#64748B] uppercase font-bold border-b border-[#E2E8F0]">
                  <tr>
                    <th className="px-3 py-2.5">Produk</th>
                    <th className="px-3 py-2.5 text-center">Dipesan</th>
                    <th className="px-3 py-2.5 text-center">Terkirim</th>
                    <th className="px-3 py-2.5 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {so.lines.map((l) => (
                    <tr key={l.id}>
                      <td className="px-3 py-2.5 font-bold">{l.product.name} <span className="font-mono text-[10px] text-[#64748B]">{l.sku}</span></td>
                      <td className="px-3 py-2.5 text-center font-mono">{l.qtyOrdered}</td>
                      <td className="px-3 py-2.5 text-center font-mono">{l.qtyDelivered}</td>
                      <td className="px-3 py-2.5 text-right font-mono font-bold">{rp(l.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 text-xs">
              <Link href="/sales?tab=order" className="font-bold text-[#1E293B] hover:underline">← Kembali ke daftar Sales Order</Link>
            </div>
          </FormSheet>
        </div>
      </main>
    </div>
  );
}
RR_EOF
echo "  ✓ app/sales/order/[id]/page.tsx"
mkdir -p "app/sales"
cat > "app/sales/page.tsx" <<'RR_EOF'
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { AppNavbar, ControlPanel } from '@/components/odoo';
import CreateDocModal from '@/components/erp/CreateDocModal';
import { ListTable, StatusPill, TabLinks, rp, fmtDate } from '@/components/erp/ui';

export const revalidate = 0;

export default async function SalesListPage({ searchParams }: { searchParams?: Promise<{ tab?: string }> }) {
  const tab = (searchParams ? await searchParams : {})?.tab === 'order' ? 'order' : 'quotation';

  const [quotations, orders, customers, products] = await Promise.all([
    prisma.quotation.findMany({ include: { customer: true }, orderBy: { createdAt: 'desc' } }),
    prisma.salesOrder.findMany({ include: { customer: true }, orderBy: { createdAt: 'desc' } }),
    prisma.contact.findMany({ where: { type: { not: 'VENDOR' } }, orderBy: { contactId: 'asc' } }),
    prisma.product.findMany({ orderBy: { sku: 'asc' } }),
  ]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans">
      <AppNavbar currentModule="Sales & Quotations (S-05 & S-06)" />
      <ControlPanel
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Sales', href: '/sales' }, { label: tab === 'order' ? 'Sales Orders' : 'Quotations' }]}
        searchPlaceholder="Cari dokumen..."
        pagerText={`Quotations: ${quotations.length} | SO: ${orders.length}`}
        availableViews={['list']}
        currentView="list"
      >
        <div className="flex items-center gap-3">
          <CreateDocModal
            kind="sales"
            partners={customers.map((c) => ({ id: c.id, label: `${c.contactId} · ${c.name}`, hint: c.creditLimit > 0 ? `Limit ${rp(c.creditLimit)}` : 'Cash' }))}
            products={products.map((p) => ({ sku: p.sku, name: p.name, price: p.salesPrice }))}
            buttonLabel="+ Create / Buat Baru"
          />
          <TabLinks base="/sales" active={tab} tabs={[{ id: 'quotation', label: 'Quotations' }, { id: 'order', label: 'Sales Orders' }]} />
        </div>
      </ControlPanel>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-6">
        {tab === 'quotation' ? (
          <ListTable headers={[{ label: 'Nomor' }, { label: 'Pelanggan' }, { label: 'Tanggal' }, { label: 'Total', right: true }, { label: 'Status' }]} empty="Belum ada Quotation. Klik + Create / Buat Baru.">
            {quotations.map((q) => (
              <tr key={q.id} className="hover:bg-[#F8FAFC]">
                <td className="px-4 py-3 font-mono font-bold"><Link href={`/sales/${q.id}`} className="text-[#1E293B] hover:underline">{q.docNumber}</Link></td>
                <td className="px-4 py-3">{q.customer.name}</td>
                <td className="px-4 py-3">{fmtDate(q.createdAt)}</td>
                <td className="px-4 py-3 text-right font-mono font-bold">{rp(q.totalAmount)}</td>
                <td className="px-4 py-3"><StatusPill status={q.status} /></td>
              </tr>
            ))}
          </ListTable>
        ) : (
          <ListTable headers={[{ label: 'Nomor SO' }, { label: 'Pelanggan' }, { label: 'Tanggal' }, { label: 'Total', right: true }, { label: 'Status' }]} empty="Belum ada Sales Order.">
            {orders.map((o) => (
              <tr key={o.id} className="hover:bg-[#F8FAFC]">
                <td className="px-4 py-3 font-mono font-bold"><Link href={`/sales/order/${o.id}`} className="text-[#1E293B] hover:underline">{o.docNumber}</Link></td>
                <td className="px-4 py-3">{o.customer.name}</td>
                <td className="px-4 py-3">{fmtDate(o.createdAt)}</td>
                <td className="px-4 py-3 text-right font-mono font-bold">{rp(o.totalAmount)}</td>
                <td className="px-4 py-3"><StatusPill status={o.status} /></td>
              </tr>
            ))}
          </ListTable>
        )}
      </main>
    </div>
  );
}
RR_EOF
echo "  ✓ app/sales/page.tsx"
mkdir -p "components/erp"
cat > "components/erp/ActionButton.tsx" <<'RR_EOF'
'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { showToast } from './Toast';

interface Result { ok: boolean; message: string; redirectTo?: string }

export default function ActionButton({
  action,
  label,
  className,
  confirmText,
  disabled,
}: {
  action: () => Promise<Result>;
  label: string;
  className?: string;
  confirmText?: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState(false);

  function onClick() {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    start(async () => {
      const r = await action();
      setBusy(false);
      showToast(r.ok ? 'success' : 'error', r.message);
      if (r.ok) {
        if (r.redirectTo) router.push(r.redirectTo);
        router.refresh();
      }
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || pending || busy}
      className={
        className ??
        'bg-[#CFFF30] hover:brightness-95 text-[#0F172A] font-extrabold text-xs px-4 py-1.5 rounded-md shadow-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed'
      }
    >
      {pending || busy ? 'Memproses...' : label}
    </button>
  );
}
RR_EOF
echo "  ✓ components/erp/ActionButton.tsx"
mkdir -p "components/erp"
cat > "components/erp/CloseSessionForm.tsx" <<'RR_EOF'
'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { showToast } from './Toast';
import { closePosSessionAction } from '@/app/actions/erp';

export default function CloseSessionForm({ sessionId, expected }: { sessionId: string; expected: number }) {
  const router = useRouter();
  const [counted, setCounted] = useState(String(Math.round(expected)));
  const [pending, start] = useTransition();

  function close() {
    if (!window.confirm('Tutup sesi? Stok gerai (SHOP) akan dipotong sesuai barang terjual.')) return;
    start(async () => {
      const r = await closePosSessionAction(sessionId, counted === '' ? undefined : Number(counted));
      showToast(r.ok ? 'success' : 'error', r.message);
      if (r.ok) {
        router.push(r.redirectTo ?? '/pos');
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-semibold text-[#64748B] mb-1">Kas Dihitung Fisik (Counted, Rp)</label>
        <input type="number" min={0} value={counted} onChange={(e) => setCounted(e.target.value)} className="w-full max-w-xs px-3 py-2 rounded-lg border border-[#E2E8F0] text-sm font-mono bg-white text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#CFFF30]" />
      </div>
      <button type="button" onClick={close} disabled={pending} className="bg-[#EF4444] hover:brightness-95 text-white font-extrabold text-sm px-5 py-2.5 rounded-lg disabled:opacity-50">
        {pending ? 'Menutup...' : 'Close Session'}
      </button>
    </div>
  );
}
RR_EOF
echo "  ✓ components/erp/CloseSessionForm.tsx"
mkdir -p "components/erp"
cat > "components/erp/CreateDocModal.tsx" <<'RR_EOF'
'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { showToast } from './Toast';
import { createQuotationAction, createPurchaseOrderAction } from '@/app/actions/erp';

interface Partner { id: string; label: string; hint?: string }
interface Prod { sku: string; name: string; price: number }
interface Line { sku: string; qty: number }

const rp = (n: number) => 'Rp ' + Math.round(n).toLocaleString('id-ID');
const inputCls = 'w-full px-3 py-2 rounded-lg border border-[#E2E8F0] text-sm bg-white text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#CFFF30]';

export default function CreateDocModal({
  kind, partners, products, buttonLabel = '+ Buat Baru',
}: {
  kind: 'sales' | 'purchase';
  partners: Partner[];
  products: Prod[];
  buttonLabel?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [partnerId, setPartnerId] = useState('');
  const [lines, setLines] = useState<Line[]>([{ sku: '', qty: 1 }]);
  const [error, setError] = useState('');
  const [pending, start] = useTransition();

  const pmap = new Map(products.map((p) => [p.sku, p]));
  const subtotal = lines.reduce((s, l) => s + (pmap.get(l.sku)?.price ?? 0) * (l.qty > 0 ? l.qty : 0), 0);
  const tax = Math.round(subtotal * 0.11);
  const isSales = kind === 'sales';

  function setLine(i: number, patch: Partial<Line>) {
    setLines((p) => p.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function reset() {
    setPartnerId(''); setLines([{ sku: '', qty: 1 }]); setError('');
  }
  function submit() {
    setError('');
    const valid = lines.filter((l) => l.sku && l.qty > 0);
    if (!partnerId) return setError(isSales ? 'Pilih pelanggan.' : 'Pilih vendor.');
    if (valid.length === 0) return setError('Pilih minimal 1 produk dengan kuantitas > 0.');
    start(async () => {
      const r = isSales ? await createQuotationAction(partnerId, valid) : await createPurchaseOrderAction(partnerId, valid);
      if (!r.ok) return setError(r.message);
      showToast('success', r.message);
      setOpen(false); reset();
      if (r.redirectTo) router.push(r.redirectTo);
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="bg-[#CFFF30] hover:brightness-95 text-[#0F172A] font-extrabold text-xs px-4 py-1.5 rounded-md shadow-xs"
      >
        {buttonLabel}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-12 px-4 bg-[#1E293B]/70 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-[#E2E8F0] p-6 space-y-4 text-[#0F172A] max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="font-black text-lg">{isSales ? 'Buat Quotation Baru' : 'Buat RFQ / Purchase Order Baru'}</h2>
              <button type="button" onClick={() => setOpen(false)} className="text-[#64748B] hover:text-[#0F172A]">✕</button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#64748B] mb-1">{isSales ? 'Pelanggan' : 'Vendor'}</label>
              <select value={partnerId} onChange={(e) => setPartnerId(e.target.value)} className={inputCls}>
                <option value="">-- Pilih {isSales ? 'pelanggan' : 'vendor'} --</option>
                {partners.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}{p.hint ? ` · ${p.hint}` : ''}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-semibold text-[#64748B]">Order Lines</div>
              {lines.map((l, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center">
                  <select value={l.sku} onChange={(e) => setLine(i, { sku: e.target.value })} className={`${inputCls} col-span-6`}>
                    <option value="">-- Produk --</option>
                    {products.map((p) => (
                      <option key={p.sku} value={p.sku}>{p.sku} · {p.name} ({rp(p.price)})</option>
                    ))}
                  </select>
                  <input type="number" min={1} value={l.qty} onChange={(e) => setLine(i, { qty: parseInt(e.target.value, 10) || 0 })} className={`${inputCls} col-span-2`} />
                  <div className="col-span-3 text-right font-mono text-xs">{rp((pmap.get(l.sku)?.price ?? 0) * (l.qty > 0 ? l.qty : 0))}</div>
                  <button type="button" disabled={lines.length === 1} onClick={() => setLines((p) => p.filter((_, idx) => idx !== i))} className="col-span-1 text-[#EF4444] disabled:opacity-30">🗑</button>
                </div>
              ))}
              <button type="button" onClick={() => setLines((p) => [...p, { sku: '', qty: 1 }])} className="text-xs font-bold text-[#1E293B] hover:underline">+ Tambah baris produk</button>
            </div>

            <div className="border-t border-[#E2E8F0] pt-3 text-xs space-y-1 text-right">
              <div>Subtotal: <span className="font-mono font-bold">{rp(subtotal)}</span></div>
              <div>PPN 11%: <span className="font-mono font-bold">{rp(tax)}</span></div>
              <div className="text-sm font-black">Total: <span className="font-mono">{rp(subtotal + tax)}</span></div>
            </div>

            {error && <div className="bg-red-50 border border-red-200 text-[#EF4444] text-xs font-medium rounded-lg px-3 py-2">⚠️ {error}</div>}

            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 text-xs font-semibold rounded-md border border-[#E2E8F0]">Batal</button>
              <button type="button" onClick={submit} disabled={pending} className="px-4 py-2 text-xs font-extrabold rounded-md bg-[#CFFF30] text-[#0F172A] disabled:opacity-50">
                {pending ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
RR_EOF
echo "  ✓ components/erp/CreateDocModal.tsx"
mkdir -p "components/erp"
cat > "components/erp/PosTerminal.tsx" <<'RR_EOF'
'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { showToast } from './Toast';
import { posCheckoutAction } from '@/app/actions/erp';

interface P { sku: string; name: string; price: number; avail: number }
const rp = (n: number) => 'Rp ' + Math.round(n).toLocaleString('id-ID');

export default function PosTerminal({ products }: { products: P[] }) {
  const router = useRouter();
  const [cart, setCart] = useState<Record<string, number>>({});
  const [cash, setCash] = useState('');
  const [search, setSearch] = useState('');
  const [pending, start] = useTransition();

  const pmap = new Map(products.map((p) => [p.sku, p]));
  const items = Object.entries(cart).filter(([, q]) => q > 0).map(([sku, qty]) => ({ sku, qty, p: pmap.get(sku)! }));
  const subtotal = items.reduce((s, i) => s + i.p.price * i.qty, 0);
  const tax = Math.round(subtotal * 0.11);
  const total = subtotal + tax;
  const paid = Number(cash) || 0;
  const change = paid - total;

  function add(sku: string, delta: number) {
    const p = pmap.get(sku);
    if (!p) return;
    setCart((c) => {
      const next = Math.max(0, (c[sku] ?? 0) + delta);
      if (next > p.avail) {
        showToast('error', `Stok ${p.name} di gerai hanya ${p.avail} unit.`);
        return c;
      }
      return { ...c, [sku]: next };
    });
  }

  function pay() {
    if (items.length === 0) return showToast('error', 'Keranjang masih kosong.');
    if (paid < total) return showToast('error', `Uang tunai kurang. Total ${rp(total)}.`);
    start(async () => {
      const r = await posCheckoutAction(items.map((i) => ({ sku: i.sku, qty: i.qty })), paid);
      showToast(r.ok ? 'success' : 'error', r.message);
      if (r.ok) {
        setCart({});
        setCash('');
        router.refresh();
      }
    });
  }

  const shown = products.filter((p) => !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <div className="lg:col-span-8 space-y-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari SKU atau nama produk..."
          className="w-full px-3.5 py-2.5 rounded-lg border border-[#E2E8F0] text-sm bg-white text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#CFFF30]"
        />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {shown.map((p) => (
            <button
              key={p.sku}
              type="button"
              disabled={p.avail <= 0}
              onClick={() => add(p.sku, 1)}
              className="text-left bg-white border border-[#E2E8F0] rounded-xl p-3 hover:border-[#00F0FF] hover:shadow-md transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <div className="flex justify-between items-start">
                <span className="font-mono text-[10px] font-bold text-[#64748B]">{p.sku}</span>
                {cart[p.sku] > 0 && <span className="bg-[#CFFF30] text-[#0F172A] text-[10px] font-black px-1.5 rounded">×{cart[p.sku]}</span>}
              </div>
              <div className="font-bold text-sm text-[#0F172A] mt-1 leading-snug">{p.name}</div>
              <div className="font-mono font-black text-[#1E293B] text-sm mt-1">{rp(p.price)}</div>
              <div className={`text-[10px] mt-1 font-semibold ${p.avail <= 3 ? 'text-[#EF4444]' : 'text-[#64748B]'}`}>Stok gerai: {p.avail}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="lg:col-span-4 bg-white border border-[#E2E8F0] rounded-xl shadow-xs p-4 space-y-3 lg:sticky lg:top-4">
        <h3 className="font-black text-sm text-[#0F172A] uppercase tracking-wider">Keranjang</h3>
        {items.length === 0 ? (
          <p className="text-xs text-[#64748B] py-6 text-center">Klik produk untuk menambah ke keranjang.</p>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {items.map((i) => (
              <div key={i.sku} className="flex items-center gap-2 text-xs">
                <div className="flex-1">
                  <div className="font-bold text-[#0F172A]">{i.p.name}</div>
                  <div className="font-mono text-[#64748B]">{rp(i.p.price)}</div>
                </div>
                <button type="button" onClick={() => add(i.sku, -1)} className="w-6 h-6 rounded border border-[#E2E8F0] font-bold">−</button>
                <span className="w-6 text-center font-mono font-bold">{i.qty}</span>
                <button type="button" onClick={() => add(i.sku, 1)} className="w-6 h-6 rounded border border-[#E2E8F0] font-bold">+</button>
                <span className="w-24 text-right font-mono font-bold">{rp(i.p.price * i.qty)}</span>
              </div>
            ))}
          </div>
        )}

        <div className="border-t border-[#E2E8F0] pt-3 text-xs space-y-1">
          <div className="flex justify-between"><span>Subtotal</span><span className="font-mono font-bold">{rp(subtotal)}</span></div>
          <div className="flex justify-between"><span>PPN 11%</span><span className="font-mono font-bold">{rp(tax)}</span></div>
          <div className="flex justify-between text-base font-black text-[#0F172A]"><span>TOTAL</span><span className="font-mono">{rp(total)}</span></div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#64748B] mb-1">Uang Tunai Diterima (Rp)</label>
          <input type="number" min={0} value={cash} onChange={(e) => setCash(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] text-sm font-mono bg-white text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#CFFF30]" />
          <div className="flex gap-1.5 mt-1.5">
            <button type="button" onClick={() => setCash(String(total))} className="text-[10px] font-bold px-2 py-1 rounded border border-[#E2E8F0] hover:bg-[#F8FAFC]">Uang Pas</button>
            {[50000, 100000, 200000].map((n) => (
              <button key={n} type="button" onClick={() => setCash(String(n))} className="text-[10px] font-bold px-2 py-1 rounded border border-[#E2E8F0] hover:bg-[#F8FAFC]">{(n / 1000).toLocaleString('id-ID')}rb</button>
            ))}
          </div>
          {paid > 0 && total > 0 && (
            <div className={`mt-2 text-xs font-bold ${change >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
              {change >= 0 ? `Kembalian: ${rp(change)}` : `Kurang: ${rp(-change)}`}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={pay}
          disabled={pending || items.length === 0}
          className="w-full bg-[#CFFF30] hover:brightness-95 text-[#0F172A] font-extrabold py-3 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {pending ? 'Memproses...' : `Bayar Tunai ${total > 0 ? rp(total) : ''}`}
        </button>
        {items.length > 0 && (
          <button type="button" onClick={() => { setCart({}); setCash(''); }} className="w-full text-xs font-semibold text-[#EF4444] hover:underline">Kosongkan keranjang</button>
        )}
      </div>
    </div>
  );
}
RR_EOF
echo "  ✓ components/erp/PosTerminal.tsx"
mkdir -p "components/erp"
cat > "components/erp/ProductCreateModal.tsx" <<'RR_EOF'
'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { showToast } from './Toast';
import { createProductAction } from '@/app/actions/erp';

const inputCls = 'w-full px-3 py-2 rounded-lg border border-[#E2E8F0] text-sm bg-white text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#CFFF30]';

export default function ProductCreateModal({ vendors }: { vendors: { id: string; label: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  const [f, setF] = useState({ sku: '', name: '', uom: 'Unit', salesPrice: '', cost: '', vendorId: '', initialQty: '0' });

  function submit() {
    setError('');
    start(async () => {
      const r = await createProductAction({
        sku: f.sku, name: f.name, uom: f.uom,
        salesPrice: Number(f.salesPrice), cost: Number(f.cost),
        vendorId: f.vendorId, initialQty: Number(f.initialQty),
      });
      if (!r.ok) return setError(r.message);
      showToast('success', r.message);
      setOpen(false);
      if (r.redirectTo) router.push(r.redirectTo);
      router.refresh();
    });
  }

  const field = (label: string, key: keyof typeof f, type = 'text') => (
    <div>
      <label className="block text-xs font-semibold text-[#64748B] mb-1">{label}</label>
      <input type={type} value={f[key]} onChange={(e) => setF({ ...f, [key]: e.target.value })} className={inputCls} />
    </div>
  );

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="bg-[#CFFF30] hover:brightness-95 text-[#0F172A] font-extrabold text-xs px-4 py-1.5 rounded-md shadow-xs">
        + Buat Produk Baru
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-12 px-4 bg-[#1E293B]/70 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-[#E2E8F0] p-6 space-y-3 text-[#0F172A]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="font-black text-lg">Produk Baru</h2>
              <button type="button" onClick={() => setOpen(false)} className="text-[#64748B]">✕</button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {field('SKU (mis. P017)', 'sku')}
              {field('Nama Produk', 'name')}
              {field('Harga Jual (Rp)', 'salesPrice', 'number')}
              {field('Biaya / HPP (Rp)', 'cost', 'number')}
              {field('Satuan (UoM)', 'uom')}
              {field('Stok Awal WH', 'initialQty', 'number')}
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#64748B] mb-1">Vendor Default</label>
              <select value={f.vendorId} onChange={(e) => setF({ ...f, vendorId: e.target.value })} className={inputCls}>
                <option value="">-- Pilih vendor --</option>
                {vendors.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
              </select>
            </div>
            {error && <div className="bg-red-50 border border-red-200 text-[#EF4444] text-xs font-medium rounded-lg px-3 py-2">⚠️ {error}</div>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 text-xs font-semibold rounded-md border border-[#E2E8F0]">Batal</button>
              <button type="button" onClick={submit} disabled={pending} className="px-4 py-2 text-xs font-extrabold rounded-md bg-[#CFFF30] text-[#0F172A] disabled:opacity-50">
                {pending ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
RR_EOF
echo "  ✓ components/erp/ProductCreateModal.tsx"
mkdir -p "components/erp"
cat > "components/erp/Toast.tsx" <<'RR_EOF'
'use client';

import { useEffect, useState } from 'react';

type ToastType = 'error' | 'success' | 'info';
interface ToastItem { id: number; type: ToastType; message: string }

/** Panggil dari komponen client mana pun: showToast('error', 'Akses Ditolak') */
export function showToast(type: ToastType, message: string) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('rr-toast', { detail: { type, message } }));
}

const STYLE: Record<ToastType, string> = {
  error: 'bg-[#EF4444] text-white border-red-700',
  success: 'bg-[#10B981] text-white border-emerald-700',
  info: 'bg-[#1E293B] text-white border-slate-700',
};

export default function ToastHost() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    function onToast(e: Event) {
      const { type, message } = (e as CustomEvent).detail as { type: ToastType; message: string };
      const id = Date.now() + Math.random();
      setItems((p) => [...p, { id, type, message }]);
      setTimeout(() => setItems((p) => p.filter((t) => t.id !== id)), 5000);
    }
    window.addEventListener('rr-toast', onToast);
    return () => window.removeEventListener('rr-toast', onToast);
  }, []);

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm" aria-live="assertive">
      {items.map((t) => (
        <div
          key={t.id}
          role="alert"
          className={`rounded-lg border px-4 py-3 text-sm font-semibold shadow-lg flex items-start gap-2 ${STYLE[t.type]}`}
        >
          <span className="flex-1">{t.message}</span>
          <button
            type="button"
            onClick={() => setItems((p) => p.filter((x) => x.id !== t.id))}
            className="opacity-80 hover:opacity-100"
            aria-label="Tutup"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
RR_EOF
echo "  ✓ components/erp/Toast.tsx"
mkdir -p "components/erp"
cat > "components/erp/ui.tsx" <<'RR_EOF'
import Link from 'next/link';

export const rp = (n: number) => 'Rp ' + Math.round(n).toLocaleString('id-ID');
export const fmtDate = (d: Date) =>
  new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

const PILL: Record<string, string> = {
  Draft: 'bg-slate-100 text-slate-600 border-slate-300',
  Ready: 'bg-amber-50 text-amber-700 border-amber-300',
  Confirmed: 'bg-emerald-50 text-emerald-700 border-emerald-300',
  Done: 'bg-emerald-50 text-emerald-700 border-emerald-300',
  Received: 'bg-emerald-50 text-emerald-700 border-emerald-300',
  Posted: 'bg-sky-50 text-sky-700 border-sky-300',
  Paid: 'bg-emerald-100 text-emerald-800 border-emerald-400',
  Open: 'bg-sky-50 text-sky-700 border-sky-300',
  Closed: 'bg-slate-100 text-slate-600 border-slate-300',
  'Pending Credit Approval': 'bg-red-50 text-red-700 border-red-300',
};

export function StatusPill({ status }: { status: string }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded border text-[10px] font-bold uppercase ${PILL[status] ?? PILL.Draft}`}>
      {status}
    </span>
  );
}

export function TabLinks({ base, active, tabs }: { base: string; active: string; tabs: { id: string; label: string }[] }) {
  return (
    <div className="flex items-center gap-1.5 text-xs">
      {tabs.map((t) => (
        <Link
          key={t.id}
          href={`${base}?tab=${t.id}`}
          className={`px-3 py-1 rounded-md font-semibold transition-colors ${
            active === t.id ? 'bg-[#1E293B] text-[#CFFF30]' : 'bg-white border border-[#E2E8F0] text-[#64748B] hover:text-[#0F172A]'
          }`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}

export function ListTable({ headers, children, empty }: { headers: { label: string; right?: boolean }[]; children: React.ReactNode; empty?: string }) {
  const hasRows = Array.isArray(children) ? children.length > 0 : !!children;
  return (
    <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-xs overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead className="bg-[#F8FAFC] text-[#64748B] uppercase font-bold border-b border-[#E2E8F0]">
          <tr>
            {headers.map((h) => (
              <th key={h.label} className={`px-4 py-3 ${h.right ? 'text-right' : ''}`}>{h.label}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#E2E8F0]">{children}</tbody>
      </table>
      {!hasRows && <div className="p-10 text-center text-[#64748B] text-xs">{empty ?? 'Belum ada data.'}</div>}
    </div>
  );
}
RR_EOF
echo "  ✓ components/erp/ui.tsx"
mkdir -p "components/odoo"
cat > "components/odoo/AppNavbar.tsx" <<'RR_EOF'
'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import AppSwitcherModal from './AppSwitcherModal';
import ThemeToggle from './ThemeToggle';

export interface AppNavbarProps {
  currentModule?: string;
  subMenus?: { label: string; href: string; active?: boolean }[];
  companyName?: string;
  userName?: string;
  userRole?: string;
}

interface UserSession {
  userId: string;
  email: string;
  name: string;
  role: string;
  access: string[];
}

export default function AppNavbar({
  currentModule = 'Sales & CRM',
  subMenus = [],
  companyName = 'RupaRuang Retail (Depok)',
  userName: initialUserName,
  userRole: initialUserRole,
}: AppNavbarProps) {
  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [session, setSession] = useState<UserSession | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch dynamic active user session on mount
  useEffect(() => {
    async function loadUser() {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data: UserSession = await res.json();
          setSession(data);
        }
      } catch (err) {
        console.error('Failed to load session:', err);
      }
    }
    loadUser();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeName = session?.name || initialUserName || 'Memuat...';
  const activeRole = session?.role || initialUserRole || 'STAFF';
  const isAdminOrOwner = activeRole === 'SUPERADMIN' || activeRole === 'OWNER';
  const canPos = isAdminOrOwner || !!session?.access?.includes('pos');

  // Compute initials (e.g. Hendra Wijaya -> HW)
  const initials = activeName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('') || 'U';

  async function handleLogout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      window.location.href = '/login';
    }
  }

  return (
    <>
      <header className="bg-[#1E293B] text-[#FFFFFF] h-12 flex items-center justify-between px-3 text-sm select-none shadow-sm z-30 sticky top-0 border-b border-slate-700/60">
        {/* Kiri: App Switcher Toggle Button & Modul Aktif */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsSwitcherOpen(true)}
            aria-label="Open App Switcher"
            className="w-8 h-8 rounded flex items-center justify-center hover:bg-white/10 active:bg-white/20 transition-colors text-[#CFFF30]"
            title="App Launcher (Semua Modul)"
          >
            {/* Odoo 9 dots icon */}
            <svg
              className="w-5 h-5 fill-current"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle cx="5" cy="5" r="2" />
              <circle cx="12" cy="5" r="2" />
              <circle cx="19" cy="5" r="2" />
              <circle cx="5" cy="12" r="2" />
              <circle cx="12" cy="12" r="2" />
              <circle cx="19" cy="12" r="2" />
              <circle cx="5" cy="19" r="2" />
              <circle cx="12" cy="19" r="2" />
              <circle cx="19" cy="19" r="2" />
            </svg>
          </button>

          {/* Nama Modul / Brand Link */}
          <Link
            href="/"
            className="font-bold tracking-tight text-white hover:text-[#CFFF30] transition-colors flex items-center gap-1.5"
          >
            <span className="text-[#CFFF30] font-black tracking-wider">RUPARUANG</span>
            <span className="text-white/40 font-normal">/</span>
            <span className="font-semibold text-white/95">{currentModule}</span>
          </Link>

          {/* Submenu links */}
          {subMenus.length > 0 && (
            <nav className="hidden md:flex items-center ml-4 gap-1 text-xs">
              {subMenus.map((sub, idx) => (
                <Link
                  key={idx}
                  href={sub.href}
                  className={`px-2.5 py-1 rounded transition-colors ${
                    sub.active
                      ? 'bg-[#CFFF30] font-bold text-[#0F172A]'
                      : 'text-white/80 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {sub.label}
                </Link>
              ))}
            </nav>
          )}
        </div>

        {/* Kanan: Company Badge, Kasir POS, Admin Quick Link, ThemeToggle, User Profile Dropdown */}
        <div className="flex items-center gap-2 text-xs">
          {/* Company Badge */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded bg-black/30 text-white/90 border border-white/10 font-medium">
            <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
            <span className="text-[11px] font-mono">{companyName}</span>
          </div>

          {/* Quick POS Button */}
          {canPos && (
          <Link
            href="/pos"
            className="hidden lg:flex items-center gap-1 px-2.5 py-1 rounded bg-[#00F0FF]/15 text-[#00F0FF] border border-[#00F0FF]/30 hover:bg-[#00F0FF]/25 font-bold transition-all"
          >
            <span>🏪</span>
            <span>Kasir POS</span>
          </Link>
          )}

          {/* Quick Link Panel Super Admin (Khusus SUPERADMIN & OWNER) */}
          {isAdminOrOwner && (
            <Link
              href="/admin/users"
              className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 hover:bg-purple-500/30 font-semibold transition-all text-xs"
              title="Panel Super Admin - Kelola Pengguna"
            >
              <span>⚙️</span>
              <span>Kelola Pengguna</span>
            </Link>
          )}

          {/* Dark Mode Toggle */}
          <ThemeToggle />

          {/* Dynamic Header User Profile Dropdown (◯ user / role pada S-01) */}
          <div className="relative pl-1 border-l border-white/15" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setIsProfileOpen((prev) => !prev)}
              aria-expanded={isProfileOpen}
              className="flex items-center gap-2 py-1 px-2 rounded-lg hover:bg-white/10 active:bg-white/15 transition-colors focus:outline-none"
            >
              <div className="w-7 h-7 rounded-full bg-[#CFFF30] text-[#0F172A] font-black flex items-center justify-center text-[11px] shadow-xs shrink-0">
                {initials}
              </div>
              <div className="hidden md:flex items-center gap-1.5 text-left">
                <span className="text-white/95 font-semibold text-xs leading-none">
                  {activeName}
                </span>
                <span className="text-[#CFFF30] font-bold text-[10px] uppercase tracking-wide leading-none">
                  ({activeRole})
                </span>
              </div>
              <svg
                className={`w-3.5 h-3.5 text-white/60 transition-transform ${isProfileOpen ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Profile Dropdown Menu */}
            {isProfileOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-[#1E293B] text-[#0F172A] dark:text-[#F8FAFC] rounded-xl shadow-xl border border-[#E2E8F0] dark:border-[#334155] py-2 z-50 text-xs animate-in fade-in slide-in-from-top-1">
                {/* User Info Header */}
                <div className="px-4 py-2.5 border-b border-[#E2E8F0] dark:border-[#334155]">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-2 h-2 rounded-full bg-[#10B981]" />
                    <span className="font-bold text-sm text-[#0F172A] dark:text-[#F8FAFC]">
                      {activeName}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] truncate">
                    {session?.email || 'email@ruparuang.com'}
                  </p>
                  <div className="mt-2">
                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[#1E293B] dark:bg-[#334155] text-[#CFFF30] border border-[#CFFF30]/30">
                      Peran: {activeRole}
                    </span>
                  </div>
                </div>

                {/* Menu items */}
                <div className="py-1">
                  {/* Link ke Panel Super Admin (Khusus SUPERADMIN & OWNER) */}
                  {isAdminOrOwner && (
                    <Link
                      href="/admin/users"
                      onClick={() => setIsProfileOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2 hover:bg-[#F8FAFC] dark:hover:bg-[#334155] text-[#0F172A] dark:text-[#F8FAFC] font-semibold transition-colors"
                    >
                      <span className="text-sm">⚙️</span>
                      <div className="flex flex-col">
                        <span>Panel Super Admin</span>
                        <span className="text-[10px] text-[#64748B] dark:text-[#94A3B8] font-normal">
                          Kelola Pengguna & Hak Akses
                        </span>
                      </div>
                    </Link>
                  )}

                  <Link
                    href="/"
                    onClick={() => setIsProfileOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2 hover:bg-[#F8FAFC] dark:hover:bg-[#334155] text-[#0F172A] dark:text-[#F8FAFC] transition-colors"
                  >
                    <span className="text-sm">⚡</span>
                    <span>App Switcher (S-01)</span>
                  </Link>

                  {canPos && (
                  <Link
                    href="/pos"
                    onClick={() => setIsProfileOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2 hover:bg-[#F8FAFC] dark:hover:bg-[#334155] text-[#0F172A] dark:text-[#F8FAFC] transition-colors"
                  >
                    <span className="text-sm">🏪</span>
                    <span>Kasir POS (Depok)</span>
                  </Link>
                  )}
                </div>

                {/* Logout Divider & Button */}
                <div className="pt-1 border-t border-[#E2E8F0] dark:border-[#334155]">
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-[#EF4444] hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors font-semibold text-left"
                  >
                    <span className="text-sm">🚪</span>
                    <span>Keluar dari Sistem (Logout)</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Fullscreen App Switcher Modal */}
      <AppSwitcherModal
        isOpen={isSwitcherOpen}
        onClose={() => setIsSwitcherOpen(false)}
      />
    </>
  );
}
RR_EOF
echo "  ✓ components/odoo/AppNavbar.tsx"
mkdir -p "components/odoo"
cat > "components/odoo/AppSwitcherModal.tsx" <<'RR_EOF'
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';

export interface AppSwitcherModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ERPModuleItem {
  id?: string; // id modul untuk RBAC; kosong = selalu tampil (Home)
  name: string;
  desc: string;
  href: string;
  iconBg: string;
  icon: string;
  badge?: string;
  wireframe: string;
  adminOnly?: boolean;
}

const erpModules: ERPModuleItem[] = [
  {
    name: 'Home / App Switcher',
    desc: 'Peluncur Aplikasi & Navigasi Utama',
    href: '/',
    iconBg: 'bg-[#1E293B] text-[#CFFF30]',
    icon: '⚡',
    wireframe: 'S-01',
  },
  {
    name: 'Panel Super Admin',
    desc: 'Kelola Pengguna, Hak Akses 9 Modul & Kontrol Keamanan',
    href: '/admin/users',
    iconBg: 'bg-purple-600 text-white',
    icon: '⚙️',
    wireframe: 'ADM-01',
    adminOnly: true,
  },
  {
    name: 'Master Contacts',
    desc: 'Database Pelanggan C01–C06 & Vendor V01–V04',
    id: 'contacts',
    href: '/contacts',
    iconBg: 'bg-[#3B82F6] text-white',
    icon: '👥',
    wireframe: 'S-02',
  },
  {
    name: 'Product & SKU',
    desc: 'Master 16 SKU Produk, UoM & Cost/Price',
    id: 'inventory',
    href: '/inventory',
    iconBg: 'bg-[#00F0FF] text-[#0F172A]',
    icon: '🏷️',
    wireframe: 'S-03',
  },
  {
    name: 'CRM & Pipeline',
    desc: 'Kanban Prospek (New, Qualified, Prop, Won)',
    id: 'crm',
    href: '/crm',
    iconBg: 'bg-[#8B5CF6] text-white',
    icon: '🎯',
    wireframe: 'S-04',
  },
  {
    name: 'Sales Quotation & SO',
    desc: 'Quotation Form, Sales Order & Delivery',
    id: 'sales',
    href: '/sales',
    iconBg: 'bg-[#1E293B] text-[#CFFF30]',
    icon: '💼',
    wireframe: 'S-05 & S-06',
  },
  {
    name: 'Inventory & Stock Overview',
    desc: 'Stok WH & SHOP (On-hand, Reserved, Available)',
    id: 'inventory',
    href: '/inventory',
    iconBg: 'bg-[#F59E0B] text-white',
    icon: '📦',
    wireframe: 'S-07 & S-08',
  },
  {
    name: 'Purchase & Receipts',
    desc: 'RFQ PO00018, Vendor V01–V04 & Penerimaan WH',
    id: 'purchase',
    href: '/purchase',
    iconBg: 'bg-[#10B981] text-white',
    icon: '🛒',
    wireframe: 'S-09 & S-10',
  },
  {
    name: 'Invoicing & Bills',
    desc: 'Customer Invoices, Vendor Bills, & Payment',
    id: 'invoicing',
    href: '/invoicing',
    iconBg: 'bg-[#00F0FF] text-[#0F172A]',
    icon: '📑',
    wireframe: 'S-11 s.d S-13',
  },
  {
    name: 'Accounting / Jurnal',
    desc: 'General Ledger, COA & Double-Entry Jurnal',
    id: 'accounting',
    href: '/accounting',
    iconBg: 'bg-[#1E293B] text-[#00F0FF]',
    icon: '⚖️',
    wireframe: 'S-14',
  },
  {
    name: 'Point of Sale (POS)',
    desc: 'Mesin Kasir Gerai Depok, Struk & Tutup Sesi',
    id: 'pos',
    href: '/pos',
    iconBg: 'bg-[#EF4444] text-white',
    icon: '🏪',
    wireframe: 'S-15 & S-16',
  },
  {
    name: 'Management Dashboard',
    desc: 'KPI Omzet, Nilai Stok Persediaan, & Trend',
    id: 'dashboard',
    href: '/dashboard',
    iconBg: 'bg-[#CFFF30] text-[#0F172A]',
    icon: '📊',
    wireframe: 'S-17',
  },
];

export default function AppSwitcherModal({
  isOpen,
  onClose,
}: AppSwitcherModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [userRole, setUserRole] = useState<string>('');
  const [userAccess, setUserAccess] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      fetch('/api/auth/me')
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.role) setUserRole(data.role);
          if (Array.isArray(data?.access)) setUserAccess(data.access);
        })
        .catch(() => {});
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Filter modul berdasarkan role dan input pencarian
  const filteredModules = useMemo(() => {
    const isSuperOrOwner = userRole === 'SUPERADMIN' || userRole === 'OWNER';
    const available = erpModules.filter(
      (m) => (!m.adminOnly || isSuperOrOwner) && (!m.id || isSuperOrOwner || userAccess.includes(m.id))
    );

    if (!searchTerm.trim()) return available;
    const term = searchTerm.toLowerCase();
    return available.filter(
      (m) =>
        m.name.toLowerCase().includes(term) ||
        m.desc.toLowerCase().includes(term) ||
        m.wireframe.toLowerCase().includes(term)
    );
  }, [searchTerm, userRole, userAccess]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex flex-col items-center justify-start pt-16 px-4 bg-[#1E293B]/80 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="max-w-4xl w-full bg-[#FFFFFF] rounded-2xl shadow-2xl border border-[#E2E8F0] p-6 md:p-8 space-y-6 text-[#0F172A] relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Tombol Close */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-[#64748B] hover:text-[#0F172A] p-2 rounded-lg hover:bg-[#F8FAFC] transition-colors"
          title="Tutup (Esc)"
        >
          ✕
        </button>

        {/* Header & Instant Search Bar */}
        <div className="flex flex-col items-center space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#CFFF30]" />
            <span className="text-xs font-mono font-bold uppercase tracking-widest text-[#64748B]">
              Odoo Web 17.0 Navigation
            </span>
          </div>

          <h2 className="text-2xl font-black text-[#0F172A] tracking-tight">
            App Switcher — RupaRuang Retail
          </h2>

          <div className="relative w-full max-w-md">
            <input
              type="text"
              autoFocus
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari modul atau no wireframe (misal: S-05, Sales, PO, Admin)..."
              className="w-full bg-[#F8FAFC] border border-[#E2E8F0] text-sm text-[#0F172A] rounded-xl px-4 py-2.5 pl-10 focus:outline-none focus:border-[#00F0FF] focus:ring-2 focus:ring-[#00F0FF]/30 transition-all placeholder-[#64748B]"
            />
            <span className="absolute left-3.5 top-2.5 text-[#64748B] text-sm">
              🔍
            </span>
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3.5 top-2.5 text-[#64748B] hover:text-[#0F172A] text-xs"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Grid Ikon Modul */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5 max-h-[60vh] overflow-y-auto p-1">
          {filteredModules.map((m, idx) => (
            <Link
              key={idx}
              href={m.href}
              onClick={onClose}
              className="p-3.5 bg-[#FFFFFF] hover:bg-[#F8FAFC] rounded-xl border border-[#E2E8F0] hover:border-[#00F0FF] hover:shadow-md transition-all flex flex-col items-center text-center group"
            >
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl mb-2.5 shadow-xs group-hover:scale-105 transition-transform ${m.iconBg}`}
              >
                {m.icon}
              </div>
              <span className="text-[10px] font-mono font-bold text-[#64748B] bg-[#F8FAFC] px-1.5 py-0.5 rounded border border-[#E2E8F0] mb-1">
                {m.wireframe}
              </span>
              <span className="font-bold text-xs text-[#0F172A] group-hover:text-[#1E293B] leading-snug">
                {m.name}
              </span>
              <p className="text-[10px] text-[#64748B] mt-1 line-clamp-1">
                {m.desc}
              </p>
            </Link>
          ))}
        </div>

        {/* Footer info */}
        <div className="text-center text-[11px] text-[#64748B] border-t border-[#E2E8F0] pt-3">
          Tekan <kbd className="px-1.5 py-0.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded text-[10px] font-mono">Esc</kbd> untuk menutup launcher
        </div>
      </div>
    </div>
  );
}
RR_EOF
echo "  ✓ components/odoo/AppSwitcherModal.tsx"
mkdir -p "lib"
cat > "lib/erp.ts" <<'RR_EOF'
import { Prisma } from '@prisma/client';
import { prisma } from './prisma';

type Tx = Prisma.TransactionClient;

export const TAX_RATE = 0.11;

/** Error bisnis yang pesannya aman ditampilkan ke user */
export class ErpError extends Error {}

const rp = (n: number) => 'Rp ' + Math.round(n).toLocaleString('id-ID');
const digitsOf = (s: string) => (s.match(/(\d+)$/) ?? [])[1] ?? '';

/** Nomor dokumen berikutnya: prefix + 5 digit, berdasarkan nomor terbesar yang ada */
function nextNo(prefix: string, rows: { docNumber: string }[]): string {
  let max = 0;
  for (const r of rows) {
    const n = parseInt(digitsOf(r.docNumber) || '0', 10);
    if (n > max) max = n;
  }
  return prefix + String(max + 1).padStart(5, '0');
}

export interface LineInput {
  sku: string;
  qty: number;
}

function cleanLines(lines: LineInput[]): LineInput[] {
  const map = new Map<string, number>();
  for (const l of lines) {
    const qty = Math.floor(Number(l.qty));
    if (!l.sku || !Number.isFinite(qty) || qty <= 0) continue;
    map.set(l.sku, (map.get(l.sku) ?? 0) + qty);
  }
  return Array.from(map, ([sku, qty]) => ({ sku, qty }));
}

async function addStock(tx: Tx, sku: string, locationId: string, onHand: number, reserved = 0) {
  await tx.stock.upsert({
    where: { sku_locationId: { sku, locationId } },
    update: { qtyOnHand: { increment: onHand }, qtyReserved: { increment: reserved } },
    create: { sku, locationId, qtyOnHand: Math.max(0, onHand), qtyReserved: Math.max(0, reserved) },
  });
}

async function postJournal(
  tx: Tx,
  description: string,
  ref: string,
  lines: { accountCode: string; debit: number; credit: number }[]
) {
  const clean = lines.filter((l) => l.debit > 0 || l.credit > 0);
  const d = clean.reduce((s, l) => s + l.debit, 0);
  const c = clean.reduce((s, l) => s + l.credit, 0);
  if (Math.abs(d - c) > 0.5) throw new ErpError('Jurnal tidak seimbang (Debit ≠ Kredit).');
  const all = await tx.journalEntry.findMany({ select: { docNumber: true } });
  await tx.journalEntry.create({
    data: { docNumber: nextNo('JRN-', all), description, ref, lines: { create: clean } },
  });
}

// ============================================================
// SALES: Quotation -> Sales Order -> Delivery Order
// ============================================================
export async function createQuotation(customerId: string, input: LineInput[]) {
  const lines = cleanLines(input);
  if (!customerId) throw new ErpError('Pilih pelanggan terlebih dahulu.');
  if (lines.length === 0) throw new ErpError('Tambahkan minimal 1 produk dengan kuantitas > 0.');

  return prisma.$transaction(async (tx) => {
    const customer = await tx.contact.findUnique({ where: { id: customerId } });
    if (!customer || customer.type === 'VENDOR') throw new ErpError('Pelanggan tidak valid.');
    const products = await tx.product.findMany({ where: { sku: { in: lines.map((l) => l.sku) } } });
    const pmap = new Map(products.map((p) => [p.sku, p]));

    const data = lines.map((l) => {
      const p = pmap.get(l.sku);
      if (!p) throw new ErpError(`Produk ${l.sku} tidak ditemukan.`);
      return { sku: l.sku, qty: l.qty, unitPrice: p.salesPrice, subtotal: p.salesPrice * l.qty };
    });
    const subtotal = data.reduce((s, l) => s + l.subtotal, 0);
    const taxAmount = Math.round(subtotal * TAX_RATE);

    const all = await tx.quotation.findMany({ select: { docNumber: true } });
    const q = await tx.quotation.create({
      data: {
        docNumber: nextNo('Q', all),
        customerId,
        status: 'Draft',
        subtotal,
        taxAmount,
        totalAmount: subtotal + taxAmount,
        lines: { create: data },
      },
    });
    return { id: q.id, docNumber: q.docNumber };
  });
}

/** Buat Delivery Order + reservasi stok WH untuk sebuah SO yang sudah Confirmed */
async function releaseSalesOrder(tx: Tx, soId: string) {
  const so = await tx.salesOrder.findUnique({ where: { id: soId }, include: { lines: true } });
  if (!so) throw new ErpError('Sales Order tidak ditemukan.');
  const all = await tx.deliveryOrder.findMany({ select: { docNumber: true } });
  const doDoc = await tx.deliveryOrder.create({
    data: {
      docNumber: so.docNumber.startsWith('SO') ? 'DO' + digitsOf(so.docNumber) : nextNo('DO', all),
      salesOrderId: so.id,
      status: 'Ready',
      lines: { create: so.lines.map((l) => ({ sku: l.sku, qtyDone: l.qtyOrdered })) },
    },
  });
  for (const l of so.lines) await addStock(tx, l.sku, 'WH', 0, l.qtyOrdered);
  return doDoc;
}

export async function confirmQuotation(quotationId: string) {
  return prisma.$transaction(async (tx) => {
    const q = await tx.quotation.findUnique({
      where: { id: quotationId },
      include: { lines: true, customer: true },
    });
    if (!q) throw new ErpError('Quotation tidak ditemukan.');
    if (q.status !== 'Draft') throw new ErpError('Quotation ini sudah dikonfirmasi.');

    // Credit check (SR-11): hanya untuk pelanggan dengan termin kredit
    let held = false;
    let exposure = 0;
    if (q.customer.paymentTerms !== 'PT-CASH') {
      const unpaid = await tx.invoice.findMany({
        where: { customerId: q.customerId, status: { not: 'Paid' } },
      });
      const openSo = await tx.salesOrder.findMany({
        where: { customerId: q.customerId, status: 'Confirmed', invoices: { none: {} } },
      });
      exposure =
        unpaid.reduce((s, i) => s + i.totalAmount, 0) +
        openSo.reduce((s, o) => s + o.totalAmount, 0) +
        q.totalAmount;
      held = exposure > q.customer.creditLimit;
    }

    const soAll = await tx.salesOrder.findMany({ select: { docNumber: true } });
    const soNo = 'SO' + (digitsOf(q.docNumber) || nextNo('', soAll));
    const so = await tx.salesOrder.create({
      data: {
        docNumber: soNo,
        customerId: q.customerId,
        status: held ? 'Pending Credit Approval' : 'Confirmed',
        subtotal: q.subtotal,
        taxAmount: q.taxAmount,
        totalAmount: q.totalAmount,
        lines: {
          create: q.lines.map((l) => ({
            sku: l.sku,
            qtyOrdered: l.qty,
            unitPrice: l.unitPrice,
            subtotal: l.subtotal,
          })),
        },
      },
    });
    await tx.quotation.update({ where: { id: q.id }, data: { status: 'Confirmed' } });

    if (held) {
      return {
        soId: so.id,
        held: true,
        message: `${so.docNumber} ditahan (Pending Credit Approval): eksposur ${rp(exposure)} melebihi limit kredit ${rp(q.customer.creditLimit)}.`,
      };
    }
    const d = await releaseSalesOrder(tx, so.id);
    return { soId: so.id, held: false, message: `${so.docNumber} dikonfirmasi. Delivery Order ${d.docNumber} dibuat di Inventory.` };
  });
}

export async function approveCredit(soId: string) {
  return prisma.$transaction(async (tx) => {
    const so = await tx.salesOrder.findUnique({ where: { id: soId } });
    if (!so) throw new ErpError('Sales Order tidak ditemukan.');
    if (so.status !== 'Pending Credit Approval') throw new ErpError('SO ini tidak sedang menunggu approval kredit.');
    await tx.salesOrder.update({ where: { id: soId }, data: { status: 'Confirmed' } });
    const d = await releaseSalesOrder(tx, soId);
    return `Kredit disetujui. ${so.docNumber} Confirmed, Delivery Order ${d.docNumber} dibuat.`;
  });
}

/** Validate Delivery Order: stok fisik WH berkurang sesuai qty kirim */
export async function validateDelivery(deliveryId: string) {
  return prisma.$transaction(async (tx) => {
    const d = await tx.deliveryOrder.findUnique({ where: { id: deliveryId }, include: { lines: true } });
    if (!d) throw new ErpError('Delivery Order tidak ditemukan.');
    if (d.status === 'Done') throw new ErpError('Delivery Order ini sudah divalidasi.');

    for (const l of d.lines) {
      const st = await tx.stock.findUnique({ where: { sku_locationId: { sku: l.sku, locationId: 'WH' } } });
      if (!st || st.qtyOnHand < l.qtyDone) {
        throw new ErpError(`Stok ${l.sku} di WH tidak cukup (tersedia ${st?.qtyOnHand ?? 0}, dikirim ${l.qtyDone}).`);
      }
    }
    for (const l of d.lines) {
      const st = await tx.stock.findUniqueOrThrow({ where: { sku_locationId: { sku: l.sku, locationId: 'WH' } } });
      await tx.stock.update({
        where: { id: st.id },
        data: { qtyOnHand: { decrement: l.qtyDone }, qtyReserved: Math.max(0, st.qtyReserved - l.qtyDone) },
      });
      await tx.salesOrderLine.updateMany({
        where: { salesOrderId: d.salesOrderId, sku: l.sku },
        data: { qtyDelivered: { increment: l.qtyDone } },
      });
    }
    await tx.deliveryOrder.update({ where: { id: d.id }, data: { status: 'Done' } });
    return `${d.docNumber} tervalidasi. Stok WH berkurang.`;
  });
}

// ============================================================
// PURCHASE: PO -> Receipt
// ============================================================
export async function createPurchaseOrder(vendorId: string, input: LineInput[]) {
  const lines = cleanLines(input);
  if (!vendorId) throw new ErpError('Pilih vendor terlebih dahulu.');
  if (lines.length === 0) throw new ErpError('Tambahkan minimal 1 produk dengan kuantitas > 0.');

  return prisma.$transaction(async (tx) => {
    const vendor = await tx.contact.findUnique({ where: { id: vendorId } });
    if (!vendor || vendor.type !== 'VENDOR') throw new ErpError('Vendor tidak valid.');
    const products = await tx.product.findMany({ where: { sku: { in: lines.map((l) => l.sku) } } });
    const pmap = new Map(products.map((p) => [p.sku, p]));
    const data = lines.map((l) => {
      const p = pmap.get(l.sku);
      if (!p) throw new ErpError(`Produk ${l.sku} tidak ditemukan.`);
      return { sku: l.sku, qtyOrdered: l.qty, unitPrice: p.cost, subtotal: p.cost * l.qty };
    });
    const subtotal = data.reduce((s, l) => s + l.subtotal, 0);
    const taxAmount = Math.round(subtotal * TAX_RATE);
    const all = await tx.purchaseOrder.findMany({ select: { docNumber: true } });
    const po = await tx.purchaseOrder.create({
      data: {
        docNumber: nextNo('PO', all),
        vendorId,
        status: 'Draft',
        subtotal,
        taxAmount,
        totalAmount: subtotal + taxAmount,
        lines: { create: data },
      },
    });
    return { id: po.id, docNumber: po.docNumber };
  });
}

export async function confirmPurchaseOrder(poId: string) {
  return prisma.$transaction(async (tx) => {
    const po = await tx.purchaseOrder.findUnique({ where: { id: poId }, include: { lines: true } });
    if (!po) throw new ErpError('Purchase Order tidak ditemukan.');
    if (po.status !== 'Draft') throw new ErpError('PO ini sudah dikonfirmasi.');
    await tx.purchaseOrder.update({ where: { id: po.id }, data: { status: 'Confirmed' } });
    const all = await tx.receipt.findMany({ select: { docNumber: true } });
    const r = await tx.receipt.create({
      data: {
        docNumber: po.docNumber.startsWith('PO') ? 'RC' + digitsOf(po.docNumber) : nextNo('RC', all),
        purchaseOrderId: po.id,
        status: 'Ready',
        lines: { create: po.lines.map((l) => ({ sku: l.sku, qtyDone: l.qtyOrdered })) },
      },
    });
    return `${po.docNumber} dikonfirmasi. Receipt ${r.docNumber} dibuat di Inventory.`;
  });
}

/** Validate Receipt: stok fisik WH bertambah sesuai barang masuk */
export async function validateReceipt(receiptId: string) {
  return prisma.$transaction(async (tx) => {
    const r = await tx.receipt.findUnique({ where: { id: receiptId }, include: { lines: true } });
    if (!r) throw new ErpError('Receipt tidak ditemukan.');
    if (r.status === 'Done') throw new ErpError('Receipt ini sudah divalidasi.');
    for (const l of r.lines) {
      await addStock(tx, l.sku, 'WH', l.qtyDone);
      await tx.purchaseOrderLine.updateMany({
        where: { purchaseOrderId: r.purchaseOrderId, sku: l.sku },
        data: { qtyReceived: { increment: l.qtyDone } },
      });
    }
    await tx.receipt.update({ where: { id: r.id }, data: { status: 'Done' } });
    await tx.purchaseOrder.update({ where: { id: r.purchaseOrderId }, data: { status: 'Received' } });
    return `${r.docNumber} tervalidasi. Stok WH bertambah.`;
  });
}

// ============================================================
// INVENTORY: produk baru
// ============================================================
export async function createProduct(p: {
  sku: string; name: string; uom?: string; salesPrice: number; cost: number; vendorId: string; initialQty: number;
}) {
  const sku = p.sku.trim().toUpperCase();
  if (!sku || !p.name.trim()) throw new ErpError('SKU dan nama produk wajib diisi.');
  if (!(p.salesPrice > 0) || !(p.cost >= 0)) throw new ErpError('Harga jual dan biaya harus valid.');
  if (!p.vendorId) throw new ErpError('Pilih vendor default.');
  const exist = await prisma.product.findUnique({ where: { sku } });
  if (exist) throw new ErpError(`SKU ${sku} sudah ada.`);
  await prisma.$transaction(async (tx) => {
    await tx.product.create({
      data: {
        sku, name: p.name.trim(), uom: p.uom?.trim() || 'Unit',
        salesPrice: p.salesPrice, cost: p.cost, defaultVendorId: p.vendorId,
      },
    });
    await addStock(tx, sku, 'WH', Math.max(0, Math.floor(p.initialQty || 0)));
    await addStock(tx, sku, 'SHOP', 0);
  });
  return `Produk ${sku} berhasil dibuat.`;
}

// ============================================================
// INVOICING & ACCOUNTING
// ============================================================
export async function createInvoiceFromSO(soId: string) {
  return prisma.$transaction(async (tx) => {
    const so = await tx.salesOrder.findUnique({ where: { id: soId }, include: { lines: true } });
    if (!so) throw new ErpError('Sales Order tidak ditemukan.');
    if (so.status !== 'Confirmed') throw new ErpError('Hanya SO berstatus Confirmed yang bisa difakturkan.');
    const invNo = 'INV-' + digitsOf(so.docNumber);
    if (await tx.invoice.findUnique({ where: { docNumber: invNo } })) throw new ErpError(`Faktur ${invNo} sudah ada.`);
    await tx.invoice.create({
      data: {
        docNumber: invNo, salesOrderId: so.id, customerId: so.customerId, status: 'Posted',
        subtotal: so.subtotal, taxAmount: so.taxAmount, totalAmount: so.totalAmount,
        lines: { create: so.lines.map((l) => ({ sku: l.sku, qty: l.qtyOrdered, unitPrice: l.unitPrice, subtotal: l.subtotal })) },
      },
    });
    for (const l of so.lines) {
      await tx.salesOrderLine.update({ where: { id: l.id }, data: { qtyInvoiced: l.qtyOrdered } });
    }
    await postJournal(tx, `Pengakuan Piutang Faktur ${invNo}`, invNo, [
      { accountCode: '1100', debit: so.totalAmount, credit: 0 },
      { accountCode: '4000', debit: 0, credit: so.subtotal },
      { accountCode: '2100', debit: 0, credit: so.taxAmount },
    ]);
    return `Faktur ${invNo} diterbitkan.`;
  });
}

export async function createBillFromPO(poId: string) {
  return prisma.$transaction(async (tx) => {
    const po = await tx.purchaseOrder.findUnique({ where: { id: poId }, include: { lines: true } });
    if (!po) throw new ErpError('Purchase Order tidak ditemukan.');
    const billNo = 'BILL-' + digitsOf(po.docNumber);
    if (await tx.vendorBill.findUnique({ where: { docNumber: billNo } })) throw new ErpError(`Tagihan ${billNo} sudah ada.`);
    await tx.vendorBill.create({
      data: {
        docNumber: billNo, purchaseOrderId: po.id, vendorId: po.vendorId, status: 'Posted',
        subtotal: po.subtotal, taxAmount: po.taxAmount, totalAmount: po.totalAmount,
        lines: { create: po.lines.map((l) => ({ sku: l.sku, qty: l.qtyOrdered, unitPrice: l.unitPrice, subtotal: l.subtotal })) },
      },
    });
    await postJournal(tx, `Pengakuan Hutang Pembelian ${billNo}`, billNo, [
      { accountCode: '1200', debit: po.subtotal, credit: 0 },
      { accountCode: '1150', debit: po.taxAmount, credit: 0 },
      { accountCode: '2000', debit: 0, credit: po.totalAmount },
    ]);
    return `Tagihan ${billNo} diterbitkan.`;
  });
}

/** Register Payment faktur pelanggan: Posted -> Paid + jurnal Debit Bank / Kredit Piutang */
export async function registerInvoicePayment(invoiceId: string) {
  return prisma.$transaction(async (tx) => {
    const inv = await tx.invoice.findUnique({ where: { id: invoiceId } });
    if (!inv) throw new ErpError('Faktur tidak ditemukan.');
    if (inv.status === 'Paid') throw new ErpError('Faktur ini sudah dibayar.');
    if (inv.status !== 'Posted') throw new ErpError('Faktur harus berstatus Posted (dikonfirmasi) sebelum dibayar.');
    await tx.invoice.update({ where: { id: inv.id }, data: { status: 'Paid' } });
    await postJournal(tx, `Pembayaran Faktur ${inv.docNumber}`, inv.docNumber, [
      { accountCode: '1010', debit: inv.totalAmount, credit: 0 },
      { accountCode: '1100', debit: 0, credit: inv.totalAmount },
    ]);
    return `${inv.docNumber} PAID. Jurnal Bank (D) / Piutang (K) ${rp(inv.totalAmount)} masuk General Ledger.`;
  });
}

/** Register Payment tagihan vendor: Posted -> Paid + jurnal Debit Hutang / Kredit Bank */
export async function registerBillPayment(billId: string) {
  return prisma.$transaction(async (tx) => {
    const b = await tx.vendorBill.findUnique({ where: { id: billId } });
    if (!b) throw new ErpError('Tagihan tidak ditemukan.');
    if (b.status === 'Paid') throw new ErpError('Tagihan ini sudah dibayar.');
    await tx.vendorBill.update({ where: { id: b.id }, data: { status: 'Paid' } });
    await postJournal(tx, `Pembayaran Tagihan ${b.docNumber}`, b.docNumber, [
      { accountCode: '2000', debit: b.totalAmount, credit: 0 },
      { accountCode: '1010', debit: 0, credit: b.totalAmount },
    ]);
    return `${b.docNumber} PAID. Jurnal Hutang (D) / Bank (K) ${rp(b.totalAmount)} masuk General Ledger.`;
  });
}

// ============================================================
// POS
// ============================================================
export async function posAvailability(): Promise<Record<string, number>> {
  const session = await prisma.pOSSession.findFirst({ where: { status: 'Open' } });
  const stocks = await prisma.stock.findMany({ where: { locationId: 'SHOP' } });
  const avail: Record<string, number> = {};
  for (const s of stocks) avail[s.sku] = s.qtyOnHand;
  if (session) {
    const sold = await prisma.pOSOrderLine.findMany({ where: { posOrder: { sessionId: session.id } } });
    for (const l of sold) avail[l.sku] = (avail[l.sku] ?? 0) - l.qty;
  }
  return avail;
}

export async function posCheckout(input: LineInput[], cashPaid: number, cashierName: string) {
  const lines = cleanLines(input);
  if (lines.length === 0) throw new ErpError('Keranjang masih kosong.');
  return prisma.$transaction(async (tx) => {
    let session = await tx.pOSSession.findFirst({ where: { status: 'Open' } });
    if (!session) {
      session = await tx.pOSSession.create({
        data: { sessionNumber: `SESS-${Math.floor(Date.now() / 1000)}`, cashierName, startBalance: 0 },
      });
    }
    const products = await tx.product.findMany({ where: { sku: { in: lines.map((l) => l.sku) } } });
    const pmap = new Map(products.map((p) => [p.sku, p]));
    const soldRows = await tx.pOSOrderLine.findMany({ where: { posOrder: { sessionId: session.id } } });

    const data = lines.map((l) => {
      const p = pmap.get(l.sku);
      if (!p) throw new ErpError(`Produk ${l.sku} tidak ditemukan.`);
      return { sku: l.sku, qty: l.qty, unitPrice: p.salesPrice, subtotal: p.salesPrice * l.qty };
    });
    for (const l of data) {
      const st = await tx.stock.findUnique({ where: { sku_locationId: { sku: l.sku, locationId: 'SHOP' } } });
      const already = soldRows.filter((r) => r.sku === l.sku).reduce((s, r) => s + r.qty, 0);
      const avail = (st?.qtyOnHand ?? 0) - already;
      if (avail < l.qty) throw new ErpError(`Stok ${l.sku} di SHOP tidak cukup (sisa ${Math.max(0, avail)}).`);
    }
    const subtotal = data.reduce((s, l) => s + l.subtotal, 0);
    const taxAmount = Math.round(subtotal * TAX_RATE);
    const total = subtotal + taxAmount;
    if (!(cashPaid >= total)) throw new ErpError(`Uang tunai kurang. Total tagihan ${rp(total)}.`);

    const o = await tx.pOSOrder.create({
      data: {
        sessionId: session.id,
        docNumber: `TRX-${Date.now()}`,
        subtotal, taxAmount, totalAmount: total, paidAmount: cashPaid, change: cashPaid - total,
        lines: { create: data },
      },
    });
    return { docNumber: o.docNumber, total, change: cashPaid - total };
  });
}

/** Close Session: potong stok SHOP sesuai barang terjual + jurnal penjualan kasir */
export async function closePosSession(sessionId: string, counted?: number) {
  return prisma.$transaction(async (tx) => {
    const s = await tx.pOSSession.findUnique({
      where: { id: sessionId },
      include: { orders: { include: { lines: true } } },
    });
    if (!s) throw new ErpError('Sesi POS tidak ditemukan.');
    if (s.status !== 'Open') throw new ErpError('Sesi ini sudah ditutup.');

    const sold = new Map<string, number>();
    for (const o of s.orders) for (const l of o.lines) sold.set(l.sku, (sold.get(l.sku) ?? 0) + l.qty);
    for (const [sku, qty] of sold) {
      const st = await tx.stock.findUnique({ where: { sku_locationId: { sku, locationId: 'SHOP' } } });
      if (!st) throw new ErpError(`Stok SHOP untuk ${sku} tidak ditemukan.`);
      await tx.stock.update({ where: { id: st.id }, data: { qtyOnHand: Math.max(0, st.qtyOnHand - qty) } });
    }

    const subtotal = s.orders.reduce((a, o) => a + o.subtotal, 0);
    const tax = s.orders.reduce((a, o) => a + o.taxAmount, 0);
    const sales = subtotal + tax;
    const expected = s.startBalance + sales;
    const cnt = counted === undefined || Number.isNaN(counted) ? expected : counted;
    const variance = cnt - expected;

    await tx.pOSSession.update({
      where: { id: s.id },
      data: { status: 'Closed', closedAt: new Date(), expectedBalance: expected, countedBalance: cnt, variance },
    });
    if (sales > 0) {
      await postJournal(tx, `Penjualan POS sesi ${s.sessionNumber}`, s.sessionNumber, [
        { accountCode: '1000', debit: sales, credit: 0 },
        { accountCode: '4010', debit: 0, credit: subtotal },
        { accountCode: '2100', debit: 0, credit: tax },
      ]);
    }
    if (Math.abs(variance) > 0.5) {
      await postJournal(tx, `Selisih kas sesi ${s.sessionNumber}`, s.sessionNumber, [
        { accountCode: variance > 0 ? '1000' : '6100', debit: Math.abs(variance), credit: 0 },
        { accountCode: variance > 0 ? '6100' : '1000', debit: 0, credit: Math.abs(variance) },
      ]);
    }
    const units = Array.from(sold.values()).reduce((a, b) => a + b, 0);
    return `Sesi ${s.sessionNumber} ditutup. Stok SHOP berkurang ${units} unit sesuai penjualan.`;
  });
}
RR_EOF
echo "  ✓ lib/erp.ts"
mkdir -p "lib"
cat > "lib/password.ts" <<'RR_EOF'
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
RR_EOF
echo "  ✓ lib/password.ts"
mkdir -p "lib"
cat > "lib/session.ts" <<'RR_EOF'
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
RR_EOF
echo "  ✓ lib/session.ts"
cat > "middleware.ts" <<'RR_EOF'
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
RR_EOF
echo "  ✓ middleware.ts"
mkdir -p "prisma"
cat > "prisma/schema.prisma" <<'RR_EOF'
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

model Contact {
  id             String          @id @default(uuid())
  contactId      String          @unique
  name           String
  type           String          // BUSINESS, INDIVIDUAL, VENDOR
  city           String
  creditLimit    Float           @default(0)
  paymentTerms   String          // PT-CASH, PT-7, PT-14
  category       String?         // Khusus Vendor
  salesOrders    SalesOrder[]
  quotations     Quotation[]
  purchaseOrders PurchaseOrder[]
  vendorBills    VendorBill[]
  invoices       Invoice[]
}

model Product {
  sku             String              @id
  name            String
  uom             String              @default("Unit")
  salesPrice      Float
  cost            Float
  defaultVendorId String
  taxCode         String              @default("PPN-E11")
  stocks          Stock[]
  quotationLines  QuotationLine[]
  soLines         SalesOrderLine[]
  poLines         PurchaseOrderLine[]
  doLines         DeliveryOrderLine[]
  invoiceLines    InvoiceLine[]
  billLines       VendorBillLine[]
  posLines        POSOrderLine[]
  receiptLines    ReceiptLine[]
}

model Warehouse {
  locationId String  @id
  name       String
  type       String
  city       String
  stocks     Stock[]
}

model Stock {
  id          String    @id @default(uuid())
  sku         String
  locationId  String
  qtyOnHand   Int       @default(0)
  qtyReserved Int       @default(0)
  product     Product   @relation(fields: [sku], references: [sku])
  warehouse   Warehouse @relation(fields: [locationId], references: [locationId])

  @@unique([sku, locationId])
}

model Account {
  code         String        @id
  name         String
  type         String
  journalLines JournalLine[]
}

model Quotation {
  id          String          @id @default(uuid())
  docNumber   String          @unique
  customerId  String
  status      String          @default("Draft")
  subtotal    Float
  taxAmount   Float
  totalAmount Float
  customer    Contact         @relation(fields: [customerId], references: [id])
  lines       QuotationLine[]
  createdAt   DateTime        @default(now())
}

model QuotationLine {
  id          String    @id @default(uuid())
  quotationId String
  sku         String
  qty         Int
  unitPrice   Float
  subtotal    Float
  quotation   Quotation @relation(fields: [quotationId], references: [id])
  product     Product   @relation(fields: [sku], references: [sku])
}

model SalesOrder {
  id          String           @id @default(uuid())
  docNumber   String           @unique
  customerId  String
  status      String           @default("Draft")
  subtotal    Float
  taxAmount   Float
  totalAmount Float
  customer    Contact          @relation(fields: [customerId], references: [id])
  lines       SalesOrderLine[]
  deliveries  DeliveryOrder[]
  invoices    Invoice[]
  createdAt   DateTime         @default(now())
}

model SalesOrderLine {
  id           String     @id @default(uuid())
  salesOrderId String
  sku          String
  qtyOrdered   Int
  qtyDelivered Int        @default(0)
  qtyInvoiced  Int        @default(0)
  unitPrice    Float
  subtotal     Float
  salesOrder   SalesOrder @relation(fields: [salesOrderId], references: [id])
  product      Product    @relation(fields: [sku], references: [sku])
}

model PurchaseOrder {
  id          String              @id @default(uuid())
  docNumber   String              @unique
  vendorId    String
  status      String              @default("Draft")
  subtotal    Float
  taxAmount   Float
  totalAmount Float
  vendor      Contact             @relation(fields: [vendorId], references: [id])
  lines       PurchaseOrderLine[]
  vendorBills VendorBill[]
  receipts    Receipt[]
  createdAt   DateTime            @default(now())
}

model PurchaseOrderLine {
  id              String        @id @default(uuid())
  purchaseOrderId String
  sku             String
  qtyOrdered      Int
  qtyReceived     Int           @default(0)
  qtyBilled       Int           @default(0)
  unitPrice       Float
  subtotal        Float
  purchaseOrder   PurchaseOrder @relation(fields: [purchaseOrderId], references: [id])
  product         Product       @relation(fields: [sku], references: [sku])
}

model DeliveryOrder {
  id           String              @id @default(uuid())
  docNumber    String              @unique
  salesOrderId String
  status       String              @default("Draft")
  salesOrder   SalesOrder          @relation(fields: [salesOrderId], references: [id])
  lines        DeliveryOrderLine[]
  createdAt    DateTime            @default(now())
}

model DeliveryOrderLine {
  id              String        @id @default(uuid())
  deliveryOrderId String
  sku             String
  qtyDone         Int
  deliveryOrder   DeliveryOrder @relation(fields: [deliveryOrderId], references: [id])
  product         Product       @relation(fields: [sku], references: [sku])
}

model Receipt {
  id              String         @id @default(uuid())
  docNumber       String         @unique
  purchaseOrderId String
  status          String         @default("Ready")
  purchaseOrder   PurchaseOrder  @relation(fields: [purchaseOrderId], references: [id])
  lines           ReceiptLine[]
  createdAt       DateTime       @default(now())
}

model ReceiptLine {
  id        String   @id @default(uuid())
  receiptId String
  sku       String
  qtyDone   Int
  receipt   Receipt  @relation(fields: [receiptId], references: [id])
  product   Product  @relation(fields: [sku], references: [sku])
}

model Invoice {
  id           String        @id @default(uuid())
  docNumber    String        @unique
  salesOrderId String?
  customerId   String
  status       String        @default("Draft")
  subtotal     Float
  taxAmount    Float
  totalAmount  Float
  customer     Contact       @relation(fields: [customerId], references: [id])
  salesOrder   SalesOrder?   @relation(fields: [salesOrderId], references: [id])
  lines        InvoiceLine[]
  createdAt    DateTime      @default(now())
}

model InvoiceLine {
  id        String   @id @default(uuid())
  invoiceId String
  sku       String
  qty       Int
  unitPrice Float
  subtotal  Float
  invoice   Invoice  @relation(fields: [invoiceId], references: [id])
  product   Product  @relation(fields: [sku], references: [sku])
}

model VendorBill {
  id              String           @id @default(uuid())
  docNumber       String           @unique
  purchaseOrderId String?
  vendorId        String
  status          String           @default("Draft")
  subtotal        Float
  taxAmount       Float
  totalAmount     Float
  vendor          Contact          @relation(fields: [vendorId], references: [id])
  purchaseOrder   PurchaseOrder?  @relation(fields: [purchaseOrderId], references: [id])
  lines           VendorBillLine[]
  createdAt       DateTime         @default(now())
}

model VendorBillLine {
  id           String     @id @default(uuid())
  vendorBillId String
  sku          String
  qty          Int
  unitPrice    Float
  subtotal     Float
  vendorBill   VendorBill @relation(fields: [vendorBillId], references: [id])
  product      Product    @relation(fields: [sku], references: [sku])
}

model JournalEntry {
  id          String        @id @default(uuid())
  docNumber   String        @unique
  date        DateTime      @default(now())
  ref         String?
  description String?
  lines       JournalLine[]
  createdAt   DateTime      @default(now())
}

model JournalLine {
  id             String       @id @default(uuid())
  journalEntryId String
  accountCode    String
  debit          Float        @default(0)
  credit         Float        @default(0)
  journalEntry   JournalEntry @relation(fields: [journalEntryId], references: [id])
  account        Account      @relation(fields: [accountCode], references: [code])
}

model POSSession {
  id              String     @id @default(uuid())
  sessionNumber   String     @unique
  cashierName     String
  status          String     @default("Open")
  startBalance    Float
  countedBalance  Float?
  expectedBalance Float?
  variance        Float?
  varianceReason  String?
  orders          POSOrder[]
  openedAt        DateTime   @default(now())
  closedAt        DateTime?
}

model POSOrder {
  id          String         @id @default(uuid())
  sessionId   String
  docNumber   String         @unique
  subtotal    Float
  taxAmount   Float
  totalAmount Float
  paidAmount  Float
  change      Float
  session     POSSession     @relation(fields: [sessionId], references: [id])
  lines       POSOrderLine[]
  createdAt   DateTime       @default(now())
}

model POSOrderLine {
  id         String   @id @default(uuid())
  posOrderId String
  sku        String
  qty        Int
  unitPrice  Float
  subtotal   Float
  posOrder   POSOrder @relation(fields: [posOrderId], references: [id])
  product    Product  @relation(fields: [sku], references: [sku])
}
model Lead {
  id          String   @id @default(uuid())
  title       String
  contactName String
  email       String?
  phone       String?
  value       Float    @default(0)
  stage       String   @default("New") // Options: New, Qualified, Proposition, Won, Lost
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}


// AppUser: system users with RBAC
model AppUser {
  id           String   @id @default(uuid())
  email        String   @unique
  username     String   @unique
  passwordHash String
  name         String
  role         String   @default("STAFF") // SUPERADMIN, OWNER, SALES, WAREHOUSE, FINANCE, PURCHASING, CASHIER, STAFF
  access       String   @default("") // comma-separated module IDs, e.g. "dashboard,crm,sales"
  active       Boolean  @default(true)
  createdAt    DateTime @default(now())
}
RR_EOF
echo "  ✓ prisma/schema.prisma"
mkdir -p "prisma"
cat > "prisma/seed.ts" <<'RR_EOF'
import { PrismaClient } from "@prisma/client";
import { createHash } from "crypto";

function hashPassword(plain: string): string {
  const salt = "ruparuang-salt-2024";
  return createHash("sha256").update(salt + plain).digest("hex");
}

const prisma = new PrismaClient();

async function main() {
  console.log("Mulai nge-seed data RupaRuang Retail...");

  // 1. Seed Accounts (Chart of Accounts)
  const accounts = [
    { code: "1000", name: "Cash Kas Gerai", type: "Asset" },
    { code: "1010", name: "Bank", type: "Asset" },
    { code: "1100", name: "Trade Receivables", type: "Asset" },
    { code: "1150", name: "PPN Masukan", type: "Asset" },
    { code: "1200", name: "Inventory Valuation", type: "Asset" },
    { code: "1210", name: "Stock Interim Received (GRNI)", type: "Clearing liability" },
    { code: "2000", name: "Trade Payables", type: "Liability" },
    { code: "2100", name: "PPN Keluaran", type: "Liability" },
    { code: "3000", name: "Opening Equity", type: "Equity" },
    { code: "4000", name: "Sales Revenue B2B", type: "Revenue" },
    { code: "4010", name: "POS Sales Revenue", type: "Revenue" },
    { code: "4100", name: "Sales Returns / Contra Revenue", type: "Contra revenue" },
    { code: "5000", name: "COGS-B2B", type: "Expense" },
    { code: "5010", name: "COGS-POS", type: "Expense" },
    { code: "6100", name: "Cash Overage/Shortage", type: "Other income/expense" },
  ];
  for (const acc of accounts) {
    await prisma.account.upsert({
      where: { code: acc.code },
      update: acc,
      create: acc,
    });
  }

  // 2. Seed Contacts (Pelanggan C01-C06 & Vendor V01-V04)
  const contacts = [
    { contactId: "C01", name: "PT Kantor Sentosa", type: "BUSINESS", city: "Jakarta", creditLimit: 5000000, paymentTerms: "PT-14" },
    { contactId: "C02", name: "CV Maju Properti", type: "BUSINESS", city: "Depok", creditLimit: 2000000, paymentTerms: "PT-14" },
    { contactId: "C03", name: "Sari Wulandari", type: "INDIVIDUAL", city: "Jakarta", creditLimit: 0, paymentTerms: "PT-CASH" },
    { contactId: "C04", name: "Benny Pratama", type: "INDIVIDUAL", city: "Jakarta", creditLimit: 0, paymentTerms: "PT-CASH" },
    { contactId: "C05", name: "Toko Sinar Cepat", type: "BUSINESS", city: "Bekasi", creditLimit: 3000000, paymentTerms: "PT-14" },
    { contactId: "C06", name: "Anisa Putri", type: "INDIVIDUAL", city: "Tangerang", creditLimit: 0, paymentTerms: "PT-CASH" },
    { contactId: "V01", name: "PT Bina Plastik Abadi", type: "VENDOR", city: "Jakarta", creditLimit: 0, paymentTerms: "PT-14", category: "Peralatan plastik dan penyimpanan" },
    { contactId: "V02", name: "PT Sinar Elektrik", type: "VENDOR", city: "Tangerang", creditLimit: 0, paymentTerms: "PT-14", category: "Peralatan listrik dan penerangan" },
    { contactId: "V03", name: "CV Tekstil Bersih", type: "VENDOR", city: "Bogor", creditLimit: 0, paymentTerms: "PT-7", category: "Tekstil dan perlengkapan kebersihan" },
    { contactId: "V04", name: "PT Dapur Prima", type: "VENDOR", city: "Bekasi", creditLimit: 0, paymentTerms: "PT-14", category: "Peralatan dapur dan minum" },
  ];
  for (const c of contacts) {
    await prisma.contact.upsert({
      where: { contactId: c.contactId },
      update: c,
      create: c,
    });
  }

  // 3. Seed Products (P001-P016)
  const products = [
    { sku: "P001", name: "Kotak Simpan 20L", salesPrice: 120000, cost: 75000, defaultVendorId: "V01" },
    { sku: "P002", name: "Rak Serbaguna 3 Tingkat", salesPrice: 350000, cost: 230000, defaultVendorId: "V01" },
    { sku: "P003", name: "Lampu Meja LED", salesPrice: 180000, cost: 110000, defaultVendorId: "V02" },
    { sku: "P004", name: "Bohlam LED 9W", salesPrice: 45000, cost: 27000, defaultVendorId: "V02" },
    { sku: "P005", name: "Keset Anti Selip", salesPrice: 65000, cost: 38000, defaultVendorId: "V03" },
    { sku: "P006", name: "Sapu Microfiber", salesPrice: 90000, cost: 54000, defaultVendorId: "V03" },
    { sku: "P007", name: "Botol Minum 1L", salesPrice: 85000, cost: 48000, defaultVendorId: "V04" },
    { sku: "P008", name: "Tempat Sampah 12L", salesPrice: 145000, cost: 90000, defaultVendorId: "V01" },
    { sku: "P009", name: "Panci Stainless 20cm", salesPrice: 275000, cost: 180000, defaultVendorId: "V04" },
    { sku: "P010", name: "Wajan Anti Lengket", salesPrice: 295000, cost: 195000, defaultVendorId: "V04" },
    { sku: "P011", name: "Gantungan Pakaian 10pc", salesPrice: 55000, cost: 31000, defaultVendorId: "V01" },
    { sku: "P012", name: "Keranjang Laundry", salesPrice: 185000, cost: 120000, defaultVendorId: "V01" },
    { sku: "P013", name: "Sarung Bantal 2pc", salesPrice: 95000, cost: 58000, defaultVendorId: "V03" },
    { sku: "P014", name: "Lap Dapur 3pc", salesPrice: 60000, cost: 34000, defaultVendorId: "V03" },
    { sku: "P015", name: "Stop Kontak 4 Lubang", salesPrice: 160000, cost: 101000, defaultVendorId: "V02" },
    { sku: "P016", name: "Rak Sepatu Lipat", salesPrice: 245000, cost: 155000, defaultVendorId: "V01" },
  ];
  for (const p of products) {
    await prisma.product.upsert({
      where: { sku: p.sku },
      update: p,
      create: p,
    });
  }

  // 4. Seed Warehouses & Opening Stock
  await prisma.warehouse.upsert({
    where: { locationId: "WH" },
    update: {},
    create: { locationId: "WH", name: "WH/JKT/Stock - Gudang utama Jakarta Timur", type: "Pembelian B2B dan stok buffer", city: "Jakarta Timur" },
  });
  await prisma.warehouse.upsert({
    where: { locationId: "SHOP" },
    update: {},
    create: { locationId: "SHOP", name: "SHOP/DPK/Stock - Gerai Depok", type: "Stok jual Point of Sale", city: "Depok" },
  });

  const stocks = [
    { sku: "P001", WH: 20, SHOP: 8 }, { sku: "P002", WH: 6, SHOP: 3 },
    { sku: "P003", WH: 10, SHOP: 5 }, { sku: "P004", WH: 60, SHOP: 30 },
    { sku: "P005", WH: 18, SHOP: 10 }, { sku: "P006", WH: 16, SHOP: 7 },
    { sku: "P007", WH: 25, SHOP: 12 }, { sku: "P008", WH: 12, SHOP: 6 },
    { sku: "P009", WH: 9, SHOP: 4 }, { sku: "P010", WH: 7, SHOP: 3 },
    { sku: "P011", WH: 30, SHOP: 15 }, { sku: "P012", WH: 11, SHOP: 5 },
    { sku: "P013", WH: 20, SHOP: 12 }, { sku: "P014", WH: 24, SHOP: 13 },
    { sku: "P015", WH: 15, SHOP: 8 }, { sku: "P016", WH: 9, SHOP: 4 },
  ];

  for (const s of stocks) {
    await prisma.stock.upsert({
      where: { sku_locationId: { sku: s.sku, locationId: "WH" } },
      update: { qtyOnHand: s.WH },
      create: { sku: s.sku, locationId: "WH", qtyOnHand: s.WH },
    });
    await prisma.stock.upsert({
      where: { sku_locationId: { sku: s.sku, locationId: "SHOP" } },
      update: { qtyOnHand: s.SHOP },
      create: { sku: s.sku, locationId: "SHOP", qtyOnHand: s.SHOP },
    });
  }

  // 5. Existing Documents: Q00031 & PO00018
  const c01 = await prisma.contact.findUnique({ where: { contactId: "C01" } });
  if (c01) {
    const existingQ = await prisma.quotation.findUnique({ where: { docNumber: "Q00031" } });
    if (!existingQ) {
      await prisma.quotation.create({
        data: {
          docNumber: "Q00031",
          customerId: c01.id,
          status: "Draft",
          subtotal: 840000,
          taxAmount: 92400,
          totalAmount: 932400,
          lines: {
            create: [
              { sku: "P001", qty: 4, unitPrice: 120000, subtotal: 480000 },
              { sku: "P003", qty: 2, unitPrice: 180000, subtotal: 360000 },
            ],
          },
        },
      });
    }
  }

  const v01 = await prisma.contact.findUnique({ where: { contactId: "V01" } });
  if (v01) {
    const existingPO = await prisma.purchaseOrder.findUnique({ where: { docNumber: "PO00018" } });
    if (!existingPO) {
      await prisma.purchaseOrder.create({
        data: {
          docNumber: "PO00018",
          vendorId: v01.id,
          status: "Confirmed",
          subtotal: 1670000,
          taxAmount: 183700,
          totalAmount: 1853700,
          lines: {
            create: [
              { sku: "P001", qtyOrdered: 10, unitPrice: 75000, subtotal: 750000 },
              { sku: "P002", qtyOrdered: 4, unitPrice: 230000, subtotal: 920000 },
            ],
          },
        },
      });
    }
  }

  // Receipt untuk PO00018 yang sudah Confirmed (alur Procure-to-Pay)
  const po18 = await prisma.purchaseOrder.findUnique({ where: { docNumber: "PO00018" }, include: { lines: true } });
  if (po18 && po18.status === "Confirmed") {
    const rc = await prisma.receipt.findUnique({ where: { docNumber: "RC00018" } });
    if (!rc) {
      await prisma.receipt.create({
        data: {
          docNumber: "RC00018",
          purchaseOrderId: po18.id,
          status: "Ready",
          lines: { create: po18.lines.map((l) => ({ sku: l.sku, qtyDone: l.qtyOrdered })) },
        },
      });
    }
  }

  console.log("Seeding data awal BERHASIL! Database siap dipakai.");

  // 6. Seed AppUsers (7 akun: 1 superadmin + 6 role)
  const appUsers = [
    {
      email: "superadmin@ruparuang.com",
      username: "superadmin",
      password: "admin123456",
      name: "Super Admin RupaRuang",
      role: "SUPERADMIN",
      access: "dashboard,contacts,crm,inventory,sales,purchase,pos,invoicing,accounting",
    },
    {
      email: "owner@ruparuang.com",
      username: "owner",
      password: "owner123",
      name: "Hendra Wijaya",
      role: "OWNER",
      access: "dashboard,contacts,crm,inventory,sales,purchase,pos,invoicing,accounting",
    },
    {
      email: "sales@ruparuang.com",
      username: "maya.sales",
      password: "sales123",
      name: "Maya Lestari",
      role: "SALES",
      access: "contacts,crm,sales,inventory",
    },
    {
      email: "warehouse@ruparuang.com",
      username: "doni.warehouse",
      password: "warehouse123",
      name: "Doni Saputra",
      role: "WAREHOUSE",
      access: "inventory,purchase",
    },
    {
      email: "finance@ruparuang.com",
      username: "sinta.finance",
      password: "finance123",
      name: "Sinta Rahmawati",
      role: "FINANCE",
      access: "contacts,invoicing,accounting",
    },
    {
      email: "purchasing@ruparuang.com",
      username: "awan.purch",
      password: "purch123",
      name: "Awan Nugraha",
      role: "PURCHASING",
      access: "purchase,contacts",
    },
    {
      email: "cashier@ruparuang.com",
      username: "rina.kasir",
      password: "cashier123",
      name: "Rina Hartati",
      role: "CASHIER",
      access: "pos",
    },
  ];

  for (const u of appUsers) {
    await prisma.appUser.upsert({
      where: { email: u.email },
      update: {
        username: u.username,
        passwordHash: hashPassword(u.password),
        name: u.name,
        role: u.role,
        access: u.access,
        active: true,
      },
      create: {
        email: u.email,
        username: u.username,
        passwordHash: hashPassword(u.password),
        name: u.name,
        role: u.role,
        access: u.access,
        active: true,
      },
    });
    console.log(`  ✓ User seeded: ${u.email} (${u.role})`);
  }

  console.log("\n✅ Seeding SELESAI! 7 akun pengguna + data ERP siap digunakan.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
RR_EOF
echo "  ✓ prisma/seed.ts"
echo ""; echo "Selesai. Lanjut: npx prisma db push && npx prisma db seed && npm run dev"
