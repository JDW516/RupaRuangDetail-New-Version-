import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { AppNavbar, ControlPanel } from '@/components/odoo';
import CreateDocModal from '@/components/erp/CreateDocModal';
import { ListTable, StatusPill, rp, fmtDate } from '@/components/erp/ui';

export const revalidate = 0;

export default async function PurchaseListPage() {
  const [orders, vendors, products] = await Promise.all([
    prisma.purchaseOrder.findMany({ include: { vendor: true }, orderBy: { createdAt: 'desc' } }),
    prisma.contact.findMany({ where: { type: 'VENDOR' }, orderBy: { contactId: 'asc' } }),
    prisma.product.findMany({ orderBy: { sku: 'asc' } }),
  ]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans">
      <AppNavbar currentModule="Purchase Orders & Receipts (S-09 & S-10)" />
      <ControlPanel
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Purchase', href: '/purchase' }, { label: 'Purchase Orders' }]}
        searchPlaceholder="Cari nomor PO atau vendor..."
        pagerText={`Total PO: ${orders.length}`}
        availableViews={['list']}
        currentView="list"
      >
        <CreateDocModal
          kind="purchase"
          partners={vendors.map((v) => ({ id: v.id, label: `${v.contactId} · ${v.name}`, hint: v.category ?? undefined }))}
          products={products.map((p) => ({ sku: p.sku, name: p.name, price: p.cost }))}
          buttonLabel="+ Create / Buat Baru"
        />
      </ControlPanel>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-6">
        <ListTable headers={[{ label: 'Nomor PO' }, { label: 'Vendor' }, { label: 'Tanggal' }, { label: 'Total', right: true }, { label: 'Status' }]} empty="Belum ada Purchase Order. Klik + Create / Buat Baru.">
          {orders.map((o) => (
            <tr key={o.id} className="hover:bg-[#F8FAFC]">
              <td className="px-4 py-3 font-mono font-bold"><Link href={`/purchase/${o.id}`} className="text-[#1E293B] hover:underline">{o.docNumber}</Link></td>
              <td className="px-4 py-3">{o.vendor.name}</td>
              <td className="px-4 py-3">{fmtDate(o.createdAt)}</td>
              <td className="px-4 py-3 text-right font-mono font-bold">{rp(o.totalAmount)}</td>
              <td className="px-4 py-3"><StatusPill status={o.status} /></td>
            </tr>
          ))}
        </ListTable>
      </main>
    </div>
  );
}
