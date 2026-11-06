import { PrismaClient } from "@prisma/client";
import { createHash } from "crypto";

function hashPassword(plain: string): string {
  const salt = "ruparuang-salt-2024";
  return createHash("sha256").update(salt + plain).digest("hex");
}

const prisma = new PrismaClient();

async function main() {
  console.log("Mulai nge-seed data RupaRuang Retail...");

  // 1. Seed Accounts (Chart of Accounts)
  const accounts = [
    { code: "1000", name: "Cash Kas Gerai", type: "Asset" },
    { code: "1010", name: "Bank", type: "Asset" },
    { code: "1100", name: "Trade Receivables", type: "Asset" },
    { code: "1150", name: "PPN Masukan", type: "Asset" },
    { code: "1200", name: "Inventory Valuation", type: "Asset" },
    { code: "1210", name: "Stock Interim Received (GRNI)", type: "Clearing liability" },
    { code: "2000", name: "Trade Payables", type: "Liability" },
    { code: "2100", name: "PPN Keluaran", type: "Liability" },
    { code: "3000", name: "Opening Equity", type: "Equity" },
    { code: "4000", name: "Sales Revenue B2B", type: "Revenue" },
    { code: "4010", name: "POS Sales Revenue", type: "Revenue" },
    { code: "4100", name: "Sales Returns / Contra Revenue", type: "Contra revenue" },
    { code: "5000", name: "COGS-B2B", type: "Expense" },
    { code: "5010", name: "COGS-POS", type: "Expense" },
    { code: "6100", name: "Cash Overage/Shortage", type: "Other income/expense" },
  ];
  for (const acc of accounts) {
    await prisma.account.upsert({
      where: { code: acc.code },
      update: acc,
      create: acc,
    });
  }

  // 2. Seed Contacts (Pelanggan C01-C06 & Vendor V01-V04)
  const contacts = [
    { contactId: "C01", name: "PT Kantor Sentosa", type: "BUSINESS", city: "Jakarta", creditLimit: 5000000, paymentTerms: "PT-14" },
    { contactId: "C02", name: "CV Maju Properti", type: "BUSINESS", city: "Depok", creditLimit: 2000000, paymentTerms: "PT-14" },
    { contactId: "C03", name: "Sari Wulandari", type: "INDIVIDUAL", city: "Jakarta", creditLimit: 0, paymentTerms: "PT-CASH" },
    { contactId: "C04", name: "Benny Pratama", type: "INDIVIDUAL", city: "Jakarta", creditLimit: 0, paymentTerms: "PT-CASH" },
    { contactId: "C05", name: "Toko Sinar Cepat", type: "BUSINESS", city: "Bekasi", creditLimit: 3000000, paymentTerms: "PT-14" },
    { contactId: "C06", name: "Anisa Putri", type: "INDIVIDUAL", city: "Tangerang", creditLimit: 0, paymentTerms: "PT-CASH" },
    { contactId: "V01", name: "PT Bina Plastik Abadi", type: "VENDOR", city: "Jakarta", creditLimit: 0, paymentTerms: "PT-14", category: "Peralatan plastik dan penyimpanan" },
    { contactId: "V02", name: "PT Sinar Elektrik", type: "VENDOR", city: "Tangerang", creditLimit: 0, paymentTerms: "PT-14", category: "Peralatan listrik dan penerangan" },
    { contactId: "V03", name: "CV Tekstil Bersih", type: "VENDOR", city: "Bogor", creditLimit: 0, paymentTerms: "PT-7", category: "Tekstil dan perlengkapan kebersihan" },
    { contactId: "V04", name: "PT Dapur Prima", type: "VENDOR", city: "Bekasi", creditLimit: 0, paymentTerms: "PT-14", category: "Peralatan dapur dan minum" },
  ];
  for (const c of contacts) {
    await prisma.contact.upsert({
      where: { contactId: c.contactId },
      update: c,
      create: c,
    });
  }

  // 3. Seed Products (P001-P016)
  const products = [
    { sku: "P001", name: "Kotak Simpan 20L", salesPrice: 120000, cost: 75000, defaultVendorId: "V01" },
    { sku: "P002", name: "Rak Serbaguna 3 Tingkat", salesPrice: 350000, cost: 230000, defaultVendorId: "V01" },
    { sku: "P003", name: "Lampu Meja LED", salesPrice: 180000, cost: 110000, defaultVendorId: "V02" },
    { sku: "P004", name: "Bohlam LED 9W", salesPrice: 45000, cost: 27000, defaultVendorId: "V02" },
    { sku: "P005", name: "Keset Anti Selip", salesPrice: 65000, cost: 38000, defaultVendorId: "V03" },
    { sku: "P006", name: "Sapu Microfiber", salesPrice: 90000, cost: 54000, defaultVendorId: "V03" },
    { sku: "P007", name: "Botol Minum 1L", salesPrice: 85000, cost: 48000, defaultVendorId: "V04" },
    { sku: "P008", name: "Tempat Sampah 12L", salesPrice: 145000, cost: 90000, defaultVendorId: "V01" },
    { sku: "P009", name: "Panci Stainless 20cm", salesPrice: 275000, cost: 180000, defaultVendorId: "V04" },
    { sku: "P010", name: "Wajan Anti Lengket", salesPrice: 295000, cost: 195000, defaultVendorId: "V04" },
    { sku: "P011", name: "Gantungan Pakaian 10pc", salesPrice: 55000, cost: 31000, defaultVendorId: "V01" },
    { sku: "P012", name: "Keranjang Laundry", salesPrice: 185000, cost: 120000, defaultVendorId: "V01" },
    { sku: "P013", name: "Sarung Bantal 2pc", salesPrice: 95000, cost: 58000, defaultVendorId: "V03" },
    { sku: "P014", name: "Lap Dapur 3pc", salesPrice: 60000, cost: 34000, defaultVendorId: "V03" },
    { sku: "P015", name: "Stop Kontak 4 Lubang", salesPrice: 160000, cost: 101000, defaultVendorId: "V02" },
    { sku: "P016", name: "Rak Sepatu Lipat", salesPrice: 245000, cost: 155000, defaultVendorId: "V01" },
  ];
  for (const p of products) {
    await prisma.product.upsert({
      where: { sku: p.sku },
      update: p,
      create: p,
    });
  }

  // 4. Seed Warehouses & Opening Stock
  await prisma.warehouse.upsert({
    where: { locationId: "WH" },
    update: {},
    create: { locationId: "WH", name: "WH/JKT/Stock - Gudang utama Jakarta Timur", type: "Pembelian B2B dan stok buffer", city: "Jakarta Timur" },
  });
  await prisma.warehouse.upsert({
    where: { locationId: "SHOP" },
    update: {},
    create: { locationId: "SHOP", name: "SHOP/DPK/Stock - Gerai Depok", type: "Stok jual Point of Sale", city: "Depok" },
  });

  const stocks = [
    { sku: "P001", WH: 20, SHOP: 8 }, { sku: "P002", WH: 6, SHOP: 3 },
    { sku: "P003", WH: 10, SHOP: 5 }, { sku: "P004", WH: 60, SHOP: 30 },
    { sku: "P005", WH: 18, SHOP: 10 }, { sku: "P006", WH: 16, SHOP: 7 },
    { sku: "P007", WH: 25, SHOP: 12 }, { sku: "P008", WH: 12, SHOP: 6 },
    { sku: "P009", WH: 9, SHOP: 4 }, { sku: "P010", WH: 7, SHOP: 3 },
    { sku: "P011", WH: 30, SHOP: 15 }, { sku: "P012", WH: 11, SHOP: 5 },
    { sku: "P013", WH: 20, SHOP: 12 }, { sku: "P014", WH: 24, SHOP: 13 },
    { sku: "P015", WH: 15, SHOP: 8 }, { sku: "P016", WH: 9, SHOP: 4 },
  ];

  for (const s of stocks) {
    await prisma.stock.upsert({
      where: { sku_locationId: { sku: s.sku, locationId: "WH" } },
      update: { qtyOnHand: s.WH },
      create: { sku: s.sku, locationId: "WH", qtyOnHand: s.WH },
    });
    await prisma.stock.upsert({
      where: { sku_locationId: { sku: s.sku, locationId: "SHOP" } },
      update: { qtyOnHand: s.SHOP },
      create: { sku: s.sku, locationId: "SHOP", qtyOnHand: s.SHOP },
    });
  }

  // 5. Existing Documents: Q00031 & PO00018
  const c01 = await prisma.contact.findUnique({ where: { contactId: "C01" } });
  if (c01) {
    const existingQ = await prisma.quotation.findUnique({ where: { docNumber: "Q00031" } });
    if (!existingQ) {
      await prisma.quotation.create({
        data: {
          docNumber: "Q00031",
          customerId: c01.id,
          status: "Draft",
          subtotal: 840000,
          taxAmount: 92400,
          totalAmount: 932400,
          lines: {
            create: [
              { sku: "P001", qty: 4, unitPrice: 120000, subtotal: 480000 },
              { sku: "P003", qty: 2, unitPrice: 180000, subtotal: 360000 },
            ],
          },
        },
      });
    }
  }

  const v01 = await prisma.contact.findUnique({ where: { contactId: "V01" } });
  if (v01) {
    const existingPO = await prisma.purchaseOrder.findUnique({ where: { docNumber: "PO00018" } });
    if (!existingPO) {
      await prisma.purchaseOrder.create({
        data: {
          docNumber: "PO00018",
          vendorId: v01.id,
          status: "Confirmed",
          subtotal: 1670000,
          taxAmount: 183700,
          totalAmount: 1853700,
          lines: {
            create: [
              { sku: "P001", qtyOrdered: 10, unitPrice: 75000, subtotal: 750000 },
              { sku: "P002", qtyOrdered: 4, unitPrice: 230000, subtotal: 920000 },
            ],
          },
        },
      });
    }
  }

  // Receipt untuk PO00018 yang sudah Confirmed (alur Procure-to-Pay)
  const po18 = await prisma.purchaseOrder.findUnique({ where: { docNumber: "PO00018" }, include: { lines: true } });
  if (po18 && po18.status === "Confirmed") {
    const rc = await prisma.receipt.findUnique({ where: { docNumber: "RC00018" } });
    if (!rc) {
      await prisma.receipt.create({
        data: {
          docNumber: "RC00018",
          purchaseOrderId: po18.id,
          status: "Ready",
          lines: { create: po18.lines.map((l) => ({ sku: l.sku, qtyDone: l.qtyOrdered })) },
        },
      });
    }
  }

  console.log("Seeding data awal BERHASIL! Database siap dipakai.");

  // 6. Seed AppUsers (7 akun: 1 superadmin + 6 role)
  const appUsers = [
    {
      email: "superadmin@ruparuang.com",
      username: "superadmin",
      password: "admin123456",
      name: "Super Admin RupaRuang",
      role: "SUPERADMIN",
      access: "dashboard,contacts,crm,inventory,sales,purchase,pos,invoicing,accounting",
    },
    {
      email: "owner@ruparuang.com",
      username: "owner",
      password: "owner123",
      name: "Hendra Wijaya",
      role: "OWNER",
      access: "dashboard,contacts,crm,inventory,sales,purchase,pos,invoicing,accounting",
    },
    {
      email: "sales@ruparuang.com",
      username: "maya.sales",
      password: "sales123",
      name: "Maya Lestari",
      role: "SALES",
      access: "contacts,crm,sales,inventory",
    },
    {
      email: "warehouse@ruparuang.com",
      username: "doni.warehouse",
      password: "warehouse123",
      name: "Doni Saputra",
      role: "WAREHOUSE",
      access: "inventory,purchase",
    },
    {
      email: "finance@ruparuang.com",
      username: "sinta.finance",
      password: "finance123",
      name: "Sinta Rahmawati",
      role: "FINANCE",
      access: "contacts,invoicing,accounting",
    },
    {
      email: "purchasing@ruparuang.com",
      username: "awan.purch",
      password: "purch123",
      name: "Awan Nugraha",
      role: "PURCHASING",
      access: "purchase,contacts",
    },
    {
      email: "cashier@ruparuang.com",
      username: "rina.kasir",
      password: "cashier123",
      name: "Rina Hartati",
      role: "CASHIER",
      access: "pos",
    },
  ];

  for (const u of appUsers) {
    await prisma.appUser.upsert({
      where: { email: u.email },
      update: {
        username: u.username,
        passwordHash: hashPassword(u.password),
        name: u.name,
        role: u.role,
        access: u.access,
        active: true,
      },
      create: {
        email: u.email,
        username: u.username,
        passwordHash: hashPassword(u.password),
        name: u.name,
        role: u.role,
        access: u.access,
        active: true,
      },
    });
    console.log(`  ✓ User seeded: ${u.email} (${u.role})`);
  }

  console.log("\n✅ Seeding SELESAI! 7 akun pengguna + data ERP siap digunakan.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
