'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { showToast } from './Toast';
import { posCheckoutAction } from '@/app/actions/erp';

interface P { sku: string; name: string; price: number; avail: number }
const rp = (n: number) => 'Rp ' + Math.round(n).toLocaleString('id-ID');

export default function PosTerminal({ products }: { products: P[] }) {
  const router = useRouter();
  const [cart, setCart] = useState<Record<string, number>>({});
  const [cash, setCash] = useState('');
  const [search, setSearch] = useState('');
  const [pending, start] = useTransition();

  const pmap = new Map(products.map((p) => [p.sku, p]));
  const items = Object.entries(cart).filter(([, q]) => q > 0).map(([sku, qty]) => ({ sku, qty, p: pmap.get(sku)! }));
  const subtotal = items.reduce((s, i) => s + i.p.price * i.qty, 0);
  const tax = Math.round(subtotal * 0.11);
  const total = subtotal + tax;
  const paid = Number(cash) || 0;
  const change = paid - total;

  function add(sku: string, delta: number) {
    const p = pmap.get(sku);
    if (!p) return;
    setCart((c) => {
      const next = Math.max(0, (c[sku] ?? 0) + delta);
      if (next > p.avail) {
        showToast('error', `Stok ${p.name} di gerai hanya ${p.avail} unit.`);
        return c;
      }
      return { ...c, [sku]: next };
    });
  }

  function pay() {
    if (items.length === 0) return showToast('error', 'Keranjang masih kosong.');
    if (paid < total) return showToast('error', `Uang tunai kurang. Total ${rp(total)}.`);
    start(async () => {
      const r = await posCheckoutAction(items.map((i) => ({ sku: i.sku, qty: i.qty })), paid);
      showToast(r.ok ? 'success' : 'error', r.message);
      if (r.ok) {
        setCart({});
        setCash('');
        router.refresh();
      }
    });
  }

  const shown = products.filter((p) => !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <div className="lg:col-span-8 space-y-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari SKU atau nama produk..."
          className="w-full px-3.5 py-2.5 rounded-lg border border-[#E2E8F0] text-sm bg-white text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#CFFF30]"
        />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {shown.map((p) => (
            <button
              key={p.sku}
              type="button"
              disabled={p.avail <= 0}
              onClick={() => add(p.sku, 1)}
              className="text-left bg-white border border-[#E2E8F0] rounded-xl p-3 hover:border-[#00F0FF] hover:shadow-md transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <div className="flex justify-between items-start">
                <span className="font-mono text-[10px] font-bold text-[#64748B]">{p.sku}</span>
                {cart[p.sku] > 0 && <span className="bg-[#CFFF30] text-[#0F172A] text-[10px] font-black px-1.5 rounded">×{cart[p.sku]}</span>}
              </div>
              <div className="font-bold text-sm text-[#0F172A] mt-1 leading-snug">{p.name}</div>
              <div className="font-mono font-black text-[#1E293B] text-sm mt-1">{rp(p.price)}</div>
              <div className={`text-[10px] mt-1 font-semibold ${p.avail <= 3 ? 'text-[#EF4444]' : 'text-[#64748B]'}`}>Stok gerai: {p.avail}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="lg:col-span-4 bg-white border border-[#E2E8F0] rounded-xl shadow-xs p-4 space-y-3 lg:sticky lg:top-4">
        <h3 className="font-black text-sm text-[#0F172A] uppercase tracking-wider">Keranjang</h3>
        {items.length === 0 ? (
          <p className="text-xs text-[#64748B] py-6 text-center">Klik produk untuk menambah ke keranjang.</p>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {items.map((i) => (
              <div key={i.sku} className="flex items-center gap-2 text-xs">
                <div className="flex-1">
                  <div className="font-bold text-[#0F172A]">{i.p.name}</div>
                  <div className="font-mono text-[#64748B]">{rp(i.p.price)}</div>
                </div>
                <button type="button" onClick={() => add(i.sku, -1)} className="w-6 h-6 rounded border border-[#E2E8F0] font-bold">−</button>
                <span className="w-6 text-center font-mono font-bold">{i.qty}</span>
                <button type="button" onClick={() => add(i.sku, 1)} className="w-6 h-6 rounded border border-[#E2E8F0] font-bold">+</button>
                <span className="w-24 text-right font-mono font-bold">{rp(i.p.price * i.qty)}</span>
              </div>
            ))}
          </div>
        )}

        <div className="border-t border-[#E2E8F0] pt-3 text-xs space-y-1">
          <div className="flex justify-between"><span>Subtotal</span><span className="font-mono font-bold">{rp(subtotal)}</span></div>
          <div className="flex justify-between"><span>PPN 11%</span><span className="font-mono font-bold">{rp(tax)}</span></div>
          <div className="flex justify-between text-base font-black text-[#0F172A]"><span>TOTAL</span><span className="font-mono">{rp(total)}</span></div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#64748B] mb-1">Uang Tunai Diterima (Rp)</label>
          <input type="number" min={0} value={cash} onChange={(e) => setCash(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] text-sm font-mono bg-white text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#CFFF30]" />
          <div className="flex gap-1.5 mt-1.5">
            <button type="button" onClick={() => setCash(String(total))} className="text-[10px] font-bold px-2 py-1 rounded border border-[#E2E8F0] hover:bg-[#F8FAFC]">Uang Pas</button>
            {[50000, 100000, 200000].map((n) => (
              <button key={n} type="button" onClick={() => setCash(String(n))} className="text-[10px] font-bold px-2 py-1 rounded border border-[#E2E8F0] hover:bg-[#F8FAFC]">{(n / 1000).toLocaleString('id-ID')}rb</button>
            ))}
          </div>
          {paid > 0 && total > 0 && (
            <div className={`mt-2 text-xs font-bold ${change >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
              {change >= 0 ? `Kembalian: ${rp(change)}` : `Kurang: ${rp(-change)}`}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={pay}
          disabled={pending || items.length === 0}
          className="w-full bg-[#CFFF30] hover:brightness-95 text-[#0F172A] font-extrabold py-3 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {pending ? 'Memproses...' : `Bayar Tunai ${total > 0 ? rp(total) : ''}`}
        </button>
        {items.length > 0 && (
          <button type="button" onClick={() => { setCart({}); setCash(''); }} className="w-full text-xs font-semibold text-[#EF4444] hover:underline">Kosongkan keranjang</button>
        )}
      </div>
    </div>
  );
}
