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
          <Link
            href="/pos"
            className="hidden lg:flex items-center gap-1 px-2.5 py-1 rounded bg-[#00F0FF]/15 text-[#00F0FF] border border-[#00F0FF]/30 hover:bg-[#00F0FF]/25 font-bold transition-all"
          >
            <span>🏪</span>
            <span>Kasir POS</span>
          </Link>

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

                  <Link
                    href="/pos"
                    onClick={() => setIsProfileOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2 hover:bg-[#F8FAFC] dark:hover:bg-[#334155] text-[#0F172A] dark:text-[#F8FAFC] transition-colors"
                  >
                    <span className="text-sm">🏪</span>
                    <span>Kasir POS (Depok)</span>
                  </Link>
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
