'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, DollarSign, Trash2, Plus, Save, Minus, Pencil } from 'lucide-react';
import { z } from 'zod';
import { apiJson } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { STANDARD_EXPENSE_CATEGORIES } from '../lib/expenseCategories';

const createExpenseSchema = z.object({
  amount: z.coerce.number().positive(),
  category: z.string().min(1),
  date: z.string().min(1),
  note: z.string().optional(),
  type: z.enum(['EXPENSE', 'INCOME']),
});

type TxType = 'EXPENSE' | 'INCOME';

type Expense = {
  id: string;
  amount: number;
  category: string;
  type: TxType;
  date: string;
  note?: string | null;
};

const expenseCategories = [...STANDARD_EXPENSE_CATEGORIES];

const incomeCategories = ['Paycheck', 'Scholarship', 'Gift', 'Refund', 'Other'];

type FieldErrors = {
  amount?: string;
  category?: string;
  date?: string;
  note?: string;
  type?: string;
};

export function Expenses() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();

  const [items, setItems] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [showForm, setShowForm] = useState(false);

  const mostRecentMonthDate = useMemo(() => {
    if (items.length === 0) return new Date();
    let max = new Date(items[0].date);
    for (const it of items) {
      const d = new Date(it.date);
      if (!Number.isNaN(d.getTime()) && d > max) max = d;
    }
    return max;
  }, [items]);

  const activeMonthLabel = useMemo(
    () =>
      mostRecentMonthDate.toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      }),
    [mostRecentMonthDate],
  );

  const [type, setType] = useState<TxType>('EXPENSE');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<string>(expenseCategories[0]);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const [editingItem, setEditingItem] = useState<Expense | null>(null);
  const [editType, setEditType] = useState<TxType>('EXPENSE');
  const [editAmount, setEditAmount] = useState('');
  const [editCategory, setEditCategory] = useState<string>(expenseCategories[0]);
  const [editDate, setEditDate] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editFieldErrors, setEditFieldErrors] = useState<FieldErrors>({});

  useEffect(() => {
    if (!isAuthenticated) router.push('/login');
  }, [isAuthenticated, router]);

  useEffect(() => {
    if (type === 'EXPENSE') setCategory(expenseCategories[0]);
    else setCategory(incomeCategories[0]);
  }, [type]);

  useEffect(() => {
    if (!editingItem) return;
    const list = editType === 'EXPENSE' ? expenseCategories : incomeCategories;
    if (!list.includes(editCategory)) {
      setEditCategory(list[0]);
    }
  }, [editType, editingItem, editCategory]);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiJson('/api/expenses');
      setItems(
        (data?.expenses || []).map((e: any) => ({
          id: e.id,
          amount: e.amount,
          category: e.category,
          type: (e.type || 'EXPENSE') as TxType,
          date: new Date(e.date).toISOString(),
          note: e.note,
        })),
      );
    } catch (e: any) {
      setError(e?.message || 'Failed to load expenses');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) refresh();
  }, [isAuthenticated]);

  const totals = useMemo(() => {
    const y = mostRecentMonthDate.getFullYear();
    const m = mostRecentMonthDate.getMonth();

    const thisMonthItems = items.filter((x) => {
      const d = new Date(x.date);
      return d.getFullYear() === y && d.getMonth() === m;
    });

    const incomeTotal = thisMonthItems
      .filter((x) => x.type === 'INCOME')
      .reduce((s, x) => s + (x.amount || 0), 0);

    const expenseTotal = thisMonthItems
      .filter((x) => x.type === 'EXPENSE')
      .reduce((s, x) => s + (x.amount || 0), 0);

    const net = incomeTotal - expenseTotal;
    return { incomeTotal, expenseTotal, net };
  }, [items]);

  const onAdd = async () => {
    setSaving(true);
    setError(null);
    setFieldErrors({});

    try {
      const parsed = createExpenseSchema.parse({
        amount,
        category,
        date,
        note: note || undefined,
        type,
      });

      await apiJson('/api/expenses', {
        method: 'POST',
        body: JSON.stringify({
          amount: parsed.amount,
          category: parsed.category,
          date: parsed.date,
          note: parsed.note,
          type: parsed.type,
        }),
      });

      setShowForm(false);
      setAmount('');
      setNote('');
      await refresh();
    } catch (e: any) {
      if (e instanceof z.ZodError) {
        const flattened = e.flatten();
        setFieldErrors({
          amount: flattened.fieldErrors.amount?.[0],
          category: flattened.fieldErrors.category?.[0],
          date: flattened.fieldErrors.date?.[0],
          note: flattened.fieldErrors.note?.[0],
          type: flattened.fieldErrors.type?.[0],
        });
        setError('Please fix the highlighted fields.');
        return;
      }

      const server = e?.data || e?.response || e;
      const serverFieldErrors = server?.error?.fieldErrors;

      if (serverFieldErrors) {
        setFieldErrors({
          amount: serverFieldErrors.amount?.[0],
          category: serverFieldErrors.category?.[0],
          date: serverFieldErrors.date?.[0],
          note: serverFieldErrors.note?.[0],
          type: serverFieldErrors.type?.[0],
        });
        setError('Please fix the highlighted fields.');
        return;
      }

      setError(e?.message || 'Failed to add item');
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (id: string) => {
    setError(null);
    try {
      await apiJson(`/api/expenses/${id}`, { method: 'DELETE' });
      setItems((prev) => prev.filter((x) => x.id !== id));
    } catch (e: any) {
      setError(e?.message || 'Failed to delete item');
    }
  };

  const categoryList = type === 'EXPENSE' ? expenseCategories : incomeCategories;
  const editCategoryList = editType === 'EXPENSE' ? expenseCategories : incomeCategories;

  const openEdit = (item: Expense) => {
    setEditingItem(item);
    setEditType(item.type);
    setEditAmount(item.amount.toString());
    setEditCategory(item.category);
    setEditDate(new Date(item.date).toISOString().slice(0, 10));
    setEditNote(item.note || '');
    setEditFieldErrors({});
    setError(null);
  };

  const closeEdit = () => {
    setEditingItem(null);
    setEditSaving(false);
    setEditFieldErrors({});
  };

  const onEditSave = async () => {
    if (!editingItem) return;

    setEditSaving(true);
    setError(null);
    setEditFieldErrors({});

    try {
      const parsed = createExpenseSchema.parse({
        amount: editAmount,
        category: editCategory,
        date: editDate,
        note: editNote || undefined,
        type: editType,
      });

      await apiJson(`/api/expenses/${editingItem.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          amount: parsed.amount,
          category: parsed.category,
          date: parsed.date,
          note: parsed.note,
          type: parsed.type,
        }),
      });

      closeEdit();
      await refresh();
    } catch (e: any) {
      if (e instanceof z.ZodError) {
        const flattened = e.flatten();
        setEditFieldErrors({
          amount: flattened.fieldErrors.amount?.[0],
          category: flattened.fieldErrors.category?.[0],
          date: flattened.fieldErrors.date?.[0],
          note: flattened.fieldErrors.note?.[0],
          type: flattened.fieldErrors.type?.[0],
        });
        setError('Please fix the highlighted fields.');
        return;
      }

      const server = e?.data || e?.response || e;
      const serverFieldErrors = server?.error?.fieldErrors;

      if (serverFieldErrors) {
        setEditFieldErrors({
          amount: serverFieldErrors.amount?.[0],
          category: serverFieldErrors.category?.[0],
          date: serverFieldErrors.date?.[0],
          note: serverFieldErrors.note?.[0],
          type: serverFieldErrors.type?.[0],
        });
        setError('Please fix the highlighted fields.');
        return;
      }

      setError(e?.message || 'Failed to update item');
    } finally {
      setEditSaving(false);
    }
  };

  if (!isAuthenticated) return null;

  return (
    <div className="p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Expenses</h1>
            <p className="text-gray-600">Track expenses and income. Dates support backdating.</p>
          </div>

          <button
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            {showForm ? <Minus className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
            <span>{showForm ? 'Close' : 'Add Item'}</span>
          </button>
        </div>

        {error ? (
          <div className="mb-4 p-3 rounded-lg border border-red-200 bg-red-50 text-red-700">{error}</div>
        ) : null}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-lg p-4 border border-gray-100">
            <div className="text-sm text-gray-600">Income ({activeMonthLabel})</div>
            <div className="text-lg font-semibold text-green-700 flex items-center gap-1">
              <DollarSign className="w-4 h-4" /> {totals.incomeTotal.toFixed(2)}
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-4 border border-gray-100">
            <div className="text-sm text-gray-600">Expenses ({activeMonthLabel})</div>
            <div className="text-lg font-semibold text-red-700 flex items-center gap-1">
              <DollarSign className="w-4 h-4" /> {totals.expenseTotal.toFixed(2)}
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-4 border border-gray-100">
            <div className="text-sm text-gray-600">Net ({activeMonthLabel})</div>
            <div
              className={`text-lg font-semibold flex items-center gap-1 ${
                totals.net >= 0 ? 'text-gray-900' : 'text-red-700'
              }`}
            >
              <DollarSign className="w-4 h-4" /> {totals.net.toFixed(2)}
            </div>
          </div>
        </div>

        {showForm ? (
          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100 mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">New Item</h2>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as TxType)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                >
                  <option value="EXPENSE">Expense</option>
                  <option value="INCOME">Income</option>
                </select>
                {fieldErrors.type ? <p className="mt-1 text-sm text-red-600">{fieldErrors.type}</p> : null}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Amount</label>
                <input
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  inputMode="decimal"
                  placeholder="12.34"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
                {fieldErrors.amount ? <p className="mt-1 text-sm text-red-600">{fieldErrors.amount}</p> : null}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                >
                  {categoryList.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                {fieldErrors.category ? <p className="mt-1 text-sm text-red-600">{fieldErrors.category}</p> : null}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
                {fieldErrors.date ? <p className="mt-1 text-sm text-red-600">{fieldErrors.date}</p> : null}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Note (optional)</label>
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Optional"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
                {fieldErrors.note ? <p className="mt-1 text-sm text-red-600">{fieldErrors.note}</p> : null}
              </div>
            </div>

            <div className="mt-4">
              <button
                onClick={onAdd}
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-black disabled:opacity-60"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? 'Saving...' : 'Save'}</span>
              </button>
            </div>
          </div>
        ) : null}

        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">History</h2>
          </div>

          {loading ? (
            <div className="text-gray-600">Loading...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Date</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Type</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Category</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Note</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-600">Amount</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((x) => {
                    const isIncome = x.type === 'INCOME';
                    return (
                      <tr key={x.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Calendar className="w-4 h-4" />
                            {new Date(x.date).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-sm font-semibold">
                          <span
                            className={`px-2 py-0.5 rounded ${
                              isIncome ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {x.type}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {x.category}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-700">{x.note || ''}</td>
                        <td className="py-3 px-4 text-right">
                          <div
                            className={`flex items-center justify-end gap-1 text-sm font-semibold ${
                              isIncome ? 'text-green-700' : 'text-gray-900'
                            }`}
                          >
                            <DollarSign className="w-4 h-4" />
                            {isIncome ? '+' : '-'}
                            {x.amount.toFixed(2)}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => openEdit(x)}
                              className="inline-flex items-center justify-center p-2 hover:bg-indigo-50 rounded-lg transition-colors"
                              aria-label="Edit"
                            >
                              <Pencil className="w-4 h-4 text-indigo-600" />
                            </button>
                            <button
                              onClick={() => onDelete(x.id)}
                              className="inline-flex items-center justify-center p-2 hover:bg-red-50 rounded-lg transition-colors"
                              aria-label="Delete"
                            >
                              <Trash2 className="w-4 h-4 text-red-600" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {items.length === 0 ? <div className="text-sm text-gray-600 mt-4">No items yet.</div> : null}
            </div>
          )}
        </div>
      </div>

      {editingItem ? (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl border border-gray-100 w-full max-w-lg p-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Edit Item</h2>
                <p className="text-sm text-gray-600">Update the details of this entry.</p>
              </div>
              <button onClick={closeEdit} className="text-sm text-gray-500 hover:text-gray-700">
                Close
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
                <select
                  value={editType}
                  onChange={(e) => setEditType(e.target.value as TxType)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                >
                  <option value="EXPENSE">Expense</option>
                  <option value="INCOME">Income</option>
                </select>
                {editFieldErrors.type ? <p className="mt-1 text-sm text-red-600">{editFieldErrors.type}</p> : null}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Amount</label>
                <input
                  type="number"
                  step="0.01"
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                  inputMode="decimal"
                  placeholder="12.34"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
                {editFieldErrors.amount ? <p className="mt-1 text-sm text-red-600">{editFieldErrors.amount}</p> : null}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                <select
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                >
                  {editCategoryList.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                {editFieldErrors.category ? <p className="mt-1 text-sm text-red-600">{editFieldErrors.category}</p> : null}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
                <input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
                {editFieldErrors.date ? <p className="mt-1 text-sm text-red-600">{editFieldErrors.date}</p> : null}
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Note (optional)</label>
                <input
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  placeholder="Optional"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
                {editFieldErrors.note ? <p className="mt-1 text-sm text-red-600">{editFieldErrors.note}</p> : null}
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={closeEdit}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={onEditSave}
                disabled={editSaving}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-black disabled:opacity-60"
              >
                <Save className="w-4 h-4" />
                <span>{editSaving ? 'Saving...' : 'Save changes'}</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}