import React, { useMemo, useState } from 'react';
import { Check, CheckCircle2, X } from 'lucide-react';
import type { Product, StockAdjustmentRequest } from '../types/store.ts';
import { formatTimeAgo } from '../utils/storeMetrics.ts';

interface ApprovalsManagerProps {
  adjustments: StockAdjustmentRequest[];
  products: Product[];
  onReview: (
    id: string,
    decision: 'Approved' | 'Rejected',
    reviewNote?: string
  ) => Promise<void>;
}

export const ApprovalsManager: React.FC<ApprovalsManagerProps> = ({
  adjustments,
  products,
  onReview,
}) => {
  const [filter, setFilter] = useState<'Pending' | 'Reviewed' | 'All'>('Pending');
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  const productMap = useMemo(
    () => new Map(products.map((p) => [p.id, p])),
    [products]
  );

  const pendingCount = useMemo(
    () => adjustments.filter((a) => a.status === 'Pending').length,
    [adjustments]
  );

  const filtered = useMemo(() => {
    if (filter === 'Pending') return adjustments.filter((a) => a.status === 'Pending');
    if (filter === 'Reviewed') return adjustments.filter((a) => a.status !== 'Pending');
    return adjustments;
  }, [adjustments, filter]);

  const handleDecision = async (
    req: StockAdjustmentRequest,
    decision: 'Approved' | 'Rejected'
  ) => {
    setBusyId(req.id);
    setBanner(null);
    try {
      await onReview(req.id, decision, reviewNotes[req.id]);
      setBanner(
        decision === 'Approved'
          ? `Approved ${req.requestedDelta >= 0 ? `+${req.requestedDelta}` : req.requestedDelta} stock adjustment for ${req.productName}. Live inventory updated.`
          : `Rejected stock adjustment request for ${req.productName}.`
      );
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-5">
      {banner && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 flex items-center justify-between gap-3">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{banner}</span>
          </span>
          <button
            type="button"
            onClick={() => setBanner(null)}
            className="text-xs font-medium text-emerald-700 hover:text-emerald-900 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-base font-semibold text-slate-900">
            Employee Stock Adjustment Approvals
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Review employee-submitted damaged write-offs, shelf corrections, and received
            deliveries before updating inventory.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
          {(['Pending', 'Reviewed', 'All'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setFilter(tab)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer whitespace-nowrap ${
                filter === tab
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab}
              {tab === 'Pending' ? ` (${pendingCount})` : ''}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <p className="font-medium text-slate-900">No {filter.toLowerCase()} requests</p>
          <p className="mt-1 text-xs text-slate-500">
            When employees submit a stock adjustment request from the Employee Dashboard, it will
            appear here for your approval.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((req) => {
            const liveProduct = productMap.get(req.productId);
            const liveStock = liveProduct?.stock ?? req.currentStock;
            const proposedStock = Math.max(0, liveStock + req.requestedDelta);

            return (
              <article
                key={req.id}
                className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-5"
              >
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="font-medium text-slate-800">{req.reasonType}</span>
                    <span aria-hidden="true">·</span>
                    <span>Requested by {req.requestedBy}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono">{formatTimeAgo(req.requestedAt)}</span>
                  </div>

                  <h3 className="font-display text-base font-semibold text-slate-900">
                    {req.productName}
                  </h3>

                  <p className="text-sm text-slate-600 leading-relaxed">{req.notes}</p>

                  <div className="pt-1 flex flex-wrap items-center gap-4 text-xs font-mono tabular-nums">
                    <span className="text-slate-600">
                      Live Stock: <strong className="text-slate-900">{liveStock}</strong>
                    </span>
                    <span
                      className={`font-semibold ${
                        req.requestedDelta >= 0 ? 'text-emerald-700' : 'text-red-600'
                      }`}
                    >
                      Requested Delta:{' '}
                      {req.requestedDelta >= 0
                        ? `+${req.requestedDelta}`
                        : req.requestedDelta}
                    </span>
                    {req.status === 'Pending' && (
                      <span className="text-slate-600">
                        Resulting Stock:{' '}
                        <strong className="text-teal-700">{proposedStock}</strong>
                      </span>
                    )}
                  </div>
                </div>

                {req.status === 'Pending' ? (
                  <div className="lg:w-80 space-y-2.5 shrink-0">
                    <input
                      type="text"
                      value={reviewNotes[req.id] ?? ''}
                      onChange={(e) =>
                        setReviewNotes((prev) => ({
                          ...prev,
                          [req.id]: e.target.value,
                        }))
                      }
                      placeholder="Optional approval / rejection note..."
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={busyId === req.id}
                        onClick={() => handleDecision(req, 'Approved')}
                        className="flex-1 py-2 px-3 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer whitespace-nowrap"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Approve &amp; Update</span>
                      </button>
                      <button
                        type="button"
                        disabled={busyId === req.id}
                        onClick={() => handleDecision(req, 'Rejected')}
                        className="py-2 px-3 rounded-lg border border-slate-300 bg-white hover:border-red-300 hover:text-red-700 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1 transition-colors disabled:opacity-50 cursor-pointer whitespace-nowrap"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Reject</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="lg:text-right shrink-0 space-y-1">
                    <p
                      className={`text-sm font-semibold ${
                        req.status === 'Approved' ? 'text-emerald-700' : 'text-red-600'
                      }`}
                    >
                      {req.status}
                    </p>
                    <p className="text-xs text-slate-500">
                      By {req.reviewedBy} ·{' '}
                      <span className="font-mono">
                        {req.reviewedAt ? formatTimeAgo(req.reviewedAt) : ''}
                      </span>
                    </p>
                    {req.reviewNote && (
                      <p className="text-xs text-slate-600 max-w-xs">{req.reviewNote}</p>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
