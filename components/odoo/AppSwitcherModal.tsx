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
