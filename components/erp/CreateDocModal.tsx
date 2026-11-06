'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { showToast } from './Toast';
import { createQuotationAction, createPurchaseOrderAction } from '@/app/actions/erp';

interface Partner { id: string; label: string; hint?: string }
interface Prod { sku: string; name: string; price: number }
interface Line { sku: string; qty: number }

const rp = (n: number) => 'Rp ' + Math.round(n).toLocaleString('id-ID');
const inputCls = 'w-full px-3 py-2 rounded-lg border border-[#E2E8F0] text-sm bg-white text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#CFFF30]';

export default function CreateDocModal({
  kind, partners, products, buttonLabel = '+ Buat Baru',
}: {
  kind: 'sales' | 'purchase';
  partners: Partner[];
  products: Prod[];
  buttonLabel?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [partnerId, setPartnerId] = useState('');
  const [lines, setLines] = useState<Line[]>([{ sku: '', qty: 1 }]);
  const [error, setError] = useState('');
  const [pending, start] = useTransition();

  const pmap = new Map(products.map((p) => [p.sku, p]));
  const subtotal = lines.reduce((s, l) => s + (pmap.get(l.sku)?.price ?? 0) * (l.qty > 0 ? l.qty : 0), 0);
  const tax = Math.round(subtotal * 0.11);
  const isSales = kind === 'sales';

  function setLine(i: number, patch: Partial<Line>) {
    setLines((p) => p.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function reset() {
    setPartnerId(''); setLines([{ sku: '', qty: 1 }]); setError('');
  }
  function submit() {
    setError('');
    const valid = lines.filter((l) => l.sku && l.qty > 0);
    if (!partnerId) return setError(isSales ? 'Pilih pelanggan.' : 'Pilih vendor.');
    if (valid.length === 0) return setError('Pilih minimal 1 produk dengan kuantitas > 0.');
    start(async () => {
      const r = isSales ? await createQuotationAction(partnerId, valid) : await createPurchaseOrderAction(partnerId, valid);
      if (!r.ok) return setError(r.message);
      showToast('success', r.message);
      setOpen(false); reset();
      if (r.redirectTo) router.push(r.redirectTo);
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="bg-[#CFFF30] hover:brightness-95 text-[#0F172A] font-extrabold text-xs px-4 py-1.5 rounded-md shadow-xs"
      >
        {buttonLabel}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-12 px-4 bg-[#1E293B]/70 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-[#E2E8F0] p-6 space-y-4 text-[#0F172A] max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="font-black text-lg">{isSales ? 'Buat Quotation Baru' : 'Buat RFQ / Purchase Order Baru'}</h2>
              <button type="button" onClick={() => setOpen(false)} className="text-[#64748B] hover:text-[#0F172A]">✕</button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#64748B] mb-1">{isSales ? 'Pelanggan' : 'Vendor'}</label>
              <select value={partnerId} onChange={(e) => setPartnerId(e.target.value)} className={inputCls}>
                <option value="">-- Pilih {isSales ? 'pelanggan' : 'vendor'} --</option>
                {partners.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}{p.hint ? ` · ${p.hint}` : ''}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-semibold text-[#64748B]">Order Lines</div>
              {lines.map((l, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center">
                  <select value={l.sku} onChange={(e) => setLine(i, { sku: e.target.value })} className={`${inputCls} col-span-6`}>
                    <option value="">-- Produk --</option>
                    {products.map((p) => (
                      <option key={p.sku} value={p.sku}>{p.sku} · {p.name} ({rp(p.price)})</option>
                    ))}
                  </select>
                  <input type="number" min={1} value={l.qty} onChange={(e) => setLine(i, { qty: parseInt(e.target.value, 10) || 0 })} className={`${inputCls} col-span-2`} />
                  <div className="col-span-3 text-right font-mono text-xs">{rp((pmap.get(l.sku)?.price ?? 0) * (l.qty > 0 ? l.qty : 0))}</div>
                  <button type="button" disabled={lines.length === 1} onClick={() => setLines((p) => p.filter((_, idx) => idx !== i))} className="col-span-1 text-[#EF4444] disabled:opacity-30">🗑</button>
                </div>
              ))}
              <button type="button" onClick={() => setLines((p) => [...p, { sku: '', qty: 1 }])} className="text-xs font-bold text-[#1E293B] hover:underline">+ Tambah baris produk</button>
            </div>

            <div className="border-t border-[#E2E8F0] pt-3 text-xs space-y-1 text-right">
              <div>Subtotal: <span className="font-mono font-bold">{rp(subtotal)}</span></div>
              <div>PPN 11%: <span className="font-mono font-bold">{rp(tax)}</span></div>
              <div className="text-sm font-black">Total: <span className="font-mono">{rp(subtotal + tax)}</span></div>
            </div>

            {error && <div className="bg-red-50 border border-red-200 text-[#EF4444] text-xs font-medium rounded-lg px-3 py-2">⚠️ {error}</div>}

            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 text-xs font-semibold rounded-md border border-[#E2E8F0]">Batal</button>
              <button type="button" onClick={submit} disabled={pending} className="px-4 py-2 text-xs font-extrabold rounded-md bg-[#CFFF30] text-[#0F172A] disabled:opacity-50">
                {pending ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
