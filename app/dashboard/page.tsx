import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import {
  AppNavbar,
  ControlPanel,
  Chatter,
} from '@/components/odoo';

export const revalidate = 0;

export default async function DashboardPage() {
  const contactCount = await prisma.contact.count();
  const productCount = await prisma.product.count();
  const quotationCount = await prisma.quotation.count();
  const poCount = await prisma.purchaseOrder.count();
  const accountCount = await prisma.account.count();
  const invoiceCount = await prisma.invoice.count();
  const stocks = await prisma.stock.findMany({
    include: { product: true },
  });

  const totalWhQty = stocks
    .filter((s) => s.locationId === 'WH')
    .reduce((acc, curr) => acc + curr.qtyOnHand, 0);

  const totalShopQty = stocks
    .filter((s) => s.locationId === 'SHOP')
    .reduce((acc, curr) => acc + curr.qtyOnHand, 0);

  const totalCompanyQty = totalWhQty + totalShopQty;

  // Nilai Persediaan Berdasarkan Biaya HPP (Standard Price Baseline B0 = Rp 29.009.000)
  const totalStockValuation = stocks.reduce((acc, curr) => {
    return acc + curr.qtyOnHand * curr.product.cost;
  }, 0);

  // Omzet Penjualan yang Terkonfirmasi (SO & Invoice Posted / POS, SR-15: Bukan Draft)
  const confirmedSalesOrders = await prisma.salesOrder.findMany({
    where: { status: 'Confirmed' },
  });
  const totalB2BOmzet = confirmedSalesOrders.reduce(
    (acc, so) => acc + so.totalAmount,
    0
  );

  const posOrders = await prisma.pOSOrder.findMany();
  const totalPosOmzet = posOrders.reduce((acc, po) => acc + po.totalAmount, 0);
  const grandTotalOmzet = totalB2BOmzet + totalPosOmzet;

  // Open PO Commitment
  const purchaseOrders = await prisma.purchaseOrder.findMany();
  const totalOpenPoValue = purchaseOrders.reduce(
    (acc, po) => acc + po.totalAmount,
    0
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans">
      {/* 1. App Navbar Odoo */}
      <AppNavbar currentModule="Management Dashboard (S-17)" />

      {/* 2. Control Panel Header */}
      <ControlPanel
        breadcrumbs={[
          { label: 'Home', href: '/' },
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Executive KPI Overview' },
        ]}
        searchPlaceholder="Cari metrik atau indikator bisnis..."
        pagerText="Periode: Semua Transaksi Aktif"
        availableViews={['graph', 'list']}
        currentView="graph"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30 px-3 py-1 rounded-md">
            Sistem: Live Operational
          </span>
        </div>
      </ControlPanel>

      {/* 3. Main Workspace: S-17 Executive KPI Dashboard */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-6 space-y-6">
        
        {/* Banner Welcome & Date Filter */}
        <div className="bg-[#1E293B] text-white rounded-2xl border border-slate-700 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#CFFF30]" />
              <span className="text-[11px] font-mono font-bold text-[#CFFF30] uppercase tracking-wider">
                S-17 Management Dashboard (F-18 / SR-15)
              </span>
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight mt-1">
              Executive Business Overview · PT RupaRuang Niaga
            </h1>
            <p className="text-xs text-slate-300 mt-0.5">
              Konsolidasi penjualan B2B, kasir ritel gerai, valuasi persediaan dua lokasi & komitmen pengadaan.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-slate-800/80 border border-slate-700 p-1.5 rounded-xl text-xs">
            <span className="text-slate-400 px-2 font-medium">Filter Periode:</span>
            <button
              type="button"
              className="bg-[#CFFF30] text-[#0F172A] font-extrabold px-3 py-1 rounded-lg"
            >
              Tahun Berjalan (YTD)
            </button>
            <button
              type="button"
              className="text-slate-300 hover:text-white px-3 py-1 rounded-lg"
            >
              Bulan Ini
            </button>
          </div>
        </div>

        {/* 4 KARTU KPI UTAMA (S-17 Area 3 & 4) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* KPI 1: Total Omzet Penjualan */}
          <div className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-xs relative overflow-hidden group hover:border-[#00F0FF] transition-all">
            <div className="flex justify-between items-start">
              <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">
                Total Omzet Sah (SR-15)
              </span>
              <span className="text-xl">💰</span>
            </div>
            <div className="text-2xl font-mono font-black text-[#0F172A] mt-2">
              Rp {grandTotalOmzet.toLocaleString('id-ID')}
            </div>
            <div className="mt-2 pt-2 border-t border-[#E2E8F0] text-[11px] text-[#10B981] font-semibold flex items-center justify-between">
              <span>B2B: Rp {totalB2BOmzet.toLocaleString('id-ID')}</span>
              <span>POS: Rp {totalPosOmzet.toLocaleString('id-ID')}</span>
            </div>
          </div>

          {/* KPI 2: Valuasi Persediaan (Baseline B0 = Rp 29.009.000) */}
          <div className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-xs relative overflow-hidden group hover:border-[#00F0FF] transition-all">
            <div className="flex justify-between items-start">
              <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">
                Nilai Persediaan (Stock Value)
              </span>
              <span className="text-xl">📦</span>
            </div>
            <div className="text-2xl font-mono font-black text-[#1E293B] mt-2">
              Rp {totalStockValuation.toLocaleString('id-ID')}
            </div>
            <div className="mt-2 pt-2 border-t border-[#E2E8F0] text-[11px] text-[#64748B] font-semibold flex items-center justify-between">
              <span>Total Fisik:</span>
              <span className="font-mono font-bold text-[#0F172A]">{totalCompanyQty} Unit</span>
            </div>
          </div>

          {/* KPI 3: Open PO Commitment */}
          <div className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-xs relative overflow-hidden group hover:border-[#00F0FF] transition-all">
            <div className="flex justify-between items-start">
              <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">
                Komitmen Pengadaan (PO)
              </span>
              <span className="text-xl">🛒</span>
            </div>
            <div className="text-2xl font-mono font-black text-[#F59E0B] mt-2">
              Rp {totalOpenPoValue.toLocaleString('id-ID')}
            </div>
            <div className="mt-2 pt-2 border-t border-[#E2E8F0] text-[11px] text-[#64748B] font-semibold flex items-center justify-between">
              <span>{poCount} Dokumen PO</span>
              <Link href="/purchase" className="text-[#00F0FF] hover:underline font-bold">
                Buka PO ➔
              </Link>
            </div>
          </div>

          {/* KPI 4: Master Data Health */}
          <div className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-xs relative overflow-hidden group hover:border-[#00F0FF] transition-all">
            <div className="flex justify-between items-start">
              <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">
                Kesehatan Sistem Master
              </span>
              <span className="text-xl">🛡️</span>
            </div>
            <div className="text-2xl font-mono font-black text-[#10B981] mt-2">
              100% Ready
            </div>
            <div className="mt-2 pt-2 border-t border-[#E2E8F0] text-[11px] text-[#64748B] font-semibold flex items-center justify-between">
              <span>{productCount} SKU Produk</span>
              <span>{contactCount} Kontak</span>
            </div>
          </div>
        </div>

        {/* SECTION METRIK DETAIL & GRAFIK VISUAL */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* KIRI: GRAFIK & DISTRIBUSI STOK MULTI-LOKASI */}
          <div className="lg:col-span-7 bg-white rounded-2xl border border-[#E2E8F0] p-6 shadow-xs space-y-4">
            <div className="flex justify-between items-center border-b border-[#E2E8F0] pb-3">
              <div>
                <h2 className="font-extrabold text-[#0F172A] text-sm">
                  Distribusi Stok Dua Lokasi (Gudang Utama vs Gerai Depok)
                </h2>
                <span className="text-xs text-[#64748B]">
                  Perbandingan unit fisik on-hand antar lokasi operasional
                </span>
              </div>
              <Link
                href="/inventory"
                className="text-xs font-bold text-[#1E293B] hover:text-[#00F0FF] transition-colors"
              >
                Lihat Detail Stok ➔
              </Link>
            </div>

            {/* Visual Bar Breakdown */}
            <div className="space-y-4 pt-2">
              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span className="flex items-center gap-1.5 text-[#0F172A]">
                    <span className="w-3 h-3 rounded-md bg-[#3B82F6]" />
                    <span>WH/JKT/Stock (Gudang Utama Jakarta Timur)</span>
                  </span>
                  <span className="font-mono font-bold text-[#0F172A]">
                    {totalWhQty} Unit ({totalCompanyQty > 0 ? Math.round((totalWhQty / totalCompanyQty) * 100) : 0}%)
                  </span>
                </div>
                <div className="w-full bg-[#F8FAFC] h-3 rounded-full overflow-hidden border border-[#E2E8F0]">
                  <div
                    className="bg-[#3B82F6] h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${totalCompanyQty > 0 ? (totalWhQty / totalCompanyQty) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span className="flex items-center gap-1.5 text-[#0F172A]">
                    <span className="w-3 h-3 rounded-md bg-[#10B981]" />
                    <span>SHOP/DPK/Stock (Gerai Penjualan Depok)</span>
                  </span>
                  <span className="font-mono font-bold text-[#0F172A]">
                    {totalShopQty} Unit ({totalCompanyQty > 0 ? Math.round((totalShopQty / totalCompanyQty) * 100) : 0}%)
                  </span>
                </div>
                <div className="w-full bg-[#F8FAFC] h-3 rounded-full overflow-hidden border border-[#E2E8F0]">
                  <div
                    className="bg-[#10B981] h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${totalCompanyQty > 0 ? (totalShopQty / totalCompanyQty) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Metric Insight Card */}
            <div className="mt-6 p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex justify-between items-center text-xs">
              <div>
                <span className="font-bold text-[#0F172A] block">
                  Metode Penilaian Persediaan Sesuai Handout:
                </span>
                <span className="text-[#64748B]">
                  Standard Cost Price tetap per SKU. Total valuasi saat ini (real-time dari database): <strong>Rp {totalStockValuation.toLocaleString('id-ID')}</strong>.
                </span>
              </div>
              <span className="font-mono font-black text-sm text-[#0F172A] bg-white px-3 py-1 rounded-lg border border-[#E2E8F0]">
                {totalCompanyQty.toLocaleString('id-ID')} Unit
              </span>
            </div>
          </div>

          {/* KANAN: STATUS ALUR DOKUMEN & QUICK SHORTCUTS */}
          <div className="lg:col-span-5 bg-white rounded-2xl border border-[#E2E8F0] p-6 shadow-xs space-y-4">
            <h2 className="font-extrabold text-[#0F172A] text-sm border-b border-[#E2E8F0] pb-3">
              Status Alur Transaksi Bisnis (Order-to-Cash & Procure-to-Pay)
            </h2>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0] flex justify-between items-center">
                <div>
                  <span className="font-bold text-[#0F172A] block">Sales Quotations (S-05)</span>
                  <span className="text-[11px] text-[#64748B]">{quotationCount} Dokumen Penawaran</span>
                </div>
                <Link
                  href="/sales"
                  className="bg-[#CFFF30] text-[#0F172A] font-extrabold px-3 py-1 rounded-lg text-xs hover:brightness-95"
                >
                  Buka SO ➔
                </Link>
              </div>

              <div className="p-3 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0] flex justify-between items-center">
                <div>
                  <span className="font-bold text-[#0F172A] block">Customer Invoices (S-11)</span>
                  <span className="text-[11px] text-[#64748B]">{invoiceCount} Faktur Pelanggan Terbit</span>
                </div>
                <Link
                  href="/invoicing"
                  className="bg-[#00F0FF]/15 text-[#0F172A] border border-[#00F0FF] font-bold px-3 py-1 rounded-lg text-xs hover:bg-[#00F0FF]/30"
                >
                  Buka Faktur ➔
                </Link>
              </div>

              <div className="p-3 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0] flex justify-between items-center">
                <div>
                  <span className="font-bold text-[#0F172A] block">Purchase Orders & Receipts (S-09)</span>
                  <span className="text-[11px] text-[#64748B]">{poCount} Pengadaan PO Vendor</span>
                </div>
                <Link
                  href="/purchase"
                  className="bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30 font-bold px-3 py-1 rounded-lg text-xs hover:bg-[#10B981]/30"
                >
                  Buka PO ➔
                </Link>
              </div>

              <div className="p-3 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0] flex justify-between items-center">
                <div>
                  <span className="font-bold text-[#0F172A] block">Chart of Accounts & Jurnal (S-14)</span>
                  <span className="text-[11px] text-[#64748B]">{accountCount} Akun COA Terdaftar</span>
                </div>
                <Link
                  href="/accounting"
                  className="bg-[#1E293B] text-white font-bold px-3 py-1 rounded-lg text-xs hover:bg-slate-800"
                >
                  Buka Jurnal ➔
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Section Chatter Log Audit Dashboard */}
        <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-xs p-2">
          <Chatter
            documentId="EXEC-DASHBOARD"
            documentType="Executive Management Dashboard"
            initialLogs={[
              {
                id: 'dash1',
                user: 'Hendra Wijaya (Business Owner)',
                role: 'Executive Owner',
                action: 'Tinjauan KPI Berkala & Kepatuhan Aturan Bisnis',
                timestamp: 'Hari ini, 11:00',
                message: `Nilai persediaan saat ini Rp${totalStockValuation.toLocaleString('id-ID')} dan omzet Rp${grandTotalOmzet.toLocaleString('id-ID')} dihitung langsung dari database.`,
              },
            ]}
          />
        </div>
      </main>
    </div>
  );
}
