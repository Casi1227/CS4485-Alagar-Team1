"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Protected } from "@/components/shared/Protected";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/store/auth";

type Expense = { id: string; amount: number; category: string; date: string; note?: string | null };

export default function ExpensesPage() {
  const { token } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await apiFetch<{ expenses: Expense[] }>("/expenses", {}, token);
    setExpenses(res.expenses);
  }

  useEffect(() => { load().catch((e) => setError(e.message)); }, []);

  async function addExpense(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const body = {
        amount: Number(amount),
        category,
        date: new Date(date).toISOString(),
        note: note || undefined,
      };
      await apiFetch("/expenses", { method: "POST", body: JSON.stringify(body) }, token);
      setAmount("");
      setCategory("");
      setNote("");
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function remove(id: string) {
    setError(null);
    try {
      await apiFetch(`/expenses/${id}`, { method: "DELETE" }, token);
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <Protected>
      <main className="mx-auto max-w-3xl p-6 space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Expenses</h1>
          <Link href="/dashboard"><Button variant="outline">Back</Button></Link>
        </header>

        <form className="rounded-md border p-4 space-y-3" onSubmit={addExpense}>
          <h2 className="font-medium">Add Expense</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <input className="rounded-md border px-3 py-2" placeholder="Category" value={category} onChange={(e) => setCategory(e.target.value)} />
            <input className="rounded-md border px-3 py-2" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <input className="rounded-md border px-3 py-2" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            <input className="rounded-md border px-3 py-2 md:col-span-1" placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          {error ? <p className="text-sm text-alert">{error}</p> : null}
          <Button type="submit">Create</Button>
        </form>

        <section className="space-y-2">
          <h2 className="font-medium">All Expenses</h2>
          <div className="rounded-md border">
            {expenses.length === 0 ? (
              <p className="p-4 text-sm text-slate-600">No expenses yet.</p>
            ) : (
              <ul>
                {expenses.map((e) => (
                  <li key={e.id} className="flex items-center justify-between border-b p-3 last:border-b-0">
                    <div>
                      <p className="text-sm">{e.category}</p>
                      <p className="text-xs text-slate-500">{new Date(e.date).toLocaleDateString()} {e.note ? `• ${e.note}` : ""}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="text-sm font-medium">${e.amount.toFixed(2)}</p>
                      <Button variant="destructive" size="sm" onClick={() => remove(e.id)}>Delete</Button>
                    </div>
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
