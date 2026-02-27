import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-xl p-6 space-y-4">
      <h1 className="text-2xl font-semibold">BudgetWise</h1>
      <p className="text-slate-600">
        Spec aligned starter: Next.js + TypeScript + Tailwind, Express + Prisma + Postgres, Zod, bcrypt auth.
      </p>
      <div className="flex gap-3">
        <Link className="underline" href="/login">Login</Link>
        <Link className="underline" href="/register">Register</Link>
        <Link className="underline" href="/dashboard">Dashboard</Link>
      </div>
    </main>
  );
}
