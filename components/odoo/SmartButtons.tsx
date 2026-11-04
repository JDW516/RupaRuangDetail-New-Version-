'use client';

import React from 'react';
import Link from 'next/link';

export interface SmartButtonItem {
  label: string;
  value: string | number;
  icon?: string;
  href?: string;
  onClick?: () => void;
  badge?: string;
}

export interface SmartButtonsProps {
  items: SmartButtonItem[];
}

export default function SmartButtons({ items }: SmartButtonsProps) {
  if (items.length === 0) return null;

  return (
    <div className="flex items-center justify-end flex-wrap gap-1.5 mb-4">
      {items.map((item, idx) => {
        const content = (
          <div className="flex items-center gap-2.5 px-3 py-1.5 border border-[#E2E8F0] bg-[#FFFFFF] hover:bg-[#F8FAFC] hover:border-[#00F0FF] rounded-lg text-xs transition-all shadow-2xs group cursor-pointer">
            {item.icon && (
              <span className="text-base text-[#1E293B] group-hover:scale-110 transition-transform">
                {item.icon}
              </span>
            )}
            <div className="text-left">
              <span className="block font-black text-[#0F172A] leading-tight font-mono text-xs">
                {item.value}
              </span>
              <span className="block text-[10px] text-[#64748B] font-semibold group-hover:text-[#0F172A] transition-colors">
                {item.label}
              </span>
            </div>
            {item.badge && (
              <span className="text-[9px] bg-[#CFFF30] text-[#0F172A] font-extrabold px-1.5 py-0.5 rounded ml-1">
                {item.badge}
              </span>
            )}
          </div>
        );

        if (item.href) {
          return (
            <Link key={idx} href={item.href}>
              {content}
            </Link>
          );
        }

        return (
          <button key={idx} type="button" onClick={item.onClick}>
            {content}
          </button>
        );
      })}
    </div>
  );
}
