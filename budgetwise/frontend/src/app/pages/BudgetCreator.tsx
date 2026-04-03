'use client';

import { useEffect, useMemo, useState } from 'react';
import { Sparkles, DollarSign, TrendingUp, Lightbulb, ChevronRight, Check } from 'lucide-react';
import { apiJson } from '../lib/api';
import { STANDARD_EXPENSE_CATEGORIES, type StandardExpenseCategory } from '../lib/expenseCategories';

/** Suggested % splits (sum ≈ 100) for the 9 canonical categories. */
const CATEGORY_META: Record<
  StandardExpenseCategory,
  { icon: string; suggestedPercent: number; color: string }
> = {
  Rent: { icon: '🏠', suggestedPercent: 28, color: 'bg-slate-100 text-slate-700' },
  Groceries: { icon: '🛒', suggestedPercent: 12, color: 'bg-lime-100 text-lime-700' },
  Tuition: { icon: '🎓', suggestedPercent: 15, color: 'bg-cyan-100 text-cyan-700' },
  Transportation: { icon: '🚗', suggestedPercent: 10, color: 'bg-blue-100 text-blue-600' },
  Entertainment: { icon: '🎮', suggestedPercent: 8, color: 'bg-purple-100 text-purple-600' },
  Utilities: { icon: '💡', suggestedPercent: 10, color: 'bg-yellow-100 text-yellow-600' },
  Health: { icon: '💪', suggestedPercent: 8, color: 'bg-red-100 text-red-600' },
  Dining: { icon: '🍔', suggestedPercent: 7, color: 'bg-orange-100 text-orange-600' },
  Other: { icon: '🔧', suggestedPercent: 2, color: 'bg-gray-100 text-gray-700' },
};

const categoryOptions = STANDARD_EXPENSE_CATEGORIES.map((name) => ({
  name,
  ...CATEGORY_META[name],
}));

const aiInsights = [
  {
    title: 'Student-Optimized Budget',
    description: 'Based on average student spending patterns, we recommend allocating a realistic share to rent and dining.',
    impact: 'high',
  },
  {
    title: 'Emergency Fund Priority',
    description: 'Try to save at least 15% of your income for unexpected expenses and future goals.',
    impact: 'high',
  },
  {
    title: 'Entertainment Balance',
    description: 'Keep entertainment at 10% to maintain a healthy balance between fun and financial goals.',
    impact: 'medium',
  },
  {
    title: 'Transportation Savings',
    description: 'Consider using public transit or bike-sharing to reduce transportation costs below 15%.',
    impact: 'medium',
  },
];

type BudgetCategory = (typeof categoryOptions)[number] & {
  amount: number;
  percent: number;
};

type BudgetGetResponse = {
  month: number;
  year: number;
  totalLimit: number;
  categories: Array<{ category: string; allocated: number; percent: number }>;
};

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function getMonthYear() {
  const d = new Date();
  return { month: d.getMonth() + 1, year: d.getFullYear() };
}

function buildFromSuggested(income: number): BudgetCategory[] {
  return categoryOptions.map((cat) => ({
    ...cat,
    amount: round2((income * cat.suggestedPercent) / 100),
    percent: cat.suggestedPercent,
  }));
}

function balanceCategories(income: number, cats: BudgetCategory[]): BudgetCategory[] {
  if (cats.length === 0) return cats;

  const totalAllocated = cats.reduce((sum, c) => sum + c.amount, 0);
  const remaining = round2(income - totalAllocated);

  if (Math.abs(remaining) < 0.01) return cats;

  const lastIdx = cats.length - 1;
  const adjusted = [...cats];

  // absorb rounding into last category but never let it go negative
  const newLast = round2(adjusted[lastIdx].amount + remaining);
  adjusted[lastIdx] = {
    ...adjusted[lastIdx],
    amount: Math.max(0, newLast),
  };

  adjusted[lastIdx].percent = income > 0 ? (adjusted[lastIdx].amount / income) * 100 : 0;
  return adjusted;
}

const DECIMAL_RE = /^\d*\.?\d*$/;

export function BudgetCreator() {
  const [totalIncome, setTotalIncome] = useState('1200');

  const [budgetCategories, setBudgetCategories] = useState<BudgetCategory[]>(() => {
    const initialIncome = 1200;
    return balanceCategories(initialIncome, buildFromSuggested(initialIncome));
  });

  // input buffers so user can type decimals like ".", "12.", "", etc.
  const [amountInputs, setAmountInputs] = useState<string[]>(() => {
    const initial = balanceCategories(1200, buildFromSuggested(1200));
    return initial.map((c) => String(c.amount));
  });

  const [percentInputs, setPercentInputs] = useState<string[]>(() => {
    const initial = balanceCategories(1200, buildFromSuggested(1200));
    return initial.map((c) => String(round2(c.percent)));
  });

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [{ month, year }, setMonthYear] = useState(() => getMonthYear());

  // Time-sync rule: default Budget Creator to the most-recent month that has any transactions.
  // If user has no transactions, fall back to the real current month.
  useEffect(() => {
    let cancelled = false;
    apiJson('/api/expenses')
      .then((data: { expenses?: unknown[] }) => {
        if (cancelled) return;
        const items = (data?.expenses || []) as { date: string }[];
        if (items.length === 0) return;

        let max = new Date(items[0].date);
        for (const it of items) {
          const d = new Date(it.date);
          if (!Number.isNaN(d.getTime()) && d > max) max = d;
        }

        setMonthYear({ month: max.getMonth() + 1, year: max.getFullYear() });
      })
      .catch(() => {
        // ignore
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const income = useMemo(() => {
    const n = parseFloat(totalIncome);
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  }, [totalIncome]);

  const syncInputsFromCategories = (cats: BudgetCategory[]) => {
    setAmountInputs(cats.map((c) => String(c.amount)));
    setPercentInputs(cats.map((c) => String(round2(c.percent))));
  };

  // Load from backend if budget exists
  useEffect(() => {
    let cancelled = false;

    async function loadBudget() {
      setLoading(true);
      try {
        const data = (await apiJson(`/api/budgets?month=${month}&year=${year}`)) as BudgetGetResponse;

        if (cancelled) return;

        const loadedIncome = round2(data.totalLimit || 0);
        setTotalIncome(String(loadedIncome));

        const byName = new Map(data.categories.map((c) => [c.category, c]));

        const merged: BudgetCategory[] = categoryOptions.map((cat) => {
          const found = byName.get(cat.name);
          if (!found) {
            return {
              ...cat,
              amount: round2((loadedIncome * cat.suggestedPercent) / 100),
              percent: cat.suggestedPercent,
            };
          }

          const pct = Number.isFinite(found.percent)
            ? found.percent
            : (loadedIncome > 0 ? (found.allocated / loadedIncome) * 100 : 0);

          return {
            ...cat,
            amount: round2(found.allocated),
            percent: pct,
          };
        });

        const balanced = balanceCategories(loadedIncome, merged);
        setBudgetCategories(balanced);
        syncInputsFromCategories(balanced);
        setStep(3);
      } catch {
        // No budget exists yet (or backend down). Keep defaults.
        setStep(1);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadBudget();
    return () => {
      cancelled = true;
    };
  }, [month, year]);

  const handleIncomeChange = (value: string) => {
    if (!DECIMAL_RE.test(value)) return;
    setTotalIncome(value);

    const parsed = parseFloat(value);
    if (!Number.isFinite(parsed)) {
      setStep(2);
      return;
    }

    const newIncome = Math.max(0, parsed);

    const updated = budgetCategories.map((cat) => ({
      ...cat,
      amount: round2((newIncome * cat.percent) / 100),
    }));

    const balanced = balanceCategories(newIncome, updated);
    setBudgetCategories(balanced);
    syncInputsFromCategories(balanced);
    setStep(2);
  };

  const handleCategoryAmountChange = (index: number, value: string) => {
    if (!DECIMAL_RE.test(value)) return;

    const nextAmountInputs = [...amountInputs];
    nextAmountInputs[index] = value;
    setAmountInputs(nextAmountInputs);

    const parsed = parseFloat(value);
    if (!Number.isFinite(parsed)) return;

    const amt = clamp(parsed, 0, 1_000_000);

    const newCategories = [...budgetCategories];
    newCategories[index] = {
      ...newCategories[index],
      amount: round2(amt),
      percent: income > 0 ? (amt / income) * 100 : 0,
    };

    const balanced = balanceCategories(income, newCategories);
    setBudgetCategories(balanced);
    syncInputsFromCategories(balanced);
    setStep(2);
  };

  const handleCategoryPercentChange = (index: number, value: string) => {
    if (!DECIMAL_RE.test(value)) return;

    const nextPercentInputs = [...percentInputs];
    nextPercentInputs[index] = value;
    setPercentInputs(nextPercentInputs);

    const parsed = parseFloat(value);
    if (!Number.isFinite(parsed)) return;

    const pct = clamp(parsed, 0, 100);

    const newCategories = [...budgetCategories];
    newCategories[index] = {
      ...newCategories[index],
      percent: pct,
      amount: round2((income * pct) / 100),
    };

    const balanced = balanceCategories(income, newCategories);
    setBudgetCategories(balanced);
    syncInputsFromCategories(balanced);
    setStep(2);
  };

  const commitAmountOnBlur = (index: number) => {
    const v = amountInputs[index];
    const parsed = parseFloat(v);
    if (Number.isFinite(parsed)) return;

    const next = [...amountInputs];
    next[index] = String(budgetCategories[index].amount);
    setAmountInputs(next);
  };

  const commitPercentOnBlur = (index: number) => {
    const v = percentInputs[index];
    const parsed = parseFloat(v);
    if (Number.isFinite(parsed)) return;

    const next = [...percentInputs];
    next[index] = String(round2(budgetCategories[index].percent));
    setPercentInputs(next);
  };

  // Keep button + UI, just applies suggested percents
  const applyAISuggestions = () => {
    const newCats = balanceCategories(income, buildFromSuggested(income));
    setBudgetCategories(newCats);
    syncInputsFromCategories(newCats);
    setStep(2);
  };

  const totalAllocated = budgetCategories.reduce((sum, cat) => sum + cat.amount, 0);
  const totalPercent = budgetCategories.reduce((sum, cat) => sum + cat.percent, 0);
  const remaining = round2(income - totalAllocated);
  /** All category percentages must sum to 100% before save. */
  const percentagesTotal100 = Math.abs(totalPercent - 100) <= 0.01;

  const handleSaveBudget = async () => {
    const sumPct = round2(budgetCategories.reduce((s, c) => s + c.percent, 0));
    if (Math.abs(sumPct - 100) > 0.01) {
      alert(
        'Your category percentages must add up to exactly 100% before you can save. Adjust the percentages (or amounts) for each category and try again.',
      );
      return;
    }

    setSaving(true);
    try {
      const payload = {
        month,
        year,
        totalLimit: income,
        categories: budgetCategories.map((c) => ({
          category: c.name,
          allocated: round2(c.amount),
          percent: round2(c.percent),
        })),
      };

      await apiJson('/api/budgets', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setStep(3);
      alert('Budget saved successfully!');
    } catch (e: any) {
      alert(e?.message || 'Failed to save budget.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-6">Loading budget data...</div>;
  }

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-gray-900">AI Budget Creator</h1>
          </div>
          <p className="text-gray-600">Let AI help you create an optimized budget based on your income and goals</p>
        </div>

        <div className="mb-8 bg-white rounded-xl shadow-lg p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${step >= 1 ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
                {step > 1 ? <Check className="w-5 h-5" /> : '1'}
              </div>
              <div>
                <div className="font-semibold text-gray-900">Income</div>
                <div className="text-sm text-gray-500">Enter your monthly income</div>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${step >= 2 ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
                {step > 2 ? <Check className="w-5 h-5" /> : '2'}
              </div>
              <div>
                <div className="font-semibold text-gray-900">Categories</div>
                <div className="text-sm text-gray-500">Allocate your budget</div>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${step >= 3 ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
                {step > 3 ? <Check className="w-5 h-5" /> : '3'}
              </div>
              <div>
                <div className="font-semibold text-gray-900">Review</div>
                <div className="text-sm text-gray-500">Finalize your budget</div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Monthly Income</h2>
              <div className="relative">
                <DollarSign className="absolute left-4 top-1/2 transform -translate-y-1/2 w-6 h-6 text-gray-400" />
                <input
                  type="text"
                  inputMode="decimal"
                  value={totalIncome}
                  onChange={(e) => handleIncomeChange(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 text-2xl font-bold border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none"
                  placeholder="0.00"
                />
              </div>

              {income > 0 && (
                <button
                  onClick={applyAISuggestions}
                  className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-lg hover:from-purple-600 hover:to-indigo-700 transition-colors"
                >
                  <Sparkles className="w-5 h-5" />
                  <span>Apply AI Suggestions</span>
                </button>
              )}
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Budget Allocation</h2>
              <div className="space-y-4">
                {budgetCategories.map((category, index) => (
                  <div key={category.name} className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg ${category.color} flex items-center justify-center text-xl`}>
                          {category.icon}
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900">{category.name}</div>
                          <div className="text-sm text-gray-500">
                            AI suggests: {category.suggestedPercent}% (${Math.round((income * category.suggestedPercent) / 100)})
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                        <div className="relative">
                          <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <input
                            type="text"
                            inputMode="decimal"
                            value={amountInputs[index] ?? ''}
                            onChange={(e) => handleCategoryAmountChange(index, e.target.value)}
                            onBlur={() => commitAmountOnBlur(index)}
                            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:border-indigo-500 focus:outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Percentage</label>
                        <div className="relative">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={percentInputs[index] ?? ''}
                            onChange={(e) => handleCategoryPercentChange(index, e.target.value)}
                            onBlur={() => commitPercentOnBlur(index)}
                            className="w-full pr-8 pl-3 py-2 border border-gray-300 rounded-lg focus:border-indigo-500 focus:outline-none"
                          />
                          <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={handleSaveBudget}
              disabled={saving || !percentagesTotal100}
              className="w-full px-6 py-4 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {saving
                ? 'Saving...'
                : !percentagesTotal100
                  ? 'Percentages must total 100%'
                  : 'Save Budget'}
            </button>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
              <h3 className="font-semibold text-gray-900 mb-4">Budget Summary</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-3 border-b border-gray-200">
                  <span className="text-gray-600">Total Income</span>
                  <span className="font-semibold text-gray-900">${income.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between pb-3 border-b border-gray-200">
                  <span className="text-gray-600">Allocated</span>
                  <span className="font-semibold text-gray-900">${totalAllocated.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between pb-3 border-b border-gray-200">
                  <span className="text-gray-600">Total Percent</span>
                  <span
                    className={`font-semibold ${
                      !percentagesTotal100 ? 'text-amber-600' : totalPercent > 100 ? 'text-red-600' : 'text-gray-900'
                    }`}
                  >
                    {totalPercent.toFixed(1)}%
                    {percentagesTotal100 ? '' : ' (target 100%)'}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-2">
                  <span className="text-gray-600">Remaining</span>
                  <span className={`font-bold text-lg ${remaining < 0 ? 'text-red-600' : remaining > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                    ${remaining.toFixed(2)}
                  </span>
                </div>
              </div>

              {!percentagesTotal100 && (
                <div className="mt-4 p-3 rounded-lg bg-amber-50 text-amber-900 border border-amber-200">
                  <p className="text-sm font-medium">
                    Category percentages must total <strong>100%</strong> to save. Rework your percentage (or amount)
                    fields until the total is 100%.
                  </p>
                </div>
              )}

              {percentagesTotal100 && Math.abs(remaining) > 0.01 && (
                <div className={`mt-4 p-3 rounded-lg ${remaining < 0 ? 'bg-red-50 text-red-700' : 'bg-orange-50 text-orange-700'}`}>
                  <p className="text-sm font-medium">
                    {remaining < 0 ? '⚠️ Over budget! Reduce allocations.' : '💡 Allocated amounts do not match income; adjust amounts.'}
                  </p>
                </div>
              )}

              {percentagesTotal100 && Math.abs(remaining) < 0.01 && (
                <div className="mt-4 p-3 rounded-lg bg-green-50 text-green-700">
                  <p className="text-sm font-medium">✅ Percentages total 100% and amounts match income.</p>
                </div>
              )}
            </div>

            {/* AI Insights left untouched */}
            <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl shadow-lg p-6 border border-purple-200">
              <div className="flex items-center gap-2 mb-4">
                <Lightbulb className="w-5 h-5 text-purple-600" />
                <h3 className="font-semibold text-gray-900">AI Insights</h3>
              </div>
              <div className="space-y-3">
                {aiInsights.map((insight, index) => (
                  <div key={index} className="p-3 bg-white rounded-lg border border-purple-100">
                    <div className="flex items-start gap-2">
                      <div
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          insight.impact === 'high' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                        }`}
                      >
                        {insight.impact.toUpperCase()}
                      </div>
                    </div>
                    <h4 className="font-semibold text-gray-900 mt-2 text-sm">{insight.title}</h4>
                    <p className="text-sm text-gray-600 mt-1">{insight.description}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
              <h3 className="font-semibold text-gray-900 mb-4">Quick Stats</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-green-600" />
                    <span className="text-sm text-gray-600">Largest allocation</span>
                  </div>
                  <span className="font-semibold text-gray-900">
                    {income > 0 && budgetCategories.length > 0
                      ? (() => {
                          const top = budgetCategories.reduce((a, b) => (b.amount > a.amount ? b : a));
                          return `${top.name} (${((top.amount / income) * 100).toFixed(1)}%)`;
                        })()
                      : '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-blue-600" />
                    <span className="text-sm text-gray-600">Daily Budget</span>
                  </div>
                  <span className="font-semibold text-gray-900">${(income / 30).toFixed(2)}/day</span>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}