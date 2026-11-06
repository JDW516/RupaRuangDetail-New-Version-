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
