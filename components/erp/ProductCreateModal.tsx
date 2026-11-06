'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { showToast } from './Toast';
import { createProductAction } from '@/app/actions/erp';

const inputCls = 'w-full px-3 py-2 rounded-lg border border-[#E2E8F0] text-sm bg-white text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#CFFF30]';

export default function ProductCreateModal({ vendors }: { vendors: { id: string; label: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  const [f, setF] = useState({ sku: '', name: '', uom: 'Unit', salesPrice: '', cost: '', vendorId: '', initialQty: '0' });

  function submit() {
    setError('');
    start(async () => {
      const r = await createProductAction({
        sku: f.sku, name: f.name, uom: f.uom,
        salesPrice: Number(f.salesPrice), cost: Number(f.cost),
        vendorId: f.vendorId, initialQty: Number(f.initialQty),
      });
      if (!r.ok) return setError(r.message);
      showToast('success', r.message);
      setOpen(false);
      if (r.redirectTo) router.push(r.redirectTo);
      router.refresh();
    });
  }

  const field = (label: string, key: keyof typeof f, type = 'text') => (
    <div>
      <label className="block text-xs font-semibold text-[#64748B] mb-1">{label}</label>
      <input type={type} value={f[key]} onChange={(e) => setF({ ...f, [key]: e.target.value })} className={inputCls} />
    </div>
  );

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="bg-[#CFFF30] hover:brightness-95 text-[#0F172A] font-extrabold text-xs px-4 py-1.5 rounded-md shadow-xs">
        + Buat Produk Baru
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-12 px-4 bg-[#1E293B]/70 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-[#E2E8F0] p-6 space-y-3 text-[#0F172A]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="font-black text-lg">Produk Baru</h2>
              <button type="button" onClick={() => setOpen(false)} className="text-[#64748B]">✕</button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {field('SKU (mis. P017)', 'sku')}
              {field('Nama Produk', 'name')}
              {field('Harga Jual (Rp)', 'salesPrice', 'number')}
              {field('Biaya / HPP (Rp)', 'cost', 'number')}
              {field('Satuan (UoM)', 'uom')}
              {field('Stok Awal WH', 'initialQty', 'number')}
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#64748B] mb-1">Vendor Default</label>
              <select value={f.vendorId} onChange={(e) => setF({ ...f, vendorId: e.target.value })} className={inputCls}>
                <option value="">-- Pilih vendor --</option>
                {vendors.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
              </select>
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
