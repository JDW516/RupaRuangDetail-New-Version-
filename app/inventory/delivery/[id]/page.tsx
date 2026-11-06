import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { AppNavbar, ControlPanel, FormStatusBar, FormSheet, FormField, FormFieldGroup } from '@/components/odoo';
import ActionButton from '@/components/erp/ActionButton';
import { validateDeliveryAction } from '@/app/actions/erp';
import { StatusPill, fmtDate } from '@/components/erp/ui';

export const revalidate = 0;

export default async function DeliveryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = await prisma.deliveryOrder.findUnique({
    where: { id },
    include: { salesOrder: { include: { customer: true } }, lines: { include: { product: { include: { stocks: true } } } } },
  });
  if (!d) notFound();

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans">
      <AppNavbar currentModule="Delivery Order (S-07)" />
      <ControlPanel
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Inventory', href: '/inventory?tab=delivery' }, { label: d.docNumber }]}
        availableViews={['form']}
        currentView="form"
      />
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-6">
        <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-xs overflow-hidden">
          <FormStatusBar stages={['Ready', 'Done']} currentStage={d.status === 'Done' ? 'Done' : 'Ready'} actions={[]}>
            {d.status !== 'Done' && <ActionButton action={validateDeliveryAction.bind(null, d.id)} label="✓ Validate" confirmText={`Validasi ${d.docNumber}? Stok WH akan berkurang.`} />}
          </FormStatusBar>
          <FormSheet
            title={`Delivery Order ${d.docNumber}`}
            subtitle="Pengeluaran barang dari WH ke pelanggan"
            ribbon={{ text: d.status.toUpperCase(), variant: d.status === 'Done' ? 'success' : 'warning' }}
            smartButtons={[{ label: 'Sales Order', value: d.salesOrder.docNumber, icon: '💼', href: `/sales/order/${d.salesOrderId}` }]}
          >
            <FormFieldGroup columns={2}>
              <FormField label="Pelanggan"><span className="font-bold">{d.salesOrder.customer.name}</span></FormField>
              <FormField label="Tanggal"><span>{fmtDate(d.createdAt)}</span></FormField>
              <FormField label="Status"><StatusPill status={d.status} /></FormField>
              <FormField label="Lokasi Asal"><span className="font-mono">WH/JKT/Stock</span></FormField>
            </FormFieldGroup>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8FAFC] text-[#64748B] uppercase font-bold border-b border-[#E2E8F0]">
                  <tr>
                    <th className="px-3 py-2.5">Produk</th>
                    <th className="px-3 py-2.5 text-center">Qty Kirim</th>
                    <th className="px-3 py-2.5 text-center">Stok WH On-hand</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {d.lines.map((l) => {
                    const wh = l.product.stocks.find((s) => s.locationId === 'WH');
                    return (
                      <tr key={l.id}>
                        <td className="px-3 py-2.5 font-bold">{l.product.name} <span className="font-mono text-[10px] text-[#64748B]">{l.sku}</span></td>
                        <td className="px-3 py-2.5 text-center font-mono font-bold">{l.qtyDone}</td>
                        <td className="px-3 py-2.5 text-center font-mono">{wh?.qtyOnHand ?? 0}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-4 text-xs"><Link href="/inventory?tab=delivery" className="font-bold text-[#1E293B] hover:underline">← Kembali ke daftar Delivery Order</Link></div>
          </FormSheet>
        </div>
      </main>
    </div>
  );
}
