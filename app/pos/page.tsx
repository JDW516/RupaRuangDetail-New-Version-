import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { posAvailability } from '@/lib/erp';
import { AppNavbar, ControlPanel } from '@/components/odoo';
import PosTerminal from '@/components/erp/PosTerminal';
import { rp } from '@/components/erp/ui';

export const revalidate = 0;

export default async function POSPage() {
  const session = await prisma.pOSSession.findFirst({
    where: { status: 'Open' },
    include: { orders: true },
  });
  const [products, avail] = await Promise.all([
    prisma.product.findMany({ orderBy: { sku: 'asc' } }),
    posAvailability(),
  ]);
  const sales = session?.orders.reduce((s, o) => s + o.totalAmount, 0) ?? 0;

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans">
      <AppNavbar currentModule="Point of Sale (S-15 & S-16)" />
      <ControlPanel
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Point of Sale', href: '/pos' }, { label: 'Gerai Depok (SHOP) · Kasir' }]}
        pagerText={`Sesi: ${session?.sessionNumber ?? 'Belum dibuka'}`}
        availableViews={['kanban']}
        currentView="kanban"
      />
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-6 space-y-6">
        <div className="bg-[#1E293B] text-white p-4 rounded-2xl border border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-[#CFFF30]">{session?.sessionNumber ?? 'Belum ada sesi'}</span>
              <span className="text-[10px] bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/40 px-2 py-0.5 rounded font-bold">
                {session ? 'Status: Open' : 'Dibuka otomatis saat transaksi pertama'}
              </span>
            </div>
            <h2 className="text-base font-extrabold">SHOP/DPK/Stock — Gerai Penjualan Depok</h2>
            <span className="text-xs text-slate-400">
              Transaksi sesi ini: <strong>{session?.orders.length ?? 0}</strong> · Penjualan tunai: <strong>{rp(sales)}</strong>
            </span>
          </div>
          <Link href="/pos/close" className="bg-[#EF4444] hover:brightness-95 text-white font-extrabold text-xs px-4 py-2.5 rounded-lg text-center">
            Tutup Sesi (S-16) ➔
          </Link>
        </div>

        <PosTerminal products={products.map((p) => ({ sku: p.sku, name: p.name, price: p.salesPrice, avail: Math.max(0, avail[p.sku] ?? 0) }))} />
      </main>
    </div>
  );
}
