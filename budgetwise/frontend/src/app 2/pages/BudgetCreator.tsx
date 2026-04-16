'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Sparkles, DollarSign, TrendingUp, Lightbulb, ChevronRight, Check } from 'lucide-react';
import { apiJson, fetchAiBudgetSuggestions } from '../lib/api';
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

type AiProposalItem = {
  category: string;
  percent: number;
  amount: number;
};
type ExpenseTx = {
  amount: number;
  category: string;
  type: 'EXPENSE' | 'INCOME';
  date: string;
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
const AI_REQUEST_TIMEOUT_MS = 30000;

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
  const [calculatingAi, setCalculatingAi] = useState(false);
  const [applyingAi, setApplyingAi] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiNotice, setAiNotice] = useState<string | null>(null);
  const [aiProposal, setAiProposal] = useState<AiProposalItem[] | null>(null);
  const [aiProposalGeneratedAt, setAiProposalGeneratedAt] = useState<string | null>(null);
  const [aiReasons, setAiReasons] = useState<Record<string, string>>({});
  const [expenseHistory, setExpenseHistory] = useState<ExpenseTx[]>([]);

  const isMountedRef = useRef(true);
  const applyRequestIdRef = useRef(0);
  const latestIncomeRef = useRef(0);

  // Same month/year as the dashboard default (real-world calendar month) so saved budgets
  // match what the dashboard reads for total budget and per-category bars.
  const [period] = useState(() => getMonthYear());
  const { month, year } = period;

  const budgetPeriodLabel = useMemo(
    () =>
      new Date(year, month - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' }),
    [month, year],
  );

  const income = useMemo(() => {
    const n = parseFloat(totalIncome);
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  }, [totalIncome]);

  useEffect(() => {
    latestIncomeRef.current = income;
  }, [income]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const syncInputsFromCategories = (cats: BudgetCategory[]) => {
    setAmountInputs(cats.map((c) => String(c.amount)));
    setPercentInputs(cats.map((c) => String(round2(c.percent))));
  };

  useEffect(() => {
    let cancelled = false;
    apiJson('/api/expenses')
      .then((data: { expenses?: ExpenseTx[] }) => {
        if (cancelled) return;
        const rows = (data?.expenses ?? []).filter((t) => t.type === 'EXPENSE');
        setExpenseHistory(rows);
      })
      .catch(() => {
        if (!cancelled) setExpenseHistory([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
    setAiError(null);
    setAiNotice(null);
    setAiProposal(null);
    setAiProposalGeneratedAt(null);

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
    setAiError(null);
    setAiNotice(null);
    setAiProposal(null);
    setAiProposalGeneratedAt(null);

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
    setAiError(null);
    setAiNotice(null);
    setAiProposal(null);
    setAiProposalGeneratedAt(null);

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

  const calculateAISuggestions = async () => {
    if (income <= 0 || calculatingAi) return;

    const startedIncome = income;
    const requestId = applyRequestIdRef.current + 1;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), AI_REQUEST_TIMEOUT_MS);
    let raceTimeoutId: number | null = null;
    applyRequestIdRef.current = requestId;
    setCalculatingAi(true);
    setAiError(null);
    setAiNotice(null);
    setAiProposal(null);
    setAiProposalGeneratedAt(null);

    try {
      // Build 3-month window (current + prior 2 months) for trend analysis.
      const monthKeys: string[] = [];
      for (let i = 0; i < 3; i += 1) {
        const d = new Date(year, month - 1 - i, 1);
        monthKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
      }
      const byCategoryByMonth = new Map<string, Map<string, number>>();
      let monthsWithAnyDataCount = 0;
      const totalsByMonth = new Map<string, number>();
      for (const t of expenseHistory) {
        const d = new Date(t.date);
        if (Number.isNaN(d.getTime())) continue;
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (!monthKeys.includes(key)) continue;
        const cat = t.category.trim();
        if (!byCategoryByMonth.has(cat)) byCategoryByMonth.set(cat, new Map<string, number>());
        const monthMap = byCategoryByMonth.get(cat)!;
        monthMap.set(key, (monthMap.get(key) ?? 0) + t.amount);
        totalsByMonth.set(key, (totalsByMonth.get(key) ?? 0) + t.amount);
      }
      monthsWithAnyDataCount = monthKeys.filter((k) => (totalsByMonth.get(k) ?? 0) > 0).length;

      if (monthsWithAnyDataCount === 0) {
        const defaults = balanceCategories(startedIncome, buildFromSuggested(startedIncome)).map((x) => ({
          category: x.name,
          percent: round2(x.percent),
          amount: round2(x.amount),
        }));
        const reasons: Record<string, string> = {};
        for (const d of defaults) {
          reasons[d.category] = 'Default allocation used due to lack of transaction data.';
        }
        setAiReasons(reasons);
        setAiProposal(defaults);
        setAiProposalGeneratedAt(new Date().toISOString());
        setAiNotice('No transaction data found. Default budget allocation values were used.');
        return;
      }

      if (monthsWithAnyDataCount === 1) {
        setAiNotice('Suggestions are based on only the current month of data, so allocations may be skewed.');
      }

      const response = await Promise.race([
        fetchAiBudgetSuggestions(
          {
            income: startedIncome,
            month,
            year,
            categories: budgetCategories.map((c) => ({
              category: c.name,
              allocated: round2(c.amount),
              percent: round2(c.percent),
            })),
          },
          { signal: controller.signal },
        ),
        new Promise<never>((_, reject) => {
          raceTimeoutId = window.setTimeout(() => {
            reject(new Error('AI request timed out. Please try again.'));
          }, AI_REQUEST_TIMEOUT_MS);
        }),
      ]);

      // Only skip if this is an old/stale request (requestId doesn't match)
      if (applyRequestIdRef.current !== requestId) {
        return;
      }

      if (Math.abs(latestIncomeRef.current - startedIncome) > 0.009) {
        setAiError('Income changed while AI suggestions were generated. Please try again.');
        return;
      }

      const byCategory = new Map(response.suggestions.map((item) => [item.category.trim().toLowerCase(), item.percent]));

      const rawProposal = budgetCategories.map((cat) => {
        const normalized = cat.name.trim().toLowerCase();
        const pct = clamp(byCategory.get(normalized) ?? cat.percent, 0, 100);
        return {
          category: cat.name,
          percent: round2(pct),
          amount: round2((startedIncome * pct) / 100),
        };
      });

      const avgByCategory = new Map<string, number>();
      const latestByCategory = new Map<string, number>();
      const sampleCountByCategory = new Map<string, number>();
      const variabilityByCategory = new Map<string, number>();
      for (const cat of STANDARD_EXPENSE_CATEGORIES) {
        const monthMap = byCategoryByMonth.get(cat) ?? new Map<string, number>();
        const raw = monthKeys.map((k) => monthMap.get(k) ?? 0);
        const samples = raw.filter((x) => x > 0);
        const avg = samples.length > 0 ? samples.reduce((a, b) => a + b, 0) / samples.length : 0;
        avgByCategory.set(cat, avg);
        latestByCategory.set(cat, monthMap.get(monthKeys[0]) ?? 0);
        sampleCountByCategory.set(cat, samples.length);
        if (samples.length <= 1 || avg <= 0) {
          variabilityByCategory.set(cat, 0);
        } else {
          const variance = samples.reduce((acc, v) => acc + Math.pow(v - avg, 2), 0) / samples.length;
          const stdDev = Math.sqrt(variance);
          variabilityByCategory.set(cat, stdDev / avg); // coefficient of variation
        }
      }

      const working = rawProposal.map((item) => ({ ...item }));
      const reasons: Record<string, string> = {};

      // Rent: static/required category should be at least its stable trend level.
      const rentIndex = working.findIndex((x) => x.category === 'Rent');
      if (rentIndex >= 0) {
        const rentFloor = Math.max(avgByCategory.get('Rent') ?? 0, latestByCategory.get('Rent') ?? 0);
        if (rentFloor > 0 && working[rentIndex].amount < rentFloor) {
          working[rentIndex].amount = round2(rentFloor);
          reasons.Rent = `Rent is consistently static; set to at least your recent monthly trend ($${round2(rentFloor).toFixed(2)}).`;
        } else {
          reasons.Rent = 'Rent appears stable, so allocation stays near your historical monthly amount.';
        }
      }

      for (const cat of STANDARD_EXPENSE_CATEGORIES) {
        if (cat === 'Rent') continue;
        const idx = working.findIndex((x) => x.category === cat);
        if (idx < 0) continue;
        const avg = avgByCategory.get(cat) ?? 0;
        const samples = sampleCountByCategory.get(cat) ?? 0;
        const variability = variabilityByCategory.get(cat) ?? 0;

        if (avg <= 0 || samples === 0) {
          reasons[cat] = 'Limited recent data for this category, so AI baseline is used.';
          continue;
        }

        // Average-first approach: use 1-3 month average as the anchor, then adjust.
        let target = avg;
        if (variability > 0.45) {
          // Highly inconsistent spending: avoid over-trimming and keep around average.
          target = avg;
          reasons[cat] = `Spending swings across months, so this is kept around your ${samples}-month average ($${round2(avg).toFixed(2)}).`;
        } else {
          const trimPct = cat === 'Dining' || cat === 'Other' ? 0.1 : 0.03;
          target = avg * (1 - trimPct);
          reasons[cat] = `Spending is fairly consistent; using your ${samples}-month average with a small ${Math.round(trimPct * 100)}% trim to encourage savings.`;
        }

        const blended = working[idx].amount * 0.25 + target * 0.75;
        working[idx].amount = round2(blended);
      }

      const totalFloor = working.reduce((sum, x) => sum + x.amount, 0);
      if (totalFloor > startedIncome) {
        // If required floors exceed income, scale non-rent first; then clamp to income.
        const rent = working.find((x) => x.category === 'Rent');
        const rentAmount = rent?.amount ?? 0;
        const nonRent = working.filter((x) => x.category !== 'Rent');
        const nonRentTotal = nonRent.reduce((s, x) => s + x.amount, 0);
        const remaining = Math.max(0, startedIncome - rentAmount);
        if (nonRentTotal > 0) {
          for (const x of nonRent) x.amount = round2((x.amount / nonRentTotal) * remaining);
        }
      } else {
        // Normalize to full income while preserving relative category intent.
        const scaled = balanceCategories(
          startedIncome,
          working.map((x, i) => ({
            ...budgetCategories[i],
            amount: x.amount,
            percent: startedIncome > 0 ? (x.amount / startedIncome) * 100 : 0,
          })),
        );
        for (let i = 0; i < working.length; i += 1) working[i].amount = round2(scaled[i].amount);
      }

      const proposal = working.map((p) => ({
        ...p,
        percent: startedIncome > 0 ? round2((p.amount / startedIncome) * 100) : 0,
      }));

      const sumPct = proposal.reduce((s, p) => s + p.percent, 0);
      if (Math.abs(sumPct - 100) > 0.01 && proposal.length > 0) {
        const delta = round2(100 - sumPct);
        const last = proposal.length - 1;
        proposal[last] = { ...proposal[last], percent: round2(Math.max(0, proposal[last].percent + delta)) };
        proposal[last] = { ...proposal[last], amount: round2((startedIncome * proposal[last].percent) / 100) };
      }

      setAiReasons(reasons);
      setAiProposal(proposal);
      setAiProposalGeneratedAt(response.generatedAt);
    } catch (error: unknown) {
      const message =
        error instanceof DOMException && error.name === 'AbortError'
          ? 'AI request timed out. Please try again.'
          : error instanceof Error
            ? error.message
            : 'Failed to apply AI suggestions.';
      setAiError(message);
    } finally {
      window.clearTimeout(timeoutId);
      if (raceTimeoutId !== null) {
        window.clearTimeout(raceTimeoutId);
      }
      setCalculatingAi(false);
    }
  };

  const applyAISuggestions = () => {
    if (!aiProposal || applyingAi || income <= 0) return;
    setApplyingAi(true);
    setAiError(null);
    try {
      const byCategory = new Map(aiProposal.map((item) => [item.category.toLowerCase(), item.percent]));
      const newCats = budgetCategories.map((cat) => {
        const pct = clamp(byCategory.get(cat.name.toLowerCase()) ?? cat.percent, 0, 100);
        return {
          ...cat,
          percent: round2(pct),
          amount: round2((income * pct) / 100),
        };
      });
      const balanced = balanceCategories(income, newCats);
      setBudgetCategories(balanced);
      syncInputsFromCategories(balanced);
      setStep(2);
      setAiProposal(null);
      setAiProposalGeneratedAt(null);
      setAiNotice(null);
    } finally {
      setApplyingAi(false);
    }
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
          <p className="text-sm text-indigo-700 font-medium mt-2">Editing budget for {budgetPeriodLabel}</p>
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
              <h3 className="font-semibold text-gray-900 mb-3">AI Suggested Allocation</h3>
              {!aiProposal ? (
                <p className="text-sm text-gray-600">
                  Run <strong>AI Budget Calculator</strong> to preview percentages based on the current month and the prior 1-2 months of transaction trends.
                </p>
              ) : (
                <>
                  <div className="space-y-3 max-h-72 overflow-auto pr-1">
                    {aiProposal.map((item) => (
                      <div key={item.category} className="rounded-lg border border-gray-100 p-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium text-gray-800">{item.category}</span>
                          <span className="font-semibold text-gray-900">
                            {item.percent.toFixed(2)}% (${item.amount.toFixed(2)})
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 mt-1">
                          {aiReasons[item.category] || 'Calculated from AI + transaction trend.'}
                        </p>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-3">
                    Generated {aiProposalGeneratedAt ? new Date(aiProposalGeneratedAt).toLocaleString() : 'just now'}.
                  </p>
                </>
              )}
            </div>

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
                <div className="mt-4 space-y-2">
                  <button
                    onClick={calculateAISuggestions}
                    disabled={calculatingAi}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-lg hover:from-purple-600 hover:to-indigo-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <Sparkles className="w-5 h-5" />
                    <span>{calculatingAi ? 'Calculating with AI...' : 'AI Budget Calculator'}</span>
                  </button>

                  <button
                    onClick={applyAISuggestions}
                    disabled={!aiProposal || applyingAi}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-900 text-white rounded-lg hover:bg-black transition-colors disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed"
                  >
                    <Sparkles className="w-5 h-5" />
                    <span>{applyingAi ? 'Applying...' : 'Apply AI Suggestions'}</span>
                  </button>
                </div>
              )}

              {aiError && (
                <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {aiError}
                </div>
              )}
              {aiNotice && (
                <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  {aiNotice}
                </div>
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
