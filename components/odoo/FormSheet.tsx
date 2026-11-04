'use client';

import React from 'react';
import SmartButtons, { SmartButtonItem } from './SmartButtons';

export interface FormSheetProps {
  title?: string;
  subtitle?: string;
  ribbon?: {
    text: string;
    variant?: 'success' | 'warning' | 'danger' | 'info';
  };
  smartButtons?: SmartButtonItem[];
  children: React.ReactNode;
}

export default function FormSheet({
  title,
  subtitle,
  ribbon,
  smartButtons,
  children,
}: FormSheetProps) {
  return (
    <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl p-6 md:p-8 shadow-xs relative overflow-hidden">
      {/* Ribbon Banner Odoo (e.g. "CONFIRMED", "PAID", "DONE") */}
      {ribbon && (
        <div className="absolute top-4 right-[-35px] rotate-45 z-10">
          <div
            className={`text-[10px] font-extrabold uppercase tracking-widest px-10 py-1 text-center shadow-xs text-white ${
              ribbon.variant === 'danger'
                ? 'bg-[#EF4444]'
                : ribbon.variant === 'warning'
                ? 'bg-[#F59E0B]'
                : ribbon.variant === 'info'
                ? 'bg-[#3B82F6]'
                : 'bg-[#10B981]'
            }`}
          >
            {ribbon.text}
          </div>
        </div>
      )}

      {/* Baris Smart Buttons di Pojok Kanan Atas */}
      {smartButtons && smartButtons.length > 0 && (
        <div className="flex justify-end">
          <SmartButtons items={smartButtons} />
        </div>
      )}

      {/* Header Dokumen: Subtitle & Title */}
      {(title || subtitle) && (
        <div className="mb-6">
          {subtitle && (
            <span className="text-xs font-bold text-[#64748B] uppercase tracking-wider block mb-1">
              {subtitle}
            </span>
          )}
          {title && (
            <h1 className="text-2xl sm:text-3xl font-black text-[#0F172A] tracking-tight font-mono">
              {title}
            </h1>
          )}
        </div>
      )}

      {/* Konten Utama Dokumen (Grid metadata, Notebook, etc.) */}
      <div>{children}</div>
    </div>
  );
}

/**
 * Komponen pembantu untuk grid metadata khas Odoo
 */
export function FormFieldGroup({
  children,
  columns = 2,
}: {
  children: React.ReactNode;
  columns?: 1 | 2 | 3;
}) {
  const colClass =
    columns === 1
      ? 'grid-cols-1'
      : columns === 3
      ? 'grid-cols-1 md:grid-cols-3'
      : 'grid-cols-1 md:grid-cols-2';

  return <div className={`grid ${colClass} gap-x-8 gap-y-4`}>{children}</div>;
}

export function FormField({
  label,
  children,
  required = false,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 py-1">
      <label className="text-xs font-semibold text-[#64748B] sm:w-1/3 shrink-0">
        {label}
        {required && <span className="text-[#EF4444] ml-0.5">*</span>}
      </label>
      <div className="text-xs font-medium text-[#0F172A] flex-1 min-w-0">
        {children}
      </div>
    </div>
  );
}
