import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  LogIn,
  RefreshCw,
  Search,
  Store,
  X,
  XCircle,
} from 'lucide-react';
import { fetchPublicCatalog } from '../api/client.ts';
import type {
  ProductCategory,
  PublicCatalogProduct,
} from '../types/store.ts';
import { PRODUCT_CATEGORIES } from '../types/store.ts';
import { formatInr } from '../utils/storeMetrics.ts';

interface CustomerCatalogPageProps {
  onBackToLogin: () => void;
}

export const CustomerCatalogPage: React.FC<CustomerCatalogPageProps> = ({
  onBackToLogin,
}) => {
  const [storeName, setStoreName] = useState('Shree Ganesh General Store');
  const [products, setProducts] = useState<PublicCatalogProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'All' | ProductCategory>('All');
  const [availableOnly, setAvailableOnly] = useState(false);

  const loadCatalog = useCallback(async (isBackground = false) => {
    if (isBackground) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      const data = await fetchPublicCatalog();
      setStoreName(data.storeName);
      setProducts(data.products);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load store product availability right now.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadCatalog(false);

    // Live sync with store inventory (polling every 5s + on window focus)
    const interval = window.setInterval(() => {
      loadCatalog(true);
    }, 5000);

    const handleFocus = () => loadCatalog(true);
    window.addEventListener('focus', handleFocus);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [loadCatalog]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = Array.isArray(products) ? products : [];
    return list.filter((p) => {
      if (!p) return false;
      if (selectedCategory !== 'All' && p.category !== selectedCategory) return false;
      if (availableOnly && !p.available) return false;
      if (!q) return true;
      return (
        (p.name ?? '').toLowerCase().includes(q) ||
        (p.category ?? '').toLowerCase().includes(q) ||
        (p.unit ?? '').toLowerCase().includes(q)
      );
    });
  }, [products, search, selectedCategory, availableOnly]);

  const availableCount = useMemo(
    () => products.filter((p) => p.available).length,
    [products]
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col">
      {/* Clean Public Header */}
      <header className="sticky top-0 z-20 bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-teal-700 text-white flex items-center justify-center shrink-0">
              <Store className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="font-display text-sm sm:text-base font-bold text-slate-900 truncate">
                {storeName}
              </p>
              <p className="text-xs text-slate-500 truncate">
                Live Product Availability
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => loadCatalog(true)}
              disabled={refreshing}
              aria-label="Refresh product availability"
              className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onBackToLogin}
              className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Staff Login</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Catalog Content */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-5">
        {/* Search & Filter Panel */}
        <section className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h1 className="font-display text-lg sm:text-xl font-bold text-slate-900">
                Check Store Product Availability
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Live shelf status and MRP prices ·{' '}
                <span className="font-mono tabular-nums text-slate-700">
                  {availableCount} of {products.length} items currently available
                </span>
              </p>
            </div>
          </div>

          {/* Fast Search Bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products like Maggi, Tata Salt, Milk..."
              className="w-full pl-10 pr-9 py-3 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Category Filter Pills & Available Only Toggle */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              {(['All', ...PRODUCT_CATEGORIES] as const).map((cat) => {
                const active = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      active
                        ? 'bg-teal-700 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={availableOnly}
              onClick={() => setAvailableOnly((prev) => !prev)}
              className="inline-flex items-center gap-2.5 self-start sm:self-auto text-xs font-medium text-slate-700 cursor-pointer whitespace-nowrap shrink-0"
            >
              <span
                className={`w-9 h-5 rounded-full transition-colors flex items-center px-0.5 ${
                  availableOnly ? 'bg-teal-700' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`w-4 h-4 rounded-full bg-white transition-transform ${
                    availableOnly ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </span>
              <span>Available Only</span>
            </button>
          </div>
        </section>

        {/* Error State */}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center justify-between gap-3">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => loadCatalog(false)}
              className="px-3 py-1 rounded-md bg-red-700 text-white text-xs font-medium cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading Skeleton */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {[1, 2, 3, 4, 5, 6].map((k) => (
              <div
                key={k}
                className="h-28 bg-white border border-slate-200 rounded-xl animate-pulse"
              />
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
            <p className="text-sm font-semibold text-slate-900">
              No matching products found
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Try a different product name or reset your category and availability filters.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setSelectedCategory('All');
                setAvailableOnly(false);
              }}
              className="mt-4 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium cursor-pointer"
            >
              Show All Products
            </button>
          </div>
        ) : (
          /* Customer-Safe Product Grid: Name, Category, Price (₹), Available / Out of Stock */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {filteredProducts.map((product) => (
              <article
                key={product.id}
                className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between gap-3"
              >
                <div className="space-y-1">
                  <p className="text-xs font-medium text-slate-500">
                    {product.category}
                  </p>
                  <h2 className="font-display text-sm sm:text-base font-semibold text-slate-900 leading-snug">
                    {product.name}
                  </h2>
                  <p className="text-xs text-slate-500">{product.unit}</p>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                  <span className="font-mono tabular-nums text-lg font-bold text-slate-900">
                    {formatInr(product.price)}
                  </span>

                  {product.available ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold whitespace-nowrap">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span>Available</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-50 border border-red-200 text-red-700 text-xs font-semibold whitespace-nowrap">
                      <XCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>Out of Stock</span>
                    </span>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};
