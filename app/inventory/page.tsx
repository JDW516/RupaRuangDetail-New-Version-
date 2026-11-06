import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { AppNavbar, ControlPanel } from '@/components/odoo';
import ProductCreateModal from '@/components/erp/ProductCreateModal';
import { ListTable, StatusPill, TabLinks, rp, fmtDate } from '@/components/erp/ui';

export const revalidate = 0;

export default async function InventoryListPage({ searchParams }: { searchParams?: Promise<{ tab?: string }> }) {
  const t = (searchParams ? await searchParams : {})?.tab;
  const tab = t === 'delivery' || t === 'receipt' ? t : 'stock';

  const [products, deliveries, receipts, vendors] = await Promise.all([
    prisma.product.findMany({ include: { stocks: true }, orderBy: { sku: 'asc' } }),
    prisma.deliveryOrder.findMany({ include: { salesOrder: { include: { customer: true } }, lines: true }, orderBy: { createdAt: 'desc' } }),
    prisma.receipt.findMany({ include: { purchaseOrder: { include: { vendor: true } }, lines: true }, orderBy: { createdAt: 'desc' } }),
    prisma.contact.findMany({ where: { type: 'VENDOR' }, orderBy: { contactId: 'asc' } }),
  ]);

  const qty = (p: (typeof products)[number], loc: string) => p.stocks.find((s) => s.locationId === loc);

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans">
      <AppNavbar currentModule="Inventory & Stock (S-03 & S-08)" />
      <ControlPanel
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Inventory', href: '/inventory' }, { label: tab === 'stock' ? 'Stok Produk' : tab === 'delivery' ? 'Delivery Orders' : 'Receipts' }]}
        searchPlaceholder="Cari SKU atau dokumen..."
        pagerText={`Produk: ${products.length} | DO: ${deliveries.length} | Receipt: ${receipts.length}`}
        availableViews={['list']}
        currentView="list"
      >
        <div className="flex items-center gap-3">
          <ProductCreateModal vendors={vendors.map((v) => ({ id: v.contactId, label: `${v.contactId} · ${v.name}` }))} />
          <TabLinks base="/inventory" active={tab} tabs={[{ id: 'stock', label: 'Stok Produk' }, { id: 'delivery', label: 'Delivery Orders' }, { id: 'receipt', label: 'Receipts' }]} />
        </div>
      </ControlPanel>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-6">
        {tab === 'stock' && (
          <ListTable
            headers={[{ label: 'SKU' }, { label: 'Produk' }, { label: 'WH On-hand', right: true }, { label: 'WH Reserved', right: true }, { label: 'SHOP On-hand', right: true }, { label: 'Biaya', right: true }]}
            empty="Belum ada produk."
          >
            {products.map((p) => (
              <tr key={p.sku} className="hover:bg-[#F8FAFC]">
                <td className="px-4 py-3 font-mono font-bold"><Link href={`/inventory/product?sku=${p.sku}`} className="text-[#1E293B] hover:underline">{p.sku}</Link></td>
                <td className="px-4 py-3">{p.name}</td>
                <td className="px-4 py-3 text-right font-mono font-bold">{qty(p, 'WH')?.qtyOnHand ?? 0}</td>
                <td className="px-4 py-3 text-right font-mono">{qty(p, 'WH')?.qtyReserved ?? 0}</td>
                <td className="px-4 py-3 text-right font-mono font-bold">{qty(p, 'SHOP')?.qtyOnHand ?? 0}</td>
                <td className="px-4 py-3 text-right font-mono">{rp(p.cost)}</td>
              </tr>
            ))}
          </ListTable>
        )}

        {tab === 'delivery' && (
          <ListTable headers={[{ label: 'Nomor DO' }, { label: 'Sales Order' }, { label: 'Pelanggan' }, { label: 'Tanggal' }, { label: 'Unit', right: true }, { label: 'Status' }]} empty="Belum ada Delivery Order. DO dibuat otomatis saat Quotation dikonfirmasi menjadi Sales Order.">
            {deliveries.map((d) => (
              <tr key={d.id} className="hover:bg-[#F8FAFC]">
                <td className="px-4 py-3 font-mono font-bold"><Link href={`/inventory/delivery/${d.id}`} className="text-[#1E293B] hover:underline">{d.docNumber}</Link></td>
                <td className="px-4 py-3 font-mono">{d.salesOrder.docNumber}</td>
                <td className="px-4 py-3">{d.salesOrder.customer.name}</td>
                <td className="px-4 py-3">{fmtDate(d.createdAt)}</td>
                <td className="px-4 py-3 text-right font-mono">{d.lines.reduce((s, l) => s + l.qtyDone, 0)}</td>
                <td className="px-4 py-3"><StatusPill status={d.status} /></td>
              </tr>
            ))}
          </ListTable>
        )}

        {tab === 'receipt' && (
          <ListTable headers={[{ label: 'Nomor Receipt' }, { label: 'PO' }, { label: 'Vendor' }, { label: 'Tanggal' }, { label: 'Unit', right: true }, { label: 'Status' }]} empty="Belum ada Receipt. Receipt dibuat otomatis saat PO dikonfirmasi.">
            {receipts.map((r) => (
              <tr key={r.id} className="hover:bg-[#F8FAFC]">
                <td className="px-4 py-3 font-mono font-bold"><Link href={`/inventory/receipt/${r.id}`} className="text-[#1E293B] hover:underline">{r.docNumber}</Link></td>
                <td className="px-4 py-3 font-mono">{r.purchaseOrder.docNumber}</td>
                <td className="px-4 py-3">{r.purchaseOrder.vendor.name}</td>
                <td className="px-4 py-3">{fmtDate(r.createdAt)}</td>
                <td className="px-4 py-3 text-right font-mono">{r.lines.reduce((s, l) => s + l.qtyDone, 0)}</td>
                <td className="px-4 py-3"><StatusPill status={r.status} /></td>
              </tr>
            ))}
          </ListTable>
        )}
      </main>
    </div>
  );
}
