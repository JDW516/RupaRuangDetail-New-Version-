import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import {
  AppNavbar,
  ControlPanel,
  Chatter,
} from '@/components/odoo';

export const revalidate = 0;

export default async function AccountingPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; type?: string }>;
}) {
  const resolvedParams = searchParams ? await searchParams : {};
  const filterType = resolvedParams?.type || 'ALL';
  const searchQuery = (resolvedParams?.q || '').toLowerCase();

  const accounts = await prisma.account.findMany({
    orderBy: { code: 'asc' },
  });

  const journals = await prisma.journalEntry.findMany({
    include: {
      lines: {
        include: { account: true },
      },
    },
    orderBy: { date: 'desc' },
  });

  const filteredAccounts = accounts.filter((acc) => {
    const matchesType = filterType === 'ALL' || acc.type === filterType;
    const matchesSearch =
      searchQuery === '' ||
      acc.code.toLowerCase().includes(searchQuery) ||
      acc.name.toLowerCase().includes(searchQuery) ||
      acc.type.toLowerCase().includes(searchQuery);
    return matchesType && matchesSearch;
  });

  // Hitung total saldo debit dan kredit dari seluruh jurnal
  const grandTotalDebit = journals.reduce(
    (acc, j) => acc + j.lines.reduce((s, l) => s + l.debit, 0),
    0
  );
  const grandTotalCredit = journals.reduce(
    (acc, j) => acc + j.lines.reduce((s, l) => s + l.credit, 0),
    0
  );
  const isAllBalanced = Math.abs(grandTotalDebit - grandTotalCredit) < 0.01;

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans">
      {/* 1. App Navbar Odoo */}
      <AppNavbar currentModule="Accounting & General Ledger (S-14)" />

      {/* 2. Control Panel Header */}
      <ControlPanel
        breadcrumbs={[
          { label: 'Home', href: '/' },
          { label: 'Accounting', href: '/accounting' },
          { label: 'Chart of Accounts & Ledger' },
        ]}
        searchPlaceholder="Cari kode akun COA atau nama buku besar..."
        pagerText={`Akun: ${accounts.length} | Mutasi Jurnal: ${journals.length}`}
        availableViews={['list', 'graph']}
        currentView="list"
      >
        <div className="flex items-center gap-2">
          <Link
            href="/invoicing"
            className="px-3 py-1 bg-white border border-[#E2E8F0] hover:border-[#00F0FF] rounded-md text-xs font-semibold text-[#0F172A] transition-colors"
          >
            Faktur & Tagihan (S-11 & S-12) ➔
          </Link>
        </div>
      </ControlPanel>

      {/* 3. Main Workspace: S-14 Chart of Accounts & General Ledger */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-6 space-y-8">
        
        {/* Banner Balance Status */}
        <div className="bg-[#FFFFFF] rounded-2xl border border-[#E2E8F0] p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${isAllBalanced ? 'bg-[#10B981]' : 'bg-[#EF4444]'}`} />
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#64748B]">
                Pemeriksaan Integritas Double-Entry (SR-11 / F-14)
              </span>
            </div>
            <h1 className="text-xl font-black text-[#0F172A] tracking-tight mt-1">
              General Ledger & Chart of Accounts (COA)
            </h1>
            <p className="text-xs text-[#64748B] mt-0.5">
              Seluruh mutasi otomatis divalidasi dengan aturan persamaan akuntansi Debit == Kredit.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-4 py-2 text-right">
              <span className="block text-[10px] text-[#64748B] font-semibold uppercase">Total Mutasi Debit</span>
              <span className="text-sm font-mono font-black text-[#0F172A]">
                Rp {grandTotalDebit.toLocaleString('id-ID')}
              </span>
            </div>
            <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-4 py-2 text-right">
              <span className="block text-[10px] text-[#64748B] font-semibold uppercase">Total Mutasi Kredit</span>
              <span className="text-sm font-mono font-black text-[#0F172A]">
                Rp {grandTotalCredit.toLocaleString('id-ID')}
              </span>
            </div>
            <div
              className={`px-3 py-2 rounded-xl text-xs font-bold border ${
                isAllBalanced
                  ? 'bg-[#10B981]/15 text-[#10B981] border-[#10B981]/30'
                  : 'bg-[#EF4444]/15 text-[#EF4444] border-[#EF4444]/30'
              }`}
            >
              {isAllBalanced ? '✓ Jurnal Seimbang' : 'Selisih Jurnal!'}
            </div>
          </div>
        </div>

        {/* SECTION 1: CHART OF ACCOUNTS (COA) */}
        <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-xs overflow-hidden">
          <div className="p-4 border-b border-[#E2E8F0] bg-[#F8FAFC] flex justify-between items-center">
            <h2 className="font-extrabold text-[#0F172A] text-sm">
              15 Chart of Accounts (COA) Resmi RupaRuang Retail
            </h2>
            <span className="text-xs font-mono font-bold bg-[#1E293B] text-[#CFFF30] px-2.5 py-1 rounded">
              Total Akun: {accounts.length}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FFFFFF] text-[#64748B] uppercase font-bold border-b border-[#E2E8F0] text-[10px]">
                <tr>
                  <th className="px-4 py-3">Kode Akun</th>
                  <th className="px-4 py-3">Nama Akun (Account Name)</th>
                  <th className="px-4 py-3">Tipe Klasifikasi</th>
                  <th className="px-4 py-3 text-right">Status Ledger</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {filteredAccounts.map((acc) => (
                  <tr key={acc.code} className="hover:bg-[#F8FAFC]">
                    <td className="px-4 py-3 font-mono font-bold text-[#0F172A]">
                      <span className="bg-[#F8FAFC] border border-[#E2E8F0] px-2 py-0.5 rounded">
                        {acc.code}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-[#0F172A]">
                      {acc.name}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          acc.type === 'Asset'
                            ? 'bg-[#3B82F6]/15 text-[#3B82F6]'
                            : acc.type === 'Liability'
                            ? 'bg-[#EF4444]/15 text-[#EF4444]'
                            : acc.type === 'Equity'
                            ? 'bg-[#8B5CF6]/15 text-[#8B5CF6]'
                            : acc.type === 'Revenue'
                            ? 'bg-[#10B981]/15 text-[#10B981]'
                            : 'bg-[#F59E0B]/15 text-[#F59E0B]'
                        }`}
                      >
                        {acc.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-[#64748B]">
                      Aktif Terhubung
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* SECTION 2: BUKU BESAR JURNAL ENTRY DRILL-DOWN (S-14) */}
        <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-xs overflow-hidden">
          <div className="p-4 border-b border-[#E2E8F0] bg-[#1E293B] text-white flex justify-between items-center">
            <div>
              <h2 className="font-extrabold text-sm text-[#00F0FF]">
                Buku Jurnal Umum (General Ledger Entries)
              </h2>
              <span className="text-xs text-slate-300">
                Drill-down ke dokumen sumber (Invoice INV, Tagihan BILL, Sales POS)
              </span>
            </div>
            <span className="text-xs font-mono font-bold bg-[#CFFF30] text-[#0F172A] px-2.5 py-1 rounded">
              {journals.length} Mutasi
            </span>
          </div>

          <div className="p-5">
            {journals.length === 0 ? (
              <div className="p-8 text-center text-[#64748B] space-y-2">
                <span className="text-3xl">📑</span>
                <p className="text-xs">
                  Belum ada entri jurnal yang dibukukan. Kunjungi halaman Invoicing untuk menerbitkan Faktur!
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {journals.map((j) => (
                  <div
                    key={j.id}
                    className="border border-[#E2E8F0] rounded-xl overflow-hidden shadow-2xs"
                  >
                    <div className="bg-[#F8FAFC] px-4 py-2.5 border-b border-[#E2E8F0] flex justify-between items-center text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-[#0F172A] bg-white px-2 py-0.5 rounded border border-[#E2E8F0]">
                          {j.docNumber}
                        </span>
                        <span className="text-[#64748B] font-medium">{j.description}</span>
                      </div>
                      <span className="font-mono text-[10px] text-[#64748B]">
                        {new Date(j.date).toLocaleDateString('id-ID')}
                      </span>
                    </div>

                    <table className="w-full text-xs text-left">
                      <thead className="bg-white text-[#64748B] border-b border-[#E2E8F0] uppercase text-[10px]">
                        <tr>
                          <th className="px-4 py-2 w-1/2">Akun COA</th>
                          <th className="px-4 py-2 text-right">Debit (Rp)</th>
                          <th className="px-4 py-2 text-right">Kredit (Rp)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E2E8F0]">
                        {j.lines.map((l) => (
                          <tr key={l.id} className="hover:bg-[#F8FAFC]">
                            <td className="px-4 py-2 text-[#0F172A]">
                              <span className="font-mono font-bold bg-[#F8FAFC] px-1.5 py-0.5 rounded border border-[#E2E8F0] mr-2 text-[11px]">
                                {l.accountCode}
                              </span>
                              <span>{l.account.name}</span>
                            </td>
                            <td className="px-4 py-2 text-right font-mono font-semibold">
                              {l.debit > 0 ? l.debit.toLocaleString('id-ID') : '-'}
                            </td>
                            <td className="px-4 py-2 text-right font-mono font-semibold">
                              {l.credit > 0 ? l.credit.toLocaleString('id-ID') : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Chatter Section */}
        <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-xs p-2">
          <Chatter
            documentId="GL-ACCOUNTING"
            documentType="Accounting General Ledger"
            initialLogs={[
              {
                id: 'acc1',
                user: 'Sinta Rahmawati (Finance Officer)',
                role: 'Finance Lead',
                action: 'Audit Integritas Saldo Buku Besar (SR-11)',
                timestamp: 'Hari ini, 10:30',
                message: 'Semua posting jurnal dari Invoice dan Bill telah diperiksa dengan prinsip double-entry.',
              },
            ]}
          />
        </div>
      </main>
    </div>
  );
}
