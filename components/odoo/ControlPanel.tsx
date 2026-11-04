'use client';

import React, { useState } from 'react';
import Link from 'next/link';

export type OdooViewType = 'list' | 'kanban' | 'form' | 'pivot' | 'graph';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface ActionMenuItem {
  label: string;
  onClick: () => void;
  icon?: string;
  danger?: boolean;
}

export interface ControlPanelProps {
  breadcrumbs: BreadcrumbItem[];
  title?: string;
  // Action Buttons
  onNew?: () => void;
  newButtonLabel?: string;
  onSave?: () => void;
  onDiscard?: () => void;
  showSaveDiscard?: boolean;
  actions?: ActionMenuItem[];
  // Search & Filters
  searchValue?: string;
  onSearchChange?: (val: string) => void;
  searchPlaceholder?: string;
  onFilterClick?: () => void;
  onGroupByClick?: () => void;
  activeFilter?: string;
  activeGroupBy?: string;
  // View Switchers
  availableViews?: OdooViewType[];
  currentView?: OdooViewType;
  onViewChange?: (view: OdooViewType) => void;
  // Pager
  pagerText?: string;
  onPrevPage?: () => void;
  onNextPage?: () => void;
  children?: React.ReactNode;
}

export default function ControlPanel({
  breadcrumbs,
  title,
  onNew,
  newButtonLabel = 'New',
  onSave,
  onDiscard,
  showSaveDiscard = false,
  actions = [],
  searchValue = '',
  onSearchChange,
  searchPlaceholder = 'Search...',
  onFilterClick,
  onGroupByClick,
  activeFilter,
  activeGroupBy,
  availableViews = ['list', 'kanban'],
  currentView = 'list',
  onViewChange,
  pagerText,
  onPrevPage,
  onNextPage,
  children,
}: ControlPanelProps) {
  const [isActionDropdownOpen, setIsActionDropdownOpen] = useState(false);
  const [internalSearch, setInternalSearch] = useState(searchValue);

  const handleSearch = (val: string) => {
    setInternalSearch(val);
    if (onSearchChange) onSearchChange(val);
  };

  return (
    <div className="bg-[#FFFFFF] border-b border-[#E2E8F0] px-4 py-2.5 shadow-2xs sticky top-12 z-20">
      {/* Baris Atas: Breadcrumbs & Search View */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        {/* Sisi Kiri: Breadcrumbs Hierarchy */}
        <div className="flex items-center gap-2 overflow-x-auto text-sm">
          {title && (
            <span className="font-bold text-[#0F172A] mr-2 text-base">{title}</span>
          )}
          {breadcrumbs.map((b, idx) => {
            const isLast = idx === breadcrumbs.length - 1;
            return (
              <React.Fragment key={idx}>
                {idx > 0 && <span className="text-[#64748B]">/</span>}
                {b.href && !isLast ? (
                  <Link
                    href={b.href}
                    className="text-[#64748B] hover:text-[#0F172A] hover:underline transition-colors whitespace-nowrap font-medium"
                  >
                    {b.label}
                  </Link>
                ) : (
                  <span
                    className={`whitespace-nowrap ${
                      isLast ? 'text-[#0F172A] text-base font-bold' : 'text-[#64748B] font-medium'
                    }`}
                  >
                    {b.label}
                  </span>
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Sisi Kanan: Odoo Search Input, Filter, & Group By */}
        <div className="flex items-center gap-1.5 flex-1 max-w-md ml-auto">
          <div className="relative flex-1 flex items-center bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-2.5 py-1.5 focus-within:border-[#00F0FF] focus-within:ring-1 focus-within:ring-[#00F0FF] transition-all">
            <svg
              className="w-3.5 h-3.5 text-[#64748B] mr-2 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              value={internalSearch}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full bg-transparent text-xs text-[#0F172A] placeholder-[#64748B] outline-none"
            />
            {internalSearch && (
              <button
                type="button"
                onClick={() => handleSearch('')}
                className="text-[#64748B] hover:text-[#0F172A] text-xs px-1"
              >
                ✕
              </button>
            )}
          </div>

          {/* Filter Dropdown Button */}
          <button
            type="button"
            onClick={onFilterClick}
            className={`px-2.5 py-1.5 border rounded-lg text-xs font-medium flex items-center gap-1 transition-colors ${
              activeFilter
                ? 'bg-[#00F0FF]/15 text-[#0F172A] border-[#00F0FF]'
                : 'bg-[#FFFFFF] border-[#E2E8F0] text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC]'
            }`}
            title="Filters (Filter data aktif)"
          >
            <span>⚡</span>
            <span className="hidden sm:inline">Filters</span>
            {activeFilter && (
              <span className="w-1.5 h-1.5 rounded-full bg-[#00F0FF]" />
            )}
          </button>

          {/* Group By Button */}
          <button
            type="button"
            onClick={onGroupByClick}
            className={`px-2.5 py-1.5 border rounded-lg text-xs font-medium flex items-center gap-1 transition-colors ${
              activeGroupBy
                ? 'bg-[#CFFF30]/40 text-[#0F172A] border-[#CFFF30]'
                : 'bg-[#FFFFFF] border-[#E2E8F0] text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC]'
            }`}
            title="Group By (Kelompokkan data)"
          >
            <span>📁</span>
            <span className="hidden sm:inline">Group By</span>
          </button>
        </div>
      </div>

      {/* Baris Bawah: Action Buttons & View Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 mt-2 pt-2 border-t border-[#E2E8F0]/70">
        {/* Sisi Kiri: New, Save, Discard, & Actions Gear */}
        <div className="flex items-center gap-2 flex-wrap">
          {onNew && (
            <button
              type="button"
              onClick={onNew}
              className="bg-[#CFFF30] hover:brightness-95 text-[#0F172A] font-extrabold text-xs px-3.5 py-1.5 rounded-md shadow-xs transition-all flex items-center gap-1"
            >
              <span>+</span>
              <span>{newButtonLabel}</span>
            </button>
          )}

          {showSaveDiscard && (
            <>
              <button
                type="button"
                onClick={onSave}
                className="bg-[#1E293B] hover:bg-slate-800 text-white font-bold text-xs px-3 py-1.5 rounded-md shadow-xs transition-all"
              >
                Save
              </button>
              <button
                type="button"
                onClick={onDiscard}
                className="bg-white border border-[#E2E8F0] text-[#64748B] hover:text-[#0F172A] text-xs px-3 py-1.5 rounded-md transition-all"
              >
                Discard
              </button>
            </>
          )}

          {actions.length > 0 && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsActionDropdownOpen(!isActionDropdownOpen)}
                className="border border-[#E2E8F0] bg-white text-[#64748B] hover:text-[#0F172A] px-2.5 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 hover:bg-[#F8FAFC] transition-colors"
              >
                <span>⚙️ Actions</span>
                <span className="text-[10px]">▼</span>
              </button>

              {isActionDropdownOpen && (
                <div className="absolute left-0 mt-1 w-44 bg-white border border-[#E2E8F0] rounded-lg shadow-lg py-1 z-30">
                  {actions.map((act, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setIsActionDropdownOpen(false);
                        act.onClick();
                      }}
                      className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-[#F8FAFC] transition-colors ${
                        act.danger ? 'text-[#EF4444]' : 'text-[#0F172A]'
                      }`}
                    >
                      {act.icon && <span>{act.icon}</span>}
                      <span>{act.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Custom Action Children (e.g. Server action forms or quick filter buttons) */}
          {children}
        </div>

        {/* Sisi Kanan: Pager & View Switchers */}
        <div className="flex items-center gap-3 ml-auto text-xs text-[#64748B]">
          {pagerText && (
            <div className="flex items-center gap-1 font-mono">
              <span>{pagerText}</span>
              {(onPrevPage || onNextPage) && (
                <div className="flex items-center border border-[#E2E8F0] rounded overflow-hidden ml-1">
                  <button
                    type="button"
                    onClick={onPrevPage}
                    className="px-1.5 py-0.5 hover:bg-[#F8FAFC] text-[#0F172A] disabled:opacity-40"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    onClick={onNextPage}
                    className="px-1.5 py-0.5 hover:bg-[#F8FAFC] text-[#0F172A] disabled:opacity-40 border-l border-[#E2E8F0]"
                  >
                    ›
                  </button>
                </div>
              )}
            </div>
          )}

          {/* View Switchers Icons (List, Kanban, Form) */}
          {availableViews.length > 1 && onViewChange && (
            <div className="flex items-center border border-[#E2E8F0] rounded-md overflow-hidden bg-[#FFFFFF]">
              {availableViews.includes('list') && (
                <button
                  type="button"
                  onClick={() => onViewChange('list')}
                  className={`p-1.5 transition-colors ${
                    currentView === 'list'
                      ? 'bg-[#1E293B] text-[#CFFF30]'
                      : 'text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC]'
                  }`}
                  title="List View"
                >
                  <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                    <path d="M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z" />
                  </svg>
                </button>
              )}
              {availableViews.includes('kanban') && (
                <button
                  type="button"
                  onClick={() => onViewChange('kanban')}
                  className={`p-1.5 border-l border-[#E2E8F0] transition-colors ${
                    currentView === 'kanban'
                      ? 'bg-[#1E293B] text-[#CFFF30]'
                      : 'text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC]'
                  }`}
                  title="Kanban View"
                >
                  <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                    <path d="M3 5h8v14H3V5zm10 0h8v8h-8V5zm0 10h8v4h-8v-4z" />
                  </svg>
                </button>
              )}
              {availableViews.includes('graph') && (
                <button
                  type="button"
                  onClick={() => onViewChange('graph')}
                  className={`p-1.5 border-l border-[#E2E8F0] transition-colors ${
                    currentView === 'graph'
                      ? 'bg-[#1E293B] text-[#CFFF30]'
                      : 'text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC]'
                  }`}
                  title="Graph / Pivot View"
                >
                  <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                    <path d="M5 9.2h3V19H5zM10.6 5h2.8v14h-2.8zm5.6 8H19v6h-2.8z" />
                  </svg>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
