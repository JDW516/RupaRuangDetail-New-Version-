import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { AppNavbar, ControlPanel } from '@/components/odoo';
import CloseSessionForm from '@/components/erp/CloseSessionForm';
import { ListTable, rp } from '@/components/erp/ui';

export const revalidate = 0;

export default async function ClosePosPage() {
  const session = await prisma.pOSSession.findFirst({
    where: { status: 'Open' },
    include: { orders: { include: { lines: { include: { product: true } } } } },
  });

  const sold = new Map<string, { name: string; qty: number; total: number }>();
  for (const o of session?.orders ?? []) {
    for (const l of o.lines) {
      const cur = sold.get(l.sku) ?? { name: l.product.name, qty: 0, total: 0 };
      cur.qty += l.qty;
      cur.total += l.subtotal;
      sold.set(l.sku, cur);
    }
  }
  const sales = session?.orders.reduce((s, o) => s + o.totalAmount, 0) ?? 0;
  const expected = (session?.startBalance ?? 0) + sales;

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans">
      <AppNavbar currentModule="Tutup Sesi POS (S-16)" />
      <ControlPanel
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Point of Sale', href: '/pos' }, { label: 'Tutup Sesi' }]}
        availableViews={['form']}
        currentView="form"
      />
      <main className="flex-1 max-w-4xl mx-auto w-full p-4 md:p-6 space-y-5">
        {!session ? (
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-10 text-center text-xs text-[#64748B] space-y-2">
            <p>Tidak ada sesi POS yang sedang terbuka.</p>
            <Link href="/pos" className="font-bold text-[#1E293B] hover:underline">← Kembali ke kasir</Link>
          </div>
        ) : (
          <>
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 space-y-1 text-xs">
              <h2 className="font-black text-base text-[#0F172A]">Sesi {session.sessionNumber}</h2>
              <div>Kasir: <strong>{session.cashierName}</strong> · Kas awal: <strong>{rp(session.startBalance)}</strong></div>
              <div>Jumlah transaksi: <strong>{session.orders.length}</strong> · Penjualan tunai: <strong>{rp(sales)}</strong></div>
              <div>Kas seharusnya (Expected): <strong className="font-mono">{rp(expected)}</strong></div>
            </div>

            <ListTable headers={[{ label: 'SKU' }, { label: 'Produk' }, { label: 'Terjual', right: true }, { label: 'Nilai', right: true }]} empty="Belum ada barang terjual di sesi ini.">
              {Array.from(sold, ([sku, v]) => (
                <tr key={sku}>
                  <td className="px-4 py-3 font-mono font-bold">{sku}</td>
                  <td className="px-4 py-3">{v.name}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold">{v.qty}</td>
                  <td className="px-4 py-3 text-right font-mono">{rp(v.total)}</td>
                </tr>
              ))}
            </ListTable>

            <div className="bg-white border border-[#E2E8F0] rounded-xl p-5">
              <CloseSessionForm sessionId={session.id} expected={expected} />
            </div>
          </>
        )}
      </main>
    </div>
  );
}
