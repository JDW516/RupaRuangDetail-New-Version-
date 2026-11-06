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

