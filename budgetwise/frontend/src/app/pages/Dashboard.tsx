import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, DollarSign, AlertCircle, Loader2 } from 'lucide-react';
import { SpendingPieChart } from '../components/SpendingPieChart';
import { RemainingBudgetChart } from '../components/RemainingBudgetChart';
import { AIRecommendations } from '../components/AIRecommendations';
import { apiJson } from '../lib/api';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export type DashboardData = {
  month: number;
  year: number;
  totalBudget: number;
  totalSpent: number; // expense-only (legacy)
  totalIncome?: number;
  totalExpense?: number;
  net?: number;
  remaining: number;
  categoryBreakdown: { name: string; value: number; color: string }[];
  remainingByCategory: { category: string; allocated: number; spent: number; remaining: number }[];
};

export function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiJson('/api/dashboard')
      .then((res: DashboardData) => {
        if (!cancelled) setData(res);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load dashboard');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const totalBudget = data?.totalBudget ?? 0;
  const totalExpense = data?.totalExpense ?? data?.totalSpent ?? 0;
  const totalIncome = data?.totalIncome ?? 0;
  const remaining = data?.remaining ?? 0;
  const percentSpent = totalBudget > 0 ? (totalExpense / totalBudget) * 100 : 0;
  const monthYearLabel = data
    ? `${MONTH_NAMES[data.month - 1]} ${data.year}`
    : `${MONTH_NAMES[new Date().getMonth()]} ${new Date().getFullYear()}`;

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[40vh]">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="max-w-7xl mx-auto rounded-xl bg-red-50 border border-red-200 p-6 text-red-800">
          <p className="font-medium">Could not load dashboard</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Student Budget Dashboard</h1>
          <p className="text-gray-600">Track your spending and stay on budget — {monthYearLabel}</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-green-100 rounded-lg">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
              <span className="text-sm text-gray-500">Total Income</span>
            </div>
            <div className="text-3xl font-bold text-gray-900">${totalIncome.toFixed(2)}</div>
            <p className="text-sm text-gray-500 mt-2">This month&apos;s income</p>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <DollarSign className="w-6 h-6 text-blue-600" />
              </div>
              <span className="text-sm text-gray-500">Total Budget</span>
            </div>
            <div className="text-3xl font-bold text-gray-900">${totalBudget.toFixed(2)}</div>
            <p className="text-sm text-gray-500 mt-2">This month&apos;s budget</p>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-red-100 rounded-lg">
                <TrendingDown className="w-6 h-6 text-red-600" />
              </div>
              <span className="text-sm text-gray-500">Total Expenses</span>
            </div>
            <div className="text-3xl font-bold text-gray-900">${totalExpense.toFixed(2)}</div>
            <p className="text-sm text-gray-500 mt-2">
              {totalBudget > 0 ? `${percentSpent.toFixed(1)}% of budget` : 'No budget set'}
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-indigo-100 rounded-lg">
                <DollarSign className="w-6 h-6 text-indigo-600" />
              </div>
              <span className="text-sm text-gray-500">Remaining</span>
            </div>
            <div className="text-3xl font-bold text-gray-900">${remaining.toFixed(2)}</div>
            <p className="text-sm text-gray-500 mt-2">
              {totalBudget > 0 ? `${(100 - percentSpent).toFixed(1)}% left` : 'Set budgets to track'}
            </p>
          </div>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Monthly Spending by Category</h2>
            <SpendingPieChart data={data?.categoryBreakdown ?? null} />
          </div>
          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Remaining Budget by Category</h2>
            <RemainingBudgetChart data={data?.remainingByCategory ?? null} />
          </div>
        </div>

        {/* AI Recommendations */}
        <div className="bg-gradient-to-r from-purple-500 to-indigo-600 rounded-xl shadow-lg p-6 border border-purple-200 mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-white/20 rounded-lg">
              <AlertCircle className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-xl font-semibold text-white">AI-Powered Budget Recommendations</h2>
          </div>
          {/* Pass the current dashboard month and year to AIRecommendations */}
          {/* This ensures AI recommendations match the displayed dashboard data */}
          <AIRecommendations month={data?.month} year={data?.year} />
        </div>
      </div>
    </div>
  );
}