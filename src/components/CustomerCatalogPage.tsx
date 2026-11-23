import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Cookie,
  CupSoda,
  Droplets,
  LayoutGrid,
  LogIn,
  Milk,
  RefreshCw,
  Search,
  ShoppingBasket,
  Store,
  X,
  XCircle,
} from 'lucide-react';
import {
  fetchPublicCatalog,
  getLocalPublicCatalogSnapshot,
} from '../api/client.ts';
import type {
  ProductCategory,
  PublicCatalogProduct,
} from '../types/store.ts';
import { PRODUCT_CATEGORIES } from '../types/store.ts';
import { formatInr } from '../utils/storeMetrics.ts';
import { ProductPackThumbnail } from './ProductPackThumbnail.tsx';

interface CustomerCatalogPageProps {
  onBackToLogin: () => void;
}

type CategoryFilterKey = 'All' | ProductCategory;

const CATEGORY_PILL_STYLES: Record<
  CategoryFilterKey,
  {
    active: string;
    inactive: string;
    iconColor: string;
  }
> = {
  All: {
    active: 'bg-[#0052FF] text-white border-[#0052FF] shadow-sm shadow-[#0052FF]/25',
    inactive: 'bg-blue-50/80 text-blue-800 border-blue-100 hover:bg-blue-100/80',
    iconColor: 'text-[#0052FF]',
  },
  Grocery: {
    active: 'bg-amber-600 text-white border-amber-600 shadow-sm shadow-amber-600/25',
    inactive: 'bg-amber-50/80 text-amber-900 border-amber-100 hover:bg-amber-100/80',
    iconColor: 'text-amber-600',
  },
  Snacks: {
    active: 'bg-rose-600 text-white border-rose-600 shadow-sm shadow-rose-600/25',
    inactive: 'bg-rose-50/80 text-rose-900 border-rose-100 hover:bg-rose-100/80',
    iconColor: 'text-rose-600',
  },
  Drinks: {
    active: 'bg-sky-600 text-white border-sky-600 shadow-sm shadow-sky-600/25',
    inactive: 'bg-sky-50/80 text-sky-900 border-sky-100 hover:bg-sky-100/80',
    iconColor: 'text-sky-600',
  },
  Dairy: {
    active: 'bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-600/25',
    inactive: 'bg-indigo-50/80 text-indigo-900 border-indigo-100 hover:bg-indigo-100/80',
    iconColor: 'text-indigo-600',
  },
  'Personal Care': {
    active: 'bg-emerald-600 text-white border-emerald-600 shadow-sm shadow-emerald-600/25',
    inactive: 'bg-emerald-50/80 text-emerald-900 border-emerald-100 hover:bg-emerald-100/80',
    iconColor: 'text-emerald-600',
  },
};

const CategoryPillIcon: React.FC<{ category: CategoryFilterKey; active: boolean }> = ({
  category,
  active,
}) => {
  const cls = `w-3.5 h-3.5 shrink-0 ${active ? 'text-white' : CATEGORY_PILL_STYLES[category].iconColor}`;
  switch (category) {
    case 'All':
      return <LayoutGrid className={cls} />;
    case 'Grocery':
      return <ShoppingBasket className={cls} />;
    case 'Snacks':
      return <Cookie className={cls} />;
    case 'Drinks':
      return <CupSoda className={cls} />;
    case 'Dairy':
      return <Milk className={cls} />;
    case 'Personal Care':
      return <Droplets className={cls} />;
  }
};

export const CustomerCatalogPage: React.FC<CustomerCatalogPageProps> = ({
  onBackToLogin,
}) => {
  // Pre-seed immediately from localStorage so secondary phones / static Vercel never see a blank page or 404
  const [initialSnapshot] = useState(() => getLocalPublicCatalogSnapshot());
  const [storeName, setStoreName] = useState(initialSnapshot.storeName);
  const [products, setProducts] = useState<PublicCatalogProduct[]>(
    initialSnapshot.products
  );
  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilterKey>('All');
  const [availableOnly, setAvailableOnly] = useState(false);

  const loadCatalog = useCallback(async (isManual = false) => {
    if (isManual) {
      setRefreshing(true);
    }
    try {
      const data = await fetchPublicCatalog();
      if (data && Array.isArray(data.products) && data.products.length > 0) {
        setStoreName(data.storeName || 'Shree Ganesh General Store');
        setProducts(data.products);
      }
    } catch {
      // Keep pre-seeded local catalog visible without interrupting customer browsing
      const localFallback = getLocalPublicCatalogSnapshot();
      setStoreName(localFallback.storeName);
      setProducts(localFallback.products);
    } finally {
      if (isManual) {
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    loadCatalog(false);

    // Live sync with store inventory (polling every 5s + on window focus)
    const interval = window.setInterval(() => {
      loadCatalog(false);
    }, 5000);

    const handleFocus = () => loadCatalog(false);
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
    <div className="min-h-screen bg-gradient-to-b from-[#EDF3FF] via-[#F4F7FF] to-[#F8FAFC] flex flex-col">
      {/* High-Fidelity Royal Blue Gradient App Header */}
      <header className="sticky top-0 z-20 bg-gradient-to-r from-[#0052FF] via-[#0B5FFF] to-[#1D6BFF] text-white shadow-md shadow-[#0052FF]/15">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/95 ring-2 ring-emerald-300/40 text-white flex items-center justify-center shrink-0 shadow-sm">
              <Store className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="font-display text-sm sm:text-base font-bold text-white truncate leading-tight">
                {storeName}
              </h1>
              <p className="text-xs text-blue-100/95 truncate">
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
              title="Refresh availability"
              className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 border border-white/20 text-white flex items-center justify-center transition-colors cursor-pointer disabled:opacity-60"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onBackToLogin}
              className="px-3.5 py-2 rounded-full bg-white/15 hover:bg-white/25 border border-white/25 text-white text-xs font-semibold inline-flex items-center gap-1.5 backdrop-blur-xs transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Staff Login</span>
            </button>
          </div>
        </div>
      </header>

      {/* Subtle Blue Status Strip Connected Below Header */}
      <div className="bg-gradient-to-r from-[#0052FF] via-[#0B5FFF] to-[#1D6BFF] text-blue-50 pb-5 pt-1 rounded-b-3xl shadow-sm shadow-[#0052FF]/10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <p className="text-xs sm:text-sm text-blue-50/95 font-medium">
            Live shelf status and prices ·{' '}
            <span className="font-mono tabular-nums font-semibold text-white">
              {availableCount} of {products.length}
            </span>{' '}
            items currently available
          </p>
        </div>
      </div>

      {/* Main Catalog Content */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 -mt-3 pb-10 space-y-4">
        {/* Search Bar & Colorful Category Filter Panel */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 sm:p-5 space-y-3.5">
          {/* Rounded White Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products like Maggi, Tata Salt, Milk..."
              className="w-full pl-11 pr-10 py-3 text-sm bg-white border border-slate-200 rounded-full text-slate-900 placeholder:text-slate-400 shadow-xs focus:outline-none focus:border-[#0052FF] focus:ring-2 focus:ring-[#0052FF]/15 transition-colors"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Swipeable Colorful Category Pills & Green Available Only Toggle */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 -mx-1 px-1">
              {(['All', ...PRODUCT_CATEGORIES] as const).map((cat) => {
                const active = selectedCategory === cat;
                const styles = CATEGORY_PILL_STYLES[cat];
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3.5 py-2 rounded-full border text-xs font-semibold inline-flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                      active ? styles.active : styles.inactive
                    }`}
                  >
                    <CategoryPillIcon category={cat} active={active} />
                    <span>{cat}</span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={availableOnly}
              onClick={() => setAvailableOnly((prev) => !prev)}
              className="inline-flex items-center gap-2.5 self-start sm:self-auto text-xs font-semibold text-slate-700 cursor-pointer whitespace-nowrap shrink-0 py-1"
            >
              <span
                className={`w-10 h-5.5 rounded-full transition-colors flex items-center px-0.5 ${
                  availableOnly ? 'bg-emerald-500' : 'bg-slate-200'
                }`}
              >
                <span
                  className={`w-4.5 h-4.5 rounded-full bg-white shadow-xs transition-transform ${
                    availableOnly ? 'translate-x-4.5' : 'translate-x-0'
                  }`}
                />
              </span>
              <span className={availableOnly ? 'text-emerald-700' : 'text-slate-600'}>
                Available Only
              </span>
            </button>
          </div>
        </section>

        {/* Empty State */}
        {filteredProducts.length === 0 ? (
          <div className="bg-white border border-slate-100 shadow-sm rounded-2xl p-10 text-center">
            <p className="font-display text-sm sm:text-base font-bold text-slate-900">
              No matching products found
            </p>
            <p className="mt-1 text-xs sm:text-sm text-slate-500">
              Try a different product name or reset your category and availability filters.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setSelectedCategory('All');
                setAvailableOnly(false);
              }}
              className="mt-4 px-4 py-2 rounded-full bg-[#0052FF] hover:bg-[#0044D6] text-white text-xs font-semibold cursor-pointer transition-colors"
            >
              Show All Products
            </button>
          </div>
        ) : (
          /* Customer-Safe Product Cards with Real Pack Photography */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            {filteredProducts.map((product) => (
              <article
                key={product.id}
                className="rounded-2xl shadow-sm bg-white border border-slate-100 p-3.5 sm:p-4 flex items-center gap-3.5 sm:gap-4 hover:shadow-md hover:border-blue-100 transition-all"
              >
                {/* Left: Real Photographic Pack Cutout */}
                <ProductPackThumbnail
                  product={product}
                  className="w-20 h-20 sm:w-22 sm:h-22"
                />

                {/* Right: Category, Product Name, Weight, Price & Capsule Status */}
                <div className="flex-1 min-w-0 flex flex-col justify-between self-stretch py-0.5">
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium text-slate-400 leading-tight">
                      {product.category}
                    </p>
                    <h2 className="font-display text-sm sm:text-base font-bold text-slate-900 leading-snug mt-0.5 line-clamp-2">
                      {product.name}
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5 truncate">
                      {product.unit}
                    </p>
                  </div>

                  <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                    <span className="font-mono tabular-nums text-lg sm:text-xl font-extrabold text-slate-900">
                      {formatInr(product.price)}
                    </span>

                    {product.available ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold whitespace-nowrap shrink-0">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        <span>Available</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 border border-red-200 text-red-700 text-xs font-semibold whitespace-nowrap shrink-0">
                        <XCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>Out of Stock</span>
                      </span>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};
