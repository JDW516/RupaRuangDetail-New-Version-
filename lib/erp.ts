import { Prisma } from '@prisma/client';
import { prisma } from './prisma';

type Tx = Prisma.TransactionClient;

export const TAX_RATE = 0.11;

/** Error bisnis yang pesannya aman ditampilkan ke user */
export class ErpError extends Error {}

const rp = (n: number) => 'Rp ' + Math.round(n).toLocaleString('id-ID');
const digitsOf = (s: string) => (s.match(/(\d+)$/) ?? [])[1] ?? '';

/** Nomor dokumen berikutnya: prefix + 5 digit, berdasarkan nomor terbesar yang ada */
function nextNo(prefix: string, rows: { docNumber: string }[]): string {
  let max = 0;
  for (const r of rows) {
    const n = parseInt(digitsOf(r.docNumber) || '0', 10);
    if (n > max) max = n;
  }
  return prefix + String(max + 1).padStart(5, '0');
}

export interface LineInput {
  sku: string;
  qty: number;
}

function cleanLines(lines: LineInput[]): LineInput[] {
  const map = new Map<string, number>();
  for (const l of lines) {
    const qty = Math.floor(Number(l.qty));
    if (!l.sku || !Number.isFinite(qty) || qty <= 0) continue;
    map.set(l.sku, (map.get(l.sku) ?? 0) + qty);
  }
  return Array.from(map, ([sku, qty]) => ({ sku, qty }));
}

async function addStock(tx: Tx, sku: string, locationId: string, onHand: number, reserved = 0) {
  await tx.stock.upsert({
    where: { sku_locationId: { sku, locationId } },
    update: { qtyOnHand: { increment: onHand }, qtyReserved: { increment: reserved } },
    create: { sku, locationId, qtyOnHand: Math.max(0, onHand), qtyReserved: Math.max(0, reserved) },
  });
}

async function postJournal(
  tx: Tx,
  description: string,
  ref: string,
  lines: { accountCode: string; debit: number; credit: number }[]
) {
  const clean = lines.filter((l) => l.debit > 0 || l.credit > 0);
  const d = clean.reduce((s, l) => s + l.debit, 0);
  const c = clean.reduce((s, l) => s + l.credit, 0);
  if (Math.abs(d - c) > 0.5) throw new ErpError('Jurnal tidak seimbang (Debit ≠ Kredit).');
  const all = await tx.journalEntry.findMany({ select: { docNumber: true } });
  await tx.journalEntry.create({
    data: { docNumber: nextNo('JRN-', all), description, ref, lines: { create: clean } },
  });
}

// ============================================================
// SALES: Quotation -> Sales Order -> Delivery Order
// ============================================================
export async function createQuotation(customerId: string, input: LineInput[]) {
  const lines = cleanLines(input);
  if (!customerId) throw new ErpError('Pilih pelanggan terlebih dahulu.');
  if (lines.length === 0) throw new ErpError('Tambahkan minimal 1 produk dengan kuantitas > 0.');

  return prisma.$transaction(async (tx) => {
    const customer = await tx.contact.findUnique({ where: { id: customerId } });
    if (!customer || customer.type === 'VENDOR') throw new ErpError('Pelanggan tidak valid.');
    const products = await tx.product.findMany({ where: { sku: { in: lines.map((l) => l.sku) } } });
    const pmap = new Map(products.map((p) => [p.sku, p]));

    const data = lines.map((l) => {
      const p = pmap.get(l.sku);
      if (!p) throw new ErpError(`Produk ${l.sku} tidak ditemukan.`);
      return { sku: l.sku, qty: l.qty, unitPrice: p.salesPrice, subtotal: p.salesPrice * l.qty };
    });
    const subtotal = data.reduce((s, l) => s + l.subtotal, 0);
    const taxAmount = Math.round(subtotal * TAX_RATE);

    const all = await tx.quotation.findMany({ select: { docNumber: true } });
    const q = await tx.quotation.create({
      data: {
        docNumber: nextNo('Q', all),
        customerId,
        status: 'Draft',
        subtotal,
        taxAmount,
        totalAmount: subtotal + taxAmount,
        lines: { create: data },
      },
    });
    return { id: q.id, docNumber: q.docNumber };
  });
}

/** Buat Delivery Order + reservasi stok WH untuk sebuah SO yang sudah Confirmed */
async function releaseSalesOrder(tx: Tx, soId: string) {
  const so = await tx.salesOrder.findUnique({ where: { id: soId }, include: { lines: true } });
  if (!so) throw new ErpError('Sales Order tidak ditemukan.');
  const all = await tx.deliveryOrder.findMany({ select: { docNumber: true } });
  const doDoc = await tx.deliveryOrder.create({
    data: {
      docNumber: so.docNumber.startsWith('SO') ? 'DO' + digitsOf(so.docNumber) : nextNo('DO', all),
      salesOrderId: so.id,
      status: 'Ready',
      lines: { create: so.lines.map((l) => ({ sku: l.sku, qtyDone: l.qtyOrdered })) },
    },
  });
  for (const l of so.lines) await addStock(tx, l.sku, 'WH', 0, l.qtyOrdered);
  return doDoc;
}

export async function confirmQuotation(quotationId: string) {
  return prisma.$transaction(async (tx) => {
    const q = await tx.quotation.findUnique({
      where: { id: quotationId },
      include: { lines: true, customer: true },
    });
    if (!q) throw new ErpError('Quotation tidak ditemukan.');
    if (q.status !== 'Draft') throw new ErpError('Quotation ini sudah dikonfirmasi.');

    // Credit check (SR-11): hanya untuk pelanggan dengan termin kredit
    let held = false;
    let exposure = 0;
    if (q.customer.paymentTerms !== 'PT-CASH') {
      const unpaid = await tx.invoice.findMany({
        where: { customerId: q.customerId, status: { not: 'Paid' } },
      });
      const openSo = await tx.salesOrder.findMany({
        where: { customerId: q.customerId, status: 'Confirmed', invoices: { none: {} } },
      });
      exposure =
        unpaid.reduce((s, i) => s + i.totalAmount, 0) +
        openSo.reduce((s, o) => s + o.totalAmount, 0) +
        q.totalAmount;
      held = exposure > q.customer.creditLimit;
    }

    const soAll = await tx.salesOrder.findMany({ select: { docNumber: true } });
    const soNo = 'SO' + (digitsOf(q.docNumber) || nextNo('', soAll));
    const so = await tx.salesOrder.create({
      data: {
        docNumber: soNo,
        customerId: q.customerId,
        status: held ? 'Pending Credit Approval' : 'Confirmed',
        subtotal: q.subtotal,
        taxAmount: q.taxAmount,
        totalAmount: q.totalAmount,
        lines: {
          create: q.lines.map((l) => ({
            sku: l.sku,
            qtyOrdered: l.qty,
            unitPrice: l.unitPrice,
            subtotal: l.subtotal,
          })),
        },
      },
    });
    await tx.quotation.update({ where: { id: q.id }, data: { status: 'Confirmed' } });

    if (held) {
      return {
        soId: so.id,
        held: true,
        message: `${so.docNumber} ditahan (Pending Credit Approval): eksposur ${rp(exposure)} melebihi limit kredit ${rp(q.customer.creditLimit)}.`,
      };
    }
    const d = await releaseSalesOrder(tx, so.id);
    return { soId: so.id, held: false, message: `${so.docNumber} dikonfirmasi. Delivery Order ${d.docNumber} dibuat di Inventory.` };
  });
}

export async function approveCredit(soId: string) {
  return prisma.$transaction(async (tx) => {
    const so = await tx.salesOrder.findUnique({ where: { id: soId } });
    if (!so) throw new ErpError('Sales Order tidak ditemukan.');
    if (so.status !== 'Pending Credit Approval') throw new ErpError('SO ini tidak sedang menunggu approval kredit.');
    await tx.salesOrder.update({ where: { id: soId }, data: { status: 'Confirmed' } });
    const d = await releaseSalesOrder(tx, soId);
    return `Kredit disetujui. ${so.docNumber} Confirmed, Delivery Order ${d.docNumber} dibuat.`;
  });
}

/** Validate Delivery Order: stok fisik WH berkurang sesuai qty kirim */
export async function validateDelivery(deliveryId: string) {
  return prisma.$transaction(async (tx) => {
    const d = await tx.deliveryOrder.findUnique({ where: { id: deliveryId }, include: { lines: true } });
    if (!d) throw new ErpError('Delivery Order tidak ditemukan.');
    if (d.status === 'Done') throw new ErpError('Delivery Order ini sudah divalidasi.');

    for (const l of d.lines) {
      const st = await tx.stock.findUnique({ where: { sku_locationId: { sku: l.sku, locationId: 'WH' } } });
      if (!st || st.qtyOnHand < l.qtyDone) {
        throw new ErpError(`Stok ${l.sku} di WH tidak cukup (tersedia ${st?.qtyOnHand ?? 0}, dikirim ${l.qtyDone}).`);
      }
    }
    for (const l of d.lines) {
      const st = await tx.stock.findUniqueOrThrow({ where: { sku_locationId: { sku: l.sku, locationId: 'WH' } } });
      await tx.stock.update({
        where: { id: st.id },
        data: { qtyOnHand: { decrement: l.qtyDone }, qtyReserved: Math.max(0, st.qtyReserved - l.qtyDone) },
      });
      await tx.salesOrderLine.updateMany({
        where: { salesOrderId: d.salesOrderId, sku: l.sku },
        data: { qtyDelivered: { increment: l.qtyDone } },
      });
    }
    await tx.deliveryOrder.update({ where: { id: d.id }, data: { status: 'Done' } });
    return `${d.docNumber} tervalidasi. Stok WH berkurang.`;
  });
}

// ============================================================
// PURCHASE: PO -> Receipt
// ============================================================
export async function createPurchaseOrder(vendorId: string, input: LineInput[]) {
  const lines = cleanLines(input);
  if (!vendorId) throw new ErpError('Pilih vendor terlebih dahulu.');
  if (lines.length === 0) throw new ErpError('Tambahkan minimal 1 produk dengan kuantitas > 0.');

  return prisma.$transaction(async (tx) => {
    const vendor = await tx.contact.findUnique({ where: { id: vendorId } });
    if (!vendor || vendor.type !== 'VENDOR') throw new ErpError('Vendor tidak valid.');
    const products = await tx.product.findMany({ where: { sku: { in: lines.map((l) => l.sku) } } });
    const pmap = new Map(products.map((p) => [p.sku, p]));
    const data = lines.map((l) => {
      const p = pmap.get(l.sku);
      if (!p) throw new ErpError(`Produk ${l.sku} tidak ditemukan.`);
      return { sku: l.sku, qtyOrdered: l.qty, unitPrice: p.cost, subtotal: p.cost * l.qty };
    });
    const subtotal = data.reduce((s, l) => s + l.subtotal, 0);
    const taxAmount = Math.round(subtotal * TAX_RATE);
    const all = await tx.purchaseOrder.findMany({ select: { docNumber: true } });
    const po = await tx.purchaseOrder.create({
      data: {
        docNumber: nextNo('PO', all),
        vendorId,
        status: 'Draft',
        subtotal,
        taxAmount,
        totalAmount: subtotal + taxAmount,
        lines: { create: data },
      },
    });
    return { id: po.id, docNumber: po.docNumber };
  });
}

export async function confirmPurchaseOrder(poId: string) {
  return prisma.$transaction(async (tx) => {
    const po = await tx.purchaseOrder.findUnique({ where: { id: poId }, include: { lines: true } });
    if (!po) throw new ErpError('Purchase Order tidak ditemukan.');
    if (po.status !== 'Draft') throw new ErpError('PO ini sudah dikonfirmasi.');
    await tx.purchaseOrder.update({ where: { id: po.id }, data: { status: 'Confirmed' } });
    const all = await tx.receipt.findMany({ select: { docNumber: true } });
    const r = await tx.receipt.create({
      data: {
        docNumber: po.docNumber.startsWith('PO') ? 'RC' + digitsOf(po.docNumber) : nextNo('RC', all),
        purchaseOrderId: po.id,
        status: 'Ready',
        lines: { create: po.lines.map((l) => ({ sku: l.sku, qtyDone: l.qtyOrdered })) },
      },
    });
    return `${po.docNumber} dikonfirmasi. Receipt ${r.docNumber} dibuat di Inventory.`;
  });
}

/** Validate Receipt: stok fisik WH bertambah sesuai barang masuk */
export async function validateReceipt(receiptId: string) {
  return prisma.$transaction(async (tx) => {
    const r = await tx.receipt.findUnique({ where: { id: receiptId }, include: { lines: true } });
    if (!r) throw new ErpError('Receipt tidak ditemukan.');
    if (r.status === 'Done') throw new ErpError('Receipt ini sudah divalidasi.');
    for (const l of r.lines) {
      await addStock(tx, l.sku, 'WH', l.qtyDone);
      await tx.purchaseOrderLine.updateMany({
        where: { purchaseOrderId: r.purchaseOrderId, sku: l.sku },
        data: { qtyReceived: { increment: l.qtyDone } },
      });
    }
    await tx.receipt.update({ where: { id: r.id }, data: { status: 'Done' } });
    await tx.purchaseOrder.update({ where: { id: r.purchaseOrderId }, data: { status: 'Received' } });
    return `${r.docNumber} tervalidasi. Stok WH bertambah.`;
  });
}

// ============================================================
// INVENTORY: produk baru
// ============================================================
export async function createProduct(p: {
  sku: string; name: string; uom?: string; salesPrice: number; cost: number; vendorId: string; initialQty: number;
}) {
  const sku = p.sku.trim().toUpperCase();
  if (!sku || !p.name.trim()) throw new ErpError('SKU dan nama produk wajib diisi.');
  if (!(p.salesPrice > 0) || !(p.cost >= 0)) throw new ErpError('Harga jual dan biaya harus valid.');
  if (!p.vendorId) throw new ErpError('Pilih vendor default.');
  const exist = await prisma.product.findUnique({ where: { sku } });
  if (exist) throw new ErpError(`SKU ${sku} sudah ada.`);
  await prisma.$transaction(async (tx) => {
    await tx.product.create({
      data: {
        sku, name: p.name.trim(), uom: p.uom?.trim() || 'Unit',
        salesPrice: p.salesPrice, cost: p.cost, defaultVendorId: p.vendorId,
      },
    });
    await addStock(tx, sku, 'WH', Math.max(0, Math.floor(p.initialQty || 0)));
    await addStock(tx, sku, 'SHOP', 0);
  });
  return `Produk ${sku} berhasil dibuat.`;
}

// ============================================================
// INVOICING & ACCOUNTING
// ============================================================
export async function createInvoiceFromSO(soId: string) {
  return prisma.$transaction(async (tx) => {
    const so = await tx.salesOrder.findUnique({ where: { id: soId }, include: { lines: true } });
    if (!so) throw new ErpError('Sales Order tidak ditemukan.');
    if (so.status !== 'Confirmed') throw new ErpError('Hanya SO berstatus Confirmed yang bisa difakturkan.');
    const invNo = 'INV-' + digitsOf(so.docNumber);
    if (await tx.invoice.findUnique({ where: { docNumber: invNo } })) throw new ErpError(`Faktur ${invNo} sudah ada.`);
    await tx.invoice.create({
      data: {
        docNumber: invNo, salesOrderId: so.id, customerId: so.customerId, status: 'Posted',
        subtotal: so.subtotal, taxAmount: so.taxAmount, totalAmount: so.totalAmount,
        lines: { create: so.lines.map((l) => ({ sku: l.sku, qty: l.qtyOrdered, unitPrice: l.unitPrice, subtotal: l.subtotal })) },
      },
    });
    for (const l of so.lines) {
      await tx.salesOrderLine.update({ where: { id: l.id }, data: { qtyInvoiced: l.qtyOrdered } });
    }
    await postJournal(tx, `Pengakuan Piutang Faktur ${invNo}`, invNo, [
      { accountCode: '1100', debit: so.totalAmount, credit: 0 },
      { accountCode: '4000', debit: 0, credit: so.subtotal },
      { accountCode: '2100', debit: 0, credit: so.taxAmount },
    ]);
    return `Faktur ${invNo} diterbitkan.`;
  });
}

export async function createBillFromPO(poId: string) {
  return prisma.$transaction(async (tx) => {
    const po = await tx.purchaseOrder.findUnique({ where: { id: poId }, include: { lines: true } });
    if (!po) throw new ErpError('Purchase Order tidak ditemukan.');
    const billNo = 'BILL-' + digitsOf(po.docNumber);
    if (await tx.vendorBill.findUnique({ where: { docNumber: billNo } })) throw new ErpError(`Tagihan ${billNo} sudah ada.`);
    await tx.vendorBill.create({
      data: {
        docNumber: billNo, purchaseOrderId: po.id, vendorId: po.vendorId, status: 'Posted',
        subtotal: po.subtotal, taxAmount: po.taxAmount, totalAmount: po.totalAmount,
        lines: { create: po.lines.map((l) => ({ sku: l.sku, qty: l.qtyOrdered, unitPrice: l.unitPrice, subtotal: l.subtotal })) },
      },
    });
    await postJournal(tx, `Pengakuan Hutang Pembelian ${billNo}`, billNo, [
      { accountCode: '1200', debit: po.subtotal, credit: 0 },
      { accountCode: '1150', debit: po.taxAmount, credit: 0 },
      { accountCode: '2000', debit: 0, credit: po.totalAmount },
    ]);
    return `Tagihan ${billNo} diterbitkan.`;
  });
}

/** Register Payment faktur pelanggan: Posted -> Paid + jurnal Debit Bank / Kredit Piutang */
export async function registerInvoicePayment(invoiceId: string) {
  return prisma.$transaction(async (tx) => {
    const inv = await tx.invoice.findUnique({ where: { id: invoiceId } });
    if (!inv) throw new ErpError('Faktur tidak ditemukan.');
    if (inv.status === 'Paid') throw new ErpError('Faktur ini sudah dibayar.');
    if (inv.status !== 'Posted') throw new ErpError('Faktur harus berstatus Posted (dikonfirmasi) sebelum dibayar.');
    await tx.invoice.update({ where: { id: inv.id }, data: { status: 'Paid' } });
    await postJournal(tx, `Pembayaran Faktur ${inv.docNumber}`, inv.docNumber, [
      { accountCode: '1010', debit: inv.totalAmount, credit: 0 },
      { accountCode: '1100', debit: 0, credit: inv.totalAmount },
    ]);
    return `${inv.docNumber} PAID. Jurnal Bank (D) / Piutang (K) ${rp(inv.totalAmount)} masuk General Ledger.`;
  });
}

/** Register Payment tagihan vendor: Posted -> Paid + jurnal Debit Hutang / Kredit Bank */
export async function registerBillPayment(billId: string) {
  return prisma.$transaction(async (tx) => {
    const b = await tx.vendorBill.findUnique({ where: { id: billId } });
    if (!b) throw new ErpError('Tagihan tidak ditemukan.');
    if (b.status === 'Paid') throw new ErpError('Tagihan ini sudah dibayar.');
    await tx.vendorBill.update({ where: { id: b.id }, data: { status: 'Paid' } });
    await postJournal(tx, `Pembayaran Tagihan ${b.docNumber}`, b.docNumber, [
      { accountCode: '2000', debit: b.totalAmount, credit: 0 },
      { accountCode: '1010', debit: 0, credit: b.totalAmount },
    ]);
    return `${b.docNumber} PAID. Jurnal Hutang (D) / Bank (K) ${rp(b.totalAmount)} masuk General Ledger.`;
  });
}

// ============================================================
// POS
// ============================================================
export async function posAvailability(): Promise<Record<string, number>> {
  const session = await prisma.pOSSession.findFirst({ where: { status: 'Open' } });
  const stocks = await prisma.stock.findMany({ where: { locationId: 'SHOP' } });
  const avail: Record<string, number> = {};
  for (const s of stocks) avail[s.sku] = s.qtyOnHand;
  if (session) {
    const sold = await prisma.pOSOrderLine.findMany({ where: { posOrder: { sessionId: session.id } } });
    for (const l of sold) avail[l.sku] = (avail[l.sku] ?? 0) - l.qty;
  }
  return avail;
}

export async function posCheckout(input: LineInput[], cashPaid: number, cashierName: string) {
  const lines = cleanLines(input);
  if (lines.length === 0) throw new ErpError('Keranjang masih kosong.');
  return prisma.$transaction(async (tx) => {
    let session = await tx.pOSSession.findFirst({ where: { status: 'Open' } });
    if (!session) {
      session = await tx.pOSSession.create({
        data: { sessionNumber: `SESS-${Math.floor(Date.now() / 1000)}`, cashierName, startBalance: 0 },
      });
    }
    const products = await tx.product.findMany({ where: { sku: { in: lines.map((l) => l.sku) } } });
    const pmap = new Map(products.map((p) => [p.sku, p]));
    const soldRows = await tx.pOSOrderLine.findMany({ where: { posOrder: { sessionId: session.id } } });

    const data = lines.map((l) => {
      const p = pmap.get(l.sku);
      if (!p) throw new ErpError(`Produk ${l.sku} tidak ditemukan.`);
      return { sku: l.sku, qty: l.qty, unitPrice: p.salesPrice, subtotal: p.salesPrice * l.qty };
    });
    for (const l of data) {
      const st = await tx.stock.findUnique({ where: { sku_locationId: { sku: l.sku, locationId: 'SHOP' } } });
      const already = soldRows.filter((r) => r.sku === l.sku).reduce((s, r) => s + r.qty, 0);
      const avail = (st?.qtyOnHand ?? 0) - already;
      if (avail < l.qty) throw new ErpError(`Stok ${l.sku} di SHOP tidak cukup (sisa ${Math.max(0, avail)}).`);
    }
    const subtotal = data.reduce((s, l) => s + l.subtotal, 0);
    const taxAmount = Math.round(subtotal * TAX_RATE);
    const total = subtotal + taxAmount;
    if (!(cashPaid >= total)) throw new ErpError(`Uang tunai kurang. Total tagihan ${rp(total)}.`);

    const o = await tx.pOSOrder.create({
      data: {
        sessionId: session.id,
        docNumber: `TRX-${Date.now()}`,
        subtotal, taxAmount, totalAmount: total, paidAmount: cashPaid, change: cashPaid - total,
        lines: { create: data },
      },
    });
    return { docNumber: o.docNumber, total, change: cashPaid - total };
  });
}

/** Close Session: potong stok SHOP sesuai barang terjual + jurnal penjualan kasir */
export async function closePosSession(sessionId: string, counted?: number) {
  return prisma.$transaction(async (tx) => {
    const s = await tx.pOSSession.findUnique({
      where: { id: sessionId },
      include: { orders: { include: { lines: true } } },
    });
    if (!s) throw new ErpError('Sesi POS tidak ditemukan.');
    if (s.status !== 'Open') throw new ErpError('Sesi ini sudah ditutup.');

    const sold = new Map<string, number>();
    for (const o of s.orders) for (const l of o.lines) sold.set(l.sku, (sold.get(l.sku) ?? 0) + l.qty);
    for (const [sku, qty] of sold) {
      const st = await tx.stock.findUnique({ where: { sku_locationId: { sku, locationId: 'SHOP' } } });
      if (!st) throw new ErpError(`Stok SHOP untuk ${sku} tidak ditemukan.`);
      await tx.stock.update({ where: { id: st.id }, data: { qtyOnHand: Math.max(0, st.qtyOnHand - qty) } });
    }

    const subtotal = s.orders.reduce((a, o) => a + o.subtotal, 0);
    const tax = s.orders.reduce((a, o) => a + o.taxAmount, 0);
    const sales = subtotal + tax;
    const expected = s.startBalance + sales;
    const cnt = counted === undefined || Number.isNaN(counted) ? expected : counted;
    const variance = cnt - expected;

    await tx.pOSSession.update({
      where: { id: s.id },
      data: { status: 'Closed', closedAt: new Date(), expectedBalance: expected, countedBalance: cnt, variance },
    });
    if (sales > 0) {
      await postJournal(tx, `Penjualan POS sesi ${s.sessionNumber}`, s.sessionNumber, [
        { accountCode: '1000', debit: sales, credit: 0 },
        { accountCode: '4010', debit: 0, credit: subtotal },
        { accountCode: '2100', debit: 0, credit: tax },
      ]);
    }
    if (Math.abs(variance) > 0.5) {
      await postJournal(tx, `Selisih kas sesi ${s.sessionNumber}`, s.sessionNumber, [
        { accountCode: variance > 0 ? '1000' : '6100', debit: Math.abs(variance), credit: 0 },
        { accountCode: variance > 0 ? '6100' : '1000', debit: 0, credit: Math.abs(variance) },
      ]);
    }
    const units = Array.from(sold.values()).reduce((a, b) => a + b, 0);
    return `Sesi ${s.sessionNumber} ditutup. Stok SHOP berkurang ${units} unit sesuai penjualan.`;
  });
}
