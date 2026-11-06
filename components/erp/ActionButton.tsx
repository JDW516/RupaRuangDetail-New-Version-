'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { showToast } from './Toast';

interface Result { ok: boolean; message: string; redirectTo?: string }

export default function ActionButton({
  action,
  label,
  className,
  confirmText,
  disabled,
}: {
  action: () => Promise<Result>;
  label: string;
  className?: string;
  confirmText?: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState(false);

  function onClick() {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    start(async () => {
      const r = await action();
      setBusy(false);
      showToast(r.ok ? 'success' : 'error', r.message);
      if (r.ok) {
        if (r.redirectTo) router.push(r.redirectTo);
        router.refresh();
      }
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || pending || busy}
      className={
        className ??
        'bg-[#CFFF30] hover:brightness-95 text-[#0F172A] font-extrabold text-xs px-4 py-1.5 rounded-md shadow-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed'
      }
    >
      {pending || busy ? 'Memproses...' : label}
    </button>
  );
}
