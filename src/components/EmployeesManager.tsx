import React, { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { EmployeeInput } from '../api/client.ts';
import type {
  EmployeeRecord,
  EmployeeShift,
  EmployeeStatus,
} from '../types/store.ts';
import { formatInr, formatShortDate } from '../utils/storeMetrics.ts';

interface EmployeesManagerProps {
  employees: EmployeeRecord[];
  onAddEmployee: (input: EmployeeInput) => Promise<void>;
  onUpdateEmployee: (id: string, input: Partial<EmployeeInput>) => Promise<void>;
  onDeleteEmployee: (id: string) => Promise<void>;
}

export const EmployeesManager: React.FC<EmployeesManagerProps> = ({
  employees,
  onAddEmployee,
  onUpdateEmployee,
  onDeleteEmployee,
}) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [roleTitle, setRoleTitle] = useState('Billing Cashier');
  const [shift, setShift] = useState<EmployeeShift>('Morning');
  const [monthlySalary, setMonthlySalary] = useState('16000');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeCount = useMemo(
    () => employees.filter((e) => e.status === 'Active').length,
    [employees]
  );
  const totalMonthlyPayroll = useMemo(
    () => employees.reduce((sum, e) => sum + e.monthlySalary, 0),
    [employees]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim() || !email.trim() || !roleTitle.trim()) {
      setError('Name, email, and role title are required.');
      return;
    }
    setSubmitting(true);
    try {
      await onAddEmployee({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || '+91 98000 00000',
        roleTitle: roleTitle.trim(),
        shift,
        monthlySalary: Math.max(0, Number(monthlySalary) || 0),
        status: 'Active',
      });
      setName('');
      setEmail('');
      setPhone('');
      setRoleTitle('Billing Cashier');
      setMonthlySalary('16000');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to add employee.');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleStatus = async (emp: EmployeeRecord) => {
    const nextStatus: EmployeeStatus =
      emp.status === 'Active' ? 'On Leave' : 'Active';
    await onUpdateEmployee(emp.id, { status: nextStatus });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Staff Table */}
      <div className="lg:col-span-8 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs font-medium text-slate-500">Total Staff</p>
            <p className="mt-1.5 font-mono tabular-nums text-2xl font-semibold text-slate-900">
              {employees.length}
            </p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs font-medium text-slate-500">Active on Duty</p>
            <p className="mt-1.5 font-mono tabular-nums text-2xl font-semibold text-emerald-700">
              {activeCount}
            </p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs font-medium text-slate-500">Monthly Payroll</p>
            <p className="mt-1.5 font-mono tabular-nums text-2xl font-semibold text-slate-900">
              {formatInr(totalMonthlyPayroll)}
            </p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs text-slate-500">
                  <th className="py-2.5 px-5 text-left font-medium">Employee</th>
                  <th className="py-2.5 px-4 text-left font-medium">Role &amp; Shift</th>
                  <th className="py-2.5 px-4 text-right font-medium">Monthly Salary</th>
                  <th className="py-2.5 px-4 text-left font-medium">Status</th>
                  <th className="py-2.5 px-5 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {employees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-50/60">
                    <td className="py-3 px-5">
                      <p className="font-medium text-slate-900">{emp.name}</p>
                      <p className="text-xs text-slate-500">
                        {emp.email} · <span className="font-mono">{emp.phone}</span>
                      </p>
                    </td>
                    <td className="py-3 px-4">
                      <p className="text-slate-800">{emp.roleTitle}</p>
                      <p className="text-xs text-slate-500">
                        {emp.shift} shift · Joined {formatShortDate(emp.joinedDate)}
                      </p>
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-medium text-slate-900 whitespace-nowrap">
                      {formatInr(emp.monthlySalary)}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => toggleStatus(emp)}
                        className={`text-xs font-semibold cursor-pointer hover:underline ${
                          emp.status === 'Active' ? 'text-emerald-700' : 'text-amber-700'
                        }`}
                      >
                        {emp.status}
                      </button>
                    </td>
                    <td className="py-3 px-5 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onDeleteEmployee(emp.id)}
                        aria-label={`Remove ${emp.name}`}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add Employee Form */}
      <form
        onSubmit={handleSubmit}
        className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-5 space-y-4 lg:sticky lg:top-20"
      >
        <div>
          <h3 className="font-display text-base font-semibold text-slate-900">
            Add Store Employee
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Track counter cashiers, floor staff, shifts, and monthly payroll.
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Full Name</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Deepak Pawar"
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="deepak@smartstock.in"
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Phone</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 98201 00000"
              className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Shift</label>
            <select
              value={shift}
              onChange={(e) => setShift(e.target.value as EmployeeShift)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-teal-600"
            >
              <option value="Morning">Morning</option>
              <option value="Evening">Evening</option>
              <option value="Full Day">Full Day</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Role Title</label>
            <input
              type="text"
              required
              value={roleTitle}
              onChange={(e) => setRoleTitle(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Salary (₹/mo)
            </label>
            <input
              type="number"
              min="0"
              required
              value={monthlySalary}
              onChange={(e) => setMonthlySalary(e.target.value)}
              className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-2.5 px-4 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-sm font-medium flex items-center justify-center gap-1.5 transition-colors disabled:opacity-60 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>{submitting ? 'Adding...' : 'Add Employee'}</span>
        </button>
      </form>
    </div>
  );
};
