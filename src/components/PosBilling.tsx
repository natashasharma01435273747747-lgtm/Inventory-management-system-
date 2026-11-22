import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  Check,
  ChevronDown,
  LayoutGrid,
  Minus,
  MoreHorizontal,
  Plus,
  Receipt,
  Search,
  ShoppingCart,
  SlidersHorizontal,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import type { CreateSaleInput } from '../api/client.ts';
import type {
  PaymentMethod,
  Product,
  ProductCategory,
  SaleRecord,
} from '../types/store.ts';
import {
  formatInr,
  getSafeDiscount,
  getSafeMrp,
  isLowStock,
  normalizeProduct,
} from '../utils/storeMetrics.ts';
import { ProductPackThumbnail } from './ProductPackThumbnail.tsx';

interface PosBillingProps {
  products: Product[];
  onGenerateBill: (input: CreateSaleInput) => Promise<SaleRecord>;
  onViewReceipt: (sale: SaleRecord) => void;
}

interface CartEntry {
  product: Product;
  quantity: number;
}

type CategoryTileKey = 'All' | ProductCategory;
type QuickFilterMode = 'all' | 'in_stock' | 'low_stock' | 'favorites';

const CategoryTileIcon: React.FC<{ id: CategoryTileKey; active: boolean }> = ({
  id,
  active,
}) => {
  if (id === 'All') {
    return (
      <LayoutGrid
        className={`w-6 h-6 ${active ? 'text-white' : 'text-[#0052FF]'}`}
        strokeWidth={2}
      />
    );
  }
  if (id === 'Grocery') {
    return (
      <ShoppingCart
        className={`w-6 h-6 ${active ? 'text-white' : 'text-[#0F1F4B]'}`}
        strokeWidth={2.1}
      />
    );
  }
  if (id === 'Snacks') {
    return (
      <svg viewBox="0 0 28 28" className="w-6 h-6" aria-hidden="true">
        <rect
          x="6"
          y="4"
          width="16"
          height="20"
          rx="3"
          fill={active ? '#FFFFFF' : '#DC2626'}
        />
        <rect
          x="6"
          y="4"
          width="16"
          height="3.5"
          rx="1"
          fill={active ? '#DBEAFE' : '#F59E0B'}
        />
        <rect
          x="6"
          y="20.5"
          width="16"
          height="3.5"
          rx="1"
          fill={active ? '#DBEAFE' : '#F59E0B'}
        />
        <circle
          cx="14"
          cy="14"
          r="4.2"
          fill={active ? '#0052FF' : '#FACC15'}
        />
      </svg>
    );
  }
  if (id === 'Drinks') {
    return (
      <svg viewBox="0 0 28 28" className="w-6 h-6" aria-hidden="true">
        <path
          d="M16 3 L19 3 L16 9"
          stroke={active ? '#BFDBFE' : '#EF4444'}
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <rect
          x="7"
          y="8.5"
          width="14"
          height="3"
          rx="1.5"
          fill={active ? '#DBEAFE' : '#38BDF8'}
        />
        <path
          d="M8.5 11.5 L19.5 11.5 L18 24 C17.8 25 17 25.5 16 25.5 L12 25.5 C11 25.5 10.2 25 10 24 Z"
          fill={active ? '#FFFFFF' : '#2563EB'}
        />
        <circle
          cx="14"
          cy="18"
          r="2.4"
          fill={active ? '#0052FF' : '#93C5FD'}
        />
      </svg>
    );
  }
  if (id === 'Dairy') {
    return (
      <svg viewBox="0 0 28 28" className="w-6 h-6" aria-hidden="true">
        <path
          d="M8 9 L14 4 L20 9 Z"
          fill={active ? '#DBEAFE' : '#0284C7'}
        />
        <rect
          x="8"
          y="9"
          width="12"
          height="16"
          rx="2.5"
          fill={active ? '#FFFFFF' : '#38BDF8'}
        />
        <rect
          x="8"
          y="14"
          width="12"
          height="6"
          fill={active ? '#BFDBFE' : '#FFFFFF'}
        />
        <circle
          cx="14"
          cy="17"
          r="2"
          fill={active ? '#0052FF' : '#0284C7'}
        />
      </svg>
    );
  }
  return (
    <MoreHorizontal
      className={`w-6 h-6 ${active ? 'text-white' : 'text-[#0F1F4B]'}`}
      strokeWidth={2.2}
    />
  );
};

export const PosBilling: React.FC<PosBillingProps> = ({
  products,
  onGenerateBill,
  onViewReceipt,
}) => {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<CategoryTileKey>('All');
  const [showFilters, setShowFilters] = useState(false);
  const [quickFilter, setQuickFilter] = useState<QuickFilterMode>('all');
  const [favorites, setFavorites] = useState<Record<string, boolean>>({});

  // Instantaneous local state for live POS cart (single source of truth)
  const [cart, setCart] = useState<Record<string, number>>({});

  // Checkout Modal State
  const [cartOpen, setCartOpen] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('UPI');
  const [includeGst, setIncludeGst] = useState(true);
  const [discount, setDiscount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const safeProducts = useMemo(
    () => (Array.isArray(products) ? products.map((p, idx) => normalizeProduct(p, idx)) : []),
    [products]
  );

  const productMap = useMemo(
    () => new Map(safeProducts.map((p) => [p.id, p])),
    [safeProducts]
  );

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return safeProducts.filter((p) => {
      if (category !== 'All' && p.category !== category) return false;
      if (quickFilter === 'in_stock' && p.stock <= 0) return false;
      if (quickFilter === 'low_stock' && !isLowStock(p)) return false;
      if (quickFilter === 'favorites' && !favorites[p.id]) return false;
      if (!q) return true;
      return (
        (p.name ?? '').toLowerCase().includes(q) ||
        (p.category ?? '').toLowerCase().includes(q) ||
        (p.unit ?? '').toLowerCase().includes(q)
      );
    });
  }, [safeProducts, search, category, quickFilter, favorites]);

  const cartItems: CartEntry[] = useMemo(() => {
    const list: CartEntry[] = [];
    for (const [productId, quantity] of Object.entries(cart)) {
      const product = productMap.get(productId);
      if (product && quantity > 0) {
        list.push({ product, quantity: Math.min(quantity, product.stock) });
      }
    }
    return list;
  }, [cart, productMap]);

  const totalCartItems = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.quantity, 0),
    [cartItems]
  );

  const subtotal = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0),
    [cartItems]
  );
  const discountVal = Math.min(Math.max(0, Number(discount) || 0), subtotal);
  const taxableBase = Math.max(0, subtotal - discountVal);
  const gstAmount = includeGst ? Math.round(taxableBase * 0.05) : 0;
  const grandTotal = Math.round(taxableBase + gstAmount);

  // Instant zero-lag live cart quantity updater
  const updateCartQty = (productId: string, nextQty: number) => {
    const product = productMap.get(productId);
    if (!product || product.stock <= 0) return;
    setError(null);
    setCart((prev) => {
      if (nextQty <= 0) {
        const copy = { ...prev };
        delete copy[productId];
        return copy;
      }
      return { ...prev, [productId]: Math.min(nextQty, product.stock) };
    });
  };

  const toggleFavorite = (productId: string) => {
    setFavorites((prev) => ({ ...prev, [productId]: !prev[productId] }));
  };

  const clearCart = () => {
    setCart({});
    setCustomerName('');
    setCustomerPhone('');
    setDiscount('');
    setError(null);
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cartItems.length === 0) {
      setError('Add at least one item to generate a customer bill.');
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      const sale = await onGenerateBill({
        customerName: customerName.trim() || 'Walk-in Customer',
        customerPhone: customerPhone.trim() || undefined,
        paymentMethod,
        includeGst,
        discount: discountVal,
        items: cartItems.map((entry) => ({
          productId: entry.product.id,
          quantity: entry.quantity,
        })),
      });
      clearCart();
      setCartOpen(false);
      onViewReceipt(sale);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to generate bill.');
    } finally {
      setSubmitting(false);
    }
  };

  const categoryTiles: Array<{ id: CategoryTileKey; label: string; isMore?: boolean }> = [
    { id: 'All', label: 'All' },
    { id: 'Grocery', label: 'Grocery' },
    { id: 'Snacks', label: 'Snacks' },
    { id: 'Drinks', label: 'Drinks' },
    { id: 'Dairy', label: 'Dairy' },
    { id: 'Personal Care', label: 'More', isMore: true },
  ];

  return (
    <div className="pb-28 space-y-4">
      {/* Search Pill + Filter Button Row */}
      <div className="flex items-center gap-2.5">
        <div className="relative flex-1">
          <Search className="w-[18px] h-[18px] text-[#0F1F4B]/60 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search product by name or category..."
            className="w-full pl-11 pr-10 py-3 text-sm bg-white/95 border border-[#D8E5FC] rounded-full text-[#0B1736] placeholder:text-[#5B6E94] shadow-[0_4px_16px_rgba(15,42,107,0.05)] focus:outline-none focus:border-[#0052FF] focus:ring-3 focus:ring-[#0052FF]/15 transition-all"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-slate-400 hover:text-slate-700 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => setShowFilters((prev) => !prev)}
          aria-label="Filter products"
          aria-expanded={showFilters}
          className={`w-12 h-12 rounded-2xl border flex items-center justify-center shrink-0 transition-all cursor-pointer ${
            showFilters || quickFilter !== 'all'
              ? 'bg-[#0052FF] border-[#0052FF] text-white shadow-[0_6px_16px_rgba(0,82,255,0.28)]'
              : 'bg-[#E9F0FF] border-[#D8E5FC] text-[#0B1736] hover:bg-[#DCE7FF]'
          }`}
        >
          <SlidersHorizontal className="w-[18px] h-[18px]" />
        </button>
      </div>

      {/* Expandable Filter Chips */}
      {showFilters && (
        <div className="bg-white/95 border border-[#DCE6FA] rounded-2xl px-3.5 py-2.5 flex items-center gap-2 overflow-x-auto shadow-xs">
          {(
            [
              { id: 'all', label: 'All Products' },
              { id: 'in_stock', label: 'In Stock Only' },
              { id: 'low_stock', label: 'Low Stock' },
              { id: 'favorites', label: 'Starred ★' },
            ] as Array<{ id: QuickFilterMode; label: string }>
          ).map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setQuickFilter(f.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                quickFilter === f.id
                  ? 'bg-[#0052FF] text-white'
                  : 'bg-[#F1F5FF] text-[#334155] hover:bg-[#E2EBFF]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {/* Horizontal Row of Rounded Square Visual Category Icon Cards */}
      <div className="flex items-stretch gap-2.5 sm:gap-3 overflow-x-auto pb-1.5 pt-0.5">
        {categoryTiles.map((tile) => {
          const active = category === tile.id;
          return (
            <button
              key={tile.id}
              type="button"
              onClick={() => setCategory(tile.id)}
              className={`relative min-w-[74px] sm:min-w-[88px] flex-1 max-w-[126px] rounded-2xl px-2.5 py-3 flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer select-none ${
                active
                  ? 'bg-gradient-to-b from-[#0052FF] to-[#003DD1] text-white shadow-[0_8px_20px_rgba(0,82,255,0.34)]'
                  : 'bg-white text-[#0B1736] border border-[#E5EEFD] shadow-[0_4px_14px_rgba(15,42,107,0.05)] hover:border-[#BFD4FF]'
              }`}
            >
              <CategoryTileIcon id={tile.id} active={active} />
              <span className="text-[11px] sm:text-xs font-semibold inline-flex items-center gap-0.5 whitespace-nowrap">
                <span>{tile.isMore && active ? 'Care' : tile.label}</span>
                {tile.isMore && !active && <ChevronDown className="w-3 h-3 opacity-75" />}
              </span>
              {active && (
                <span
                  aria-hidden="true"
                  className="absolute -bottom-1 left-3 right-3 h-1 rounded-full bg-[#38BDF8]"
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Rich 3-Part Product Cards Grid (1-col on mobile, 2-col on wide desktop) */}
      {filteredProducts.length === 0 ? (
        <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-10 text-center">
          <p className="font-display text-base font-semibold text-[#0B1736]">
            No matching products found
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Try searching another product name or switching back to All categories.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setCategory('All');
              setQuickFilter('all');
            }}
            className="mt-4 px-4 py-2 rounded-xl bg-[#0052FF] text-white text-xs font-semibold cursor-pointer"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3.5">
          {filteredProducts.map((product) => {
            const safeStock = Number.isFinite(product.stock) ? Math.max(0, product.stock) : 0;
            const safePrice = Number.isFinite(product.price) ? Math.max(0, product.price) : 0;
            const outOfStock = safeStock <= 0;
            const low = !outOfStock && isLowStock(product);
            const mrp = getSafeMrp(product);
            const discountPct = getSafeDiscount(product, safePrice, mrp);
            const inCartQty = Math.min(safeStock, cart[product.id] || 0);
            const isFav = Boolean(favorites[product.id]);

            return (
              <article
                key={product.id}
                className={`relative bg-white rounded-2xl shadow-[0_6px_22px_rgba(15,42,107,0.06)] border p-3.5 sm:p-4 flex items-center gap-3 sm:gap-4 transition-all hover:shadow-[0_10px_28px_rgba(15,42,107,0.09)] ${
                  inCartQty > 0 ? 'border-[#BFD6FF] ring-1 ring-[#0052FF]/10' : 'border-slate-100'
                }`}
              >
                {/* Favorite Star Top-Right */}
                <button
                  type="button"
                  onClick={() => toggleFavorite(product.id)}
                  aria-label={isFav ? `Unstar ${product.name}` : `Star ${product.name}`}
                  className="absolute top-3 right-3 p-1.5 rounded-full text-[#4C6491] hover:bg-[#F1F5FF] cursor-pointer"
                >
                  <Star
                    className={`w-4 h-4 ${
                      isFav ? 'fill-amber-400 text-amber-400' : 'text-[#5C739E]'
                    }`}
                  />
                </button>

                {/* Left: Realistic Product Pack Thumbnail */}
                <ProductPackThumbnail product={product} />

                {/* Middle + Right Responsive Flex */}
                <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-end justify-between gap-3 pr-1">
                  {/* Middle: Status Pill, Bold Name, Pack Unit, Price / MRP / Discount */}
                  <div className="min-w-0 flex-1 pr-5 sm:pr-0">
                    {/* Stock Status Pill Badge */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {outOfStock ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-red-50 text-red-700 text-[11px] font-semibold">
                          <span>Out of Stock</span>
                        </span>
                      ) : low ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[11px] font-semibold">
                          <span>Low Stock · {product.stock} left</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#E6F9EE] text-[#118C4F] text-[11px] font-semibold">
                          <span className="w-3.5 h-3.5 rounded-full bg-[#16A34A] text-white inline-flex items-center justify-center">
                            <Check className="w-2.5 h-2.5" strokeWidth={3} />
                          </span>
                          <span>In Stock</span>
                        </span>
                      )}

                      {inCartQty > 0 && (
                        <span className="text-[11px] font-semibold text-[#0052FF] font-mono tabular-nums">
                          {inCartQty} in cart
                        </span>
                      )}
                    </div>

                    <h3 className="mt-1.5 font-display text-[15px] sm:text-base font-bold text-[#0B1736] leading-snug line-clamp-2">
                      {product.name}
                    </h3>

                    <p className="mt-0.5 text-xs sm:text-[13px] text-[#5B6E94]">
                      {product.unit}
                    </p>

                    {/* Price + Crossed-out MRP + Green Discount Pill */}
                    <div className="mt-2.5 flex items-center flex-wrap gap-2">
                      <span className="font-display font-extrabold text-lg sm:text-[19px] text-[#0B1736] tabular-nums">
                        {formatInr(product.price)}
                      </span>
                      {mrp > product.price && (
                        <span className="text-xs sm:text-sm text-[#7B8CAE] line-through tabular-nums">
                          {formatInr(mrp)}
                        </span>
                      )}
                      {discountPct > 0 && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#E6F9EE] text-[#118C4F] text-[11px] font-bold tabular-nums">
                          ↓ {discountPct}%
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right: Real-Time Blinkit-Style "+ Add" -> Active "- qty +" Live Cart Stepper */}
                  <div className="flex items-center justify-end shrink-0 sm:w-[126px]">
                    {inCartQty === 0 ? (
                      <button
                        type="button"
                        disabled={outOfStock}
                        onClick={() => updateCartQty(product.id, 1)}
                        aria-label={`Add ${product.name} to cart`}
                        className={`w-full sm:w-[116px] h-10 px-4 rounded-xl text-xs sm:text-[13px] font-bold inline-flex items-center justify-center gap-1.5 transition-all active:scale-[0.96] cursor-pointer whitespace-nowrap select-none ${
                          outOfStock
                            ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                            : 'bg-[#0B1A3C] hover:bg-[#13295A] text-white shadow-[0_4px_12px_rgba(11,26,60,0.22)]'
                        }`}
                      >
                        {outOfStock ? (
                          <span>Unavailable</span>
                        ) : (
                          <>
                            <Plus className="w-4 h-4 shrink-0" strokeWidth={2.8} />
                            <span>Add</span>
                          </>
                        )}
                      </button>
                    ) : (
                      <div
                        className="w-full sm:w-[116px] h-10 inline-flex items-center justify-between rounded-xl bg-[#0052FF] text-white px-1 shadow-[0_6px_16px_rgba(0,82,255,0.3)] select-none"
                        role="group"
                        aria-label={`Cart quantity for ${product.name}`}
                      >
                        <button
                          type="button"
                          onClick={() => updateCartQty(product.id, inCartQty - 1)}
                          aria-label={`Decrease quantity for ${product.name}`}
                          className="w-8 h-8 rounded-lg hover:bg-white/15 active:scale-90 flex items-center justify-center cursor-pointer transition-all"
                        >
                          <Minus className="w-4 h-4" strokeWidth={2.8} />
                        </button>
                        <span className="font-mono tabular-nums text-sm font-bold min-w-[26px] text-center">
                          {inCartQty}
                        </span>
                        <button
                          type="button"
                          disabled={inCartQty >= safeStock}
                          onClick={() => updateCartQty(product.id, inCartQty + 1)}
                          aria-label={`Increase quantity for ${product.name}`}
                          className="w-8 h-8 rounded-lg hover:bg-white/15 active:scale-90 disabled:opacity-40 flex items-center justify-center cursor-pointer transition-all"
                        >
                          <Plus className="w-4 h-4" strokeWidth={2.8} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Fixed Sticky Bottom Checkout Bar */}
      <div className="fixed bottom-0 left-0 right-0 lg:left-64 z-30 pointer-events-none px-2 sm:px-6">
        <div className="max-w-[1440px] mx-auto pointer-events-auto bg-white/95 backdrop-blur-md rounded-t-2xl shadow-[0_-10px_36px_rgba(15,42,107,0.14)] border-t border-x border-[#DCE6FA] px-4 sm:px-6 py-3.5 flex items-center justify-between gap-3">
          {/* Left: Cart Icon with Red Badge + Totals */}
          <div className="flex items-center gap-3.5 sm:gap-5 min-w-0">
            <button
              type="button"
              onClick={() => setCartOpen(true)}
              aria-label="Open cart"
              className="relative w-12 h-12 rounded-2xl bg-[#EEF4FF] border border-[#DAE6FC] flex items-center justify-center text-[#0B1736] shrink-0 cursor-pointer active:scale-95 transition-transform"
            >
              <ShoppingCart className="w-5 h-5" strokeWidth={2.2} />
              <span className="absolute -top-1.5 -right-1.5 min-w-[22px] h-[22px] px-1 rounded-full bg-[#EF4444] text-white font-mono tabular-nums text-[11px] font-bold flex items-center justify-center shadow-xs">
                {totalCartItems}
              </span>
            </button>

            <div className="flex items-center gap-3 sm:gap-5 min-w-0">
              <div className="hidden xs:block sm:block">
                <p className="text-[11px] sm:text-xs font-medium text-[#5B6E94]">
                  Total Items
                </p>
                <p className="font-display font-bold text-base sm:text-lg text-[#0B1736] tabular-nums leading-tight">
                  {totalCartItems}
                </p>
              </div>

              <div className="hidden sm:block h-8 w-px bg-slate-200" aria-hidden="true" />

              <div>
                <p className="text-[11px] sm:text-xs font-medium text-[#5B6E94]">
                  Total Amount
                </p>
                <p className="font-mono tabular-nums font-bold text-base sm:text-xl text-[#16A34A] leading-tight">
                  {formatInr(subtotal, true)}
                </p>
              </div>
            </div>
          </div>

          {/* Right: Vibrant Blue-to-Purple Gradient "View Cart →" Button */}
          <button
            type="button"
            onClick={() => setCartOpen(true)}
            className="px-5 sm:px-7 py-3 rounded-full bg-gradient-to-r from-[#0052FF] via-[#4353FF] to-[#7C3AED] hover:opacity-95 active:scale-[0.98] text-white text-sm font-semibold shadow-[0_8px_22px_rgba(59,91,255,0.36)] inline-flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap shrink-0"
          >
            <span>View Cart</span>
            <ArrowRight className="w-4 h-4 shrink-0" />
          </button>
        </div>
      </div>

      {/* Cart Summary & Receipt Checkout Modal / Sheet */}
      {cartOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#0B1736]/50 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Customer Cart and Checkout"
        >
          <div className="bg-[#F8FAFC] rounded-t-3xl sm:rounded-3xl border border-[#DCE6FA] w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
            {/* Sticky White Modal Header */}
            <div className="px-5 sm:px-6 py-4 bg-white border-b border-slate-200/80 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#EEF4FF] text-[#0052FF] flex items-center justify-center shrink-0">
                  <ShoppingCart className="w-[18px] h-[18px]" />
                </div>
                <div>
                  <h2 className="font-display text-base font-bold text-[#0B1736]">
                    Customer Bill &amp; Cart
                  </h2>
                  <p className="text-xs text-[#5B6E94] font-mono tabular-nums">
                    {totalCartItems} {totalCartItems === 1 ? 'item' : 'items'} selected
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {cartItems.length > 0 && (
                  <button
                    type="button"
                    onClick={clearCart}
                    className="text-xs font-semibold text-red-600 hover:text-red-700 cursor-pointer px-2.5 py-1 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    Clear
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setCartOpen(false)}
                  aria-label="Close cart"
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <form onSubmit={handleCheckout} className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
                {/* Customer Info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#334155] mb-1">
                      Customer Name
                    </label>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Walk-in Customer"
                      className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl text-[#0B1736] placeholder:text-slate-400 shadow-2xs focus:outline-none focus:border-[#0052FF] focus:ring-2 focus:ring-[#0052FF]/15"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#334155] mb-1">
                      Phone (Optional)
                    </label>
                    <input
                      type="tel"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="98XXXXXXXX"
                      className="w-full px-3.5 py-2.5 text-sm font-mono bg-white border border-slate-200 rounded-xl text-[#0B1736] placeholder:text-slate-400 shadow-2xs focus:outline-none focus:border-[#0052FF] focus:ring-2 focus:ring-[#0052FF]/15"
                    />
                  </div>
                </div>

                {/* Elevated White Cart Item Cards with Product Thumbnails */}
                <div className="space-y-2.5">
                  {cartItems.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm py-10 px-4 text-center">
                      <p className="text-sm font-semibold text-[#0B1736]">
                        Your cart is empty
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Tap + Add on products to build a customer bill.
                      </p>
                    </div>
                  ) : (
                    cartItems.map(({ product, quantity }) => (
                      <div
                        key={product.id}
                        className="bg-white rounded-2xl shadow-sm border border-slate-100 p-3 sm:p-3.5 flex items-start gap-3"
                      >
                        {/* Product Pack Thumbnail inside Soft Rounded Square Frame */}
                        <ProductPackThumbnail
                          product={product}
                          compact
                          className="w-12 h-12"
                        />

                        {/* Right Content: Full Title + Delete on Row 1, Unit Calc + Stepper + Subtotal on Row 2 */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-bold text-[#0B1736] leading-snug">
                              {product.name}
                            </p>
                            <button
                              type="button"
                              onClick={() => updateCartQty(product.id, 0)}
                              aria-label={`Remove ${product.name}`}
                              className="p-1 -mr-1 -mt-0.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer shrink-0"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="mt-2 flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-1.5 text-xs text-[#5B6E94] font-mono tabular-nums">
                              <span>
                                {formatInr(product.price)} × {quantity}
                              </span>
                            </div>

                            <div className="flex items-center gap-2.5 shrink-0">
                              <div className="inline-flex items-center rounded-full bg-[#F3F6FD] border border-[#E1E9F9] p-0.5">
                                <button
                                  type="button"
                                  onClick={() => updateCartQty(product.id, quantity - 1)}
                                  aria-label={`Decrease quantity for ${product.name}`}
                                  className="w-7 h-7 rounded-full bg-white shadow-2xs flex items-center justify-center text-[#0B1736] active:scale-90 cursor-pointer"
                                >
                                  <Minus className="w-3 h-3" strokeWidth={2.5} />
                                </button>
                                <span className="px-2.5 font-mono tabular-nums text-xs font-bold text-[#0B1736] min-w-[24px] text-center">
                                  {quantity}
                                </span>
                                <button
                                  type="button"
                                  disabled={quantity >= product.stock}
                                  onClick={() => updateCartQty(product.id, quantity + 1)}
                                  aria-label={`Increase quantity for ${product.name}`}
                                  className="w-7 h-7 rounded-full bg-white shadow-2xs flex items-center justify-center text-[#0B1736] active:scale-90 disabled:opacity-35 cursor-pointer"
                                >
                                  <Plus className="w-3 h-3" strokeWidth={2.5} />
                                </button>
                              </div>

                              <span className="min-w-[58px] text-right font-mono tabular-nums text-sm font-bold text-[#0B1736]">
                                {formatInr(product.price * quantity)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Payment Mode + GST/Discount Summary Card */}
                <div className="rounded-2xl bg-white border border-[#DCE6FA] shadow-sm p-4 space-y-3.5">
                  <div>
                    <p className="text-xs font-semibold text-[#334155] mb-2">
                      Payment Method
                    </p>
                    <div className="grid grid-cols-3 gap-1.5 p-1 bg-[#F3F6FD] rounded-xl border border-[#E1EBFC]">
                      {(['UPI', 'Cash', 'Card'] as PaymentMethod[]).map((method) => (
                        <button
                          key={method}
                          type="button"
                          onClick={() => setPaymentMethod(method)}
                          className={`py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                            paymentMethod === method
                              ? 'bg-[#0052FF] text-white shadow-[0_4px_12px_rgba(0,82,255,0.28)]'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {method}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <label className="inline-flex items-center gap-2 text-xs font-medium text-[#334155] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={includeGst}
                        onChange={(e) => setIncludeGst(e.target.checked)}
                        className="w-4 h-4 rounded border-slate-300 accent-[#0052FF] cursor-pointer"
                      />
                      <span>Include GST (5%)</span>
                    </label>

                    <div className="flex items-center gap-1.5">
                      <label htmlFor="cart-discount" className="text-xs font-medium text-slate-600">
                        Discount ₹
                      </label>
                      <input
                        id="cart-discount"
                        type="number"
                        min="0"
                        max={subtotal}
                        value={discount}
                        onChange={(e) => setDiscount(e.target.value)}
                        placeholder="0"
                        className="w-20 px-2.5 py-1.5 text-right text-xs font-mono tabular-nums bg-[#F8FAFC] border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-[#0052FF]"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-3 border-t border-slate-100 text-xs">
                    <div className="flex justify-between text-slate-600">
                      <span>Subtotal</span>
                      <span className="font-mono tabular-nums">{formatInr(subtotal, true)}</span>
                    </div>
                    {discountVal > 0 && (
                      <div className="flex justify-between text-emerald-700">
                        <span>Discount</span>
                        <span className="font-mono tabular-nums">
                          -{formatInr(discountVal, true)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between text-slate-600">
                      <span>GST (5%)</span>
                      <span className="font-mono tabular-nums">{formatInr(gstAmount, true)}</span>
                    </div>
                    <div className="flex justify-between items-baseline pt-2.5 mt-1 border-t border-slate-100 text-base font-bold text-[#0B1736]">
                      <span>Grand Total</span>
                      <span className="font-mono tabular-nums text-lg text-[#16A34A]">
                        {formatInr(grandTotal, true)}
                      </span>
                    </div>
                  </div>
                </div>

                {error && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-700">
                    {error}
                  </div>
                )}
              </div>

              {/* Sticky White Footer with Vibrant Blue-to-Purple Generate Bill Button */}
              <div className="p-4 border-t border-slate-200/80 bg-white shrink-0">
                <button
                  type="submit"
                  disabled={submitting || cartItems.length === 0}
                  className="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-[#0052FF] via-[#4353FF] to-[#7C3AED] hover:opacity-95 active:scale-[0.99] text-white text-sm font-semibold flex items-center justify-center gap-2 shadow-[0_8px_22px_rgba(59,91,255,0.34)] transition-all disabled:opacity-50 cursor-pointer"
                >
                  <Receipt className="w-4 h-4 shrink-0" />
                  <span>
                    {submitting
                      ? 'Generating Customer Bill...'
                      : `Generate Bill · ${formatInr(grandTotal, true)}`}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
