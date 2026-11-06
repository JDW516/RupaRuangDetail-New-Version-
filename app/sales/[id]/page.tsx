import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { AppNavbar, ControlPanel, FormStatusBar, FormSheet, FormField, FormFieldGroup } from '@/components/odoo';
import ActionButton from '@/components/erp/ActionButton';
import { confirmQuotationAction } from '@/app/actions/erp';
import { StatusPill, rp, fmtDate } from '@/components/erp/ui';

export const revalidate = 0;

export default async function QuotationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const q = await prisma.quotation.findUnique({
    where: { id },
    include: { customer: true, lines: { include: { product: true } } },
  });
  if (!q) notFound();
  const so = await prisma.salesOrder.findFirst({ where: { docNumber: 'SO' + q.docNumber.replace(/\D/g, '') } });

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans">
      <AppNavbar currentModule="Sales & Quotations (S-05)" />
      <ControlPanel
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Sales', href: '/sales' }, { label: q.docNumber }]}
        availableViews={['form']}
        currentView="form"
      />
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-6">
        <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-xs overflow-hidden">
          <FormStatusBar
            stages={['Draft', 'Quotation Sent', 'Sales Order']}
            currentStage={q.status === 'Draft' ? 'Draft' : 'Sales Order'}
            actions={[]}
          >
            {q.status === 'Draft' && (
              <ActionButton action={confirmQuotationAction.bind(null, q.id)} label="✓ Confirm to Sales Order" />
            )}
            {so && (
              <Link href={`/sales/order/${so.id}`} className="px-3.5 py-1.5 rounded-md border border-[#E2E8F0] text-xs font-bold hover:bg-[#F8FAFC]">
                Lihat {so.docNumber} ➔
              </Link>
            )}
          </FormStatusBar>

          <FormSheet
            title={`Quotation ${q.docNumber}`}
            subtitle="S-05 Penawaran Harga · Alur Order-to-Cash"
            ribbon={{ text: q.status.toUpperCase(), variant: q.status === 'Draft' ? 'warning' : 'success' }}
            smartButtons={[
              { label: 'Plafon Kredit', value: q.customer.creditLimit > 0 ? rp(q.customer.creditLimit) : 'Cash', icon: '💳', href: `/contacts?contactId=${q.customer.contactId}` },
              { label: 'Termin', value: q.customer.paymentTerms, icon: '⏳' },
            ]}
          >
            <FormFieldGroup columns={2}>
              <FormField label="Pelanggan" required>
                <span className="font-bold">{q.customer.name} ({q.customer.contactId})</span>
              </FormField>
              <FormField label="Tanggal"><span>{fmtDate(q.createdAt)}</span></FormField>
              <FormField label="Status"><StatusPill status={q.status} /></FormField>
            </FormFieldGroup>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8FAFC] text-[#64748B] uppercase font-bold border-b border-[#E2E8F0]">
                  <tr>
                    <th className="px-3 py-2.5">Produk</th>
                    <th className="px-3 py-2.5 text-center">Qty</th>
                    <th className="px-3 py-2.5 text-right">Harga</th>
                    <th className="px-3 py-2.5 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {q.lines.map((l) => (
                    <tr key={l.id}>
                      <td className="px-3 py-2.5"><div className="font-bold">{l.product.name}</div><div className="font-mono text-[10px] text-[#64748B]">{l.sku}</div></td>
                      <td className="px-3 py-2.5 text-center font-mono font-bold">{l.qty}</td>
                      <td className="px-3 py-2.5 text-right font-mono">{rp(l.unitPrice)}</td>
                      <td className="px-3 py-2.5 text-right font-mono font-bold">{rp(l.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-4 pt-4 border-t border-[#E2E8F0] flex justify-end">
                <div className="w-72 space-y-1.5 text-xs">
                  <div className="flex justify-between"><span>Subtotal</span><span className="font-mono font-bold">{rp(q.subtotal)}</span></div>
                  <div className="flex justify-between"><span>PPN 11%</span><span className="font-mono font-bold">{rp(q.taxAmount)}</span></div>
                  <div className="flex justify-between pt-2 border-t border-[#E2E8F0] text-sm font-black"><span>TOTAL</span><span className="font-mono">{rp(q.totalAmount)}</span></div>
                </div>
              </div>
            </div>
          </FormSheet>
        </div>
      </main>
    </div>
  );
}
