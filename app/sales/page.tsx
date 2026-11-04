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

export default async function SalesPage() {
  // ==========================================
  // 1. BACKEND LOGIC (SERVER ACTIONS - PRESERVED STRICTLY)
  // ==========================================
  async function confirmQuotation(formData: FormData) {
    'use server';

    const quotationId = formData.get('quotationId') as string;

    const quote = await prisma.quotation.findUnique({
      where: { id: quotationId },
      include: { lines: true },
    });

    if (!quote || quote.status !== 'Draft') return;

    // A. Bikin dokumen Sales Order (SO) baru dari data Penawaran
    await prisma.salesOrder.create({
      data: {
        docNumber: quote.docNumber.replace('Q', 'SO'), // Q00031 -> SO00031
        customerId: quote.customerId,
        status: 'Confirmed',
        subtotal: quote.subtotal,
        taxAmount: quote.taxAmount,
        totalAmount: quote.totalAmount,
        lines: {
          create: quote.lines.map((l) => ({
            sku: l.sku,
            qtyOrdered: l.qty,
            unitPrice: l.unitPrice,
            subtotal: l.subtotal,
          })),
        },
      },
    });

    // B. Ubah status Quotation jadi Confirmed
    await prisma.quotation.update({
      where: { id: quotationId },
      data: { status: 'Confirmed' },
    });

    revalidatePath('/sales');
    revalidatePath('/invoicing');
    revalidatePath('/dashboard');
  }

  // ==========================================
  // 2. FETCH DATA DARI DATABASE
  // ==========================================
  const quotations = await prisma.quotation.findMany({
    include: { customer: true, lines: { include: { product: true } } },
    orderBy: { createdAt: 'desc' },
  });

  const salesOrders = await prisma.salesOrder.findMany({
    include: {
      customer: true,
      lines: { include: { product: true } },
      deliveries: true,
      invoices: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  // Current primary quotation for S-05 Wireframe demonstration
  const mainQuote = quotations[0];

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans">
      {/* 1. App Navbar Odoo */}
      <AppNavbar currentModule="Sales & Quotations (S-05 & S-06)" />

      {/* 2. Control Panel Header */}
      <ControlPanel
        breadcrumbs={[
          { label: 'Home', href: '/' },
          { label: 'Sales Orders', href: '/sales' },
          { label: mainQuote ? `${mainQuote.docNumber} / ${mainQuote.customer.name}` : 'Quotation' },
        ]}
        searchPlaceholder="Cari no SO (SO00031), Quotation (Q00031), atau pelanggan..."
        pagerText={`Quotations: ${quotations.length} | SO: ${salesOrders.length}`}
        availableViews={['form', 'list']}
        currentView="form"
      >
        <div className="flex items-center gap-2">
          <Link
            href="/invoicing"
            className="px-3 py-1 bg-white border border-[#E2E8F0] hover:border-[#00F0FF] rounded-md text-xs font-semibold text-[#0F172A] transition-colors"
          >
            Faktur & Piutang (S-11) ➔
          </Link>
        </div>
      </ControlPanel>

      {/* 3. Main Workspace: S-05 Quotation & S-06 Sales Order Forms */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-6 space-y-8">
        
        {/* ========================================================= */}
        {/* SECTION S-05: QUOTATION FORM VIEW (Draft ➔ Confirmed)     */}
        {/* ========================================================= */}
        {mainQuote && (
          <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-xs overflow-hidden">
            {/* S-05 Status Bar Workflow */}
            <FormStatusBar
              stages={['Draft', 'Quotation Sent', 'Sales Order']}
              currentStage={mainQuote.status === 'Draft' ? 'Draft' : 'Sales Order'}
              actions={[
                { label: 'Send by Email', variant: 'secondary' },
                { label: 'Print Quotation', variant: 'secondary' },
              ]}
            >
              {mainQuote.status === 'Draft' && (
                <form action={confirmQuotation}>
                  <input type="hidden" name="quotationId" value={mainQuote.id} />
                  <button
                    type="submit"
                    className="bg-[#CFFF30] hover:brightness-95 text-[#0F172A] font-extrabold text-xs px-4 py-1.5 rounded-md shadow-xs transition-all flex items-center gap-1.5"
                  >
                    <span>✓</span>
                    <span>Confirm to Sales Order (SO)</span>
                  </button>
                </form>
              )}
            </FormStatusBar>

            {/* S-05 Form Sheet */}
            <FormSheet
              title={`Quotation ${mainQuote.docNumber}`}
              subtitle="S-05 Penawaran Harga B2B · Alur Order-to-Cash (F-05)"
              ribbon={{
                text: mainQuote.status.toUpperCase(),
                variant: mainQuote.status === 'Draft' ? 'warning' : 'success',
              }}
              smartButtons={[
                {
                  label: 'Plafon Kredit',
                  value: `Rp ${mainQuote.customer.creditLimit.toLocaleString('id-ID')}`,
                  icon: '💳',
                  href: `/contacts?contactId=${mainQuote.customer.contactId}`,
                },
                {
                  label: 'Termin Pembayaran',
                  value: mainQuote.customer.paymentTerms,
                  icon: '⏳',
                },
                {
                  label: 'Status Reservasi',
                  value: mainQuote.status === 'Draft' ? 'Belum Reservasi' : 'Tereservasi WH',
                  icon: '🔒',
                  badge: mainQuote.status === 'Draft' ? 'SR-01' : 'SR-02',
                },
              ]}
            >
              {/* [4] Metadata Header: Pelanggan, Tanggal, Status */}
              <div className="mt-3 p-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl">
                <h4 className="text-xs font-bold text-[#1E293B] uppercase tracking-wider mb-3 pb-1 border-b border-[#E2E8F0]">
                  [4] Pelanggan, Tanggal, Status &nbsp;|&nbsp; [6] Reservasi / Kebijakan SR-01 & SR-02
                </h4>

                <FormFieldGroup columns={2}>
                  <FormField label="Pelanggan (Customer)" required>
                    <span className="font-bold text-[#0F172A]">
                      {mainQuote.customer.name} ({mainQuote.customer.contactId})
                    </span>
                  </FormField>

                  <FormField label="Tanggal Dokumen">
                    <span className="font-medium text-[#0F172A]">
                      {new Date(mainQuote.createdAt).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </span>
                  </FormField>

                  <FormField label="Termin Pembayaran">
                    <span className="font-mono font-bold text-[#0F172A] bg-white px-2 py-0.5 rounded border border-[#E2E8F0]">
                      {mainQuote.customer.paymentTerms} (Net {mainQuote.customer.paymentTerms === 'PT-14' ? '14 Hari' : 'Cash'})
                    </span>
                  </FormField>

                  <FormField label="Gudang Pengeluaran">
                    <span className="font-mono font-bold text-[#1E293B] bg-white px-2 py-0.5 rounded border border-[#E2E8F0]">
                      WH/JKT/Stock (Gudang Utama)
                    </span>
                  </FormField>
                </FormFieldGroup>
              </div>

              {/* [5] Notebook Lines: Qty / Harga / Pajak / Subtotal */}
              <FormNotebook
                tabs={[
                  {
                    id: 'lines',
                    label: 'Order Lines (Rincian Produk)',
                    badge: mainQuote.lines.length,
                    content: (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-[#F8FAFC] text-[#64748B] uppercase font-bold border-b border-[#E2E8F0]">
                            <tr>
                              <th className="px-3 py-2.5">Produk / SKU</th>
                              <th className="px-3 py-2.5 text-center">Kuantitas</th>
                              <th className="px-3 py-2.5 text-right">Harga Satuan (IDR)</th>
                              <th className="px-3 py-2.5 text-center">Pajak</th>
                              <th className="px-3 py-2.5 text-right font-bold text-[#0F172A]">Subtotal</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#E2E8F0]">
                            {mainQuote.lines.map((line) => (
                              <tr key={line.id} className="hover:bg-[#F8FAFC]">
                                <td className="px-3 py-2.5">
                                  <div className="font-bold text-[#0F172A]">{line.product.name}</div>
                                  <div className="font-mono text-[10px] text-[#64748B]">SKU: {line.sku}</div>
                                </td>
                                <td className="px-3 py-2.5 text-center font-mono font-bold text-[#0F172A]">
                                  {line.qty} {line.product.uom}
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

                        {/* Order Summary Total Area */}
                        <div className="mt-4 pt-4 border-t border-[#E2E8F0] flex justify-end">
                          <div className="w-72 space-y-2 text-xs">
                            <div className="flex justify-between text-[#64748B]">
                              <span>Subtotal (Net Sebelum Pajak):</span>
                              <span className="font-mono font-bold text-[#0F172A]">
                                Rp {mainQuote.subtotal.toLocaleString('id-ID')}
                              </span>
                            </div>
                            <div className="flex justify-between text-[#64748B]">
                              <span>PPN Efektif 11% (PPN-E11):</span>
                              <span className="font-mono font-bold text-[#0F172A]">
                                Rp {mainQuote.taxAmount.toLocaleString('id-ID')}
                              </span>
                            </div>
                            <div className="flex justify-between pt-2 border-t border-[#E2E8F0] text-sm font-black text-[#0F172A]">
                              <span>TOTAL KESEPAKATAN:</span>
                              <span className="font-mono text-base text-[#1E293B]">
                                Rp {mainQuote.totalAmount.toLocaleString('id-ID')}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ),
                  },
                ]}
              />

              {/* [7] Chatter / Log Notes / Related Documents / Audit */}
              <Chatter
                documentId={mainQuote.docNumber}
                documentType="Sales Quotation"
                initialLogs={[
                  {
                    id: 'q1',
                    user: 'Maya Lestari (Sales Mgr)',
                    role: 'Sales Lead',
                    action: 'Menyusun Quotation Q00031 untuk PT Kantor Sentosa',
                    timestamp: 'Hari ini, 09:15',
                    message: 'Barang: 4x P001 + 2x P003. Nilai total Rp932.400 sesuai dataset B0.',
                  },
                  {
                    id: 'q2',
                    user: 'Hendra Wijaya (Owner)',
                    role: 'Business Owner',
                    action: 'Audit Aturan Reservasi SR-01',
                    timestamp: 'Hari ini, 09:30',
                    message: 'Stok pada tahap Quotation Draft belum memotong saldo fisik atau reservasi sah.',
                  },
                ]}
              />
            </FormSheet>
          </div>
        )}

        {/* ========================================================= */}
        {/* SECTION S-06: SALES ORDER FORM VIEW (Confirmed / Locked) */}
        {/* ========================================================= */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-xs overflow-hidden">
          <div className="p-4 border-b border-[#E2E8F0] bg-[#1E293B] text-white flex justify-between items-center">
            <div>
              <h2 className="font-bold text-sm text-[#CFFF30] tracking-wider uppercase">
                S-06 Sales Order Form (SO Confirmed & Locked)
              </h2>
              <span className="text-xs text-slate-300">
                Pencegahan edit senyap (SR-06) & Credit Check (SR-11)
              </span>
            </div>
            <span className="text-xs font-mono font-bold bg-[#10B981] text-white px-3 py-1 rounded-md">
              Confirmed SO: {salesOrders.length}
            </span>
          </div>

          {salesOrders.length === 0 ? (
            <div className="p-12 text-center text-[#64748B] space-y-2">
              <span className="text-3xl">📋</span>
              <p className="text-xs">
                Belum ada Sales Order yang dikonfirmasi. Klik tombol{' '}
                <strong className="text-[#0F172A] bg-[#CFFF30] px-1 py-0.5 rounded">
                  Confirm to Sales Order
                </strong>{' '}
                pada Quotation di atas untuk menghasilkan SO00031!
              </p>
            </div>
          ) : (
            salesOrders.map((so) => (
              <div key={so.id} className="p-6 space-y-6">
                {/* S-06 Status Bar */}
                <FormStatusBar
                  stages={['Draft', 'Quotation Sent', 'Sales Order']}
                  currentStage="Sales Order"
                  actions={[
                    { label: 'Kunci Perubahan (SR-06)', variant: 'secondary', disabled: true },
                    { label: 'Kirim Pesanan (Delivery)', variant: 'accent' },
                  ]}
                />

                {/* S-06 Form Sheet */}
                <FormSheet
                  title={`Sales Order ${so.docNumber}`}
                  subtitle={`Terkonfirmasi dari ${so.docNumber.replace('SO', 'Q')} · Status Terkunci`}
                  ribbon={{ text: 'CONFIRMED', variant: 'success' }}
                  smartButtons={[
                    {
                      label: 'Delivery Order',
                      value: so.deliveries?.length || 1,
                      icon: '📦',
                      href: '/inventory',
                    },
                    {
                      label: 'Customer Invoices',
                      value: so.invoices?.length || 1,
                      icon: '📑',
                      href: '/invoicing',
                    },
                    {
                      label: 'Credit Check',
                      value: 'Passed (SR-11)',
                      icon: '🛡️',
                      badge: 'Lolos Limit',
                    },
                  ]}
                >
                  <div className="mt-2 p-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl">
                    <h4 className="text-xs font-bold text-[#1E293B] uppercase tracking-wider mb-3 pb-1 border-b border-[#E2E8F0]">
                      [4] Status Confirmed, Lock &nbsp;|&nbsp; [6] Total, Credit-Check, Log Notes (F-06 / SR-06)
                    </h4>

                    <FormFieldGroup columns={2}>
                      <FormField label="Nomor Dokumen SO">
                        <span className="font-mono font-bold text-sm bg-white px-2 py-0.5 rounded border border-[#E2E8F0] text-[#0F172A]">
                          {so.docNumber}
                        </span>
                      </FormField>

                      <FormField label="Pelanggan">
                        <span className="font-bold text-[#0F172A]">
                          {so.customer.name} ({so.customer.city})
                        </span>
                      </FormField>

                      <FormField label="Total Tagihan (Termasuk PPN)">
                        <span className="font-mono font-black text-base text-[#10B981]">
                          Rp {so.totalAmount.toLocaleString('id-ID')}
                        </span>
                      </FormField>

                      <FormField label="Kebijakan Harga SO">
                        <span className="text-xs text-[#64748B] italic">
                          🔒 Terkunci; harga tidak berubah otomatis jika master produk diedit.
                        </span>
                      </FormField>
                    </FormFieldGroup>
                  </div>

                  {/* Rincian Produk SO */}
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#F8FAFC] text-[#64748B] uppercase font-bold border-b border-[#E2E8F0]">
                        <tr>
                          <th className="px-3 py-2">Item Produk</th>
                          <th className="px-3 py-2 text-center">Qty Dipesan</th>
                          <th className="px-3 py-2 text-right">Harga Unit</th>
                          <th className="px-3 py-2 text-right">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E2E8F0]">
                        {so.lines.map((l) => (
                          <tr key={l.id}>
                            <td className="px-3 py-2 font-bold text-[#0F172A]">{l.product.name}</td>
                            <td className="px-3 py-2 text-center font-mono font-bold">{l.qtyOrdered} Unit</td>
                            <td className="px-3 py-2 text-right font-mono">Rp {l.unitPrice.toLocaleString('id-ID')}</td>
                            <td className="px-3 py-2 text-right font-mono font-bold">Rp {l.subtotal.toLocaleString('id-ID')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Chatter S-06 */}
                  <Chatter
                    documentId={so.docNumber}
                    documentType="Sales Order"
                    initialLogs={[
                      {
                        id: 'so1',
                        user: 'Sinta Rahmawati (Finance)',
                        role: 'Finance Officer',
                        action: 'Pemeriksaan Batas Kredit Berhasil (SR-11)',
                        timestamp: 'Hari ini, 10:05',
                        message: `Plafon Rp5.000.000 mencukupi untuk tagihan Rp${so.totalAmount.toLocaleString('id-ID')} termasuk PPN 11%.`,
                      },
                      {
                        id: 'so2',
                        user: 'Doni Saputra (Gudang)',
                        role: 'Warehouse Officer',
                        action: 'Reservasi Stok Gudang Utama (WH)',
                        timestamp: 'Hari ini, 10:06',
                        message: 'Stok 4x P001 dan 2x P003 dipindahkan ke status Reserved pada WH.',
                      },
                    ]}
                  />
                </FormSheet>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
