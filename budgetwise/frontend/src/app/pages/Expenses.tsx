'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, DollarSign, Trash2, Plus, Save, Minus, Pencil, X, ChevronLeft, ChevronRight } from 'lucide-react';
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

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteConfirmIds, setDeleteConfirmIds] = useState<string[]>([]);
  const [deleteConfirmSaving, setDeleteConfirmSaving] = useState(false);
  const [search, setSearch] = useState("");

  type HistoryScope = "MONTH" | "YEAR" | "ALL";
  type HistoryType = "ALL" | TxType;

  const [historyScope, setHistoryScope] = useState<HistoryScope>("MONTH");
  const [historyType, setHistoryType] = useState<HistoryType>("ALL");
  const [historyCategory, setHistoryCategory] = useState<string>("ALL");

  const MONTH_SESSION_KEY = 'bw_expenses_month';

  const [selectedMonthDate, setSelectedMonthDate] = useState<Date>(() => {
    const now = new Date();
    const currentMonthDate = new Date(now.getFullYear(), now.getMonth(), 1);
    if (typeof window === 'undefined') return new Date();
    const saved = window.sessionStorage.getItem('bw_expenses_month');
    if (!saved) return currentMonthDate;
    const m = /^(\d{4})-(\d{1,2})$/.exec(saved);
    if (!m) return currentMonthDate;
    const year = Number(m[1]);
    const month1 = Number(m[2]);
    if (!Number.isFinite(year) || !Number.isFinite(month1)) return currentMonthDate;
    return new Date(year, month1 - 1, 1);
  });

  const [monthPickerOpen, setMonthPickerOpen] = useState(false);

  const selectedMonthLabel = useMemo(
    () =>
      selectedMonthDate.toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      }),
    [selectedMonthDate],
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
      setSelectedIds([]);
    } catch (e: any) {
      setError(e?.message || 'Failed to load expenses');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) refresh();
  }, [isAuthenticated]);

  const monthItems = useMemo(() => {
    const y = selectedMonthDate.getFullYear();
    const m = selectedMonthDate.getMonth();
    return items.filter((x) => {
      const d = new Date(x.date);
      return d.getFullYear() === y && d.getMonth() === m;
    });
  }, [items, selectedMonthDate]);

  const availableCategories = useMemo(() => {
    if (historyType === "EXPENSE") return expenseCategories;
    if (historyType === "INCOME") return incomeCategories;
    return [...expenseCategories, ...incomeCategories];
  }, [historyType]);

  const uniqueAvailableCategories = useMemo(() => {
    return Array.from(new Set(availableCategories));
  }, [availableCategories]);

  useEffect(() => {
    if (historyCategory === "ALL") return;
    if (uniqueAvailableCategories.includes(historyCategory)) return;
    setHistoryCategory("ALL");
  }, [uniqueAvailableCategories, historyCategory]);

  const scopeItems = useMemo(() => {
    if (historyScope === "MONTH") return monthItems;

    const selectedYear = selectedMonthDate.getFullYear();
    if (historyScope === "YEAR") {
      return items.filter((x) => {
        const d = new Date(x.date);
        return d.getFullYear() === selectedYear;
      });
    }

    // ALL
    return items;
  }, [historyScope, items, monthItems, selectedMonthDate]);

  const visibleItems = useMemo(() => {
    const q = search.trim().toLowerCase();

    let list = scopeItems;

    if (historyType !== "ALL") {
      list = list.filter((t) => t.type === historyType);
    }

    if (historyCategory !== "ALL") {
      list = list.filter((t) => t.category === historyCategory);
    }

    if (!q) return list;

    return list.filter((t) => {
      const note = t.note ?? "";
      return `${t.category} ${note}`.toLowerCase().includes(q);
    });
  }, [scopeItems, historyType, historyCategory, search]);

  useEffect(() => {
    // Clear row selections whenever the visible list changes.
    setSelectedIds([]);
  }, [historyScope, historyType, historyCategory, search, selectedMonthDate]);

  const monthsWithData = useMemo(() => {
    const map = new Map<string, Date>();
    for (const it of items) {
      const d = new Date(it.date);
      if (Number.isNaN(d.getTime())) continue;
      const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
      if (!map.has(key)) map.set(key, new Date(d.getFullYear(), d.getMonth(), 1));
    }
    const arr = Array.from(map.values());
    arr.sort((a, b) => a.getTime() - b.getTime());
    return arr;
  }, [items]);

  const selectMonth = (d: Date) => {
    const normalized = new Date(d.getFullYear(), d.getMonth(), 1);
    setSelectedMonthDate(normalized);
    setMonthPickerOpen(false);
    setSelectedIds([]);
    setDeleteConfirmOpen(false);
    setDeleteConfirmIds([]);
    setDeleteConfirmSaving(false);
    setError(null);
  };

  const goMonth = (delta: number) => {
    const next = new Date(selectedMonthDate.getFullYear(), selectedMonthDate.getMonth() + delta, 1);
    selectMonth(next);
  };

  // Persist month selection for the current browser session.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const selectedKey = `${selectedMonthDate.getFullYear()}-${selectedMonthDate.getMonth() + 1}`;
    window.sessionStorage.setItem(MONTH_SESSION_KEY, selectedKey);
  }, [selectedMonthDate]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      if (showForm || editingItem || deleteConfirmOpen || monthPickerOpen) return;

      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      if ((target as any)?.isContentEditable) return;

      e.preventDefault();
      goMonth(e.key === 'ArrowLeft' ? -1 : 1);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [editingItem, showForm, deleteConfirmOpen, monthPickerOpen, selectedMonthDate]);

  const totals = useMemo(() => {
    const incomeTotal = monthItems
      .filter((x) => x.type === 'INCOME')
      .reduce((s, x) => s + (x.amount || 0), 0);

    const expenseTotal = monthItems
      .filter((x) => x.type === 'EXPENSE')
      .reduce((s, x) => s + (x.amount || 0), 0);

    const net = incomeTotal - expenseTotal;
    return { incomeTotal, expenseTotal, net };
  }, [monthItems]);

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

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const openDeleteConfirm = (ids: string[]) => {
    setDeleteConfirmIds(ids);
    setDeleteConfirmOpen(true);
    setDeleteConfirmSaving(false);
    setError(null);
  };

  const closeDeleteConfirm = () => {
    setDeleteConfirmOpen(false);
    setDeleteConfirmIds([]);
    setDeleteConfirmSaving(false);
  };

  const confirmDelete = async () => {
    if (deleteConfirmIds.length === 0) return;

    setDeleteConfirmSaving(true);
    setError(null);

    try {
      await Promise.all(
        deleteConfirmIds.map(async (id) => {
          await apiJson(`/api/expenses/${id}`, { method: 'DELETE' });
        }),
      );

      setSelectedIds([]);
      closeDeleteConfirm();
      await refresh();
    } catch (e: any) {
      setError(e?.message || 'Failed to delete item(s)');
    } finally {
      setDeleteConfirmSaving(false);
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
            <h1 className="text-3xl font-bold text-gray-900">Transactions</h1>
            <p className="text-gray-600">Track all transactions, including expenses and income. Dates support backdating.</p>
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

        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-2">
            <button
              onClick={() => goMonth(-1)}
              className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
              aria-label="Previous month"
              disabled={monthPickerOpen}
            >
              <ChevronLeft className="w-5 h-5 text-gray-700" />
            </button>
            <div className="text-sm text-gray-600">
              Viewing <span className="font-semibold text-gray-900">{selectedMonthLabel}</span>
            </div>
            <button
              onClick={() => goMonth(1)}
              className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
              aria-label="Next month"
              disabled={monthPickerOpen}
            >
              <ChevronRight className="w-5 h-5 text-gray-700" />
            </button>
          </div>

          <div className="relative">
            <button
              onClick={() => setMonthPickerOpen((v) => !v)}
              className="px-4 py-2 border border-gray-200 rounded-lg bg-white hover:bg-gray-50 transition-colors text-sm font-semibold text-gray-700"
              aria-label="Pick month"
              disabled={loading}
            >
              Pick month
            </button>

            {monthPickerOpen ? (
              <div className="absolute right-0 mt-2 w-72 bg-white border border-gray-200 rounded-xl shadow-lg max-h-64 overflow-y-auto p-2 z-10">
                {(monthsWithData.length > 0 ? monthsWithData : [selectedMonthDate]).map((d) => {
                  const isSelected =
                    d.getFullYear() === selectedMonthDate.getFullYear() && d.getMonth() === selectedMonthDate.getMonth();
                  return (
                    <button
                      key={`${d.getFullYear()}-${d.getMonth() + 1}`}
                      onClick={() => selectMonth(d)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                        isSelected ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-gray-50 text-gray-700'
                      }`}
                    >
                      {d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-lg p-4 border border-gray-100">
            <div className="text-sm text-gray-600">Income ({selectedMonthLabel})</div>
            <div className="text-lg font-semibold text-green-700 flex items-center gap-1">
              <DollarSign className="w-4 h-4" /> {totals.incomeTotal.toFixed(2)}
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-4 border border-gray-100">
            <div className="text-sm text-gray-600">Expenses ({selectedMonthLabel})</div>
            <div className="text-lg font-semibold text-red-700 flex items-center gap-1">
              <DollarSign className="w-4 h-4" /> {totals.expenseTotal.toFixed(2)}
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-4 border border-gray-100">
            <div className="text-sm text-gray-600">Net ({selectedMonthLabel})</div>
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
            {selectedIds.length > 0 ? (
              <button
                onClick={() => openDeleteConfirm(selectedIds)}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors inline-flex items-center gap-2"
                disabled={deleteConfirmSaving}
              >
                <Trash2 className="w-4 h-4" />
                Delete Selected ({selectedIds.length})
              </button>
            ) : null}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Scope</label>
              <select
                value={historyScope}
                onChange={(e) => setHistoryScope(e.target.value as HistoryScope)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              >
                <option value="MONTH">Month</option>
                <option value="YEAR">Year</option>
                <option value="ALL">All time</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select
                value={historyType}
                onChange={(e) => {
                  const next = e.target.value as HistoryType;
                  setHistoryType(next);
                  setHistoryCategory("ALL");
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              >
                <option value="ALL">All</option>
                <option value="EXPENSE">Expenses</option>
                <option value="INCOME">Income</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select
                value={historyCategory}
                onChange={(e) => setHistoryCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              >
                <option value="ALL">All</option>
                  {uniqueAvailableCategories.map((c) => (
                    <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mb-4">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search category or note"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            />
          </div>

          {loading ? (
            <div className="text-gray-600">Loading...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="py-3 px-4 text-sm font-semibold text-gray-600 text-center w-16">
                      <input
                        type="checkbox"
                        aria-label="Select all transactions"
                        checked={visibleItems.length > 0 && selectedIds.length === visibleItems.length}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedIds(visibleItems.map((i) => i.id));
                          else setSelectedIds([]);
                        }}
                      />
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Date</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Type</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Category</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Note</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-600">Amount</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleItems.map((x) => {
                    const isIncome = x.type === 'INCOME';
                    const isSelected = selectedIds.includes(x.id);
                    return (
                      <tr
                        key={x.id}
                        className={`border-b border-gray-100 transition-colors ${isSelected ? 'bg-indigo-50' : 'hover:bg-gray-50'}`}
                      >
                        <td className="py-3 px-4 text-center">
                          <input
                            type="checkbox"
                            aria-label={`Select transaction ${x.category}`}
                            checked={isSelected}
                            onChange={() => toggleSelected(x.id)}
                          />
                        </td>
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
                              onClick={() => openDeleteConfirm([x.id])}
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

              {visibleItems.length === 0 ? (
                <div className="text-sm text-gray-600 mt-4">No matching transactions.</div>
              ) : null}
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

      {deleteConfirmOpen ? (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl border border-gray-100 w-full max-w-lg p-6 relative">
            <button
              onClick={closeDeleteConfirm}
              className="absolute top-3 right-3 text-gray-500 hover:text-gray-700"
              aria-label="Cancel delete"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-lg font-semibold text-gray-900 mb-2">Delete Transaction</h2>
            <p className="text-sm text-gray-600">
              {deleteConfirmIds.length === 1
                ? 'Are you sure you want to delete this transaction?'
                : 'Are you sure you want to delete these transactions?'}
            </p>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={confirmDelete}
                disabled={deleteConfirmSaving}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-60"
              >
                <Trash2 className="w-4 h-4" />
                {deleteConfirmSaving ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}