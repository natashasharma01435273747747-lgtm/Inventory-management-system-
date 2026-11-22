import React, { useMemo, useState } from 'react';
import { Download, Eye } from 'lucide-react';
import type { PaymentMethod, PurchaseRecord, SaleRecord } from '../types/store.ts';
import {
  formatInr,
  formatShortDate,
  formatTimeAgo,
} from '../utils/storeMetrics.ts';

interface ReportsViewProps {
  sales: SaleRecord[];
  purchases: PurchaseRecord[];
  onViewReceipt: (sale: SaleRecord) => void;
  employeeMode?: boolean;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  sales,
  purchases,
  onViewReceipt,
  employeeMode = false,
}) => {
  const [reportTab, setReportTab] = useState<'sales' | 'purchases'>('sales');
  const [paymentFilter, setPaymentFilter] = useState<'All' | PaymentMethod>('All');

  const filteredSales = useMemo(() => {
    if (paymentFilter === 'All') return sales;
    return sales.filter((s) => s.paymentMethod === paymentFilter);
  }, [sales, paymentFilter]);

  const totalSalesRevenue = useMemo(
    () => filteredSales.reduce((sum, s) => sum + s.totalAmount, 0),
    [filteredSales]
  );
  const totalGrossProfit = useMemo(
    () => filteredSales.reduce((sum, s) => sum + s.grossProfit, 0),
    [filteredSales]
  );
  const totalPurchaseSpend = useMemo(
    () => purchases.reduce((sum, p) => sum + p.totalCost, 0),
    [purchases]
  );

  const handleExportCsv = () => {
    const rows =
      reportTab === 'sales'
        ? [
            ['Invoice', 'Date', 'Customer', 'Payment', 'Cashier', 'Items', 'Total (INR)', 'Gross Profit (INR)'],
            ...filteredSales.map((s) => [
              s.invoiceNumber,
              s.date,
              s.customerName,
              s.paymentMethod,
              s.cashierName,
              String(s.items.reduce((acc, i) => acc + i.quantity, 0)),
              String(s.totalAmount),
              String(s.grossProfit),
            ]),
          ]
        : [
            ['Date', 'Product', 'Category', 'Supplier', 'Quantity', 'Unit Cost (INR)', 'Total Cost (INR)', 'Recorded By'],
            ...purchases.map((p) => [
              p.date,
              p.productName,
              p.category,
              p.supplier,
              String(p.quantity),
              String(p.unitCost),
              String(p.totalCost),
              p.recordedBy,
            ]),
          ];

    const csv = rows
      .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `smartstock-${reportTab}-report.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      {/* Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs font-medium text-slate-500">Total Billed Revenue</p>
          <p className="mt-1.5 font-mono tabular-nums text-2xl font-semibold text-slate-900">
            {formatInr(totalSalesRevenue)}
          </p>
          <p className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
            {filteredSales.length} invoices
          </p>
        </div>

        {!employeeMode ? (
          <>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-xs font-medium text-slate-500">Gross Profit on Sales</p>
              <p className="mt-1.5 font-mono tabular-nums text-2xl font-semibold text-emerald-700">
                {formatInr(totalGrossProfit)}
              </p>
              <p className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
                {totalSalesRevenue > 0
                  ? `${((totalGrossProfit / totalSalesRevenue) * 100).toFixed(1)}% avg margin`
                  : '0% margin'}
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-xs font-medium text-slate-500">Total Stock Purchases</p>
              <p className="mt-1.5 font-mono tabular-nums text-2xl font-semibold text-slate-900">
                {formatInr(totalPurchaseSpend)}
              </p>
              <p className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
                {purchases.length} supplier restocks
              </p>
            </div>
          </>
        ) : (
          <>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-xs font-medium text-slate-500">UPI Payments</p>
              <p className="mt-1.5 font-mono tabular-nums text-2xl font-semibold text-slate-900">
                {formatInr(
                  sales
                    .filter((s) => s.paymentMethod === 'UPI')
                    .reduce((sum, s) => sum + s.totalAmount, 0)
                )}
              </p>
              <p className="mt-1 text-xs text-slate-500">Digital counter collections</p>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-xs font-medium text-slate-500">Cash &amp; Card Payments</p>
              <p className="mt-1.5 font-mono tabular-nums text-2xl font-semibold text-slate-900">
                {formatInr(
                  sales
                    .filter((s) => s.paymentMethod !== 'UPI')
                    .reduce((sum, s) => sum + s.totalAmount, 0)
                )}
              </p>
              <p className="mt-1 text-xs text-slate-500">Counter drawer &amp; card machine</p>
            </div>
          </>
        )}
      </div>

      {/* Report Table Container */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            {!employeeMode && (
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                <button
                  type="button"
                  onClick={() => setReportTab('sales')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer whitespace-nowrap ${
                    reportTab === 'sales'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Sales Invoices ({sales.length})
                </button>
                <button
                  type="button"
                  onClick={() => setReportTab('purchases')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer whitespace-nowrap ${
                    reportTab === 'purchases'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Purchase Log ({purchases.length})
                </button>
              </div>
            )}

            {reportTab === 'sales' && (
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                {(['All', 'UPI', 'Cash', 'Card'] as const).map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setPaymentFilter(method)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md cursor-pointer whitespace-nowrap ${
                      paymentFilter === method
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {method}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleExportCsv}
            className="px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download CSV</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          {reportTab === 'sales' ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs text-slate-500">
                  <th className="py-2.5 px-5 text-left font-medium">Invoice &amp; Time</th>
                  <th className="py-2.5 px-4 text-left font-medium">Customer</th>
                  <th className="py-2.5 px-4 text-left font-medium">Items</th>
                  <th className="py-2.5 px-4 text-left font-medium">Payment</th>
                  <th className="py-2.5 px-4 text-right font-medium">Bill Total</th>
                  {!employeeMode && (
                    <th className="py-2.5 px-4 text-right font-medium">Gross Profit</th>
                  )}
                  <th className="py-2.5 px-5 text-right font-medium">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-slate-50/60">
                    <td className="py-3 px-5 whitespace-nowrap">
                      <p className="font-mono tabular-nums font-medium text-slate-900">
                        {sale.invoiceNumber}
                      </p>
                      <p className="text-xs text-slate-500 font-mono">
                        {formatTimeAgo(sale.createdAt)}
                      </p>
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-medium text-slate-900">{sale.customerName}</p>
                      <p className="text-xs text-slate-500">By {sale.cashierName}</p>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600 max-w-[240px]">
                      <p className="truncate">
                        {sale.items
                          .map((i) => `${i.productName.split(' ')[0]} ×${i.quantity}`)
                          .join(', ')}
                      </p>
                      <p className="text-slate-400 font-mono">
                        {sale.items.reduce((s, i) => s + i.quantity, 0)} units total
                      </p>
                    </td>
                    <td className="py-3 px-4 text-xs font-medium text-slate-700 whitespace-nowrap">
                      {sale.paymentMethod}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                      {formatInr(sale.totalAmount)}
                    </td>
                    {!employeeMode && (
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-emerald-700 whitespace-nowrap">
                        {formatInr(sale.grossProfit)}
                      </td>
                    )}
                    <td className="py-3 px-5 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onViewReceipt(sale)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 hover:text-teal-900 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View Bill</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs text-slate-500">
                  <th className="py-2.5 px-5 text-left font-medium">Date</th>
                  <th className="py-2.5 px-4 text-left font-medium">Product</th>
                  <th className="py-2.5 px-4 text-left font-medium">Supplier</th>
                  <th className="py-2.5 px-4 text-right font-medium">Qty</th>
                  <th className="py-2.5 px-4 text-right font-medium">Unit Cost</th>
                  <th className="py-2.5 px-4 text-right font-medium">Total Cost</th>
                  <th className="py-2.5 px-5 text-left font-medium">Recorded By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {purchases.map((pur) => (
                  <tr key={pur.id} className="hover:bg-slate-50/60">
                    <td className="py-3 px-5 font-mono tabular-nums text-xs text-slate-700 whitespace-nowrap">
                      {formatShortDate(pur.date)}
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-medium text-slate-900">{pur.productName}</p>
                      <p className="text-xs text-slate-500">{pur.category}</p>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600">{pur.supplier}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-medium text-teal-700">
                      +{pur.quantity}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-600">
                      {formatInr(pur.unitCost)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                      {formatInr(pur.totalCost)}
                    </td>
                    <td className="py-3 px-5 text-xs text-slate-600 whitespace-nowrap">
                      {pur.recordedBy}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
