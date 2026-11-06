import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { AppNavbar, ControlPanel, FormStatusBar, FormSheet, FormField, FormFieldGroup } from '@/components/odoo';
import ActionButton from '@/components/erp/ActionButton';
import { approveCreditAction } from '@/app/actions/erp';
import { StatusPill, rp, fmtDate } from '@/components/erp/ui';

export const revalidate = 0;

export default async function SalesOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const so = await prisma.salesOrder.findUnique({
    where: { id },
    include: { customer: true, lines: { include: { product: true } }, deliveries: true, invoices: true },
  });
  if (!so) notFound();
  const session = await getSession();
  const canApprove = !!session && ['SUPERADMIN', 'OWNER', 'FINANCE'].includes(session.role);
  const held = so.status === 'Pending Credit Approval';

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans">
      <AppNavbar currentModule="Sales Order (S-06)" />
      <ControlPanel
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Sales', href: '/sales?tab=order' }, { label: so.docNumber }]}
        availableViews={['form']}
        currentView="form"
      />
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-6">
        <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-xs overflow-hidden">
          <FormStatusBar stages={['Draft', 'Sales Order']} currentStage="Sales Order" actions={[]}>
            {held && canApprove && (
              <ActionButton action={approveCreditAction.bind(null, so.id)} label="✓ Approve Credit" />
            )}
          </FormStatusBar>

          <FormSheet
            title={`Sales Order ${so.docNumber}`}
            subtitle="S-06 Sales Order · Credit Check (SR-11)"
            ribbon={{ text: so.status.toUpperCase(), variant: held ? 'danger' : 'success' }}
            smartButtons={[
              ...so.deliveries.map((d) => ({ label: 'Delivery Order', value: d.docNumber, icon: '📦', href: `/inventory/delivery/${d.id}` })),
              ...so.invoices.map((i) => ({ label: 'Faktur', value: i.docNumber, icon: '📑', href: '/invoicing' })),
              { label: 'Credit Check', value: held ? 'Ditahan' : 'Lolos', icon: '🛡️' },
            ]}
          >
            {held && (
              <div className="bg-red-50 border border-red-200 text-[#EF4444] text-xs font-semibold rounded-lg px-3.5 py-2.5 mb-3">
                ⚠️ Pending Credit Approval: total pesanan melebihi limit kredit {so.customer.name} ({rp(so.customer.creditLimit)}). Delivery Order belum dibuat sampai disetujui Owner/Finance.
              </div>
            )}
            <FormFieldGroup columns={2}>
              <FormField label="Pelanggan"><span className="font-bold">{so.customer.name} ({so.customer.contactId})</span></FormField>
              <FormField label="Tanggal"><span>{fmtDate(so.createdAt)}</span></FormField>
              <FormField label="Status"><StatusPill status={so.status} /></FormField>
              <FormField label="Total"><span className="font-mono font-black">{rp(so.totalAmount)}</span></FormField>
            </FormFieldGroup>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8FAFC] text-[#64748B] uppercase font-bold border-b border-[#E2E8F0]">
                  <tr>
                    <th className="px-3 py-2.5">Produk</th>
                    <th className="px-3 py-2.5 text-center">Dipesan</th>
                    <th className="px-3 py-2.5 text-center">Terkirim</th>
                    <th className="px-3 py-2.5 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {so.lines.map((l) => (
                    <tr key={l.id}>
                      <td className="px-3 py-2.5 font-bold">{l.product.name} <span className="font-mono text-[10px] text-[#64748B]">{l.sku}</span></td>
                      <td className="px-3 py-2.5 text-center font-mono">{l.qtyOrdered}</td>
                      <td className="px-3 py-2.5 text-center font-mono">{l.qtyDelivered}</td>
                      <td className="px-3 py-2.5 text-right font-mono font-bold">{rp(l.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 text-xs">
              <Link href="/sales?tab=order" className="font-bold text-[#1E293B] hover:underline">← Kembali ke daftar Sales Order</Link>
            </div>
          </FormSheet>
        </div>
      </main>
    </div>
  );
}
