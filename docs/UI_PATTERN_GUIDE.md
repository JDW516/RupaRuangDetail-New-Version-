# RupaRuang Retail ERP — Odoo Web 17.0 UI Pattern & Design System Guide
**Dokumen Standar Desain Antarmuka & Pedoman Implementasi Frontend**  
*Role: UI/UX & Frontend Lead*  
*Target Versi: Odoo Web 17.0 Convention*  
*Tech Stack: Next.js 15 (App Router), React 19, Tailwind CSS v4, Prisma ORM*

---

## 1. Pendahuluan & Filosofi Desain

Aplikasi **RupaRuang Retail ERP** dibangun dengan mengadopsi standar dan konvensi antarmuka **Odoo Web 17.0 Community & Enterprise Edition**. 

Tujuan utama dari pedoman ini adalah:
1. **Konsistensi Visual & Interaksi**: Memastikan seluruh layar (S-01 sampai S-17) memiliki nuansa, perilaku, dan hierarki navigasi yang seragam.
2. **Efisiensi Pengguna ERP**: Memaksimalkan kecepatan entri data, kejelasan alur dokumen bisnis (*state machine*), dan keterbacaan data master/transaksi.
3. **Standarisasi Komponen Tim**: Memberikan acuan konkret bagi seluruh pengembang frontend dalam menyusun komponen modular tanpa redundansi styling.

---

## 2. Design Tokens & Visual Hierarchy (Odoo 17.0)

### 2.1 Palet Warna Utama (Color Tokens)

| Token Nama | Nilai HEX / Tailwind Class | Peruntukan / Konteks |
| :--- | :--- | :--- |
| **Odoo Primary Brand** | `#714B67` / `#71639e` | Navbar Odoo, tombol primary submit, active stage, aksen brand |
| **Odoo Primary Hover** | `#5d3d54` / `#5a4e7e` | Hover state tombol utama |
| **Odoo Secondary / Teal** | `#00A09D` (`#008784`) | Indikator status sukses, aksen action alternasi, POS branding |
| **Canvas Background** | `#F8F9FA` / `bg-slate-50` | Background utama seluruh halaman web ERP |
| **Form Sheet Background**| `#FFFFFF` | Lembar dokumen putih ("Paper Sheet") di atas canvas |
| **Border & Divider** | `#E2E8F0` / `border-slate-200` | Garis pembatas form, card border, tabel row divider |
| **Text Primary** | `#1E293B` / `text-slate-800` | Judul, label field, nomor dokumen, isi teks utama |
| **Text Muted** | `#64748B` / `text-slate-500` | Helper text, breadcrumb parent, secondary detail |

### 2.2 Warna Status Alur Dokumen (*State / Stages*)

| Status | Warna Latar & Teks | Contoh Kasus |
| :--- | :--- | :--- |
| **Draft / New** | Amber/Yellow (`bg-amber-50 text-amber-800 border-amber-300`) | Quotation Draft, PO Baru, RFQ |
| **Confirmed / Sent** | Blue/Sky (`bg-blue-50 text-blue-800 border-blue-300`) | Sales Order Confirmed, PO Terkirim |
| **In Progress / Ready** | Purple/Indigo (`bg-purple-50 text-purple-800 border-purple-300`)| Delivery Ready, Picking |
| **Done / Posted / Paid** | Emerald/Green (`bg-emerald-50 text-emerald-800 border-emerald-300`)| Invoice Posted, Bill Paid, Order Done |
| **Cancelled / Rejected**| Rose/Red (`bg-rose-50 text-rose-800 border-rose-300`) | Order Cancelled, Voided Bill |

---

## 3. Empat Pola Komponen Inti Odoo Web 17.0

### 3.1 App Switcher (Main Launcher)
App Switcher adalah pintu gerbang utama Odoo Web 17.0 untuk navigasi lintas modul ERP.
* **Layout**: Fullscreen overlay atau modal terpusat dengan background soft/clean canvas (`bg-slate-50` atau dark tinted backdrop).
* **Search Bar Cepat**: Input pencarian di bagian atas tengah (*instant search/filter modul berdasarkan ketikan pengguna*).
* **App Icon Grid**: Grid 4 sampai 6 kolom berisi ikon modul persegi membulat (`rounded-2xl` atau `rounded-xl`) dengan ilustrasi warna tematik (Sales: Indigo, Purchase: Emerald, Inventory: Amber, POS: Rose, Invoicing: Teal).
* **Navigasi Cepat**: Menekan tombol App Switcher (ikon 9 titik kotak di pojok kiri atas Navbar) langsung membuka App Switcher dari halaman manapun.

---

### 3.2 Control Panel (Header Pengendali Tampilan)
Control Panel terletak tepat di bawah Main Navigation Bar pada setiap modul ERP, terdiri atas dua baris (atau dua sisi terintegrasi):
1. **Sisi Kiri (Hierarki & Aksi Utama)**:
   * **Breadcrumbs**: Menampilkan hierarki modul dan dokumen aktif (Contoh: `Sales / Orders / SO00031`). Bagian induk dapat diklik untuk kembali ke tampilan daftar (*List View*).
   * **Action Buttons**:
     * `New` / `Create` (Tombol primary warna ungu Odoo untuk membuat record baru).
     * `Save` (Menyimpan form manual/otomatis) & `Discard` (Membatalkan perubahan form).
     * `Actions` Dropdown (Menu dropdown gear/aksi kontekstual: *Duplicate*, *Delete*, *Archive*, *Print*).
2. **Sisi Kanan (Pencarian & Pengalih Tampilan / View Switcher)**:
   * **Search View Input**: Kotak pencarian dengan filter cepat (*Filters*, *Group By*, *Favorites*).
   * **View Switcher Icons**: Tombol ikon pengubah tampilan data:
     * **List View** (Ikon tabel baris)
     * **Kanban View** (Ikon kartu / papan pipeline)
     * **Form View** (Ikon lembar dokumen)
     * **Pivot / Graph View** (Ikon analitik metrik)
   * **Pager**: Navigasi jumlah record (Contoh: `1-80 / 240` dengan panah kiri/kanan `< >`).

---

### 3.3 Form View (Lembar Kerja Transaksi & Master Data)
Form View Odoo 17.0 meniru tata letak lembar kerja fisik yang sangat terstruktur:

```
+-----------------------------------------------------------------------------------+
| CONTROL PANEL (Breadcrumbs: Sales / SO00031  |  [New] [Save] [Discard]  [Actions v]|
+-----------------------------------------------------------------------------------+
| STATUS BAR (State Machine)                                                        |
| [Confirm Order] [Cancel] [Create Invoice]        [ Draft > Confirmed* > Done ]    |
+-----------------------------------------------------------------------------------+
| FORM SHEET ("Paper Sheet Canvas")                                                 |
| +-------------------------------------------------------------------------------+ |
| |                                     [SMART BUTTONS: (1 Delivery) (1 Invoice)] | |
| | (Ribbon: Confirmed / Paid)                                                    | |
| |                                                                               | |
| | H1: SO00031 (Document Number / Name)                                          | |
| |                                                                               | |
| | [2-Column Metadata Grid]                                                      | |
| | Customer: [ PT Kantor Sentosa   ]      Order Date:     [ 03/11/2026         ] | |
| | Invoice Address: [ Jl. Sudirman ]      Payment Terms:  [ PT-14 (14 Hari)    ] | |
| |                                                                               | |
| | NOTEBOOK TABS: [ Order Lines ] [ Optional Products ] [ Other Info ] [ Notes ] | |
| | ----------------------------------------------------------------------------- | |
| | Product           | Quantity | Unit Price   | Taxes    | Subtotal             | |
| | [P001] Kotak 20L  | 4        | Rp 120.000   | PPN 11%  | Rp 480.000           | |
| | [P003] Lampu LED  | 2        | Rp 180.000   | PPN 11%  | Rp 360.000           | |
| | [Add a line]                                                                  | |
| | ----------------------------------------------------------------------------- | |
| |                                         Untaxed Amount:          Rp 840.000   | |
| |                                         Taxes (11%):              Rp 92.400   | |
| |                                         Total:                   Rp 932.400   | |
| +-------------------------------------------------------------------------------+ |
+-----------------------------------------------------------------------------------+
| CHATTER & AUDIT TRAIL (Send message | Log note | Activities)                      |
+-----------------------------------------------------------------------------------+
```

#### Anatomi Khusus Form View:
1. **Status Bar (`FormStatusBar`)**:
   * **Workflow Buttons (Kiri)**: Tombol aksi status berikutnya (misal `Confirm`, `Create Invoice`, `Send by Email`, `Cancel`).
   * **Stage Tracker / Status Pills (Kanan)**: Rantai tahap dokumen yang berbentuk panah *chevron* atau *pills* bersambung. Status saat ini disorot dengan warna primer dan tanda tebal.
2. **Form Sheet (`FormSheet`)**:
   * Kontainer kertas putih di tengah dengan elevasi halus (`bg-white shadow-sm border border-slate-200 rounded-lg p-6 max-w-6xl mx-auto`).
   * **Smart Buttons Box (Kanan Atas)**: Kotak tombol statistik (*stat buttons*) yang menampilkan counter dokumen relasional (contoh: *1 Delivery*, *1 Invoice*, *16 Products On Hand*). Saat diklik, langsung membuka dokumen relasi terkait.
   * **Ribbon Status**: Pita diagonal atau label badge di pojok atas (misal badge `CONFIRMED` warna hijau atau `ARCHIVED`).
   * **Title & Subtitle**: Judul dokumen besar dengan font tebal dan field label yang jelas.
3. **Form Notebook (`FormNotebook`)**:
   * Navigasi tab untuk memisahkan tabel rincian item transaksi (`Order Lines`), detail pengiriman/faktur (`Other Info`), dan catatan internal (`Customer Notes`).

---

### 3.4 Point of Sale (POS) Layout
Khusus modul Kasir Gerai (Point of Sale), Odoo 17 menerapkan layout *touch-first full-viewport*:

```
+-----------------------------------------------------------------------------------+
| POS TOPBAR: [Exit POS] | Gerai Depok (SHOP) | Kasir: Budi | [Sync: Online] [Close]|
+-------------------------------------------+---------------------------------------+
| LEFT PANEL: ORDER CART & NUMPAD (40%)     | RIGHT PANEL: PRODUCT CATALOG (60%)    |
| +---------------------------------------+ | +-----------------------------------+ |
| | Active Order Lines:                   | | | [ Search Products (SKU / Name) ]  | |
| | - 2x Kotak Simpan 20L     Rp 240.000  | | +-----------------------------------+ |
| | - 1x Lampu Meja LED       Rp 180.000  | | Category Pills:                     | |
| |                                       | | [All] [Plastik] [Elektrik] [Dapur]  | |
| +---------------------------------------+ | +-----------------------------------+ |
| | Customer: [ PT Kantor Sentosa   ] [v] | | Product Cards Grid:                 | |
| +---------------------------------------+ | | +------------+  +------------+    | |
| | Subtotal:                  Rp 420.000 | | | [P001]       |  | [P003]       |    | |
| | PPN (11%):                  Rp 46.200 | | | Kotak 20L    |  | Lampu LED    |    | |
| | TOTAL:                     Rp 466.200 | | | Rp 120.000   |  | Rp 180.000   |    | |
| +---------------------------------------+ | | [Stok: 8]    |  | [Stok: 5]    |    | |
| | NUMPAD / KEYPAD TOUCH:                | | +------------+  +------------+    | |
| | [ 1 ] [ 2 ] [ 3 ] [ Qty   ]           | | +------------+  +------------+    | |
| | [ 4 ] [ 5 ] [ 6 ] [ Disc% ]           | | | [P007]       |  | [P015]       |    | |
| | [ 7 ] [ 8 ] [ 9 ] [ Price ]           | | | Botol 1L     |  | Stop Kontak  |    | |
| | [ +/-] [ 0 ] [ . ] [ Back ]           | | | Rp 85.000    |  | Rp 160.000   |    | |
| +---------------------------------------+ | +------------+  +------------+    | |
| | [   PAYMENT (BAYAR) -> Rp 466.200   ] | |                                     | |
| +---------------------------------------+ +---------------------------------------+
```

* **Touch-Friendly & Responsif**: Tombol berukuran minimal 44px dengan target sentuhan jari yang nyaman.
* **Dual Action Flow**:
  1. Klik kartu produk di sisi kanan langsung menambahkan item ke keranjang di sisi kiri.
  2. Numpad mengontrol kuantitas (*Qty*), diskon (*Disc%*), atau penyesuaian harga (*Price*).
* **Payment Modal View**: Memilih metode bayar (*Cash*, *Bank Transfer*, *QRIS*) dan menghitung uang kembalian secara otomatis.

---

## 4. Pemetaan Wireframe S-01 sampai S-17

Berikut pemetaan lengkap wireframe sistem **RupaRuang Retail ERP** terhadap komponen dan pola Odoo 17.0:

| ID Screen | Nama Layar & Fitur | Pola Layout Odoo 17.0 | Komponen Utama yang Digunakan |
| :--- | :--- | :--- | :--- |
| **S-01** | App Switcher / Main Launcher | **App Switcher Grid** | `AppSwitcherModal`, Quick Search Input, App Icon Grid |
| **S-02** | Master Contacts (Customer & Vendor) | **List View & Form View** | `ControlPanel`, Contact Sheet, Tagging Type (`BUSINESS`/`INDIVIDUAL`/`VENDOR`) |
| **S-03** | CRM Pipeline (Peluang Penjualan) | **Kanban View** | `ControlPanel`, Kanban Columns by Stage (*New, Qualified, Won*), Deal Cards |
| **S-04** | Form Lead / Opportunity | **Form View Standard** | `FormStatusBar` (Stage Pipeline), `FormSheet`, Revenue & Probability Fields |
| **S-05** | Sales Quotation (Q00031) | **Form View (Draft)** | `FormStatusBar` (*Confirm to SO*), `FormNotebook` (*Order Lines*), Subtotal Summary |
| **S-06** | Sales Order (SO00031) | **Form View (Confirmed)** | `FormStatusBar`, `SmartButtons` (*Delivery, Invoices*), `FormNotebook` |
| **S-07** | Delivery Order / Surat Jalan | **Form View (Stock Picking)**| `FormStatusBar` (*Check Availability, Validate*), Lines with Qty Done |
| **S-08** | Inventory On-Hand & Warehouses | **List & Kanban View** | `ControlPanel` with Warehouse Filter (`WH` vs `SHOP`), Stock Badge Indicators |
| **S-09** | Purchase Order (PO00018) | **Form View (RFQ/PO)** | `FormStatusBar` (*Confirm Order*), `SmartButtons` (*Receipts, Vendor Bills*), Lines |
| **S-10** | Goods Receipt (Penerimaan Barang)| **Form View (Receipt)** | `FormStatusBar` (*Receive Products, Validate*), Qty Received matching |
| **S-11** | Customer Invoice (Faktur Jual) | **Form View (Invoicing)** | `FormStatusBar` (*Confirm, Register Payment*), `SmartButtons` (*Payment Info*), Lines |
| **S-12** | Vendor Bill (Tagihan Pembelian)| **Form View (Accounting)**| `FormStatusBar` (*Post, Register Payment*), Auto-Account matching |
| **S-13** | Register Payment Modal | **Popup Modal Wizard** | Modal Dialog, Payment Journal (`Bank`/`Cash`), Amount & Payment Date |
| **S-14** | Journal Entries (Jurnal Umum) | **Form View (Accounting)**| `FormStatusBar` (*Draft / Posted*), Debit-Credit Balanced Table Grid |
| **S-15** | POS Cashier Workspace | **POS Layout Touchscreen**| `PosLayout`, Topbar Gerai, Left Cart & Numpad, Right Category & Product Grid |
| **S-16** | POS Closing Session & Cash Count | **Popup Modal Dialog** | Cash Drawer Counting, Expected vs Counted Balance, Variance Reason |
| **S-17** | Executive Management Dashboard | **Dashboard / Graph View** | Metric KPI Cards, Revenue Chart, Low Stock Alerts, Quick Shortcuts |

---

## 5. Standar Kode & Pedoman Arsitektur Komponen

Semua komponen layout Odoo diletakkan di dalam folder `components/odoo/`:

1. `AppNavbar.tsx`: Navbar global atas dengan tombol App Switcher, nama modul saat ini, company indicator, dan profil pengguna.
2. `AppSwitcherModal.tsx`: Tampilan fullscreen/modal peluncur 9 modul RupaRuang ERP.
3. `ControlPanel.tsx`: Kontrol breadcrumb, tombol create/save/discard/action, input filter, dan view switcher.
4. `FormStatusBar.tsx`: Status bar workflow tombol di kiri dan stage progress pill/chevron di kanan.
5. `FormSheet.tsx`: Kontainer kertas form putih lengkap dengan title dan grid informasi metadata.
6. `SmartButtons.tsx`: Kontainer dan tombol statistik di pojok kanan atas form sheet.
7. `FormNotebook.tsx`: Komponen tab notebook untuk rincian baris transaksi (lines).
8. `PosLayout.tsx`: Kerangka tata letak khusus kasir POS dengan interaksi touch-screen.
9. `OdooAppLayout.tsx`: Template master terpadu yang memadukan Navbar, Control Panel, dan Canvas konten.

---
*Dokumen ini merupakan panduan resmi tim RupaRuang Retail ERP. Setiap pengembangan modul baru wajib mengacu pada standar komponen di atas.*
