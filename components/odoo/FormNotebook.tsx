'use client';

import React, { useState } from 'react';

export interface FormNotebookTab {
  id: string;
  label: string;
  badge?: string | number;
  content: React.ReactNode;
}

export interface FormNotebookProps {
  tabs: FormNotebookTab[];
  defaultTabId?: string;
}

export default function FormNotebook({
  tabs,
  defaultTabId,
}: FormNotebookProps) {
  const [activeTabId, setActiveTabId] = useState<string>(
    defaultTabId || (tabs[0]?.id ?? '')
  );

  if (tabs.length === 0) return null;

  return (
    <div className="mt-8">
      {/* Tab Navigation Headers */}
      <div className="border-b border-[#E2E8F0] flex items-center gap-1 overflow-x-auto">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTabId(tab.id)}
              className={`px-4 py-2.5 text-xs font-bold whitespace-nowrap transition-all border-b-2 -mb-[2px] flex items-center gap-2 ${
                isActive
                  ? 'border-[#0F172A] text-[#0F172A] bg-[#FFFFFF]'
                  : 'border-transparent text-[#64748B] hover:text-[#0F172A] hover:border-[#E2E8F0]'
              }`}
            >
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
                    isActive
                      ? 'bg-[#CFFF30] text-[#0F172A]'
                      : 'bg-[#F8FAFC] text-[#64748B] border border-[#E2E8F0]'
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Content Panel */}
      <div className="py-4">
        {tabs.find((tab) => tab.id === activeTabId)?.content}
      </div>
    </div>
  );
}
