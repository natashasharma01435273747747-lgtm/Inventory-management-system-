import React, { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { CreateExpenseInput } from '../api/client.ts';
import type {
  ExpenseCategory,
  ExpenseRecord,
  PaymentMethod,
} from '../types/store.ts';
import { EXPENSE_CATEGORIES } from '../types/store.ts';
import {
  formatInr,
  formatShortDate,
  getLocalIsoDate,
} from '../utils/storeMetrics.ts';

interface ExpensesManagerProps {
  expenses: ExpenseRecord[];
  onAddExpense: (input: CreateExpenseInput) => Promise<void>;
  onDeleteExpense: (id: string) => Promise<void>;
}

export const ExpensesManager: React.FC<ExpensesManagerProps> = ({
  expenses,
  onAddExpense,
  onDeleteExpense,
}) => {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('Electricity & Utilities');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(getLocalIsoDate(0));
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | 'Bank Transfer'>('UPI');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterCat, setFilterCat] = useState<'All' | ExpenseCategory>('All');

  const totalAmount = useMemo(
    () => expenses.reduce((sum, e) => sum + e.amount, 0),
    [expenses]
  );

  const filtered = useMemo(() => {
    if (filterCat === 'All') return expenses;
    return expenses.filter((e) => e.category === filterCat);
  }, [expenses, filterCat]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const numAmt = Number(amount);
    if (!title.trim() || !Number.isFinite(numAmt) || numAmt <= 0) {
      setError('Enter an expense description and an amount greater than ₹0.');
      return;
    }
    setSubmitting(true);
    try {
      await onAddExpense({
        title: title.trim(),
        category,
        amount: numAmt,
        date,
        paymentMethod,
        notes: notes.trim() || undefined,
      });
      setTitle('');
      setAmount('');
      setNotes('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to record expense.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left: Expense Ledger */}
      <div className="lg:col-span-8 space-y-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-slate-500">Total Logged Operating Expenses</p>
            <p className="mt-1 font-mono tabular-nums text-2xl font-semibold text-slate-900">
              {formatInr(totalAmount)}
            </p>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {(['All', ...EXPENSE_CATEGORIES] as const).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setFilterCat(cat)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer whitespace-nowrap ${
                  filterCat === cat
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs text-slate-500">
                  <th className="py-2.5 px-5 text-left font-medium">Date</th>
                  <th className="py-2.5 px-4 text-left font-medium">Expense &amp; Notes</th>
                  <th className="py-2.5 px-4 text-left font-medium">Category</th>
                  <th className="py-2.5 px-4 text-right font-medium">Amount</th>
                  <th className="py-2.5 px-5 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-sm text-slate-500">
                      No expenses recorded for this category.
                    </td>
                  </tr>
                ) : (
                  filtered.map((exp) => (
                    <tr key={exp.id} className="hover:bg-slate-50/60">
                      <td className="py-3 px-5 font-mono tabular-nums text-xs text-slate-700 whitespace-nowrap">
                        {formatShortDate(exp.date)}
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-medium text-slate-900">{exp.title}</p>
                        <p className="text-xs text-slate-500">
                          {exp.paymentMethod}
                          {exp.notes ? ` · ${exp.notes}` : ''}
                        </p>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600 whitespace-nowrap">
                        {exp.category}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                        {formatInr(exp.amount)}
                      </td>
                      <td className="py-3 px-5 text-right">
                        <button
                          type="button"
                          onClick={() => onDeleteExpense(exp.id)}
                          aria-label={`Delete ${exp.title}`}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Right: Add Expense Form */}
      <form
        onSubmit={handleSubmit}
        className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-5 space-y-4 lg:sticky lg:top-20"
      >
        <div>
          <h3 className="font-display text-base font-semibold text-slate-900">
            Log Business Expense
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Expenses immediately deduct from your Net Profit calculation.
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            Expense Description
          </label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Monthly Shop Electricity Bill"
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Amount (₹)
            </label>
            <input
              type="number"
              min="1"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="500"
              className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Date</label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-teal-600"
            >
              {EXPENSE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Paid Via</label>
            <select
              value={paymentMethod}
              onChange={(e) =>
                setPaymentMethod(e.target.value as PaymentMethod | 'Bank Transfer')
              }
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-teal-600"
            >
              <option value="UPI">UPI</option>
              <option value="Cash">Cash</option>
              <option value="Card">Card</option>
              <option value="Bank Transfer">Bank Transfer</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            Notes (Optional)
          </label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Vendor or receipt reference"
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-2.5 px-4 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-sm font-medium flex items-center justify-center gap-1.5 transition-colors disabled:opacity-60 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>{submitting ? 'Saving...' : 'Add Expense'}</span>
        </button>
      </form>
    </div>
  );
};
