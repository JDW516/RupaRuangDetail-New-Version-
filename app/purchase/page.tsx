import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import {
  AppNavbar,
  ControlPanel,
  FormStatusBar,
  FormSheet,
  FormField,
  FormFieldGroup,
  FormNotebook,
  Chatter,
} from '@/components/odoo';

export const revalidate = 0;

export default async function PurchasePage() {
  // ==========================================
  // 1. BACKEND LOGIC: SERVER ACTIONS (PRESERVED STRICTLY)
  // ==========================================
  async function receiveProducts(formData: FormData) {
    'use server';

    const poId = formData.get('poId') as string;

    const po = await prisma.purchaseOrder.findUnique({
      where: { id: poId },
      include: { lines: true },
    });

    if (!po || po.status !== 'Confirmed') return;

    // A. Looping semua barang di dokumen PO, tambahkan ke stok WH
    for (const line of po.lines) {
      const stock = await prisma.stock.findUnique({
        where: { sku_locationId: { sku: line.sku, locationId: 'WH' } },
      });

      if (stock) {
        await prisma.stock.update({
          where: { id: stock.id },
          data: { qtyOnHand: stock.qtyOnHand + line.qtyOrdered },
        });
      } else {
        await prisma.stock.create({
          data: { sku: line.sku, locationId: 'WH', qtyOnHand: line.qtyOrdered },
        });
      }
    }

    // B. Ubah status PO jadi "Received"
    await prisma.purchaseOrder.update({
      where: { id: poId },
      data: { status: 'Received' },
    });

    revalidatePath('/purchase');
    revalidatePath('/inventory');
    revalidatePath('/dashboard');
    revalidatePath('/invoicing');
  }

  // ==========================================
  // 2. FETCH DATA PO DARI DATABASE
  // ==========================================
  const purchaseOrders = await prisma.purchaseOrder.findMany({
    include: {
      vendor: true,
      lines: { include: { product: true } },
      vendorBills: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const mainPo = purchaseOrders[0];

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans">
      {/* 1. App Navbar Odoo */}
      <AppNavbar currentModule="Purchase Orders & Receipts (S-09 & S-10)" />

      {/* 2. Control Panel Header */}
      <ControlPanel
        breadcrumbs={[
          { label: 'Home', href: '/' },
          { label: 'Purchase', href: '/purchase' },
          { label: mainPo ? `${mainPo.docNumber} / ${mainPo.vendor.name}` : 'Purchase Order' },
        ]}
        searchPlaceholder="Cari nomor PO (PO00018) atau vendor (V01–V04)..."
        pagerText={`Total Dokumen PO: ${purchaseOrders.length}`}
        availableViews={['form', 'list']}
        currentView="form"
      >
        <div className="flex items-center gap-2">
          <Link
            href="/invoicing"
            className="px-3 py-1 bg-white border border-[#E2E8F0] hover:border-[#00F0FF] rounded-md text-xs font-semibold text-[#0F172A] transition-colors"
          >
            Tagihan Vendor & Utang (S-12) ➔
          </Link>
        </div>
      </ControlPanel>

      {/* 3. Main Workspace: S-09 RFQ/PO Form & S-10 Receipt Form */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-6 space-y-8">
        {purchaseOrders.map((po) => {
          const isReceived = po.status === 'Received';

          return (
            <div
              key={po.id}
              className="bg-white border border-[#E2E8F0] rounded-xl shadow-xs overflow-hidden"
            >
              {/* S-09 / S-10 Status Bar Workflow */}
              <FormStatusBar
                stages={['RFQ', 'RFQ Sent', 'Purchase Order', 'Received']}
                currentStage={isReceived ? 'Received' : po.status === 'Confirmed' ? 'Purchase Order' : 'RFQ'}
                actions={[
                  { label: 'Print PO', variant: 'secondary' },
                  { label: 'Send PO by Email', variant: 'secondary' },
                ]}
              >
                {po.status === 'Confirmed' && (
                  <form action={receiveProducts}>
                    <input type="hidden" name="poId" value={po.id} />
                    <button
                      type="submit"
                      className="bg-[#CFFF30] hover:brightness-95 text-[#0F172A] font-extrabold text-xs px-4 py-1.5 rounded-md shadow-xs transition-all flex items-center gap-1.5"
                    >
                      <span>📦</span>
                      <span>Terima Barang di WH (Receive Products)</span>
                    </button>
                  </form>
                )}
                {isReceived && (
                  <span className="text-[#10B981] font-bold text-xs bg-[#10B981]/15 border border-[#10B981]/30 px-3 py-1.5 rounded-md flex items-center gap-1">
                    <span>✓</span>
                    <span>Barang Telah Diterima di Gudang WH</span>
                  </span>
                )}
              </FormStatusBar>

              {/* S-09 Form Sheet */}
              <FormSheet
                title={`Purchase Order ${po.docNumber}`}
                subtitle={`Pengadaan Vendor: ${po.vendor.name} (${po.vendor.contactId})`}
                ribbon={{
                  text: isReceived ? 'RECEIVED' : po.status.toUpperCase(),
                  variant: isReceived ? 'success' : 'warning',
                }}
                smartButtons={[
                  {
                    label: 'Receipts (S-10)',
                    value: isReceived ? '1 Penerimaan (WH)' : '0 Penerimaan',
                    icon: '📦',
                    badge: isReceived ? 'Done' : 'Pending',
                  },
                  {
                    label: 'Vendor Bills (S-12)',
                    value: po.vendorBills?.length || (isReceived ? 'Siap Dicatat' : 'Belum Receipt'),
                    icon: '📑',
                    href: '/invoicing',
                  },
                  {
                    label: 'Termin Pembayaran',
                    value: po.vendor.paymentTerms,
                    icon: '⏳',
                  },
                  {
                    label: 'Lokasi Penerimaan',
                    value: 'WH/JKT/Stock',
                    icon: '🏭',
                  },
                ]}
              >
                {/* [4] Metadata Grid Vendor, Status, Nomor PO */}
                <div className="mt-3 p-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl">
                  <h4 className="text-xs font-bold text-[#1E293B] uppercase tracking-wider mb-3 pb-1 border-b border-[#E2E8F0]">
                    [4] Vendor, Status, Nomor PO &nbsp;|&nbsp; [6] Penerimaan Gudang & Tagihan (F-09 & F-10)
                  </h4>

                  <FormFieldGroup columns={2}>
                    <FormField label="Vendor Pemasok" required>
                      <span className="font-bold text-[#0F172A]">
                        {po.vendor.name} ({po.vendor.contactId})
                      </span>
                    </FormField>

                    <FormField label="Lokasi Gudang Tujuan">
                      <span className="font-mono font-bold text-[#0F172A] bg-white px-2 py-0.5 rounded border border-[#E2E8F0]">
                        WH/JKT/Stock — Gudang Utama Jakarta Timur
                      </span>
                    </FormField>

                    <FormField label="Termin Pembayaran">
                      <span className="font-mono font-bold text-[#1E293B] bg-[#CFFF30]/40 px-2 py-0.5 rounded border border-[#CFFF30]">
                        {po.vendor.paymentTerms}
                      </span>
                    </FormField>

                    <FormField label="Kategori Barang Vendor">
                      <span className="text-[#64748B]">
                        {po.vendor.category || 'Peralatan ritel'}
                      </span>
                    </FormField>
                  </FormFieldGroup>
                </div>

                {/* [5] Notebook Lines: Taxes, Total, & S-10 Receipt Table */}
                <FormNotebook
                  tabs={[
                    {
                      id: 'products',
                      label: 'Products / Order Lines (S-09)',
                      badge: po.lines.length,
                      content: (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-[#F8FAFC] text-[#64748B] uppercase font-bold border-b border-[#E2E8F0]">
                              <tr>
                                <th className="px-3 py-2.5">Produk</th>
                                <th className="px-3 py-2.5 text-center">Dipesan (Demand)</th>
                                <th className="px-3 py-2.5 text-right">Harga Satuan B2B</th>
                                <th className="px-3 py-2.5 text-center">Pajak</th>
                                <th className="px-3 py-2.5 text-right font-bold text-[#0F172A]">Subtotal</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#E2E8F0]">
                              {po.lines.map((line) => (
                                <tr key={line.id} className="hover:bg-[#F8FAFC]">
                                  <td className="px-3 py-2.5">
                                    <div className="font-bold text-[#0F172A]">{line.product.name}</div>
                                    <div className="font-mono text-[10px] text-[#64748B]">SKU: {line.sku}</div>
                                  </td>
                                  <td className="px-3 py-2.5 text-center font-mono font-bold text-[#0F172A]">
                                    {line.qtyOrdered} {line.product.uom}
                                  </td>
                                  <td className="px-3 py-2.5 text-right font-mono text-[#64748B]">
                                    Rp {line.unitPrice.toLocaleString('id-ID')}
                                  </td>
                                  <td className="px-3 py-2.5 text-center">
                                    <span className="font-mono text-[10px] bg-[#CFFF30]/40 text-[#0F172A] px-1.5 py-0.5 rounded border border-[#CFFF30]">
                                      PPN-E11 (11%)
                                    </span>
                                  </td>
                                  <td className="px-3 py-2.5 text-right font-mono font-extrabold text-[#0F172A]">
                                    Rp {line.subtotal.toLocaleString('id-ID')}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>

                          <div className="mt-4 pt-4 border-t border-[#E2E8F0] flex justify-end">
                            <div className="w-72 space-y-2 text-xs">
                              <div className="flex justify-between text-[#64748B]">
                                <span>Subtotal Pembelian (Net):</span>
                                <span className="font-mono font-bold text-[#0F172A]">
                                  Rp {po.subtotal.toLocaleString('id-ID')}
                                </span>
                              </div>
                              <div className="flex justify-between text-[#64748B]">
                                <span>PPN Masukan 11% (1150):</span>
                                <span className="font-mono font-bold text-[#0F172A]">
                                  Rp {po.taxAmount.toLocaleString('id-ID')}
                                </span>
                              </div>
                              <div className="flex justify-between pt-2 border-t border-[#E2E8F0] text-sm font-black text-[#0F172A]">
                                <span>TOTAL KOMITMEN PO:</span>
                                <span className="font-mono text-base text-[#10B981]">
                                  Rp {po.totalAmount.toLocaleString('id-ID')}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ),
                    },
                    {
                      id: 'receipt',
                      label: 'Penerimaan Fisik Gudang / Receipts (S-10)',
                      badge: isReceived ? 'Diterima' : 'Menunggu',
                      content: (
                        <div className="space-y-3 text-xs">
                          <div className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg">
                            <div className="flex justify-between items-center mb-2">
                              <span className="font-bold text-[#0F172A]">
                                Surat Penerimaan Barang WH/IN/{po.docNumber}
                              </span>
                              <span
                                className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                                  isReceived
                                    ? 'bg-[#10B981]/15 text-[#10B981]'
                                    : 'bg-[#F59E0B]/15 text-[#F59E0B]'
                                }`}
                              >
                                {isReceived ? 'Status: Selesai (Done)' : 'Status: Ready for Receiving'}
                              </span>
                            </div>
                            <p className="text-[#64748B] text-[11px] leading-relaxed">
                              Sesuai ketentuan SR-12: Penerimaan tidak melampaui kuantitas yang dipesan tanpa otorisasi.
                              Penerimaan memotong status komitmen PO00018 dan otomatis menambah on-hand WH/JKT/Stock.
                            </p>
                          </div>
                        </div>
                      ),
                    },
                  ]}
                />

                {/* [7] Chatter / Log Notes / Related Documents / Audit */}
                <Chatter
                  documentId={po.docNumber}
                  documentType="Purchase Order"
                  initialLogs={[
                    {
                      id: 'po1',
                      user: 'Awan Nugraha (Purchasing)',
                      role: 'Purchasing Officer',
                      action: 'Membuat Komitmen PO00018 ke PT Bina Plastik Abadi (V01)',
                      timestamp: 'Hari ini, 08:00',
                      message: 'Item: 10x P001 @75.000 + 4x P002 @230.000. Total Rp1.853.700 termasuk PPN 11%.',
                    },
                    {
                      id: 'po2',
                      user: 'Doni Saputra (Gudang)',
                      role: 'Warehouse Officer',
                      action: 'Audit Aturan SR-12 & SR-09 Tiga Arah',
                      timestamp: 'Hari ini, 08:30',
                      message: 'Receipt siap dicocokkan dengan Vendor Bill saat tagihan masuk dari V01.',
                    },
                  ]}
                />
              </FormSheet>
            </div>
          );
        })}
      </main>
    </div>
  );
}
