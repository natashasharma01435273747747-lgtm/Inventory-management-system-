import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ClipboardEdit,
  Search,
  Send,
} from 'lucide-react';
import type { CreateAdjustmentInput } from '../api/client.ts';
import type {
  AdjustmentReasonType,
  Product,
  ProductCategory,
  StockAdjustmentRequest,
} from '../types/store.ts';
import {
  ADJUSTMENT_REASON_TYPES,
  PRODUCT_CATEGORIES,
} from '../types/store.ts';
import {
  formatInr,
  formatShortDate,
  formatTimeAgo,
  getExpiryStatus,
  isExpiringSoon,
  isLowStock,
} from '../utils/storeMetrics.ts';

interface EmployeeStockViewProps {
  products: Product[];
  adjustments: StockAdjustmentRequest[];
  onSubmitAdjustment: (input: CreateAdjustmentInput) => Promise<void>;
}

export const EmployeeStockView: React.FC<EmployeeStockViewProps> = ({
  products,
  adjustments,
  onSubmitAdjustment,
}) => {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<'All' | ProductCategory>('All');
  const [onlyAlerts, setOnlyAlerts] = useState(false);

  // Stock Adjustment Request Form State
  const [selectedProductId, setSelectedProductId] = useState(products[0]?.id ?? '');
  const [direction, setDirection] = useState<'decrease' | 'increase'>('decrease');
  const [quantity, setQuantity] = useState('2');
  const [reasonType, setReasonType] = useState<AdjustmentReasonType>('Damaged / Spoiled');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const lowStockCount = useMemo(
    () => products.filter((p) => isLowStock(p)).length,
    [products]
  );
  const expiringCount = useMemo(
    () => products.filter((p) => isExpiringSoon(p, 14)).length,
    [products]
  );

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = Array.isArray(products) ? products : [];
    return list.filter((p) => {
      if (!p) return false;
      if (category !== 'All' && p.category !== category) return false;
      if (onlyAlerts && !isLowStock(p) && !isExpiringSoon(p, 14)) return false;
      if (!q) return true;
      return (
        (p.name ?? '').toLowerCase().includes(q) ||
        (p.sku ?? '').toLowerCase().includes(q) ||
        (p.category ?? '').toLowerCase().includes(q)
      );
    });
  }, [products, search, category, onlyAlerts]);

  const selectedProduct = products.find((p) => p.id === selectedProductId) ?? products[0];

  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const targetProduct = selectedProduct;
    if (!targetProduct) {
      setError('Select a product to adjust.');
      return;
    }
    const qtyNum = Math.round(Number(quantity));
    if (!Number.isFinite(qtyNum) || qtyNum <= 0) {
      setError('Enter a valid quantity greater than 0.');
      return;
    }
    const signedDelta = direction === 'decrease' ? -qtyNum : qtyNum;
    if (targetProduct.stock + signedDelta < 0) {
      setError(
        `Reduction exceeds current stock (${targetProduct.stock} units available).`
      );
      return;
    }
    if (!notes.trim()) {
      setError('Add a brief explanation for the Admin reviewer.');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmitAdjustment({
        productId: targetProduct.id,
        requestedDelta: signedDelta,
        reasonType,
        notes: notes.trim(),
      });
      setSuccessMsg(
        `Submitted request (${signedDelta > 0 ? `+${signedDelta}` : signedDelta} units for ${targetProduct.name}) to Admin Approvals.`
      );
      setNotes('');
      setQuantity('1');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to submit request.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Alert Summary Strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs font-medium text-slate-500">Total Active SKUs</p>
          <p className="mt-1.5 font-mono tabular-nums text-2xl font-semibold text-slate-900">
            {products.length}
          </p>
          <p className="mt-1 text-xs text-slate-500">Read-only stock view for staff</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs font-medium text-slate-500">Low-Stock Notifications</p>
          <p className="mt-1.5 font-mono tabular-nums text-2xl font-semibold text-amber-600">
            {lowStockCount}
          </p>
          <p className="mt-1 text-xs text-amber-700">
            Alert Admin or submit restock delivery note
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs font-medium text-slate-500">Expiring Within 14 Days</p>
          <p className="mt-1.5 font-mono tabular-nums text-2xl font-semibold text-red-600">
            {expiringCount}
          </p>
          <p className="mt-1 text-xs text-red-700">
            Check dairy &amp; snacks shelves before billing
          </p>
        </div>
      </div>

      {/* Main Split: Stock Availability Table + Request Stock Adjustment Form */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Live Stock Availability */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-200 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filter stock availability..."
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
                />
              </div>
              <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={onlyAlerts}
                  onChange={(e) => setOnlyAlerts(e.target.checked)}
                  className="rounded border-slate-300 text-teal-700 focus:ring-teal-600"
                />
                <span>Show Low-Stock &amp; Expiring only</span>
              </label>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
              {(['All', ...PRODUCT_CATEGORIES] as const).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`px-3 py-1 rounded-md text-xs font-medium cursor-pointer whitespace-nowrap shrink-0 ${
                    category === cat
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs text-slate-500">
                  <th className="py-2.5 px-4 text-left font-medium">Product</th>
                  <th className="py-2.5 px-3 text-right font-medium">Price</th>
                  <th className="py-2.5 px-3 text-right font-medium">Available</th>
                  <th className="py-2.5 px-3 text-left font-medium">Expiry Alert</th>
                  <th className="py-2.5 px-4 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProducts.map((p) => {
                  const low = isLowStock(p);
                  const exp = getExpiryStatus(p.expiryDate);
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/60">
                      <td className="py-2.5 px-4">
                        <p className="font-medium text-slate-900">{p.name}</p>
                        <p className="text-xs text-slate-500">
                          {p.category} · {p.unit}
                        </p>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-800 whitespace-nowrap">
                        {formatInr(p.price)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums whitespace-nowrap">
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
                        {low && (
                          <span className="block text-[11px] font-sans text-amber-700 flex items-center justify-end gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            Low stock
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className="block text-xs font-mono tabular-nums text-slate-700">
                          {formatShortDate(p.expiryDate)}
                        </span>
                        <span
                          className={`text-xs font-medium inline-flex items-center gap-1 ${
                            exp.severity === 'expired' || exp.severity === 'critical'
                              ? 'text-red-600'
                              : exp.severity === 'warning'
                                ? 'text-amber-700'
                                : 'text-emerald-700'
                          }`}
                        >
                          {(exp.severity === 'expired' ||
                            exp.severity === 'critical' ||
                            exp.severity === 'warning') && (
                            <CalendarClock className="w-3 h-3" />
                          )}
                          <span>{exp.label}</span>
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedProductId(p.id);
                            setSuccessMsg(null);
                            setError(null);
                          }}
                          className="text-xs font-medium text-teal-700 hover:text-teal-900 cursor-pointer"
                        >
                          Request Adjustment
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Request Stock Adjustment Form */}
        <form
          onSubmit={handleRequestSubmit}
          className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-5 space-y-4 lg:sticky lg:top-20"
        >
          <div className="flex items-start gap-2.5">
            <ClipboardEdit className="w-5 h-5 text-teal-700 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-display text-base font-semibold text-slate-900">
                Request Stock Adjustment
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Employees cannot edit inventory directly. Submit a request for Admin approval.
              </p>
            </div>
          </div>

          {successMsg && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Product</label>
            <select
              value={selectedProduct?.id ?? ''}
              onChange={(e) => setSelectedProductId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-teal-600"
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (Stock: {p.stock})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Adjustment Type
              </label>
              <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-lg">
                <button
                  type="button"
                  onClick={() => setDirection('decrease')}
                  className={`py-1.5 text-xs font-medium rounded-md cursor-pointer ${
                    direction === 'decrease'
                      ? 'bg-white text-red-700 shadow-xs'
                      : 'text-slate-600'
                  }`}
                >
                  Reduce (-)
                </button>
                <button
                  type="button"
                  onClick={() => setDirection('increase')}
                  className={`py-1.5 text-xs font-medium rounded-md cursor-pointer ${
                    direction === 'increase'
                      ? 'bg-white text-emerald-700 shadow-xs'
                      : 'text-slate-600'
                  }`}
                >
                  Add (+)
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Quantity
              </label>
              <input
                type="number"
                min="1"
                required
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Reason</label>
            <select
              value={reasonType}
              onChange={(e) => setReasonType(e.target.value as AdjustmentReasonType)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-teal-600"
            >
              {ADJUSTMENT_REASON_TYPES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Details for Admin
            </label>
            <textarea
              rows={3}
              required
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Explain damaged packs, vendor delivery receipt, or physical shelf count..."
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600 resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 px-4 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-sm font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-60 cursor-pointer"
          >
            <Send className="w-4 h-4" />
            <span>{submitting ? 'Sending...' : 'Send for Admin Approval'}</span>
          </button>
        </form>
      </div>

      {/* Submitted Requests History */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200">
          <h3 className="font-display text-base font-semibold text-slate-900">
            Recent Stock Adjustment Requests
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Track pending and reviewed stock requests sent to the Store Admin.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-xs text-slate-500">
                <th className="py-2.5 px-5 text-left font-medium">Product</th>
                <th className="py-2.5 px-4 text-right font-medium">Requested Change</th>
                <th className="py-2.5 px-4 text-left font-medium">Reason &amp; Note</th>
                <th className="py-2.5 px-4 text-left font-medium">Submitted By</th>
                <th className="py-2.5 px-5 text-right font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {adjustments.map((adj) => (
                <tr key={adj.id} className="hover:bg-slate-50/60">
                  <td className="py-3 px-5">
                    <p className="font-medium text-slate-900">{adj.productName}</p>
                  </td>
                  <td
                    className={`py-3 px-4 text-right font-mono tabular-nums font-semibold ${
                      adj.requestedDelta >= 0 ? 'text-emerald-700' : 'text-red-600'
                    }`}
                  >
                    {adj.requestedDelta >= 0
                      ? `+${adj.requestedDelta}`
                      : adj.requestedDelta}
                  </td>
                  <td className="py-3 px-4">
                    <p className="text-xs font-medium text-slate-800">{adj.reasonType}</p>
                    <p className="text-xs text-slate-500">{adj.notes}</p>
                  </td>
                  <td className="py-3 px-4 text-xs text-slate-600 whitespace-nowrap">
                    <span className="block font-medium text-slate-800">
                      {adj.requestedBy}
                    </span>
                    <span className="font-mono">{formatTimeAgo(adj.requestedAt)}</span>
                  </td>
                  <td className="py-3 px-5 text-right whitespace-nowrap">
                    <span
                      className={`text-xs font-semibold ${
                        adj.status === 'Approved'
                          ? 'text-emerald-700'
                          : adj.status === 'Rejected'
                            ? 'text-red-600'
                            : 'text-amber-700'
                      }`}
                    >
                      {adj.status}
                    </span>
                    {adj.reviewNote && (
                      <span className="block text-[11px] text-slate-500 max-w-[200px] truncate ml-auto">
                        {adj.reviewNote}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
