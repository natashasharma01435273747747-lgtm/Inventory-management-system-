import React, { useMemo, useState } from 'react';
import {
  PackagePlus,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import type { ProductInput } from '../api/client.ts';
import type { Product, ProductCategory } from '../types/store.ts';
import { PRODUCT_CATEGORIES } from '../types/store.ts';
import {
  formatInr,
  formatShortDate,
  getExpiryStatus,
  isExpiringSoon,
  isLowStock,
} from '../utils/storeMetrics.ts';
import { ProductModal } from './ProductModal.tsx';
import { ProductPackThumbnail } from './ProductPackThumbnail.tsx';

interface InventoryManagerProps {
  products: Product[];
  onAddProduct: (input: ProductInput) => Promise<void>;
  onUpdateProduct: (id: string, input: ProductInput) => Promise<void>;
  onDeleteProduct: (id: string) => Promise<void>;
  onRestockProduct: (id: string, quantity: number) => Promise<void>;
}

type HealthFilter = 'All' | 'Low Stock' | 'Expiring Soon';

export const InventoryManager: React.FC<InventoryManagerProps> = ({
  products,
  onAddProduct,
  onUpdateProduct,
  onDeleteProduct,
  onRestockProduct,
}) => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'All' | ProductCategory>('All');
  const [healthFilter, setHealthFilter] = useState<HealthFilter>('All');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = Array.isArray(products) ? products : [];
    return list.filter((p) => {
      if (!p) return false;
      if (selectedCategory !== 'All' && p.category !== selectedCategory) return false;
      if (healthFilter === 'Low Stock' && !isLowStock(p)) return false;
      if (healthFilter === 'Expiring Soon' && !isExpiringSoon(p, 14)) return false;
      if (!q) return true;
      return (
        (p.name ?? '').toLowerCase().includes(q) ||
        (p.sku ?? '').toLowerCase().includes(q) ||
        (p.supplier ?? '').toLowerCase().includes(q) ||
        (p.category ?? '').toLowerCase().includes(q)
      );
    });
  }, [products, search, selectedCategory, healthFilter]);

  const handleSave = async (input: ProductInput, editingId?: string) => {
    if (editingId) {
      await onUpdateProduct(editingId, input);
      setFeedback(`Updated ${input.name}.`);
    } else {
      await onAddProduct(input);
      setFeedback(`Added ${input.name} to inventory.`);
    }
  };

  const handleDelete = async (product: Product) => {
    setBusyId(product.id);
    try {
      await onDeleteProduct(product.id);
      setConfirmDeleteId(null);
      setFeedback(`Removed ${product.name} from catalog.`);
    } finally {
      setBusyId(null);
    }
  };

  const handleQuickAddStock = async (product: Product) => {
    setBusyId(product.id);
    try {
      const qty = Math.max(10, product.minStock);
      await onRestockProduct(product.id, qty);
      setFeedback(`Restocked +${qty} units of ${product.name}.`);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-5">
      {feedback && (
        <div className="rounded-lg border border-teal-200 bg-teal-50/70 px-4 py-2.5 text-sm text-teal-900 flex items-center justify-between">
          <span>{feedback}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-xs font-medium text-teal-700 hover:text-teal-900 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Controls Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products, category, or supplier..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-teal-600"
            />
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              {(['All', 'Low Stock', 'Expiring Soon'] as HealthFilter[]).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setHealthFilter(opt)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                    healthFilter === opt
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => {
                setEditingProduct(null);
                setModalOpen(true);
              }}
              className="px-4 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-sm font-medium flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Add Product</span>
            </button>
          </div>
        </div>

        {/* Category Filter Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
          {(['All', ...PRODUCT_CATEGORIES] as const).map((cat) => {
            const count =
              cat === 'All'
                ? products.length
                : products.filter((p) => p.category === cat).length;
            const active = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                {cat} <span className="opacity-70 font-mono tabular-nums ml-1">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Products Data Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-xs text-slate-500">
                <th className="py-3 px-5 text-left font-medium">Product</th>
                <th className="py-3 px-4 text-left font-medium">Category</th>
                <th className="py-3 px-4 text-right font-medium">Price / Cost</th>
                <th className="py-3 px-4 text-right font-medium">Stock</th>
                <th className="py-3 px-4 text-left font-medium">Expiry</th>
                <th className="py-3 px-4 text-left font-medium">Supplier</th>
                <th className="py-3 px-5 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-sm text-slate-500">
                    No products match the current search or category filters.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const low = isLowStock(p);
                  const exp = getExpiryStatus(p.expiryDate);
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/60">
                      <td className="py-3 px-5">
                        <div className="flex items-center gap-3">
                          <ProductPackThumbnail
                            product={p}
                            compact
                            className="w-11 h-11"
                          />
                          <div className="min-w-0">
                            <p className="font-medium text-slate-900">{p.name}</p>
                            <p className="text-xs text-slate-500">{p.unit}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                        {p.category}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums whitespace-nowrap">
                        <span className="font-medium text-slate-900">{formatInr(p.price)}</span>
                        <span className="block text-xs text-slate-500">
                          Cost {formatInr(p.costPrice)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums whitespace-nowrap">
                        <span
                          className={`font-semibold ${
                            p.stock === 0
                              ? 'text-red-600'
                              : low
                                ? 'text-amber-700'
                                : 'text-slate-900'
                          }`}
                        >
                          {p.stock}
                        </span>
                        <span className="block text-xs text-slate-500">
                          {p.stock === 0
                            ? 'Out of stock'
                            : low
                              ? `Low (min ${p.minStock})`
                              : `Min ${p.minStock}`}
                        </span>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="block font-mono tabular-nums text-xs text-slate-800">
                          {formatShortDate(p.expiryDate)}
                        </span>
                        <span
                          className={`text-xs font-medium ${
                            exp.severity === 'expired' || exp.severity === 'critical'
                              ? 'text-red-600'
                              : exp.severity === 'warning'
                                ? 'text-amber-700'
                                : 'text-emerald-700'
                          }`}
                        >
                          {exp.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600 max-w-[180px] truncate">
                        {p.supplier}
                      </td>
                      <td className="py-3 px-5 text-right whitespace-nowrap">
                        {confirmDeleteId === p.id ? (
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              disabled={busyId === p.id}
                              onClick={() => handleDelete(p)}
                              className="px-2.5 py-1 rounded-md bg-red-600 hover:bg-red-700 text-white text-xs font-medium cursor-pointer"
                            >
                              Confirm
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-2 py-1 rounded-md border border-slate-300 text-xs text-slate-600 hover:bg-slate-50 cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              disabled={busyId === p.id}
                              onClick={() => handleQuickAddStock(p)}
                              title={`Restock +${Math.max(10, p.minStock)} units`}
                              className="p-2 rounded-lg text-slate-500 hover:text-teal-700 hover:bg-teal-50 transition-colors cursor-pointer"
                            >
                              <PackagePlus className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingProduct(p);
                                setModalOpen(true);
                              }}
                              title="Edit product"
                              className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(p.id)}
                              title="Delete product"
                              className="p-2 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ProductModal
        isOpen={modalOpen}
        editingProduct={editingProduct}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
      />
    </div>
  );
};
