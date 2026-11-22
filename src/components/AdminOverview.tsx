import React, { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  PackagePlus,
} from 'lucide-react';
import type { StoreSnapshot } from '../types/store.ts';
import {
  buildCategoryBreakdown,
  buildSevenDayTrend,
  computeDashboardMetrics,
  formatInr,
  formatShortDate,
  getExpiryStatus,
} from '../utils/storeMetrics.ts';

interface AdminOverviewProps {
  store: StoreSnapshot;
  onNavigateTab: (tab: string) => void;
  onQuickRestock: (productId: string, quantity: number) => Promise<void>;
  onOpenAssistant: () => void;
}

type AlertSubTab = 'restock' | 'low_stock' | 'expiring';

export const AdminOverview: React.FC<AdminOverviewProps> = ({
  store,
  onNavigateTab,
  onQuickRestock,
  onOpenAssistant,
}) => {
  const [alertTab, setAlertTab] = useState<AlertSubTab>('restock');
  const [restockingId, setRestockingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const metrics = useMemo(
    () => computeDashboardMetrics(store.products, store.sales, store.expenses),
    [store.products, store.sales, store.expenses]
  );

  const trendData = useMemo(
    () => buildSevenDayTrend(store.sales, store.expenses),
    [store.sales, store.expenses]
  );

  const categoryData = useMemo(
    () => buildCategoryBreakdown(store.products, store.sales),
    [store.products, store.sales]
  );

  const pendingApprovalsCount = useMemo(
    () => store.adjustments.filter((a) => a.status === 'Pending').length,
    [store.adjustments]
  );

  const handleRestock = async (productId: string, productName: string, qty: number) => {
    setRestockingId(productId);
    setNotice(null);
    try {
      await onQuickRestock(productId, qty);
      setNotice(`Restocked +${qty} units of ${productName} and logged purchase order.`);
    } finally {
      setRestockingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {notice && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 flex items-center justify-between gap-3">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{notice}</span>
          </span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="text-xs font-medium text-emerald-700 hover:text-emerald-900 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 6-Metric Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <button
          type="button"
          onClick={() => onNavigateTab('inventory')}
          className="text-left bg-white border border-slate-200 rounded-xl p-4 hover:border-slate-300 transition-colors cursor-pointer"
        >
          <p className="text-xs font-medium text-slate-500">Total Products</p>
          <p className="mt-2 font-mono tabular-nums text-2xl font-semibold text-slate-900">
            {metrics.totalProducts}
          </p>
          <p className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
            {metrics.totalUnitsInStock} units in stock
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab('reports')}
          className="text-left bg-white border border-slate-200 rounded-xl p-4 hover:border-slate-300 transition-colors cursor-pointer"
        >
          <p className="text-xs font-medium text-slate-500">Today&apos;s Sales</p>
          <p className="mt-2 font-mono tabular-nums text-2xl font-semibold text-slate-900">
            {formatInr(metrics.todaysSales)}
          </p>
          <p className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
            {metrics.todaysBillsCount} bill{metrics.todaysBillsCount === 1 ? '' : 's'} today
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab('expenses')}
          className="text-left bg-white border border-slate-200 rounded-xl p-4 hover:border-slate-300 transition-colors cursor-pointer"
        >
          <p className="text-xs font-medium text-slate-500">Business Expenses</p>
          <p className="mt-2 font-mono tabular-nums text-2xl font-semibold text-slate-900">
            {formatInr(metrics.totalExpenses)}
          </p>
          <p className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
            {store.expenses.length} recorded entries
          </p>
        </button>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs font-medium text-slate-500">Net Profit (7d)</p>
          <p
            className={`mt-2 font-mono tabular-nums text-2xl font-semibold ${
              metrics.netProfit >= 0 ? 'text-emerald-700' : 'text-red-600'
            }`}
          >
            {formatInr(metrics.netProfit)}
          </p>
          <p className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
            {metrics.netProfitMarginPct}% net margin
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setAlertTab('low_stock');
          }}
          className="text-left bg-white border border-slate-200 rounded-xl p-4 hover:border-amber-300 transition-colors cursor-pointer"
        >
          <p className="text-xs font-medium text-slate-500">Low-Stock Items</p>
          <p className="mt-2 font-mono tabular-nums text-2xl font-semibold text-amber-600">
            {metrics.lowStockProducts.length}
          </p>
          <p className="mt-1 text-xs text-amber-700">
            {metrics.lowStockProducts.length > 0 ? 'Reorder needed' : 'All stocked'}
          </p>
        </button>

        <button
          type="button"
          onClick={() => {
            setAlertTab('expiring');
          }}
          className="text-left bg-white border border-slate-200 rounded-xl p-4 hover:border-red-300 transition-colors cursor-pointer"
        >
          <p className="text-xs font-medium text-slate-500">Expiring Soon</p>
          <p className="mt-2 font-mono tabular-nums text-2xl font-semibold text-red-600">
            {metrics.expiringSoonProducts.length}
          </p>
          <p className="mt-1 text-xs text-red-700">Within 14 days</p>
        </button>
      </div>

      {/* Pending Employee Approvals Notice Bar (when > 0) */}
      {pendingApprovalsCount > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-slate-700">
            <span className="font-semibold text-slate-900">
              {pendingApprovalsCount} pending stock adjustment{' '}
              {pendingApprovalsCount === 1 ? 'request' : 'requests'}
            </span>{' '}
            submitted by store employees awaiting Admin review.
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('approvals')}
            className="text-sm font-medium text-teal-700 hover:text-teal-800 flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <span>Review Approvals</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 7-Day Sales vs Expenses */}
        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900">
                7-Day Sales &amp; Operating Expenses
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Daily billed revenue compared with logged store expenses (INR)
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-600">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-teal-700 inline-block" />
                Sales
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-slate-300 inline-block" />
                Expenses
              </span>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trendData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 12, fill: '#64748B' }}
                  axisLine={{ stroke: '#E2E8F0' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#64748B' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `₹${v}`}
                  width={56}
                />
                <Tooltip
                  formatter={(value: unknown, name: unknown) => [
                    formatInr(Number(value) || 0),
                    name === 'sales' ? 'Sales Revenue' : 'Expenses',
                  ]}
                  contentStyle={{
                    borderRadius: '8px',
                    border: '1px solid #E2E8F0',
                    fontSize: '12px',
                    boxShadow: 'none',
                  }}
                />
                <Bar dataKey="sales" fill="#0F766E" radius={[4, 4, 0, 0]} maxBarSize={32} />
                <Bar
                  dataKey="expenses"
                  fill="#CBD5E1"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={32}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Revenue by Category */}
        <section className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5">
          <div className="mb-4">
            <h2 className="font-display text-base font-semibold text-slate-900">
              Revenue by Category
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              7-day billed sales across all 5 general store departments
            </p>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={categoryData}
                layout="vertical"
                margin={{ top: 4, right: 16, left: 10, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: '#64748B' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `₹${v}`}
                />
                <YAxis
                  type="category"
                  dataKey="category"
                  tick={{ fontSize: 12, fill: '#334155' }}
                  axisLine={false}
                  tickLine={false}
                  width={92}
                />
                <Tooltip
                  formatter={(value: unknown) => [formatInr(Number(value) || 0), '7-Day Sales']}
                  contentStyle={{
                    borderRadius: '8px',
                    border: '1px solid #E2E8F0',
                    fontSize: '12px',
                    boxShadow: 'none',
                  }}
                />
                <Bar dataKey="revenue" fill="#0D9488" radius={[0, 4, 4, 0]} barSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      {/* Smart AI Alerts & Restocking Suggestions */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900">
              Smart Alerts &amp; Restocking Suggestions
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Automated reorder quantities calculated from daily sales velocity, safety thresholds,
              and shelf expiry dates.
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => setAlertTab('restock')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                  alertTab === 'restock'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Smart Restocking ({metrics.restockSuggestions.length})
              </button>
              <button
                type="button"
                onClick={() => setAlertTab('low_stock')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                  alertTab === 'low_stock'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Low Stock ({metrics.lowStockProducts.length})
              </button>
              <button
                type="button"
                onClick={() => setAlertTab('expiring')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                  alertTab === 'expiring'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Expiring Soon ({metrics.expiringSoonProducts.length})
              </button>
            </div>

            <button
              type="button"
              onClick={onOpenAssistant}
              className="text-xs font-medium text-teal-700 hover:text-teal-800 cursor-pointer whitespace-nowrap"
            >
              Ask Gemini AI →
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          {alertTab === 'restock' && (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs text-slate-500">
                  <th className="py-2.5 px-5 text-left font-medium">Product</th>
                  <th className="py-2.5 px-4 text-left font-medium">Priority &amp; Signal</th>
                  <th className="py-2.5 px-4 text-right font-medium">Current</th>
                  <th className="py-2.5 px-4 text-right font-medium">Suggested Reorder</th>
                  <th className="py-2.5 px-4 text-right font-medium">Est. Cost</th>
                  <th className="py-2.5 px-5 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {metrics.restockSuggestions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-sm text-slate-500">
                      All items are comfortably stocked above safety thresholds.
                    </td>
                  </tr>
                ) : (
                  metrics.restockSuggestions.map((item) => (
                    <tr key={item.product.id} className="hover:bg-slate-50/60">
                      <td className="py-3 px-5">
                        <p className="font-medium text-slate-900">{item.product.name}</p>
                        <p className="text-xs text-slate-500">
                          {item.product.category} · {item.product.supplier}
                        </p>
                      </td>
                      <td className="py-3 px-4">
                        <p
                          className={`text-xs font-semibold ${
                            item.urgency === 'Urgent' ? 'text-red-600' : 'text-amber-700'
                          }`}
                        >
                          {item.urgency}
                        </p>
                        <p className="text-xs text-slate-500">{item.reason}</p>
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                        {item.product.stock}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-teal-700">
                        +{item.recommendedQty}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-900">
                        {formatInr(item.estimatedCost)}
                      </td>
                      <td className="py-3 px-5 text-right">
                        <button
                          type="button"
                          disabled={restockingId === item.product.id}
                          onClick={() =>
                            handleRestock(
                              item.product.id,
                              item.product.name,
                              item.recommendedQty
                            )
                          }
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:border-teal-600 hover:text-teal-700 text-xs font-medium text-slate-700 transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
                        >
                          <PackagePlus className="w-3.5 h-3.5" />
                          <span>
                            {restockingId === item.product.id ? 'Restocking...' : 'Restock Now'}
                          </span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {alertTab === 'low_stock' && (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs text-slate-500">
                  <th className="py-2.5 px-5 text-left font-medium">Product</th>
                  <th className="py-2.5 px-4 text-left font-medium">Supplier</th>
                  <th className="py-2.5 px-4 text-right font-medium">In Stock</th>
                  <th className="py-2.5 px-4 text-right font-medium">Min Level</th>
                  <th className="py-2.5 px-5 text-right font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {metrics.lowStockProducts.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-sm text-slate-500">
                      No low-stock items right now.
                    </td>
                  </tr>
                ) : (
                  metrics.lowStockProducts.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/60">
                      <td className="py-3 px-5">
                        <p className="font-medium text-slate-900">{p.name}</p>
                        <p className="text-xs text-slate-500">
                          {p.category} · {p.unit}
                        </p>
                      </td>
                      <td className="py-3 px-4 text-slate-600">{p.supplier}</td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-red-600">
                        {p.stock}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-600">
                        {p.minStock}
                      </td>
                      <td className="py-3 px-5 text-right">
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>{p.stock === 0 ? 'Out of Stock' : 'Low Stock'}</span>
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {alertTab === 'expiring' && (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs text-slate-500">
                  <th className="py-2.5 px-5 text-left font-medium">Product</th>
                  <th className="py-2.5 px-4 text-left font-medium">Category</th>
                  <th className="py-2.5 px-4 text-right font-medium">Stock at Risk</th>
                  <th className="py-2.5 px-4 text-right font-medium">Expiry Date</th>
                  <th className="py-2.5 px-5 text-right font-medium">Urgency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {metrics.expiringSoonProducts.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-sm text-slate-500">
                      No products expiring within the next 14 days.
                    </td>
                  </tr>
                ) : (
                  metrics.expiringSoonProducts.map((p) => {
                    const exp = getExpiryStatus(p.expiryDate);
                    return (
                      <tr key={p.id} className="hover:bg-slate-50/60">
                        <td className="py-3 px-5">
                          <p className="font-medium text-slate-900">{p.name}</p>
                          <p className="text-xs text-slate-500">{p.unit}</p>
                        </td>
                        <td className="py-3 px-4 text-slate-600">{p.category}</td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                          {p.stock} ({formatInr(p.stock * p.costPrice)})
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                          {formatShortDate(p.expiryDate)}
                        </td>
                        <td className="py-3 px-5 text-right">
                          <span
                            className={`inline-flex items-center gap-1 text-xs font-medium ${
                              exp.severity === 'expired' || exp.severity === 'critical'
                                ? 'text-red-600'
                                : 'text-amber-700'
                            }`}
                          >
                            <CalendarClock className="w-3.5 h-3.5" />
                            <span>{exp.label}</span>
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
};
