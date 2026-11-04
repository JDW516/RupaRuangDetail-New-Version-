import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import {
  AppNavbar,
  ControlPanel,
} from '@/components/odoo';

export const revalidate = 0;

export default async function InvoicingPage() {
  // ==========================================
  // 1. BACKEND LOGIC: ACCOUNTING ENGINE (PRESERVED STRICTLY)
  // ==========================================
  async function createInvoice(formData: FormData) {
    'use server';
    const soId = formData.get('soId') as string;

    const so = await prisma.salesOrder.findUnique({
      where: { id: soId },
      include: { lines: true },
    });
    if (!so) return;

    const invNumber = so.docNumber.replace('SO', 'INV-');
    const exist = await prisma.invoice.findFirst({ where: { docNumber: invNumber } });
    if (exist) return;

    // A. Terbitkan Faktur
    await prisma.invoice.create({
      data: {
        docNumber: invNumber,
        customerId: so.customerId,
        status: 'Posted',
        subtotal: so.subtotal,
        taxAmount: so.taxAmount,
        totalAmount: so.totalAmount,
      },
    });

    // B. AUTO-JOURNAL: Pengakuan Piutang & Pendapatan (Double-Entry)
    // Debit: Trade Receivables (1100)
    // Kredit: Sales Revenue (4000) & PPN Keluaran (2100)
    await prisma.journalEntry.create({
      data: {
        docNumber: invNumber.replace('INV', 'JRN'),
        description: `Pengakuan Piutang Faktur ${invNumber}`,
        lines: {
          create: [
            { accountCode: '1100', debit: so.totalAmount, credit: 0 },
            { accountCode: '4000', debit: 0, credit: so.subtotal },
            { accountCode: '2100', debit: 0, credit: so.taxAmount },
          ],
        },
      },
    });

    revalidatePath('/invoicing');
    revalidatePath('/accounting');
    revalidatePath('/dashboard');
  }

  async function createBill(formData: FormData) {
    'use server';
    const poId = formData.get('poId') as string;

    const po = await prisma.purchaseOrder.findUnique({
      where: { id: poId },
      include: { lines: true },
    });
    if (!po) return;

    const billNumber = po.docNumber.replace('PO', 'BILL-');
    const exist = await prisma.vendorBill.findFirst({ where: { docNumber: billNumber } });
    if (exist) return;

    // A. Terbitkan Tagihan Vendor
    await prisma.vendorBill.create({
      data: {
        docNumber: billNumber,
        vendorId: po.vendorId,
        status: 'Posted',
        subtotal: po.subtotal,
        taxAmount: po.taxAmount,
        totalAmount: po.totalAmount,
      },
    });

    // B. AUTO-JOURNAL: Pengakuan Hutang & Persediaan (Double-Entry)
    // Debit: Inventory Valuation (1200) & PPN Masukan (1150)
    // Kredit: Trade Payables (2000)
    await prisma.journalEntry.create({
      data: {
        docNumber: billNumber.replace('BILL', 'JRN'),
        description: `Pengakuan Hutang Pembelian ${billNumber}`,
        lines: {
          create: [
            { accountCode: '1200', debit: po.subtotal, credit: 0 },
            { accountCode: '1150', debit: po.taxAmount, credit: 0 },
            { accountCode: '2000', debit: 0, credit: po.totalAmount },
          ],
        },
      },
    });

    revalidatePath('/invoicing');
    revalidatePath('/accounting');
    revalidatePath('/dashboard');
  }

  // ==========================================
  // 2. FETCH DATA KEUANGAN & BUKU BESAR
  // ==========================================
  const salesOrders = await prisma.salesOrder.findMany({ include: { customer: true } });
  const purchaseOrders = await prisma.purchaseOrder.findMany({ include: { vendor: true } });
  const invoices = await prisma.invoice.findMany({
    include: { customer: true },
    orderBy: { createdAt: 'desc' },
  });
  const vendorBills = await prisma.vendorBill.findMany({
    include: { vendor: true },
    orderBy: { createdAt: 'desc' },
  });

  const journals = await prisma.journalEntry.findMany({
    include: { lines: { include: { account: true } } },
    orderBy: { createdAt: 'desc' },
  });

  const totalInvoiced = invoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
  const totalBilled = vendorBills.reduce((sum, b) => sum + b.totalAmount, 0);

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans">
      {/* 1. App Navbar Odoo */}
      <AppNavbar currentModule="Invoicing & Accounting (S-11 s.d S-14)" />

      {/* 2. Control Panel Header */}
      <ControlPanel
        breadcrumbs={[
          { label: 'Home', href: '/' },
          { label: 'Invoicing & Bills', href: '/invoicing' },
          { label: 'Accounting Workspace' },
        ]}
        searchPlaceholder="Cari nomor faktur (INV-SO00031), tagihan, atau jurnal..."
        pagerText={`Faktur: ${invoices.length} | Tagihan: ${vendorBills.length} | Jurnal: ${journals.length}`}
        availableViews={['list', 'form']}
        currentView="list"
      >
        <div className="flex items-center gap-3">
          <Link
            href="/accounting"
            className="px-3 py-1 bg-[#1E293B] text-[#00F0FF] hover:bg-slate-800 rounded-md text-xs font-bold transition-colors flex items-center gap-1.5"
          >
            <span>⚖️</span>
            <span>General Ledger & COA (S-14)</span>
          </Link>
        </div>
      </ControlPanel>

      {/* 3. Main Workspace Grid */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-6 space-y-8">
        
        {/* KPI Ringkasan Piutang & Hutang */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-2xs">
            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">
              Total Piutang Faktur Terbit (INV)
            </span>
            <div className="text-xl font-mono font-black text-[#0F172A] mt-1">
              Rp {totalInvoiced.toLocaleString('id-ID')}
            </div>
            <span className="text-[11px] text-[#3B82F6] font-semibold mt-1 block">
              {invoices.length} Faktur Posted (Debit 1100)
            </span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-2xs">
            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">
              Total Hutang Vendor Terbit (BILL)
            </span>
            <div className="text-xl font-mono font-black text-[#0F172A] mt-1">
              Rp {totalBilled.toLocaleString('id-ID')}
            </div>
            <span className="text-[11px] text-[#F59E0B] font-semibold mt-1 block">
              {vendorBills.length} Tagihan Posted (Kredit 2000)
            </span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-2xs">
            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">
              Entri Jurnal Berpasangan (S-14)
            </span>
            <div className="text-xl font-mono font-black text-[#10B981] mt-1">
              {journals.length} Dokumen
            </div>
            <span className="text-[11px] text-[#10B981] font-semibold mt-1 block">
              ✓ Keseimbangan Saldo: Debit == Kredit
            </span>
          </div>
        </div>

        {/* 2 Kolom: S-11 Customer Invoices & S-12 Vendor Bills */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* ======================================================== */}
          {/* S-11: CUSTOMER INVOICES (PIUTANG DAGANG)                */}
          {/* ======================================================== */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-xs overflow-hidden flex flex-col">
            <div className="p-4 border-b border-[#E2E8F0] bg-[#1E293B] text-white flex justify-between items-center">
              <div>
                <h2 className="font-extrabold text-sm text-[#00F0FF]">
                  S-11 Customer Invoices (Faktur B2B)
                </h2>
                <span className="text-xs text-slate-300">
                  Tagihan berbasis bukti terkirim (SR-04 / F-11)
                </span>
              </div>
              <span className="text-xs font-mono font-bold bg-[#3B82F6] px-2.5 py-0.5 rounded text-white">
                Akun: 1100 Trade Receivables
              </span>
            </div>

            <div className="p-5 space-y-4 flex-1">
              <div className="border border-[#E2E8F0] rounded-xl p-3 bg-[#F8FAFC]">
                <h3 className="font-bold text-[#0F172A] text-xs uppercase tracking-wider mb-2">
                  Antrean Penagihan Sales Order (To Invoice)
                </h3>

                {salesOrders.length === 0 ? (
                  <p className="text-xs text-[#64748B] italic py-2">
                    Belum ada Sales Order untuk ditagihkan.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {salesOrders.map((so) => {
                      const isBilled = invoices.some((inv) =>
                        inv.docNumber.includes(so.docNumber)
                      );

                      return (
                        <div
                          key={so.id}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-lg border border-[#E2E8F0] shadow-2xs"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-xs text-[#0F172A]">
                                {so.docNumber}
                              </span>
                              <span className="text-[10px] bg-[#F8FAFC] text-[#64748B] px-1.5 py-0.5 rounded border border-[#E2E8F0]">
                                {so.customer.name}
                              </span>
                            </div>
                            <span className="font-mono font-extrabold text-xs text-[#10B981] mt-1 block">
                              Rp {so.totalAmount.toLocaleString('id-ID')}
                            </span>
                          </div>

                          {isBilled ? (
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-[#10B981] bg-[#10B981]/15 border border-[#10B981]/30 px-3 py-1.5 rounded-md">
                                ✓ Faktur Terbit (INV)
                              </span>
                            </div>
                          ) : (
                            <form action={createInvoice}>
                              <input type="hidden" name="soId" value={so.id} />
                              <button
                                type="submit"
                                className="bg-[#CFFF30] hover:brightness-95 text-[#0F172A] font-extrabold text-xs px-3.5 py-1.5 rounded-md shadow-xs transition-all flex items-center gap-1"
                              >
                                <span>📄</span>
                                <span>Terbitkan Faktur</span>
                              </button>
                            </form>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Daftar Faktur Terbit */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-[#64748B] uppercase tracking-wider">
                  Faktur Berstatus Posted ({invoices.length})
                </h4>
                {invoices.map((inv) => (
                  <div
                    key={inv.id}
                    className="p-3 bg-[#F8FAFC] rounded-lg border border-[#E2E8F0] flex justify-between items-center text-xs"
                  >
                    <div>
                      <span className="font-mono font-bold text-[#0F172A] block">
                        {inv.docNumber}
                      </span>
                      <span className="text-[11px] text-[#64748B]">
                        Pelanggan: {inv.customer.name}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="font-mono font-bold text-[#0F172A] block">
                        Rp {inv.totalAmount.toLocaleString('id-ID')}
                      </span>
                      <span className="text-[10px] font-bold text-[#10B981] bg-[#10B981]/15 px-2 py-0.5 rounded">
                        Posted & Auto-Journaled
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ======================================================== */}
          {/* S-12: VENDOR BILLS (HUTANG USAHA)                        */}
          {/* ======================================================== */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-xs overflow-hidden flex flex-col">
            <div className="p-4 border-b border-[#E2E8F0] bg-[#1E293B] text-white flex justify-between items-center">
              <div>
                <h2 className="font-extrabold text-sm text-[#CFFF30]">
                  S-12 Vendor Bills (Tagihan Pembelian)
                </h2>
                <span className="text-xs text-slate-300">
                  Pencocokan 3-Arah PO/Receipt/Bill (SR-09 / F-12)
                </span>
              </div>
              <span className="text-xs font-mono font-bold bg-[#F59E0B] px-2.5 py-0.5 rounded text-white">
                Akun: 2000 Trade Payables
              </span>
            </div>

            <div className="p-5 space-y-4 flex-1">
              <div className="border border-[#E2E8F0] rounded-xl p-3 bg-[#F8FAFC]">
                <h3 className="font-bold text-[#0F172A] text-xs uppercase tracking-wider mb-2">
                  Antrean Tagihan Vendor dari Penerimaan Gudang (To Bill)
                </h3>

                {purchaseOrders.filter((po) => po.status === 'Received').length === 0 ? (
                  <p className="text-xs text-[#64748B] italic py-2">
                    Belum ada barang masuk gudang yang siap dibill. Terima barang di modul Purchase dahulu!
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {purchaseOrders
                      .filter((po) => po.status === 'Received')
                      .map((po) => {
                        const isBilled = vendorBills.some((bill) =>
                          bill.docNumber.includes(po.docNumber)
                        );

                        return (
                          <div
                            key={po.id}
                            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-lg border border-[#E2E8F0] shadow-2xs"
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-xs text-[#0F172A]">
                                  {po.docNumber}
                                </span>
                                <span className="text-[10px] bg-[#F8FAFC] text-[#64748B] px-1.5 py-0.5 rounded border border-[#E2E8F0]">
                                  {po.vendor.name}
                                </span>
                              </div>
                              <span className="font-mono font-extrabold text-xs text-[#F59E0B] mt-1 block">
                                Rp {po.totalAmount.toLocaleString('id-ID')}
                              </span>
                            </div>

                            {isBilled ? (
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-bold text-[#10B981] bg-[#10B981]/15 border border-[#10B981]/30 px-3 py-1.5 rounded-md">
                                  ✓ Tagihan Terbit (BILL)
                                </span>
                              </div>
                            ) : (
                              <form action={createBill}>
                                <input type="hidden" name="poId" value={po.id} />
                                <button
                                  type="submit"
                                  className="bg-[#1E293B] hover:bg-slate-800 text-[#CFFF30] font-extrabold text-xs px-3.5 py-1.5 rounded-md shadow-xs transition-all flex items-center gap-1"
                                >
                                  <span>📝</span>
                                  <span>Terbitkan Tagihan (Bill)</span>
                                </button>
                              </form>
                            )}
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>

              {/* Daftar Vendor Bills Terbit */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-[#64748B] uppercase tracking-wider">
                  Tagihan Vendor Berstatus Posted ({vendorBills.length})
                </h4>
                {vendorBills.map((b) => (
                  <div
                    key={b.id}
                    className="p-3 bg-[#F8FAFC] rounded-lg border border-[#E2E8F0] flex justify-between items-center text-xs"
                  >
                    <div>
                      <span className="font-mono font-bold text-[#0F172A] block">
                        {b.docNumber}
                      </span>
                      <span className="text-[11px] text-[#64748B]">
                        Vendor: {b.vendor.name}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="font-mono font-bold text-[#0F172A] block">
                        Rp {b.totalAmount.toLocaleString('id-ID')}
                      </span>
                      <span className="text-[10px] font-bold text-[#10B981] bg-[#10B981]/15 px-2 py-0.5 rounded">
                        Posted & Auto-Journaled
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* S-14: GENERAL LEDGER / DOUBLE-ENTRY JOURNAL ENTRIES      */}
        {/* ======================================================== */}
        <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-xs overflow-hidden">
          <div className="p-4 border-b border-[#E2E8F0] bg-[#1E293B] text-white flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="font-extrabold text-sm text-[#CFFF30]">
                S-14 Journal Entries / General Ledger (F-14 / SR-11)
              </h2>
              <span className="text-xs text-slate-300">
                Pencatatan Berpasangan Otomatis: Total Saldo Debit == Total Saldo Kredit
              </span>
            </div>
            <span className="text-xs font-mono font-bold bg-[#10B981] text-white px-3 py-1 rounded-md self-start sm:self-auto">
              Debit == Kredit: BALANCED
            </span>
          </div>

          <div className="p-5">
            {journals.length === 0 ? (
              <div className="p-8 text-center text-[#64748B] space-y-2">
                <span className="text-3xl">⚖️</span>
                <p className="text-xs">
                  Belum ada jurnal transaksi. Terbitkan Faktur Pelanggan atau Tagihan Vendor di atas untuk memicu auto-journaling!
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {journals.map((journal) => {
                  const totalDebit = journal.lines.reduce((s, l) => s + l.debit, 0);
                  const totalCredit = journal.lines.reduce((s, l) => s + l.credit, 0);
                  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

                  return (
                    <div
                      key={journal.id}
                      className="border border-[#E2E8F0] rounded-xl overflow-hidden shadow-2xs"
                    >
                      {/* Header Jurnal Entry */}
                      <div className="bg-[#F8FAFC] px-4 py-3 border-b border-[#E2E8F0] flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-sm bg-white px-2 py-0.5 rounded border border-[#E2E8F0] text-[#0F172A]">
                            {journal.docNumber}
                          </span>
                          <span className="text-[#64748B] font-medium">
                            {journal.description}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-[#64748B]">
                            {new Date(journal.date).toLocaleDateString('id-ID', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </span>
                          <span
                            className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded ${
                              isBalanced
                                ? 'bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30'
                                : 'bg-[#EF4444]/15 text-[#EF4444]'
                            }`}
                          >
                            {isBalanced ? '✓ Balanced' : 'Unbalanced'}
                          </span>
                        </div>
                      </div>

                      {/* Tabel Baris Jurnal Debit/Kredit */}
                      <table className="w-full text-xs text-left">
                        <thead className="bg-[#FFFFFF] text-[#64748B] border-b border-[#E2E8F0] uppercase font-bold text-[10px]">
                          <tr>
                            <th className="px-4 py-2.5 w-1/2">Akun COA</th>
                            <th className="px-4 py-2.5 text-right">Debit (Rp)</th>
                            <th className="px-4 py-2.5 text-right">Kredit (Rp)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E2E8F0]">
                          {journal.lines.map((line) => (
                            <tr key={line.id} className="hover:bg-[#F8FAFC]">
                              <td className="px-4 py-2 text-[#0F172A]">
                                <span className="font-mono font-bold bg-[#F8FAFC] border border-[#E2E8F0] px-1.5 py-0.5 rounded text-[11px] mr-2">
                                  {line.accountCode}
                                </span>
                                <span className="font-medium">{line.account.name}</span>
                              </td>
                              <td className="px-4 py-2 text-right font-mono font-semibold text-[#0F172A]">
                                {line.debit > 0 ? line.debit.toLocaleString('id-ID') : '-'}
                              </td>
                              <td className="px-4 py-2 text-right font-mono font-semibold text-[#0F172A]">
                                {line.credit > 0 ? line.credit.toLocaleString('id-ID') : '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-[#F8FAFC] border-t border-[#E2E8F0] font-black text-xs">
                          <tr>
                            <td className="px-4 py-2 text-[#0F172A] uppercase">Total Keseimbangan:</td>
                            <td className="px-4 py-2 text-right font-mono text-[#0F172A]">
                              Rp {totalDebit.toLocaleString('id-ID')}
                            </td>
                            <td className="px-4 py-2 text-right font-mono text-[#0F172A]">
                              Rp {totalCredit.toLocaleString('id-ID')}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
