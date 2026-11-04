'use client';

import React, { useState } from 'react';
import Link from 'next/link';

export interface PosProductItem {
  sku: string;
  name: string;
  price: number;
  stockQty: number;
  category?: string;
}

export interface PosCartLine {
  sku: string;
  name: string;
  price: number;
  qty: number;
  discountPercent?: number;
}

export interface PosLayoutProps {
  storeName?: string;
  cashierName?: string;
  sessionNumber?: string;
  isOnline?: boolean;
  categories: string[];
  products: PosProductItem[];
  cartLines: PosCartLine[];
  customerName?: string;
  onSelectProduct: (product: PosProductItem) => void;
  onUpdateCartLineQty: (sku: string, delta: number) => void;
  onRemoveCartLine: (sku: string) => void;
  onCheckout: () => void;
  onCloseSession?: () => void;
}

export default function PosLayout({
  storeName = 'Gerai Depok (SHOP)',
  cashierName = 'Kasir Utama',
  sessionNumber = 'SESS-001',
  isOnline = true,
  categories = ['Semua'],
  products = [],
  cartLines = [],
  customerName = 'Pelanggan Umum',
  onSelectProduct,
  onUpdateCartLineQty,
  onRemoveCartLine,
  onCheckout,
  onCloseSession,
}: PosLayoutProps) {
  const [selectedCategory, setSelectedCategory] = useState('Semua');
  const [searchTerm, setSearchTerm] = useState('');

  // Perhitungan Subtotal, Pajak PPN 11%, dan Total
  const subtotal = cartLines.reduce((acc, line) => {
    const disc = (line.discountPercent || 0) / 100;
    return acc + line.price * line.qty * (1 - disc);
  }, 0);
  const tax = subtotal * 0.11;
  const grandTotal = subtotal + tax;

  // Filter Produk
  const filteredProducts = products.filter((p) => {
    const matchCategory =
      selectedCategory === 'Semua' || p.category === selectedCategory;
    const matchSearch =
      searchTerm.trim() === '' ||
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchTerm.toLowerCase());
    return matchCategory && matchSearch;
  });

  return (
    <div className="h-screen flex flex-col bg-slate-900 text-slate-100 overflow-hidden font-sans select-none">
      {/* 1. POS Top Bar */}
      <header className="h-12 bg-slate-800 border-b border-slate-700 px-4 flex items-center justify-between z-20">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="px-2.5 py-1 rounded bg-slate-700 hover:bg-slate-600 text-xs font-semibold text-slate-200 transition-colors flex items-center gap-1.5"
            title="Kembali ke Dashboard Utama"
          >
            <span>←</span>
            <span>Keluar POS</span>
          </Link>
          <div className="h-4 w-px bg-slate-600" />
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm tracking-tight text-white">
              {storeName}
            </span>
            <span className="text-[11px] font-mono text-purple-400 bg-purple-950/60 px-2 py-0.5 rounded border border-purple-800">
              {sessionNumber}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs">
          {/* Status Sync */}
          <div className="flex items-center gap-1.5 bg-slate-900/60 px-2.5 py-1 rounded-full border border-slate-700">
            <span
              className={`w-2 h-2 rounded-full ${
                isOnline ? 'bg-emerald-400' : 'bg-rose-500'
              }`}
            />
            <span className="text-slate-300 font-medium">
              {isOnline ? 'Online Synced' : 'Offline Mode'}
            </span>
          </div>

          {/* Cashier Name */}
          <div className="flex items-center gap-1.5 text-slate-300">
            <span>👤</span>
            <span className="font-semibold">{cashierName}</span>
          </div>

          {/* Close Session Button */}
          {onCloseSession && (
            <button
              type="button"
              onClick={onCloseSession}
              className="bg-rose-600/80 hover:bg-rose-600 text-white font-semibold px-3 py-1 rounded text-xs transition-colors"
            >
              Tutup Sesi
            </button>
          )}
        </div>
      </header>

      {/* 2. Main POS Workspace: Split Screen */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* === SISI KIRI: ORDER CART, SUMMARY & KEYPAD (40% width) === */}
        <section className="w-full md:w-[42%] lg:w-[38%] flex flex-col bg-slate-950 border-r border-slate-800">
          {/* Header Customer */}
          <div className="p-3 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="text-purple-400">👤 Customer:</span>
              <span className="font-bold text-white truncate">{customerName}</span>
            </div>
            <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded font-mono">
              {cartLines.length} Item
            </span>
          </div>

          {/* Cart Lines Scrollable List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {cartLines.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-600 text-xs">
                <span className="text-3xl mb-2">🛒</span>
                <span>Keranjang belanja masih kosong</span>
                <span className="text-[11px] text-slate-500 mt-1">
                  Pilih produk di katalog kanan untuk menambahkan
                </span>
              </div>
            ) : (
              cartLines.map((line) => (
                <div
                  key={line.sku}
                  className="bg-slate-900 border border-slate-800 rounded-lg p-2.5 flex items-center justify-between text-xs hover:border-slate-700 transition-colors"
                >
                  <div className="min-w-0 flex-1 pr-2">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-[10px] text-purple-400">
                        {line.sku}
                      </span>
                      <h4 className="font-semibold text-slate-200 truncate">
                        {line.name}
                      </h4>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {line.qty} x Rp {line.price.toLocaleString('id-ID')}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-slate-100 text-sm">
                      Rp {(line.price * line.qty).toLocaleString('id-ID')}
                    </span>
                    <div className="flex items-center gap-1 bg-slate-800 rounded p-0.5">
                      <button
                        type="button"
                        onClick={() => onUpdateCartLineQty(line.sku, -1)}
                        className="w-5 h-5 rounded bg-slate-700 hover:bg-slate-600 text-white flex items-center justify-center text-xs"
                      >
                        -
                      </button>
                      <span className="w-5 text-center font-bold font-mono">
                        {line.qty}
                      </span>
                      <button
                        type="button"
                        onClick={() => onUpdateCartLineQty(line.sku, 1)}
                        className="w-5 h-5 rounded bg-slate-700 hover:bg-slate-600 text-white flex items-center justify-center text-xs"
                      >
                        +
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemoveCartLine(line.sku)}
                      className="text-slate-500 hover:text-rose-400 p-1"
                      title="Hapus baris"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Subtotal & Ringkasan Pajak */}
          <div className="bg-slate-900 border-t border-slate-800 p-3 text-xs space-y-1">
            <div className="flex justify-between text-slate-400">
              <span>Subtotal</span>
              <span className="font-mono">
                Rp {subtotal.toLocaleString('id-ID')}
              </span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>PPN (11%)</span>
              <span className="font-mono">Rp {tax.toLocaleString('id-ID')}</span>
            </div>
            <div className="flex justify-between text-sm font-extrabold text-white pt-1 border-t border-slate-800">
              <span className="text-purple-300">TOTAL BELANJA</span>
              <span className="text-base font-mono text-emerald-400">
                Rp {grandTotal.toLocaleString('id-ID')}
              </span>
            </div>
          </div>

          {/* Tombol Checkout & Pembayaran Kasir */}
          <div className="p-3 bg-slate-950 border-t border-slate-800">
            <button
              type="button"
              disabled={cartLines.length === 0}
              onClick={onCheckout}
              className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed text-white font-extrabold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 text-sm tracking-wide"
            >
              <span>💳</span>
              <span>BAYAR (PAYMENT)</span>
              <span className="font-mono ml-1">
                Rp {grandTotal.toLocaleString('id-ID')}
              </span>
            </button>
          </div>
        </section>

        {/* === SISI KANAN: KATALOG PRODUK, SEARCH & KATEGORI (60% width) === */}
        <section className="flex-1 flex flex-col bg-slate-900 overflow-hidden">
          {/* Search bar & Category Bar */}
          <div className="p-3 border-b border-slate-800 bg-slate-850 flex flex-col sm:flex-row gap-2.5 items-center justify-between">
            {/* Search Input */}
            <div className="w-full sm:w-72 relative">
              <input
                type="text"
                placeholder="Cari produk (SKU atau nama)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg pl-8 pr-3 py-2 outline-none focus:border-purple-500"
              />
              <span className="absolute left-2.5 top-2 text-slate-400 text-xs">
                🔍
              </span>
            </div>

            {/* Category Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                    selectedCategory === cat
                      ? 'bg-purple-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Product Grid (Touch Cards) */}
          <div className="flex-1 overflow-y-auto p-4">
            {filteredProducts.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-500 text-xs">
                Tidak ada produk yang sesuai dengan pencarian
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {filteredProducts.map((p) => {
                  const isOut = p.stockQty <= 0;
                  return (
                    <button
                      key={p.sku}
                      type="button"
                      disabled={isOut}
                      onClick={() => onSelectProduct(p)}
                      className={`text-left p-3 rounded-xl border flex flex-col justify-between transition-all relative overflow-hidden group ${
                        isOut
                          ? 'bg-slate-850 border-slate-800 opacity-40 cursor-not-allowed'
                          : 'bg-slate-800/90 border-slate-700 hover:border-purple-500 hover:bg-slate-800 active:scale-[0.98]'
                      }`}
                    >
                      <div>
                        <div className="flex justify-between items-start mb-1.5">
                          <span className="font-mono text-[10px] bg-slate-900 text-purple-300 px-1.5 py-0.5 rounded border border-slate-700">
                            {p.sku}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              isOut
                                ? 'bg-red-950 text-red-400'
                                : 'bg-emerald-950 text-emerald-400'
                            }`}
                          >
                            Stok: {p.stockQty}
                          </span>
                        </div>
                        <h4 className="font-bold text-white text-xs leading-snug line-clamp-2 mt-1">
                          {p.name}
                        </h4>
                      </div>

                      <div className="mt-3 pt-2 border-t border-slate-700/60 flex justify-between items-center">
                        <span className="font-extrabold text-emerald-400 text-xs">
                          Rp {p.price.toLocaleString('id-ID')}
                        </span>
                        <span className="text-[11px] text-slate-400 group-hover:text-purple-400">
                          + Tambah
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
