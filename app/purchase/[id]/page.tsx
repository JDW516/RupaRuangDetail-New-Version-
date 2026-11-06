import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { AppNavbar, ControlPanel, FormStatusBar, FormSheet, FormField, FormFieldGroup } from '@/components/odoo';
import ActionButton from '@/components/erp/ActionButton';
import { confirmPurchaseOrderAction } from '@/app/actions/erp';
import { StatusPill, rp, fmtDate } from '@/components/erp/ui';

export const revalidate = 0;

export default async function PurchaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const po = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: { vendor: true, lines: { include: { product: true } }, receipts: true },
  });
  if (!po) notFound();

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans">
      <AppNavbar currentModule="Purchase Order (S-09)" />
      <ControlPanel
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Purchase', href: '/purchase' }, { label: po.docNumber }]}
        availableViews={['form']}
        currentView="form"
      />
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-6">
        <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-xs overflow-hidden">
          <FormStatusBar
            stages={['RFQ', 'Purchase Order', 'Received']}
            currentStage={po.status === 'Received' ? 'Received' : po.status === 'Confirmed' ? 'Purchase Order' : 'RFQ'}
            actions={[]}
          >
            {po.status === 'Draft' && <ActionButton action={confirmPurchaseOrderAction.bind(null, po.id)} label="✓ Confirm PO" />}
          </FormStatusBar>

          <FormSheet
            title={`Purchase Order ${po.docNumber}`}
            subtitle="S-09 RFQ / PO · Procure-to-Pay"
            ribbon={{ text: po.status.toUpperCase(), variant: po.status === 'Draft' ? 'warning' : 'success' }}
            smartButtons={po.receipts.map((r) => ({ label: 'Receipt', value: r.docNumber, icon: '📥', href: `/inventory/receipt/${r.id}` }))}
          >
            <FormFieldGroup columns={2}>
              <FormField label="Vendor"><span className="font-bold">{po.vendor.name} ({po.vendor.contactId})</span></FormField>
              <FormField label="Tanggal"><span>{fmtDate(po.createdAt)}</span></FormField>
              <FormField label="Status"><StatusPill status={po.status} /></FormField>
              <FormField label="Termin"><span className="font-mono">{po.vendor.paymentTerms}</span></FormField>
            </FormFieldGroup>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8FAFC] text-[#64748B] uppercase font-bold border-b border-[#E2E8F0]">
                  <tr>
                    <th className="px-3 py-2.5">Produk</th>
                    <th className="px-3 py-2.5 text-center">Dipesan</th>
                    <th className="px-3 py-2.5 text-center">Diterima</th>
                    <th className="px-3 py-2.5 text-right">Harga</th>
                    <th className="px-3 py-2.5 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {po.lines.map((l) => (
                    <tr key={l.id}>
                      <td className="px-3 py-2.5 font-bold">{l.product.name} <span className="font-mono text-[10px] text-[#64748B]">{l.sku}</span></td>
                      <td className="px-3 py-2.5 text-center font-mono">{l.qtyOrdered}</td>
                      <td className="px-3 py-2.5 text-center font-mono">{l.qtyReceived}</td>
                      <td className="px-3 py-2.5 text-right font-mono">{rp(l.unitPrice)}</td>
                      <td className="px-3 py-2.5 text-right font-mono font-bold">{rp(l.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-4 pt-4 border-t border-[#E2E8F0] flex justify-end">
                <div className="w-72 space-y-1.5 text-xs">
                  <div className="flex justify-between"><span>Subtotal</span><span className="font-mono font-bold">{rp(po.subtotal)}</span></div>
                  <div className="flex justify-between"><span>PPN 11%</span><span className="font-mono font-bold">{rp(po.taxAmount)}</span></div>
                  <div className="flex justify-between pt-2 border-t border-[#E2E8F0] text-sm font-black"><span>TOTAL</span><span className="font-mono">{rp(po.totalAmount)}</span></div>
                </div>
              </div>
            </div>
            <div className="mt-4 text-xs">
              <Link href="/purchase" className="font-bold text-[#1E293B] hover:underline">← Kembali ke daftar PO</Link>
            </div>
          </FormSheet>
        </div>
      </main>
    </div>
  );
}
