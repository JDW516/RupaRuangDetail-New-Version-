import { prisma } from '@/lib/prisma';
import Link from 'next/link';
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

export default async function ContactsPage({
  searchParams,
}: {
  searchParams?: Promise<{ contactId?: string; filter?: string; q?: string }>;
}) {
  const resolvedParams = searchParams ? await searchParams : {};
  const activeFilter = resolvedParams?.filter || 'ALL';
  const searchQuery = (resolvedParams?.q || '').toLowerCase();
  const selectedContactId = resolvedParams?.contactId;

  const contacts = await prisma.contact.findMany({
    include: {
      salesOrders: true,
      invoices: true,
      purchaseOrders: true,
      vendorBills: true,
    },
    orderBy: { contactId: 'asc' },
  });

  const filteredContacts = contacts.filter((c) => {
    const matchesFilter =
      activeFilter === 'ALL'
        ? true
        : activeFilter === 'VENDOR'
        ? c.type === 'VENDOR'
        : c.type !== 'VENDOR';

    const matchesSearch =
      searchQuery === '' ||
      c.name.toLowerCase().includes(searchQuery) ||
      c.contactId.toLowerCase().includes(searchQuery) ||
      c.city.toLowerCase().includes(searchQuery);

    return matchesFilter && matchesSearch;
  });

  // Selected contact for S-02 Form View (defaults to C01 or requested contactId)
  const currentContact =
    contacts.find((c) => c.contactId === selectedContactId) ||
    contacts.find((c) => c.contactId === 'C01') ||
    contacts[0];

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans">
      {/* 1. App Navbar Odoo */}
      <AppNavbar currentModule="Master Contacts (S-02)" />

      {/* 2. Control Panel Header */}
      <ControlPanel
        breadcrumbs={[
          { label: 'Home', href: '/' },
          { label: 'Contacts', href: '/contacts' },
          { label: currentContact ? `${currentContact.name} (${currentContact.contactId})` : 'All' },
        ]}
        searchPlaceholder="Cari nama kontak, ID (C01–C06 / V01–V04), atau kota..."
        pagerText={`1-${contacts.length} / ${contacts.length}`}
      >
        <div className="flex items-center gap-1.5 text-xs">
          <Link
            href="/contacts?filter=ALL"
            className={`px-3 py-1 rounded-md font-semibold transition-colors ${
              activeFilter === 'ALL'
                ? 'bg-[#1E293B] text-[#CFFF30]'
                : 'bg-white border border-[#E2E8F0] text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            Semua ({contacts.length})
          </Link>
          <Link
            href="/contacts?filter=CUSTOMER"
            className={`px-3 py-1 rounded-md font-semibold transition-colors ${
              activeFilter === 'CUSTOMER'
                ? 'bg-[#1E293B] text-[#CFFF30]'
                : 'bg-white border border-[#E2E8F0] text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            Pelanggan B2B / C01–C06
          </Link>
          <Link
            href="/contacts?filter=VENDOR"
            className={`px-3 py-1 rounded-md font-semibold transition-colors ${
              activeFilter === 'VENDOR'
                ? 'bg-[#1E293B] text-[#CFFF30]'
                : 'bg-white border border-[#E2E8F0] text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            Vendor V01–V04
          </Link>
        </div>
      </ControlPanel>

      {/* 3. Main Workspace: S-02 Contact Form & Directory */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Kolom Kiri: Contact Quick Switcher List (Odoo Sidebar Master List) */}
        <div className="lg:col-span-4 space-y-3">
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-3 shadow-2xs flex justify-between items-center">
            <span className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">
              Daftar Kontak ({filteredContacts.length})
            </span>
            <span className="text-[10px] font-mono bg-[#F8FAFC] border border-[#E2E8F0] text-[#64748B] px-2 py-0.5 rounded">
              Filter: {activeFilter}
            </span>
          </div>

          <div className="space-y-2 max-h-[750px] overflow-y-auto pr-1">
            {filteredContacts.map((c) => {
              const isSelected = currentContact?.contactId === c.contactId;
              const isVendor = c.type === 'VENDOR';

              return (
                <Link
                  key={c.id}
                  href={`/contacts?contactId=${c.contactId}&filter=${activeFilter}`}
                  className={`block p-3.5 rounded-xl border transition-all ${
                    isSelected
                      ? 'bg-white border-[#00F0FF] ring-2 ring-[#00F0FF]/30 shadow-xs'
                      : 'bg-white border-[#E2E8F0] hover:border-[#CBD5E1] hover:bg-[#F8FAFC]'
                  }`}
                >
                  <div className="flex justify-between items-start mb-1.5">
                    <span className="font-mono text-xs font-black bg-[#F8FAFC] border border-[#E2E8F0] px-2 py-0.5 rounded text-[#0F172A]">
                      {c.contactId}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isVendor
                          ? 'bg-[#F59E0B]/15 text-[#F59E0B]'
                          : c.type === 'BUSINESS'
                          ? 'bg-[#3B82F6]/15 text-[#3B82F6]'
                          : 'bg-[#10B981]/15 text-[#10B981]'
                      }`}
                    >
                      {c.type}
                    </span>
                  </div>

                  <h3 className="font-bold text-sm text-[#0F172A] leading-snug">
                    {c.name}
                  </h3>
                  <div className="text-[11px] text-[#64748B] mt-1 flex items-center justify-between">
                    <span>📍 {c.city}</span>
                    <span className="font-semibold text-[#1E293B]">
                      {c.paymentTerms}
                    </span>
                  </div>

                  {!isVendor && c.creditLimit > 0 && (
                    <div className="mt-2 pt-2 border-t border-[#E2E8F0]/70 text-[10px] flex justify-between text-[#64748B]">
                      <span>Limit Kredit:</span>
                      <span className="font-bold text-[#0F172A]">
                        Rp {c.creditLimit.toLocaleString('id-ID')}
                      </span>
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Kolom Kanan: S-02 Contact Form Sheet (Odoo 17 Spec) */}
        {currentContact && (
          <div className="lg:col-span-8 space-y-4">
            <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-xs overflow-hidden">
              
              {/* Status Bar Workflow (Draft ➔ Confirmed ➔ Active) */}
              <FormStatusBar
                stages={['Draft', 'Confirmed', 'Active']}
                currentStage="Active"
                actions={[
                  { label: 'Kirim Email', variant: 'secondary' },
                  { label: 'Buat Penawaran / SO', variant: 'primary' },
                  { label: 'Cek Limit Kredit', variant: 'accent' },
                ]}
              />

              {/* Form Sheet Content */}
              <FormSheet
                title={currentContact.name}
                subtitle={`Kontak ID: ${currentContact.contactId} · ${currentContact.type}`}
                ribbon={{ text: 'ACTIVE', variant: 'success' }}
                smartButtons={[
                  {
                    label: 'Sales Orders',
                    value: currentContact.salesOrders.length,
                    icon: '💼',
                    href: '/sales',
                  },
                  {
                    label: 'Invoices',
                    value: currentContact.invoices.length,
                    icon: '📑',
                    href: '/invoicing',
                  },
                  {
                    label: 'Termin Bayar',
                    value: currentContact.paymentTerms,
                    icon: '⏳',
                  },
                  ...(currentContact.type !== 'VENDOR'
                    ? [
                        {
                          label: 'Credit Limit',
                          value: `Rp ${currentContact.creditLimit.toLocaleString('id-ID')}`,
                          icon: '💳',
                          badge: currentContact.creditLimit > 0 ? 'Verified' : 'Cash Only',
                        },
                      ]
                    : [
                        {
                          label: 'Purchase Orders',
                          value: currentContact.purchaseOrders.length,
                          icon: '🛒',
                          href: '/purchase',
                        },
                      ]),
                ]}
              >
                {/* 2-Column Metadata Grid (S-02 Wireframe Area 4 & 5) */}
                <div className="mt-4 p-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl">
                  <h4 className="text-xs font-bold text-[#1E293B] uppercase tracking-wider mb-3 pb-1 border-b border-[#E2E8F0]">
                    [4] Identitas Kontak & Tipe &nbsp;|&nbsp; [5] Batas Kredit & Termin (F-02 / SR-11)
                  </h4>

                  <FormFieldGroup columns={2}>
                    <FormField label="ID Kontak">
                      <span className="font-mono font-bold text-sm bg-white px-2 py-0.5 rounded border border-[#E2E8F0] text-[#0F172A]">
                        {currentContact.contactId}
                      </span>
                    </FormField>

                    <FormField label="Tipe Entitas">
                      <span className="font-bold text-[#0F172A] bg-white px-2 py-0.5 rounded border border-[#E2E8F0]">
                        {currentContact.type}
                      </span>
                    </FormField>

                    <FormField label="Nama Lengkap / Bisnis" required>
                      <span className="font-bold text-[#0F172A]">
                        {currentContact.name}
                      </span>
                    </FormField>

                    <FormField label="Kota Operasional">
                      <span className="text-[#0F172A]">📍 {currentContact.city}</span>
                    </FormField>

                    <FormField label="Termin Pembayaran (Terms)">
                      <span className="font-mono font-bold text-[#1E293B] bg-[#CFFF30]/40 px-2 py-0.5 rounded border border-[#CFFF30]">
                        {currentContact.paymentTerms}
                      </span>
                    </FormField>

                    <FormField label="Limit Plafon Kredit (IDR)">
                      <span className="font-mono font-extrabold text-[#0F172A] text-sm">
                        Rp {currentContact.creditLimit.toLocaleString('id-ID')}
                      </span>
                    </FormField>

                    {currentContact.category && (
                      <FormField label="Kategori Produk Vendor">
                        <span className="text-[#64748B] italic">
                          {currentContact.category}
                        </span>
                      </FormField>
                    )}
                  </FormFieldGroup>
                </div>

                {/* Notebook Tabs */}
                <FormNotebook
                  tabs={[
                    {
                      id: 'terms',
                      label: 'Termin & Kontrol Kredit',
                      badge: currentContact.paymentTerms,
                      content: (
                        <div className="space-y-3 text-xs">
                          <div className="p-3 bg-[#FFFFFF] border border-[#E2E8F0] rounded-lg">
                            <span className="font-bold text-[#0F172A] block mb-1">
                              Ketentuan Kredit Menurut Skenario SR-11:
                            </span>
                            <p className="text-[#64748B] leading-relaxed">
                              Pelanggan dengan termin <strong>{currentContact.paymentTerms}</strong>{' '}
                              memiliki batas kredit maksimal sebesar{' '}
                              <strong>Rp {currentContact.creditLimit.toLocaleString('id-ID')}</strong>.
                              Setiap konfirmasi order (SO) memeriksa saldo eksposur terbuka termasuk PPN 11%.
                            </p>
                          </div>
                        </div>
                      ),
                    },
                    {
                      id: 'history',
                      label: 'Histori Transaksi Terkait',
                      badge: currentContact.salesOrders.length + currentContact.purchaseOrders.length,
                      content: (
                        <div className="text-xs text-[#64748B]">
                          {currentContact.salesOrders.length > 0 ? (
                            <div className="space-y-2">
                              {currentContact.salesOrders.map((so) => (
                                <div
                                  key={so.id}
                                  className="flex justify-between items-center p-2 bg-[#F8FAFC] rounded border border-[#E2E8F0]"
                                >
                                  <span className="font-mono font-bold text-[#0F172A]">
                                    {so.docNumber}
                                  </span>
                                  <span className="text-[#10B981] font-bold">
                                    Rp {so.totalAmount.toLocaleString('id-ID')}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="italic py-3 text-center">
                              Belum ada pesanan aktif untuk kontak ini.
                            </p>
                          )}
                        </div>
                      ),
                    },
                  ]}
                />

                {/* [7] Chatter / Log Notes / Related Documents / Audit */}
                <Chatter
                  documentId={currentContact.contactId}
                  documentType="Contact Master"
                  initialLogs={[
                    {
                      id: 'c1',
                      user: 'Maya Lestari (Sales Mgr)',
                      role: 'Sales Admin',
                      action: 'Memverifikasi limit kredit & profil kontak',
                      timestamp: 'Hari ini, 08:30',
                      message: `Limit kredit disetujui Rp ${currentContact.creditLimit.toLocaleString('id-ID')} dengan termin ${currentContact.paymentTerms}.`,
                    },
                    {
                      id: 'c2',
                      user: 'Sinta Rahmawati (Finance)',
                      role: 'Finance Officer',
                      action: 'Sinkronisasi Master Kontak ke Ledger Akuntansi',
                      timestamp: 'Kemarin, 14:10',
                      message: 'Identitas pajak & lokasi kota terkonfirmasi sesuai dataset.',
                    },
                  ]}
                />
              </FormSheet>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
