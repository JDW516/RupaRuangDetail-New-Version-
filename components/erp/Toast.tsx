'use client';

import { useEffect, useState } from 'react';

type ToastType = 'error' | 'success' | 'info';
interface ToastItem { id: number; type: ToastType; message: string }

/** Panggil dari komponen client mana pun: showToast('error', 'Akses Ditolak') */
export function showToast(type: ToastType, message: string) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('rr-toast', { detail: { type, message } }));
}

const STYLE: Record<ToastType, string> = {
  error: 'bg-[#EF4444] text-white border-red-700',
  success: 'bg-[#10B981] text-white border-emerald-700',
  info: 'bg-[#1E293B] text-white border-slate-700',
};

export default function ToastHost() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    function onToast(e: Event) {
      const { type, message } = (e as CustomEvent).detail as { type: ToastType; message: string };
      const id = Date.now() + Math.random();
      setItems((p) => [...p, { id, type, message }]);
      setTimeout(() => setItems((p) => p.filter((t) => t.id !== id)), 5000);
    }
    window.addEventListener('rr-toast', onToast);
    return () => window.removeEventListener('rr-toast', onToast);
  }, []);

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm" aria-live="assertive">
      {items.map((t) => (
        <div
          key={t.id}
          role="alert"
          className={`rounded-lg border px-4 py-3 text-sm font-semibold shadow-lg flex items-start gap-2 ${STYLE[t.type]}`}
        >
          <span className="flex-1">{t.message}</span>
          <button
            type="button"
            onClick={() => setItems((p) => p.filter((x) => x.id !== t.id))}
            className="opacity-80 hover:opacity-100"
            aria-label="Tutup"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
