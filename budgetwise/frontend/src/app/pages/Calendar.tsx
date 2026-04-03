"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";

import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { apiJson } from "../lib/api";
import { useAuth } from "../context/AuthContext";

interface Transaction {
  id: string;
  date: Date;
  type: "income" | "expense";
  amount: number;
  category: string;
  description: string;
}

function expenseToTransaction(e: {
  id: string;
  amount: number;
  category: string;
  date: string;
  note?: string | null;
  type?: "EXPENSE" | "INCOME" | null;
}): Transaction {
  return {
    id: e.id,
    date: new Date(e.date),
    type: e.type === "INCOME" ? "income" : "expense",
    amount: e.amount,
    category: e.category,
    description: e.note || e.category,
  };
}

const categoryColors: Record<string, string> = {
  Rent: "#6366F1",
  Groceries: "#16A34A",
  Tuition: "#A855F7",
  Transportation: "#4ECDC4",
  Entertainment: "#F97316",
  Utilities: "#D97706",
  Health: "#0891B2",
  Dining: "#DC2626",
  Other: "#95A5A6",
  Paycheck: "#10B981",
  Scholarship: "#06B6D4",
  Gift: "#F59E0B",
  Refund: "#3B82F6",
};

export function Calendar() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const today = useMemo(() => new Date(), []);

  const [currentMonth, setCurrentMonth] = useState(today);
  const [selectedDate, setSelectedDate] = useState(today);
  const [search, setSearch] = useState("");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const didInitToLatestMonth = useRef(false);

  useEffect(() => {
    if (!isAuthenticated) router.push("/login");
  }, [isAuthenticated, router]);

  useEffect(() => {
    if (!isAuthenticated) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    // One-time: jump calendar to most-recent month that has any data.
    // (Fallback to real current month when there are no transactions.)
    if (!didInitToLatestMonth.current) {
      didInitToLatestMonth.current = true;
      apiJson(`/api/expenses`)
        .then((data: { expenses?: unknown[] }) => {
          if (cancelled) return;
          const items = (data?.expenses || []) as { date: string }[];
          if (items.length === 0) return;

          let max = new Date(items[0].date);
          for (const it of items) {
            const d = new Date(it.date);
            if (!Number.isNaN(d.getTime()) && d > max) max = d;
          }

          // Setting these triggers the month-range fetch via effect re-run.
          setCurrentMonth(max);
          setSelectedDate(max);
        })
        .catch(() => {
          // ignore; we'll just stay on current month
        });
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const from = format(monthStart, "yyyy-MM-dd");
    const to = format(monthEnd, "yyyy-MM-dd");

    apiJson(`/api/expenses?from=${from}&to=${to}`)
      .then((data: { expenses?: unknown[] }) => {
        if (cancelled) return;
        const items = (data?.expenses || []) as {
          id: string;
          amount: number;
          category: string;
          date: string;
          note?: string | null;
          type?: "EXPENSE" | "INCOME" | null;
        }[];
        setTransactions(items.map(expenseToTransaction));
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load expenses");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, currentMonth]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const selectedDateTransactions = useMemo(
    () => transactions.filter((t) => isSameDay(t.date, selectedDate)),
    [transactions, selectedDate]
  );

  const filteredSelectedTransactions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return selectedDateTransactions;
    return selectedDateTransactions.filter((t) => `${t.category} ${t.description}`.toLowerCase().includes(q));
  }, [search, selectedDateTransactions]);

  const getTransactionsForDate = (date: Date) => transactions.filter((t) => isSameDay(t.date, date));

  const monthTransactions = useMemo(
    () => transactions.filter((t) => isSameMonth(t.date, currentMonth)),
    [transactions, currentMonth]
  );

  const totalIncome = monthTransactions.filter((t) => t.type === "income").reduce((sum, t) => sum + t.amount, 0);
  const totalExpense = monthTransactions.filter((t) => t.type === "expense").reduce((sum, t) => sum + t.amount, 0);
  const net = totalIncome - totalExpense;

  if (!isAuthenticated) return null;

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Calendar</h1>
          <p className="text-gray-600">View expenses by day</p>
        </div>

        {error ? (
          <div className="mb-6 p-4 rounded-lg border border-red-200 bg-red-50 text-red-700">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="flex items-center justify-center min-h-[40vh]">
            <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
          </div>
        ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 p-6">
            <div className="flex items-center justify-between mb-4">
              <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-2 rounded-lg hover:bg-gray-100" aria-label="Previous month">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="text-lg font-semibold">{format(currentMonth, "MMMM yyyy")}</div>
              <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-2 rounded-lg hover:bg-gray-100" aria-label="Next month">
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-7 text-sm font-medium text-gray-500 mb-2">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                <div key={d} className="p-2 text-center">
                  {d}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((day) => {
                const dayTransactions = getTransactionsForDate(day);
                const isSelected = isSameDay(day, selectedDate);
                const inMonth = isSameMonth(day, currentMonth);
                const dayTotal = dayTransactions.reduce(
                  (sum, t) => (t.type === "expense" ? sum - t.amount : sum + t.amount),
                  0,
                );

                return (
                  <button
                    key={day.toISOString()}
                    onClick={() => setSelectedDate(day)}
                    className={`min-h-[80px] p-2 rounded-lg border text-left transition-colors ${inMonth ? "bg-white" : "bg-gray-50"} ${isSelected ? "border-indigo-500 ring-2 ring-indigo-100" : "border-gray-200"} hover:bg-gray-50`}
                  >
                    <div className={`text-sm font-medium ${inMonth ? "text-gray-900" : "text-gray-400"}`}>{format(day, "d")}</div>
                    {dayTransactions.length > 0 && (
                      <div className="mt-2 space-y-1">
                        <div className={`text-xs font-semibold ${dayTotal >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {dayTotal >= 0 ? "+" : ""}${dayTotal.toFixed(2)}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {Array.from(new Set(dayTransactions.map((t) => t.category)))
                            .slice(0, 3)
                            .map((c: string) => (
                              <span
                                key={c}
                                className="inline-block w-2 h-2 rounded-full"
                                style={{ backgroundColor: categoryColors[c] ?? "#95A5A6" }}
                                aria-label={c}
                                title={c}
                              />
                            ))}
                        </div>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </Card>

          <Card className="p-6">
            <div className="mb-4">
              <div className="text-lg font-semibold">{format(selectedDate, "MMMM d, yyyy")}</div>
              <div className="text-sm text-gray-500">Transactions</div>
            </div>

            <div className="mb-4">
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search category or description" />
            </div>

            {filteredSelectedTransactions.length === 0 ? (
              <div className="text-sm text-gray-500">No transactions for this date.</div>
            ) : (
              <div className="space-y-3">
                {filteredSelectedTransactions.map((t) => (
                  <div key={t.id} className="flex items-start justify-between gap-3 border-b border-gray-100 pb-3">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{t.description}</div>
                      <div className="text-xs text-gray-500">{t.category}</div>
                    </div>
                    <div className={`text-sm font-semibold ${t.type === "income" ? "text-green-600" : "text-red-600"}`}>
                      {t.type === "income" ? "+" : "-"}${t.amount.toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-6 pt-4 border-t border-gray-100">
              <div className="text-sm text-gray-600 mb-2">This month totals</div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Income</span>
                <span className="font-semibold text-green-600">+${totalIncome.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-sm mt-1">
                <span className="text-gray-500">Expenses</span>
                <span className="font-semibold text-red-600">-${totalExpense.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-sm mt-3">
                <span className="text-gray-700 font-medium">Net</span>
                <span className={`font-semibold ${net >= 0 ? "text-green-700" : "text-red-700"}`}>${net.toFixed(2)}</span>
              </div>
            </div>
          </Card>
        </div>
        )}
      </div>
    </div>
  );
}
