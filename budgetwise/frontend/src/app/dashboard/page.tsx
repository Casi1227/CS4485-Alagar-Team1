"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Protected } from "@/components/shared/Protected";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/store/auth";

type Expense = { id: string; amount: number; category: string; date: string; note?: string | null };

export default function DashboardPage() {
  const { token, user, logout } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const res = await apiFetch<{ expenses: Expense[] }>("/expenses", {}, token);
      setExpenses(res.expenses);
    } catch (e: any) {
      setError(e.message);
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <Protected>
      <main className="mx-auto max-w-3xl p-6 space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">Dashboard</h1>
            <p className="text-sm text-slate-600">Signed in as {user?.email}</p>
          </div>
          <div className="flex gap-2">
            <Link href="/expenses"><Button variant="outline">Expenses</Button></Link>
            <Link href="/profile"><Button variant="outline">Profile</Button></Link>
            <Button variant="ghost" onClick={logout}>Logout</Button>
          </div>
        </header>

        {error ? <p className="text-sm text-alert">{error}</p> : null}

        <section className="space-y-2">
          <h2 className="font-medium">Recent Expenses</h2>
          <div className="rounded-md border">
            {expenses.length === 0 ? (
              <p className="p-4 text-sm text-slate-600">No expenses yet.</p>
            ) : (
              <ul>
                {expenses.slice(0, 10).map((e) => (
                  <li key={e.id} className="flex items-center justify-between border-b p-3 last:border-b-0">
                    <div>
                      <p className="text-sm">{e.category}</p>
                      <p className="text-xs text-slate-500">{new Date(e.date).toLocaleDateString()}</p>
                    </div>
                    <p className="text-sm font-medium">${e.amount.toFixed(2)}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </main>
    </Protected>
  );
}
