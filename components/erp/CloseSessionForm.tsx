'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { showToast } from './Toast';
import { closePosSessionAction } from '@/app/actions/erp';

export default function CloseSessionForm({ sessionId, expected }: { sessionId: string; expected: number }) {
  const router = useRouter();
  const [counted, setCounted] = useState(String(Math.round(expected)));
  const [pending, start] = useTransition();

  function close() {
    if (!window.confirm('Tutup sesi? Stok gerai (SHOP) akan dipotong sesuai barang terjual.')) return;
    start(async () => {
      const r = await closePosSessionAction(sessionId, counted === '' ? undefined : Number(counted));
      showToast(r.ok ? 'success' : 'error', r.message);
      if (r.ok) {
        router.push(r.redirectTo ?? '/pos');
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-semibold text-[#64748B] mb-1">Kas Dihitung Fisik (Counted, Rp)</label>
        <input type="number" min={0} value={counted} onChange={(e) => setCounted(e.target.value)} className="w-full max-w-xs px-3 py-2 rounded-lg border border-[#E2E8F0] text-sm font-mono bg-white text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#CFFF30]" />
      </div>
      <button type="button" onClick={close} disabled={pending} className="bg-[#EF4444] hover:brightness-95 text-white font-extrabold text-sm px-5 py-2.5 rounded-lg disabled:opacity-50">
        {pending ? 'Menutup...' : 'Close Session'}
      </button>
    </div>
  );
}
