'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import AppSwitcherModal from './AppSwitcherModal';

export interface AppNavbarProps {
  currentModule?: string;
  subMenus?: { label: string; href: string; active?: boolean }[];
  companyName?: string;
  userName?: string;
}

export default function AppNavbar({
  currentModule = 'Sales & CRM',
  subMenus = [],
  companyName = 'RupaRuang Retail (Depok)',
  userName = 'Admin Kasir',
}: AppNavbarProps) {
  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);

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

        {/* Kanan: Company Switcher, Notifikasi, Status & User Menu */}
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

          {/* User Profile */}
          <div className="flex items-center gap-1.5 pl-2 border-l border-white/15">
            <div className="w-7 h-7 rounded-full bg-[#CFFF30] text-[#0F172A] font-extrabold flex items-center justify-center text-[11px] shadow-xs">
              {userName.slice(0, 2).toUpperCase()}
            </div>
            <span className="hidden md:inline text-white/90 font-medium">{userName}</span>
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
