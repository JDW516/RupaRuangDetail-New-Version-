'use server';

import { revalidatePath } from 'next/cache';
import { getSession, type SessionPayload } from '@/lib/session';
import { canAccess } from '@/lib/auth';
import * as erp from '@/lib/erp';
import type { LineInput } from '@/lib/erp';

export interface ActionResult {
  ok: boolean;
  message: string;
  redirectTo?: string;
}

const PATHS = ['/sales', '/purchase', '/inventory', '/invoicing', '/accounting', '/pos', '/dashboard'];

async function run(
  moduleId: string,
  fn: (session: SessionPayload) => Promise<{ message: string; redirectTo?: string }>
): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, message: 'Sesi berakhir. Silakan login kembali.' };
  if (!canAccess(session, moduleId)) return { ok: false, message: 'Akses Ditolak: Anda tidak memiliki izin untuk aksi ini.' };
  try {
    const r = await fn(session);
    for (const p of PATHS) revalidatePath(p, 'layout');
    return { ok: true, ...r };
  } catch (e) {
    if (e instanceof erp.ErpError) return { ok: false, message: e.message };
    console.error('[erp action]', e);
    return { ok: false, message: 'Terjadi kesalahan server. Coba lagi.' };
  }
}

// ---- Sales ----
export async function createQuotationAction(customerId: string, lines: LineInput[]) {
  return run('sales', async () => {
    const q = await erp.createQuotation(customerId, lines);
    return { message: `Quotation ${q.docNumber} berhasil dibuat.`, redirectTo: `/sales/${q.id}` };
  });
}
export async function confirmQuotationAction(id: string) {
  return run('sales', async () => {
    const r = await erp.confirmQuotation(id);
    return { message: r.message, redirectTo: `/sales/order/${r.soId}` };
  });
}
export async function approveCreditAction(soId: string) {
  return run('sales', async (s) => {
    if (!['SUPERADMIN', 'OWNER', 'FINANCE'].includes(s.role)) throw new erp.ErpError('Hanya Owner/Finance yang boleh menyetujui kredit.');
    return { message: await erp.approveCredit(soId) };
  });
}

// ---- Purchase ----
export async function createPurchaseOrderAction(vendorId: string, lines: LineInput[]) {
  return run('purchase', async () => {
    const po = await erp.createPurchaseOrder(vendorId, lines);
    return { message: `PO ${po.docNumber} berhasil dibuat.`, redirectTo: `/purchase/${po.id}` };
  });
}
export async function confirmPurchaseOrderAction(id: string) {
  return run('purchase', async () => ({ message: await erp.confirmPurchaseOrder(id) }));
}

// ---- Inventory ----
export async function validateDeliveryAction(id: string) {
  return run('inventory', async () => ({ message: await erp.validateDelivery(id) }));
}
export async function validateReceiptAction(id: string) {
  return run('inventory', async () => ({ message: await erp.validateReceipt(id) }));
}
export async function createProductAction(p: Parameters<typeof erp.createProduct>[0]) {
  return run('inventory', async () => ({ message: await erp.createProduct(p), redirectTo: `/inventory/product?sku=${p.sku.trim().toUpperCase()}` }));
}

// ---- Invoicing ----
export async function createInvoiceAction(soId: string) {
  return run('invoicing', async () => ({ message: await erp.createInvoiceFromSO(soId) }));
}
export async function createBillAction(poId: string) {
  return run('invoicing', async () => ({ message: await erp.createBillFromPO(poId) }));
}
export async function registerInvoicePaymentAction(id: string) {
  return run('invoicing', async () => ({ message: await erp.registerInvoicePayment(id) }));
}
export async function registerBillPaymentAction(id: string) {
  return run('invoicing', async () => ({ message: await erp.registerBillPayment(id) }));
}

// ---- POS ----
export async function posCheckoutAction(lines: LineInput[], cashPaid: number) {
  const session = await getSession();
  const name = session?.name ?? 'Kasir';
  const res = await run('pos', async () => {
    const r = await erp.posCheckout(lines, cashPaid, name);
    return {
      message: `Transaksi ${r.docNumber} berhasil. Total Rp ${r.total.toLocaleString('id-ID')} · Kembalian Rp ${r.change.toLocaleString('id-ID')}`,
    };
  });
  return res;
}
export async function closePosSessionAction(sessionId: string, counted?: number) {
  return run('pos', async () => ({ message: await erp.closePosSession(sessionId, counted), redirectTo: '/pos' }));
}
