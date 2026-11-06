import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { AppNavbar, ControlPanel } from '@/components/odoo';
import CreateDocModal from '@/components/erp/CreateDocModal';
import { ListTable, StatusPill, TabLinks, rp, fmtDate } from '@/components/erp/ui';

export const revalidate = 0;

export default async function SalesListPage({ searchParams }: { searchParams?: Promise<{ tab?: string }> }) {
  const tab = (searchParams ? await searchParams : {})?.tab === 'order' ? 'order' : 'quotation';

  const [quotations, orders, customers, products] = await Promise.all([
    prisma.quotation.findMany({ include: { customer: true }, orderBy: { createdAt: 'desc' } }),
    prisma.salesOrder.findMany({ include: { customer: true }, orderBy: { createdAt: 'desc' } }),
    prisma.contact.findMany({ where: { type: { not: 'VENDOR' } }, orderBy: { contactId: 'asc' } }),
    prisma.product.findMany({ orderBy: { sku: 'asc' } }),
  ]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans">
      <AppNavbar currentModule="Sales & Quotations (S-05 & S-06)" />
      <ControlPanel
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Sales', href: '/sales' }, { label: tab === 'order' ? 'Sales Orders' : 'Quotations' }]}
        searchPlaceholder="Cari dokumen..."
        pagerText={`Quotations: ${quotations.length} | SO: ${orders.length}`}
        availableViews={['list']}
        currentView="list"
      >
        <div className="flex items-center gap-3">
          <CreateDocModal
            kind="sales"
            partners={customers.map((c) => ({ id: c.id, label: `${c.contactId} · ${c.name}`, hint: c.creditLimit > 0 ? `Limit ${rp(c.creditLimit)}` : 'Cash' }))}
            products={products.map((p) => ({ sku: p.sku, name: p.name, price: p.salesPrice }))}
            buttonLabel="+ Create / Buat Baru"
          />
          <TabLinks base="/sales" active={tab} tabs={[{ id: 'quotation', label: 'Quotations' }, { id: 'order', label: 'Sales Orders' }]} />
        </div>
      </ControlPanel>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-6">
        {tab === 'quotation' ? (
          <ListTable headers={[{ label: 'Nomor' }, { label: 'Pelanggan' }, { label: 'Tanggal' }, { label: 'Total', right: true }, { label: 'Status' }]} empty="Belum ada Quotation. Klik + Create / Buat Baru.">
            {quotations.map((q) => (
              <tr key={q.id} className="hover:bg-[#F8FAFC]">
                <td className="px-4 py-3 font-mono font-bold"><Link href={`/sales/${q.id}`} className="text-[#1E293B] hover:underline">{q.docNumber}</Link></td>
                <td className="px-4 py-3">{q.customer.name}</td>
                <td className="px-4 py-3">{fmtDate(q.createdAt)}</td>
                <td className="px-4 py-3 text-right font-mono font-bold">{rp(q.totalAmount)}</td>
                <td className="px-4 py-3"><StatusPill status={q.status} /></td>
              </tr>
            ))}
          </ListTable>
        ) : (
          <ListTable headers={[{ label: 'Nomor SO' }, { label: 'Pelanggan' }, { label: 'Tanggal' }, { label: 'Total', right: true }, { label: 'Status' }]} empty="Belum ada Sales Order.">
            {orders.map((o) => (
              <tr key={o.id} className="hover:bg-[#F8FAFC]">
                <td className="px-4 py-3 font-mono font-bold"><Link href={`/sales/order/${o.id}`} className="text-[#1E293B] hover:underline">{o.docNumber}</Link></td>
                <td className="px-4 py-3">{o.customer.name}</td>
                <td className="px-4 py-3">{fmtDate(o.createdAt)}</td>
                <td className="px-4 py-3 text-right font-mono font-bold">{rp(o.totalAmount)}</td>
                <td className="px-4 py-3"><StatusPill status={o.status} /></td>
              </tr>
            ))}
          </ListTable>
        )}
      </main>
    </div>
  );
}
