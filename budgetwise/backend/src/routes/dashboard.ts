import { Router } from "express";
import { TransactionType } from '@prisma/client';
import { prisma } from "../lib/prisma.js";
import { authRequired, type AuthedRequest } from "../middleware/authRequired.js";
import { BUDGET_CATEGORIES, CATEGORY_COLORS } from "../lib/categories.js";
import { getOrSetRequestCache } from "../lib/requestCache.js";

/**
 * Dashboard summary: spend totals, category breakdown, budget progress for a given month.
 * GET /api/dashboard?month=3&year=2026 (month/year optional; default = real-world current month)
 */
export const dashboardRouter = Router();

/** Map old/alt labels from older data into one of BUDGET_CATEGORIES. */
const LEGACY_CATEGORY_MAP: Record<string, string> = {
    "food & dining": "Dining",
    "books & supplies": "Tuition",
    "personal care": "Other",
    "health & fitness": "Health",
    savings: "Other",
    housing: "Rent",
};

function normalizeCategory(category: string): string {
    return category.trim().toLowerCase();
}

const CANONICAL_BY_NORMALIZED = new Map(
    BUDGET_CATEGORIES.map((c) => [normalizeCategory(c), c]),
);

function canonicalCategory(raw: string): string {
    const n = normalizeCategory(raw);
    const direct = CANONICAL_BY_NORMALIZED.get(n);
    if (direct) return direct;
    return LEGACY_CATEGORY_MAP[n] ?? "Other";
}

const CATEGORY_COLORS_NORMALIZED: Record<string, string> = Object.fromEntries(
    Object.entries(CATEGORY_COLORS).map(([k, v]) => [normalizeCategory(k), v]),
);
const DASHBOARD_CACHE_TTL_MS = 60_000;

function getCategoryColor(category: string, index: number): string {
    const palette = Object.values(CATEGORY_COLORS);
    const normalized = normalizeCategory(category);
    return CATEGORY_COLORS_NORMALIZED[normalized] ?? palette[index % palette.length];
}

dashboardRouter.get("/", authRequired, async (req: AuthedRequest, res) => {
    const userId = req.user!.id;
    const now = new Date();

    const monthParam = req.query.month !== undefined ? Number(req.query.month) : undefined;
    const yearParam = req.query.year !== undefined ? Number(req.query.year) : undefined;

    let month = monthParam;
    let year = yearParam;

    const monthValid =
        month != null && Number.isFinite(month) && month >= 1 && month <= 12;
    const yearValid =
        year != null && Number.isFinite(year) && year >= 1970 && year <= 2100;

    // Default to the real-world calendar month (not the latest expense date), so mock or
    // future-dated data does not shift the dashboard away from "today".
    if (!monthValid || !yearValid) {
        month = now.getMonth() + 1;
        year = now.getFullYear();
    }

    const startOfMonth = new Date(Number(year), Number(month) - 1, 1);
    const endOfMonth = new Date(Number(year), Number(month), 0, 23, 59, 59, 999);

    const cacheKey = `dashboard:${userId}:${month}:${year}`;
    const payload = await getOrSetRequestCache(cacheKey, DASHBOARD_CACHE_TTL_MS, async () => {
        const [budgets, expensesGroupedByType, expensesGroupedByCategory] =
            await Promise.all([
                prisma.budget.findMany({
                    where: { userId, month, year },
                }),
                prisma.expense.groupBy({
                    by: ["type"],
                    where: {
                        userId,
                        date: { gte: startOfMonth, lte: endOfMonth },
                    },
                    _sum: { amount: true },
                }),
                prisma.expense.groupBy({
                    by: ["category"],
                    where: {
                        userId,
                        type: TransactionType.EXPENSE,
                        date: { gte: startOfMonth, lte: endOfMonth },
                    },
                    _sum: { amount: true },
                }),
            ]);

        let recentTransactionsSourceMonth = Number(month);
        let recentTransactionsSourceYear = Number(year);
        let recentTransactions = await prisma.expense.findMany({
            where: {
                userId,
                date: { gte: startOfMonth, lte: endOfMonth },
            },
            orderBy: [{ date: "desc" }, { id: "desc" }],
            take: 10,
        });

        // If there are no transactions in the time-synced current month,
        // fallback to the latest previous month that has data.
        if (recentTransactions.length === 0) {
            const latestPrevious = await prisma.expense.findFirst({
                where: {
                    userId,
                    date: { lt: startOfMonth },
                },
                orderBy: { date: "desc" },
                select: { date: true },
            });

            if (latestPrevious?.date) {
                recentTransactionsSourceMonth = latestPrevious.date.getMonth() + 1;
                recentTransactionsSourceYear = latestPrevious.date.getFullYear();
                const sourceStart = new Date(recentTransactionsSourceYear, recentTransactionsSourceMonth - 1, 1);
                const sourceEnd = new Date(recentTransactionsSourceYear, recentTransactionsSourceMonth, 0, 23, 59, 59, 999);
                recentTransactions = await prisma.expense.findMany({
                    where: {
                        userId,
                        date: { gte: sourceStart, lte: sourceEnd },
                    },
                    orderBy: [{ date: "desc" }, { id: "desc" }],
                    take: 10,
                });
            }
        }

        const recentTransactionsPayload = recentTransactions.map((t) => ({
            id: t.id,
            date: t.date,
            category: t.category,
            note: t.note ?? "",
            type: t.type,
            amount: Math.round(t.amount * 100) / 100,
        }));

        // BudgetCreator stores the total monthly budget in `totalLimit` (duplicated per category row).
        // Use the max to be resilient if a partial save occurred.
        const totalBudget = budgets.reduce((max, b) => (b.totalLimit > max ? b.totalLimit : max), 0);
        const totalExpense = expensesGroupedByType
            .filter((row) => row.type === TransactionType.EXPENSE)
            .reduce((sum, row) => sum + (row._sum.amount ?? 0), 0);
        const totalIncome = expensesGroupedByType
            .filter((row) => row.type === TransactionType.INCOME)
            .reduce((sum, row) => sum + (row._sum.amount ?? 0), 0);
        const net = totalIncome - totalExpense;

        // For budgeting, "Remaining" is based on expenses vs allocated budget.
        const remaining = totalBudget - totalExpense;

        // Spending by category (for pie chart): { name, value, color }
        const spentByCategory = new Map<string, number>();
        for (const row of expensesGroupedByCategory) {
            const cat = canonicalCategory(row.category);
            spentByCategory.set(cat, (spentByCategory.get(cat) ?? 0) + (row._sum.amount ?? 0));
        }
        // Include all BudgetCreator categories so the pie legend shows every option,
        // but 0-value categories won't render visible slices.
        const categoryBreakdown = BUDGET_CATEGORIES.map((name, i) => ({
            name,
            value: Math.round((spentByCategory.get(name) ?? 0) * 100) / 100,
            color: getCategoryColor(name, i),
        }));

        // Remaining by category (for bar chart): { category, allocated, spent, remaining }
        const spentByCat = new Map(spentByCategory);

        const allocatedByCanonical = new Map<string, number>();
        for (const b of budgets) {
            const cat = canonicalCategory(b.category);
            allocatedByCanonical.set(cat, (allocatedByCanonical.get(cat) ?? 0) + b.allocated);
        }

        const remainingByCategory = BUDGET_CATEGORIES.map((category) => {
            const allocated = allocatedByCanonical.get(category) ?? 0;
            const spent = spentByCat.get(category) ?? 0;
            return {
                category,
                allocated: Math.round(allocated * 100) / 100,
                spent: Math.round(spent * 100) / 100,
                // "Budget Remaining" bar uses the allocated budget from Budget Creator.
                remaining: Math.round(allocated * 100) / 100,
            };
        });

        return {
            month,
            year,
            totalBudget: Math.round(totalBudget * 100) / 100,
            totalIncome: Math.round(totalIncome * 100) / 100,
            totalExpense: Math.round(totalExpense * 100) / 100,
            net: Math.round(net * 100) / 100,

            // Backward compatibility for older frontend expectations
            totalSpent: Math.round(totalExpense * 100) / 100,
            remaining: Math.round(remaining * 100) / 100,
            categoryBreakdown,
            remainingByCategory,
            recentTransactionsMonth: recentTransactionsSourceMonth,
            recentTransactionsYear: recentTransactionsSourceYear,
            recentTransactions: recentTransactionsPayload,
        };
    });
    res.json(payload);
});
