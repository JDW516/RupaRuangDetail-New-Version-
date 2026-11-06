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

export default async function InventoryPage({
  searchParams,
}: {
  searchParams?: Promise<{ sku?: string; location?: string; q?: string }>;
}) {
  const resolvedParams = searchParams ? await searchParams : {};
  const selectedSku = resolvedParams?.sku || 'P001';
  const filterLocation = resolvedParams?.location || 'ALL';
  const searchQuery = (resolvedParams?.q || '').toLowerCase();

  const products = await prisma.product.findMany({
    include: {
      stocks: {
        include: {
          warehouse: true,
        },
      },
    },
    orderBy: { sku: 'asc' },
  });

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      searchQuery === '' ||
      p.sku.toLowerCase().includes(searchQuery) ||
      p.name.toLowerCase().includes(searchQuery) ||
      p.defaultVendorId.toLowerCase().includes(searchQuery);

    return matchesSearch;
  });

  const currentProduct =
    products.find((p) => p.sku === selectedSku) || products[0];

  const currentWhStock =
    currentProduct?.stocks.find((s) => s.locationId === 'WH') || {
      qtyOnHand: 0,
      qtyReserved: 0,
    };
  const currentShopStock =
    currentProduct?.stocks.find((s) => s.locationId === 'SHOP') || {
      qtyOnHand: 0,
      qtyReserved: 0,
    };

  const totalWhCompany = products.reduce((sum, p) => {
    const s = p.stocks.find((x) => x.locationId === 'WH');
    return sum + (s?.qtyOnHand || 0);
  }, 0);

  const totalShopCompany = products.reduce((sum, p) => {
    const s = p.stocks.find((x) => x.locationId === 'SHOP');
    return sum + (s?.qtyOnHand || 0);
  }, 0);

  const totalStockCompany = totalWhCompany + totalShopCompany;

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans">
      {/* 1. App Navbar Odoo */}
      <AppNavbar currentModule="Inventory & Stock (S-03 & S-08)" />

      {/* 2. Control Panel Header Odoo */}
      <ControlPanel
        breadcrumbs={[
          { label: 'Home', href: '/' },
          { label: 'Inventory', href: '/inventory' },
          { label: `Produk ${currentProduct.sku} - ${currentProduct.name}` },
        ]}
        searchPlaceholder="Cari SKU (P001–P016) atau nama produk..."
        pagerText={`SKU 1-${products.length} / ${products.length}`}
        availableViews={['list', 'kanban']}
        currentView="list"
      >
        <div className="flex items-center gap-1.5 text-xs">
          <Link
            href="/inventory/product?location=ALL"
            className={`px-3 py-1 rounded-md font-semibold transition-colors ${
              filterLocation === 'ALL'
                ? 'bg-[#1E293B] text-[#CFFF30]'
                : 'bg-white border border-[#E2E8F0] text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            Semua Lokasi ({totalStockCompany} Unit)
          </Link>
          <Link
            href="/inventory/product?location=WH"
            className={`px-3 py-1 rounded-md font-semibold transition-colors ${
              filterLocation === 'WH'
                ? 'bg-[#1E293B] text-[#CFFF30]'
                : 'bg-white border border-[#E2E8F0] text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            WH Jakarta ({totalWhCompany} Unit)
          </Link>
          <Link
            href="/inventory/product?location=SHOP"
            className={`px-3 py-1 rounded-md font-semibold transition-colors ${
              filterLocation === 'SHOP'
                ? 'bg-[#1E293B] text-[#CFFF30]'
                : 'bg-white border border-[#E2E8F0] text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            SHOP Depok ({totalShopCompany} Unit)
          </Link>
        </div>
      </ControlPanel>

      {/* 3. Main Workspace: S-03 Product Form & S-08 Stock Overview */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-6 space-y-6">
        
        {/* S-03 PRODUCT FORM CARD DETAIL SHEET */}
        {currentProduct && (
          <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-xs overflow-hidden">
            {/* Status Bar Alur Produk */}
            <FormStatusBar
              stages={['Draft', 'Confirmed', 'Active In Stock']}
              currentStage="Active In Stock"
              actions={[
                { label: 'Update Biaya / HPP', variant: 'secondary' },
                { label: 'Transfer Antar Lokasi (WH ➔ SHOP)', variant: 'accent' },
                { label: 'Buat Reorder RFQ', variant: 'primary' },
              ]}
            />

            {/* Lembar Sheet Produk (S-03) */}
            <FormSheet
              title={`[${currentProduct.sku}] ${currentProduct.name}`}
              subtitle="Master Data SKU Produk (SR-06 & F-03)"
              ribbon={{ text: 'IN STOCK', variant: 'success' }}
              smartButtons={[
                {
                  label: 'Stok WH (Gudang)',
                  value: `${currentWhStock.qtyOnHand} Unit`,
                  icon: '🏭',
                  badge: currentWhStock.qtyOnHand > 0 ? 'Tersedia' : 'Kosong',
                },
                {
                  label: 'Stok SHOP (Gerai)',
                  value: `${currentShopStock.qtyOnHand} Unit`,
                  icon: '🏪',
                  badge: currentShopStock.qtyOnHand > 0 ? 'Tersedia' : 'Kosong',
                },
                {
                  label: 'Total Perusahaan',
                  value: `${currentWhStock.qtyOnHand + currentShopStock.qtyOnHand} Unit`,
                  icon: '📦',
                },
                {
                  label: 'Default Vendor',
                  value: currentProduct.defaultVendorId,
                  icon: '🤝',
                  href: `/contacts?contactId=${currentProduct.defaultVendorId}`,
                },
              ]}
            >
              {/* Metadata Grid Produk (S-03 Area 4 & 5) */}
              <div className="mt-4 p-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl">
                <h4 className="text-xs font-bold text-[#1E293B] uppercase tracking-wider mb-3 pb-1 border-b border-[#E2E8F0]">
                  [4] SKU, Nama, UoM &nbsp;|&nbsp; [5] Harga Jual, Biaya, Pajak (F-03)
                </h4>

                <FormFieldGroup columns={2}>
                  <FormField label="Nomor SKU">
                    <span className="font-mono font-bold text-sm bg-white px-2 py-0.5 rounded border border-[#E2E8F0] text-[#0F172A]">
                      {currentProduct.sku}
                    </span>
                  </FormField>

                  <FormField label="Satuan Ukur (UoM)">
                    <span className="font-semibold text-[#0F172A] bg-white px-2 py-0.5 rounded border border-[#E2E8F0]">
                      {currentProduct.uom}
                    </span>
                  </FormField>

                  <FormField label="Harga Jual Net (IDR)" required>
                    <span className="font-mono font-black text-sm text-[#0F172A]">
                      Rp {currentProduct.salesPrice.toLocaleString('id-ID')}
                    </span>
                  </FormField>

                  <FormField label="Harga Pokok / Cost (HPP)">
                    <span className="font-mono font-semibold text-xs text-[#64748B]">
                      Rp {currentProduct.cost.toLocaleString('id-ID')}
                    </span>
                  </FormField>

                  <FormField label="Kode Tarif Pajak">
                    <span className="font-mono font-bold text-xs bg-[#CFFF30]/40 text-[#0F172A] px-2 py-0.5 rounded border border-[#CFFF30]">
                      {currentProduct.taxCode} (Efektif 11%)
                    </span>
                  </FormField>

                  <FormField label="Pemasok Utama (Vendor)">
                    <span className="font-mono font-bold text-xs text-[#1E293B] bg-white px-2 py-0.5 rounded border border-[#E2E8F0]">
                      {currentProduct.defaultVendorId}
                    </span>
                  </FormField>
                </FormFieldGroup>
              </div>

              {/* Notebook S-08 Stock Overview & Movement */}
              <FormNotebook
                tabs={[
                  {
                    id: 'locations',
                    label: 'Ikhtisar Lokasi & Reservasi (S-08)',
                    badge: '2 Lokasi',
                    content: (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-[#F8FAFC] text-[#64748B] uppercase font-bold border-b border-[#E2E8F0]">
                            <tr>
                              <th className="px-3 py-2">Lokasi Gudang</th>
                              <th className="px-3 py-2">Tipe Lokasi</th>
                              <th className="px-3 py-2 text-center">Fisik On-Hand</th>
                              <th className="px-3 py-2 text-center">Tereservasi (Reserved)</th>
                              <th className="px-3 py-2 text-center font-bold text-[#0F172A]">Tersedia (Available)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#E2E8F0]">
                            <tr className="hover:bg-[#F8FAFC]">
                              <td className="px-3 py-2.5 font-bold text-[#0F172A]">
                                🏭 WH/JKT/Stock
                              </td>
                              <td className="px-3 py-2.5 text-[#64748B]">
                                Gudang Utama Jakarta Timur (B2B & Buffer)
                              </td>
                              <td className="px-3 py-2.5 text-center font-bold text-[#3B82F6]">
                                {currentWhStock.qtyOnHand}
                              </td>
                              <td className="px-3 py-2.5 text-center text-[#F59E0B]">
                                {currentWhStock.qtyReserved}
                              </td>
                              <td className="px-3 py-2.5 text-center font-black text-[#10B981] bg-[#10B981]/5">
                                {currentWhStock.qtyOnHand - currentWhStock.qtyReserved}
                              </td>
                            </tr>
                            <tr className="hover:bg-[#F8FAFC]">
                              <td className="px-3 py-2.5 font-bold text-[#0F172A]">
                                🏪 SHOP/DPK/Stock
                              </td>
                              <td className="px-3 py-2.5 text-[#64748B]">
                                Gerai Penjualan Depok (Point of Sale)
                              </td>
                              <td className="px-3 py-2.5 text-center font-bold text-[#3B82F6]">
                                {currentShopStock.qtyOnHand}
                              </td>
                              <td className="px-3 py-2.5 text-center text-[#F59E0B]">
                                {currentShopStock.qtyReserved}
                              </td>
                              <td className="px-3 py-2.5 text-center font-black text-[#10B981] bg-[#10B981]/5">
                                {currentShopStock.qtyOnHand - currentShopStock.qtyReserved}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    ),
                  },
                ]}
              />

              {/* Chatter Audit Log Produk (S-03 Area 7) */}
              <Chatter
                documentId={currentProduct.sku}
                documentType="Product Master"
                initialLogs={[
                  {
                    id: 'p1',
                    user: 'Doni Saputra (Kepala Gudang)',
                    role: 'Warehouse Lead',
                    action: 'Verifikasi stok fisik awal B0',
                    timestamp: 'Hari ini, 07:45',
                    message: `Stok awal diverifikasi: WH=${currentWhStock.qtyOnHand}, SHOP=${currentShopStock.qtyOnHand}. Kepatuhan aturan SR-02 ditegakkan.`,
                  },
                ]}
              />
            </FormSheet>
          </div>
        )}

        {/* S-08 STOCK OVERVIEW FULL TABLE */}
        <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-xs overflow-hidden">
          <div className="p-4 border-b border-[#E2E8F0] bg-[#F8FAFC] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-extrabold text-[#0F172A] text-sm">
                S-08 Stock Overview — Tabel Persediaan 16 SKU Produk (F-08 / SR-02)
              </h3>
              <p className="text-xs text-[#64748B] mt-0.5">
                On-hand vs Reserved vs Available di dua lokasi (WH/JKT/Stock & SHOP/DPK/Stock)
              </p>
            </div>
            <span className="text-xs font-mono font-bold bg-[#CFFF30] text-[#0F172A] px-3 py-1 rounded-md shadow-2xs">
              Total Unit Perusahaan: {totalStockCompany}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-[#64748B]">
              <thead className="bg-[#1E293B] text-white uppercase font-bold text-[11px] tracking-wider">
                <tr>
                  <th className="px-4 py-3">SKU</th>
                  <th className="px-4 py-3">Nama Produk</th>
                  <th className="px-4 py-3">Satuan</th>
                  <th className="px-4 py-3 text-right">Harga (IDR)</th>
                  <th className="px-4 py-3 text-right">HPP (IDR)</th>
                  <th className="px-4 py-3 text-center">Vendor</th>
                  <th className="px-4 py-3 text-center bg-blue-900/60 text-blue-200">WH On-Hand</th>
                  <th className="px-4 py-3 text-center bg-emerald-900/60 text-emerald-200">SHOP On-Hand</th>
                  <th className="px-4 py-3 text-center bg-slate-900 text-[#CFFF30]">Total Stok</th>
                  <th className="px-4 py-3 text-center">Aksi Form</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {filteredProducts.map((p) => {
                  const wh = p.stocks.find((s) => s.locationId === 'WH')?.qtyOnHand || 0;
                  const shop = p.stocks.find((s) => s.locationId === 'SHOP')?.qtyOnHand || 0;
                  const total = wh + shop;
                  const isCurrent = p.sku === currentProduct?.sku;

                  return (
                    <tr
                      key={p.sku}
                      className={`hover:bg-[#F8FAFC] transition-colors ${
                        isCurrent ? 'bg-[#00F0FF]/10 font-medium' : ''
                      }`}
                    >
                      <td className="px-4 py-3 font-mono font-bold text-[#0F172A]">
                        {p.sku}
                      </td>
                      <td className="px-4 py-3 font-semibold text-[#0F172A]">
                        {p.name}
                      </td>
                      <td className="px-4 py-3 text-[#64748B]">{p.uom}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-[#0F172A]">
                        Rp {p.salesPrice.toLocaleString('id-ID')}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-[#64748B]">
                        Rp {p.cost.toLocaleString('id-ID')}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="font-mono text-[10px] bg-[#F8FAFC] border border-[#E2E8F0] px-1.5 py-0.5 rounded font-bold">
                          {p.defaultVendorId}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center font-bold text-[#3B82F6] bg-blue-50/40 font-mono">
                        {wh}
                      </td>
                      <td className="px-4 py-3 text-center font-bold text-[#10B981] bg-emerald-50/40 font-mono">
                        {shop}
                      </td>
                      <td className="px-4 py-3 text-center font-black text-[#0F172A] bg-slate-100 font-mono">
                        {total}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Link
                          href={`/inventory/product?sku=${p.sku}`}
                          className={`text-[11px] font-bold px-2.5 py-1 rounded transition-colors ${
                            isCurrent
                              ? 'bg-[#1E293B] text-[#CFFF30]'
                              : 'bg-white border border-[#E2E8F0] text-[#64748B] hover:text-[#0F172A]'
                          }`}
                        >
                          Buka Form S-03 ➔
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
