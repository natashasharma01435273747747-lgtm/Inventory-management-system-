import React from 'react';
import { CheckCircle2, Printer, Receipt, X } from 'lucide-react';
import type { SaleRecord } from '../types/store.ts';
import { formatInr, formatTimeAgo } from '../utils/storeMetrics.ts';
import { ProductPackThumbnail } from './ProductPackThumbnail.tsx';

interface ReceiptModalProps {
  sale: SaleRecord | null;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ sale, onClose }) => {
  if (!sale) return null;

  const items = Array.isArray(sale.items) ? sale.items : [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#0B1736]/50 sm:p-4 print:static print:bg-white print:p-0"
      role="dialog"
      aria-modal="true"
      aria-label={`Invoice ${sale.invoiceNumber}`}
    >
      <div className="bg-[#F8FAFC] border border-[#DCE6FA] rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden print:border-0 print:shadow-none print:max-h-none print:bg-white">
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 bg-white border-b border-slate-200/80 flex items-center justify-between gap-3 shrink-0 print:hidden">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#E6F9EE] text-[#118C4F] flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-display text-base font-bold text-[#0B1736] truncate">
                Customer Tax Invoice
              </h3>
              <p className="text-xs text-[#5B6E94] font-mono tabular-nums truncate">
                {sale.invoiceNumber} · {formatTimeAgo(sale.createdAt)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close receipt"
            className="p-2 rounded-xl text-slate-400 hover:text-slate-900 hover:bg-slate-100 cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Digital / Printable Receipt Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 print:p-6 print:overflow-visible">
          {/* Store & Customer Card */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-start justify-between gap-4 print:border-slate-200 print:shadow-none">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0052FF]">
                <Receipt className="w-3.5 h-3.5" />
                <span>SmartStock AI · Digital Receipt</span>
              </div>
              <p className="mt-1 font-display text-sm sm:text-base font-bold text-[#0B1736]">
                Shree Ganesh General Store
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                Shop 14, Linking Road, Bandra West, Mumbai 400050
              </p>
              <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                GSTIN: 27AABCS1429B1Z5
              </p>
            </div>

            <div className="text-right text-xs text-slate-600 shrink-0">
              <p className="font-bold text-[#0B1736]">{sale.customerName}</p>
              {sale.customerPhone && (
                <p className="font-mono text-slate-500 mt-0.5">{sale.customerPhone}</p>
              )}
              <span className="mt-1.5 inline-flex items-center px-2 py-0.5 rounded-full bg-[#EEF4FF] text-[#0052FF] text-[11px] font-semibold">
                Paid via {sale.paymentMethod}
              </span>
            </div>
          </div>

          {/* Line Items with Compact Product Thumbnails */}
          <div className="space-y-2">
            <div className="px-1 flex items-center justify-between text-[11px] font-semibold text-[#5B6E94] uppercase tracking-wider">
              <span>Billed Items ({items.length})</span>
              <span>Amount</span>
            </div>

            <div className="space-y-2">
              {items.map((item) => (
                <div
                  key={`${item.productId}-${item.sku}`}
                  className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3 flex items-center gap-3 print:border-slate-200 print:shadow-none"
                >
                  <ProductPackThumbnail
                    product={{
                      id: item.productId,
                      name: item.productName,
                      category: item.category,
                      unit: item.unit,
                    }}
                    compact
                    className="w-10 h-10"
                  />

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-[#0B1736] leading-snug">
                      {item.productName}
                    </p>
                    <p className="mt-0.5 text-xs text-[#5B6E94] font-mono tabular-nums">
                      {formatInr(item.unitPrice)} × {item.quantity}
                      {item.unit ? ` · ${item.unit}` : ''}
                    </p>
                  </div>

                  <span className="font-mono tabular-nums text-sm font-bold text-[#0B1736] shrink-0">
                    {formatInr(item.lineTotal)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Totals Summary Card */}
          <div className="bg-white rounded-2xl border border-[#DCE6FA] shadow-sm p-4 space-y-2 text-xs sm:text-sm print:border-slate-200 print:shadow-none">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal</span>
              <span className="font-mono tabular-nums">{formatInr(sale.subtotal, true)}</span>
            </div>
            {sale.discount > 0 && (
              <div className="flex justify-between text-emerald-700 font-medium">
                <span>Discount</span>
                <span className="font-mono tabular-nums">-{formatInr(sale.discount, true)}</span>
              </div>
            )}
            <div className="flex justify-between text-slate-600">
              <span>GST (5%)</span>
              <span className="font-mono tabular-nums">{formatInr(sale.gstAmount, true)}</span>
            </div>
            <div className="pt-2.5 mt-1 border-t border-slate-100 flex justify-between items-baseline text-base font-bold text-[#0B1736]">
              <span>Grand Total</span>
              <span className="font-mono tabular-nums text-lg text-[#16A34A]">
                {formatInr(sale.totalAmount, true)}
              </span>
            </div>
          </div>

          <p className="text-xs text-[#5B6E94] text-center px-2">
            Billed by <span className="font-semibold text-[#0B1736]">{sale.cashierName}</span> ·
            Stock quantities automatically deducted from store inventory.
          </p>
        </div>

        {/* Footer Actions */}
        <div className="px-5 sm:px-6 py-4 border-t border-slate-200/80 bg-white flex items-center justify-end gap-2.5 shrink-0 print:hidden">
          <button
            type="button"
            onClick={() => window.print()}
            className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs sm:text-sm font-semibold text-[#0B1736] flex items-center gap-2 cursor-pointer whitespace-nowrap"
          >
            <Printer className="w-4 h-4" />
            <span>Print Bill</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-[#0052FF] hover:bg-[#0044D6] text-xs sm:text-sm font-semibold text-white shadow-[0_6px_16px_rgba(0,82,255,0.28)] cursor-pointer whitespace-nowrap"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
