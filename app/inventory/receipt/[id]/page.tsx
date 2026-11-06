import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { AppNavbar, ControlPanel, FormStatusBar, FormSheet, FormField, FormFieldGroup } from '@/components/odoo';
import ActionButton from '@/components/erp/ActionButton';
import { validateReceiptAction } from '@/app/actions/erp';
import { StatusPill, fmtDate } from '@/components/erp/ui';

export const revalidate = 0;

export default async function ReceiptDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await prisma.receipt.findUnique({
    where: { id },
    include: { purchaseOrder: { include: { vendor: true } }, lines: { include: { product: { include: { stocks: true } } } } },
  });
  if (!r) notFound();

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans">
      <AppNavbar currentModule="Receipt (S-10)" />
      <ControlPanel
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Inventory', href: '/inventory?tab=receipt' }, { label: r.docNumber }]}
        availableViews={['form']}
        currentView="form"
      />
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-6">
        <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-xs overflow-hidden">
          <FormStatusBar stages={['Ready', 'Done']} currentStage={r.status === 'Done' ? 'Done' : 'Ready'} actions={[]}>
            {r.status !== 'Done' && <ActionButton action={validateReceiptAction.bind(null, r.id)} label="✓ Validate" confirmText={`Validasi ${r.docNumber}? Stok WH akan bertambah.`} />}
          </FormStatusBar>
          <FormSheet
            title={`Receipt ${r.docNumber}`}
            subtitle="Penerimaan barang dari vendor ke WH"
            ribbon={{ text: r.status.toUpperCase(), variant: r.status === 'Done' ? 'success' : 'warning' }}
            smartButtons={[{ label: 'Purchase Order', value: r.purchaseOrder.docNumber, icon: '🛒', href: `/purchase/${r.purchaseOrderId}` }]}
          >
            <FormFieldGroup columns={2}>
              <FormField label="Vendor"><span className="font-bold">{r.purchaseOrder.vendor.name}</span></FormField>
              <FormField label="Tanggal"><span>{fmtDate(r.createdAt)}</span></FormField>
              <FormField label="Status"><StatusPill status={r.status} /></FormField>
              <FormField label="Lokasi Tujuan"><span className="font-mono">WH/JKT/Stock</span></FormField>
            </FormFieldGroup>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8FAFC] text-[#64748B] uppercase font-bold border-b border-[#E2E8F0]">
                  <tr>
                    <th className="px-3 py-2.5">Produk</th>
                    <th className="px-3 py-2.5 text-center">Qty Masuk</th>
                    <th className="px-3 py-2.5 text-center">Stok WH On-hand</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {r.lines.map((l) => {
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
            <div className="mt-4 text-xs"><Link href="/inventory?tab=receipt" className="font-bold text-[#1E293B] hover:underline">← Kembali ke daftar Receipt</Link></div>
          </FormSheet>
        </div>
      </main>
    </div>
  );
}
