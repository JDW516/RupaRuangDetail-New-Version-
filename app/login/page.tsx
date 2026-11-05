'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Login gagal. Periksa kembali data Anda.');
      } else {
        router.push('/');
        router.refresh();
      }
    } catch {
      setError('Koneksi ke server gagal. Silakan coba lagi.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4 selection:bg-[#CFFF30] selection:text-[#0F172A]">
      <div className="w-full max-w-sm">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#1E293B] shadow-md mb-4 border border-slate-700/60">
            <span className="text-[#CFFF30] font-black text-2xl tracking-tight">RR</span>
          </div>
          <h1 className="text-2xl font-black text-[#0F172A] tracking-tight">RupaRuang ERP</h1>
          <p className="text-xs text-[#64748B] mt-1 font-medium">
            PT RupaRuang Niaga · Odoo Web 17.0
          </p>
        </div>

        {/* Clean Login Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-[#E2E8F0] p-8">
          <div className="mb-6">
            <h2 className="text-base font-bold text-[#0F172A]">Masuk ke Akun</h2>
            <p className="text-xs text-[#64748B] mt-0.5">
              Silakan masukkan kredensial akun terdaftar Anda
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#0F172A] mb-1.5">
                Email atau Username
              </label>
              <input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="nama@ruparuang.com atau username"
                autoComplete="username"
                required
                className="w-full px-3.5 py-2.5 rounded-lg border border-[#E2E8F0] text-sm text-[#0F172A] bg-white focus:outline-none focus:ring-2 focus:ring-[#CFFF30] focus:border-transparent transition placeholder:text-[#94A3B8]"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-[#0F172A]">
                  Password
                </label>
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
                className="w-full px-3.5 py-2.5 rounded-lg border border-[#E2E8F0] text-sm text-[#0F172A] bg-white focus:outline-none focus:ring-2 focus:ring-[#CFFF30] focus:border-transparent transition placeholder:text-[#94A3B8]"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5 text-xs text-[#EF4444] font-medium flex items-center gap-2">
                <span>⚠️</span>
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#CFFF30] text-[#0F172A] font-extrabold py-2.5 rounded-lg text-sm hover:brightness-95 active:brightness-90 transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-xs mt-2"
            >
              {loading ? 'Memverifikasi...' : 'Masuk →'}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-[11px] text-[#94A3B8] mt-6">
          Sistem ERP Ritel Terintegrasi · Keamanan Berlapis RBAC
        </p>
      </div>
    </div>
  );
}
