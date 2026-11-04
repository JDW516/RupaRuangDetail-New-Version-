import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import {
  AppNavbar,
  ControlPanel,
  Chatter,
} from '@/components/odoo';

export const revalidate = 0;

export default async function POSPage() {
  // ==========================================
  // 1. BACKEND LOGIC: PROSES CHECKOUT (PRESERVED STRICTLY)
  // ==========================================
  async function processCheckout(formData: FormData) {
    'use server';

    const allProducts = await prisma.product.findMany();
    const cart = [];

    // Kumpulkan semua barang yang Qty-nya diisi lebih dari 0
    for (const p of allProducts) {
      const qty = parseInt(formData.get(`qty_${p.sku}`) as string) || 0;
      if (qty > 0) {
        cart.push({
          sku: p.sku,
          name: p.name,
          price: p.salesPrice,
          qty: qty,
          subtotal: p.salesPrice * qty,
        });
      }
    }

    if (cart.length === 0) return;

    // A. Validasi & Potong Stok di SHOP
    for (const item of cart) {
      const stock = await prisma.stock.findUnique({
        where: { sku_locationId: { sku: item.sku, locationId: 'SHOP' } },
      });
      if (!stock || stock.qtyOnHand < item.qty) return;

      await prisma.stock.update({
        where: { sku_locationId: { sku: item.sku, locationId: 'SHOP' } },
        data: { qtyOnHand: { decrement: item.qty } },
      });
    }

    // B. Siapkan Sesi Kasir
    let session = await prisma.pOSSession.findFirst({ where: { status: 'Open' } });
    if (!session) {
      session = await prisma.pOSSession.create({
        data: {
          sessionNumber: `SESS-${Math.floor(Date.now() / 1000)}`,
          cashierName: 'Kasir Rina Hartati',
          startBalance: 0,
        },
      });
    }

    // C. Hitung Total & Simpan Struk
    const subtotal = cart.reduce((acc, item) => acc + item.subtotal, 0);
    const tax = subtotal * 0.11;
    const total = subtotal + tax;

    await prisma.pOSOrder.create({
      data: {
        sessionId: session.id,
        docNumber: `TRX-${Math.floor(Date.now() / 1000)}`,
        subtotal,
        taxAmount: tax,
        totalAmount: total,
        paidAmount: total,
        change: 0,
        lines: {
          create: cart.map((item) => ({
            sku: item.sku,
            qty: item.qty,
            unitPrice: item.price,
            subtotal: item.subtotal,
          })),
        },
      },
    });

    revalidatePath('/pos');
    revalidatePath('/inventory');
    revalidatePath('/dashboard');
  }

  // ==========================================
  // 2. FETCH DATA & UI
  // ==========================================
  const sessions = await prisma.pOSSession.findMany({
    include: { orders: { include: { lines: { include: { product: true } } } } },
    orderBy: { openedAt: 'desc' },
  });

  const activeSession = sessions[0];

  const shopProducts = await prisma.product.findMany({
    include: { stocks: { where: { locationId: 'SHOP' } } },
    orderBy: { sku: 'asc' },
  });

  // Hitung total kas yang masuk di sesi aktif
  const totalSessionSales =
    activeSession?.orders.reduce((acc, o) => acc + o.totalAmount, 0) || 0;

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans">
      {/* 1. App Navbar Odoo */}
      <AppNavbar currentModule="Point of Sale (S-15 & S-16)" />

      {/* 2. Control Panel Header */}
      <ControlPanel
        breadcrumbs={[
          { label: 'Home', href: '/' },
          { label: 'Point of Sale', href: '/pos' },
          { label: 'Gerai Depok (SHOP) · Kasir' },
        ]}
        searchPlaceholder="Scan barcode atau cari nama produk kasir..."
        pagerText={`Sesi Aktif: ${activeSession?.sessionNumber || 'SESS-OPEN'}`}
        availableViews={['kanban', 'list']}
        currentView="kanban"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold bg-[#CFFF30] text-[#0F172A] px-2.5 py-1 rounded">
            Total Omzet Sesi: Rp {totalSessionSales.toLocaleString('id-ID')}
          </span>
        </div>
      </ControlPanel>

      {/* 3. Main Workspace: S-15 POS Cashier + S-16 Session Closing */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-6 space-y-6">
        
        {/* S-16 POS SESSION SUMMARY HEADER BAR */}
        <div className="bg-[#1E293B] text-white p-4 rounded-2xl shadow-xs border border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#CFFF30] text-[#0F172A] flex items-center justify-center text-xl font-bold">
              🏪
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-[#CFFF30]">
                  {activeSession?.sessionNumber || 'SESS-001'}
                </span>
                <span className="text-[10px] bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/40 px-2 py-0.5 rounded font-bold">
                  Status: Open
                </span>
              </div>
              <h2 className="text-base font-extrabold text-white">
                SHOP/DPK/Stock — Gerai Penjualan Depok
              </h2>
              <span className="text-xs text-slate-400">
                Kasir: <strong>Rina Hartati</strong> · Kas Awal: Rp 0
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-slate-800/80 border border-slate-700 px-3 py-1.5 rounded-xl text-right">
              <span className="block text-[10px] text-slate-400 font-semibold uppercase">
                Kas Seharusnya (Expected)
              </span>
              <span className="font-mono font-black text-sm text-[#00F0FF]">
                Rp {totalSessionSales.toLocaleString('id-ID')}
              </span>
            </div>
            <div className="bg-slate-800/80 border border-slate-700 px-3 py-1.5 rounded-xl text-right">
              <span className="block text-[10px] text-slate-400 font-semibold uppercase">
                Variance Kas (SR-08)
              </span>
              <span className="font-mono font-bold text-sm text-[#10B981]">
                Rp 0 (Seimbang)
              </span>
            </div>
          </div>
        </div>

        {/* 2-KOLOM: S-15 PRODUK KATALOG (KANAN) + KERANJANG CHECKOUT (KIRI) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* S-15 SISI KIRI: KATALOG PRODUK GERAI */}
          <div className="lg:col-span-8 space-y-4">
            <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-2xs flex justify-between items-center">
              <div>
                <h3 className="font-bold text-[#0F172A] text-xs uppercase tracking-wider">
                  [3] Grid Produk / Pencarian SKU &nbsp;|&nbsp; [6] Kontrol Stok Gerai (SR-07)
                </h3>
                <p className="text-[11px] text-[#64748B]">
                  Pilih kuantitas item yang dibeli pelanggan, lalu klik tombol Bayar di bawah.
                </p>
              </div>
              <span className="text-xs font-mono font-bold bg-[#F8FAFC] border border-[#E2E8F0] px-2.5 py-1 rounded text-[#0F172A]">
                16 SKU Gerai
              </span>
            </div>

            <form action={processCheckout}>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 pb-24">
                {shopProducts.map((p) => {
                  const shopQty = p.stocks[0]?.qtyOnHand || 0;
                  const isOutOfStock = shopQty <= 0;

                  return (
                    <div
                      key={p.sku}
                      className={`border rounded-xl p-4 flex flex-col justify-between shadow-2xs transition-all ${
                        isOutOfStock
                          ? 'bg-[#F8FAFC] border-[#E2E8F0] opacity-50 cursor-not-allowed'
                          : 'bg-white border-[#E2E8F0] hover:border-[#00F0FF] hover:shadow-sm'
                      }`}
                    >
                      <div>
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-[10px] font-mono font-bold bg-[#F8FAFC] border border-[#E2E8F0] px-2 py-0.5 rounded text-[#0F172A]">
                            {p.sku}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              isOutOfStock
                                ? 'bg-[#EF4444]/15 text-[#EF4444]'
                                : 'bg-[#10B981]/15 text-[#10B981]'
                            }`}
                          >
                            Stok SHOP: {shopQty}
                          </span>
                        </div>
                        <h4 className="font-bold text-[#0F172A] text-xs mb-1 line-clamp-2 leading-snug">
                          {p.name}
                        </h4>
                        <span className="font-mono font-extrabold text-[#0F172A] text-xs">
                          Rp {p.salesPrice.toLocaleString('id-ID')}
                        </span>
                      </div>

                      {/* Input Qty Belanja */}
                      <div className="mt-3 pt-3 border-t border-[#E2E8F0]">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-[#64748B] uppercase">
                            Qty:
                          </span>
                          <input
                            type="number"
                            name={`qty_${p.sku}`}
                            defaultValue="0"
                            min="0"
                            max={shopQty}
                            disabled={isOutOfStock}
                            className="w-full bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A] font-mono font-bold text-xs rounded-lg px-2.5 py-1.5 focus:border-[#00F0FF] focus:ring-1 focus:ring-[#00F0FF] outline-none disabled:bg-[#E2E8F0] disabled:cursor-not-allowed transition-all text-center"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Bottom Sticky Checkout Action Bar */}
              <div className="fixed bottom-6 left-6 lg:left-8 lg:w-[60%] bg-[#1E293B] text-white p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xl z-30 border border-slate-700">
                <div>
                  <span className="block text-[11px] text-slate-400 font-medium">
                    PPN Efektif 11% (PPN-E11) dihitung otomatis saat checkout
                  </span>
                  <span className="block text-xs font-bold text-white">
                    Pastikan Qty barang telah dimasukkan pada kartu di atas ⬆️
                  </span>
                </div>
                <button
                  type="submit"
                  className="bg-[#CFFF30] hover:brightness-95 text-[#0F172A] font-black px-6 py-2.5 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 text-xs shrink-0"
                >
                  <span>🛒</span>
                  <span>Bayar & Cetak Struk (F-15)</span>
                </button>
              </div>
            </form>
          </div>

          {/* S-15 SISI KANAN: STRUK TRANSAKSI & RIWAYAT SESI */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-xs overflow-hidden">
              <div className="p-4 border-b border-[#E2E8F0] bg-[#1E293B] text-white flex justify-between items-center">
                <div>
                  <h3 className="font-extrabold text-xs text-[#00F0FF] uppercase tracking-wider">
                    [5] Struk Kasir Real-time
                  </h3>
                  <span className="text-[11px] text-slate-300">
                    Otomatis potong stok SHOP & catat omzet
                  </span>
                </div>
                <span className="text-xs font-mono font-bold bg-[#CFFF30] text-[#0F172A] px-2 py-0.5 rounded">
                  {activeSession?.orders.length || 0} Trx
                </span>
              </div>

              <div className="p-4 max-h-[600px] overflow-y-auto space-y-3">
                {!activeSession || activeSession.orders.length === 0 ? (
                  <div className="p-8 text-center text-[#64748B] space-y-2">
                    <span className="text-3xl">🧾</span>
                    <p className="text-xs italic">
                      Belum ada struk transaksi pada sesi ini. Pilih kuantitas produk lalu tekan tombol Bayar!
                    </p>
                  </div>
                ) : (
                  activeSession.orders.map((order) => (
                    <div
                      key={order.id}
                      className="bg-[#F8FAFC] border border-[#E2E8F0] p-3.5 rounded-xl text-xs space-y-2 shadow-2xs"
                    >
                      <div className="flex justify-between items-center border-b border-[#E2E8F0] pb-2">
                        <span className="font-mono font-bold text-[#0F172A]">
                          {order.docNumber}
                        </span>
                        <span className="font-mono font-black text-sm text-[#10B981]">
                          Rp {order.totalAmount.toLocaleString('id-ID')}
                        </span>
                      </div>

                      <div className="space-y-1">
                        {order.lines.map((l) => (
                          <div
                            key={l.id}
                            className="flex justify-between text-[#64748B] text-[11px]"
                          >
                            <span>
                              {l.qty}x {l.product.name}
                            </span>
                            <span className="font-mono font-semibold text-[#0F172A]">
                              Rp {l.subtotal.toLocaleString('id-ID')}
                            </span>
                          </div>
                        ))}
                      </div>

                      <div className="pt-2 border-t border-[#E2E8F0] flex justify-between text-[11px] text-[#64748B] font-medium">
                        <span>Termasuk PPN 11%:</span>
                        <span className="font-mono font-bold text-[#0F172A]">
                          Rp {order.taxAmount.toLocaleString('id-ID')}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* S-16 POS SESSION CLOSING CARD */}
            <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-xs p-4 space-y-3">
              <div className="flex justify-between items-center border-b border-[#E2E8F0] pb-2">
                <h4 className="font-extrabold text-xs text-[#0F172A] uppercase tracking-wider">
                  S-16 Form Penutupan Shift Kasir
                </h4>
                <span className="text-[10px] font-mono bg-[#F8FAFC] border border-[#E2E8F0] px-2 py-0.5 rounded">
                  F-16 / SR-08
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between text-[#64748B]">
                  <span>Kas Fisik Dihitung (Counted):</span>
                  <span className="font-mono font-bold text-[#0F172A]">
                    Rp {totalSessionSales.toLocaleString('id-ID')}
                  </span>
                </div>
                <div className="flex justify-between text-[#64748B]">
                  <span>Kas Sistem (Expected):</span>
                  <span className="font-mono font-bold text-[#0F172A]">
                    Rp {totalSessionSales.toLocaleString('id-ID')}
                  </span>
                </div>
                <div className="flex justify-between pt-1 border-t border-[#E2E8F0] font-black text-[#10B981]">
                  <span>Discrepancy (Selisih):</span>
                  <span className="font-mono">Rp 0 (Nol)</span>
                </div>
              </div>

              <button
                type="button"
                className="w-full bg-[#1E293B] hover:bg-slate-800 text-[#CFFF30] font-extrabold text-xs py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5"
              >
                <span>🔒</span>
                <span>Tutup Sesi & Rekonsiliasi (Close Session)</span>
              </button>
            </div>
          </div>
        </div>

        {/* Section Chatter Log Kasir */}
        <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-xs p-2">
          <Chatter
            documentId={activeSession?.sessionNumber || 'SESS-POS'}
            documentType="POS Session"
            initialLogs={[
              {
                id: 'pos1',
                user: 'Rina Hartati (Kasir Gerai)',
                role: 'Cashier Lead',
                action: 'Membuka shift kasir gerai Depok',
                timestamp: 'Hari ini, 07:00',
                message: 'Kas modal awal Rp 0. Mesin kasir siap melayani transaksi ritel.',
              },
            ]}
          />
        </div>
      </main>
    </div>
  );
}
