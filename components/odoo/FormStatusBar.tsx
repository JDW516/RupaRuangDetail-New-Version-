'use client';

import React from 'react';

export interface WorkflowAction {
  label: string;
  onClick?: () => void;
  primary?: boolean;
  variant?: 'primary' | 'secondary' | 'danger' | 'accent';
  disabled?: boolean;
}

export interface FormStatusBarProps {
  actions?: WorkflowAction[];
  stages: string[];
  currentStage: string;
  onStageClick?: (stage: string) => void;
  children?: React.ReactNode;
}

export default function FormStatusBar({
  actions = [],
  stages = [],
  currentStage,
  onStageClick,
  children,
}: FormStatusBarProps) {
  return (
    <div className="bg-[#FFFFFF] border-b border-[#E2E8F0] px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
      {/* Sisi Kiri: Workflow Action Buttons */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {actions.map((act, idx) => {
          const isPrimary = act.primary || act.variant === 'primary';
          const isDanger = act.variant === 'danger';
          const isAccent = act.variant === 'accent';

          let btnClass =
            'bg-[#FFFFFF] text-[#0F172A] border border-[#E2E8F0] hover:bg-[#F8FAFC]';
          if (isPrimary) {
            btnClass =
              'bg-[#CFFF30] text-[#0F172A] border border-[#CFFF30] hover:brightness-95 shadow-xs font-extrabold';
          } else if (isAccent) {
            btnClass =
              'bg-[#00F0FF]/15 text-[#0F172A] border border-[#00F0FF] hover:bg-[#00F0FF]/30 font-bold';
          } else if (isDanger) {
            btnClass =
              'bg-[#EF4444]/10 text-[#EF4444] border border-[#EF4444]/30 hover:bg-[#EF4444]/20 font-bold';
          }

          return (
            <button
              key={idx}
              type="button"
              onClick={act.onClick}
              disabled={act.disabled}
              className={`px-3.5 py-1.5 rounded-md transition-all disabled:opacity-40 disabled:cursor-not-allowed ${btnClass}`}
            >
              {act.label}
            </button>
          );
        })}

        {/* Embedded action forms (e.g. Server Actions) */}
        {children}
      </div>

      {/* Sisi Kanan: Status Bar Stage Tracker (Odoo Chevron / Arrow chain) */}
      <div className="flex items-center rounded-lg overflow-hidden border border-[#E2E8F0] bg-[#F8FAFC] ml-auto">
        {stages.map((stage, idx) => {
          const isCurrent = stage.toLowerCase() === currentStage.toLowerCase();
          const isClickable = Boolean(onStageClick);

          return (
            <button
              key={stage}
              type="button"
              disabled={!isClickable}
              onClick={() => onStageClick && onStageClick(stage)}
              className={`px-3.5 py-1.5 font-bold text-xs transition-colors relative flex items-center gap-1.5 ${
                idx > 0 ? 'border-l border-[#E2E8F0]' : ''
              } ${
                isCurrent
                  ? 'bg-[#1E293B] text-[#CFFF30] shadow-inner'
                  : 'text-[#64748B] hover:bg-[#FFFFFF] hover:text-[#0F172A]'
              } ${isClickable ? 'cursor-pointer' : 'cursor-default'}`}
            >
              {isCurrent && <span className="w-1.5 h-1.5 rounded-full bg-[#CFFF30]" />}
              <span>{stage}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
