import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { authRequired } from "../middleware/authRequired.js";
/**
 * Dashboard summary: spend totals, category breakdown, budget progress for a given month.
 * GET /api/dashboard?month=3&year=2026 (month/year optional; default = current)
 */
export const dashboardRouter = Router();
// Categories shown in Budget Creator / charts.
// Keep this in sync with frontend `BudgetCreator.tsx` categoryOptions.
const BUDGET_CATEGORIES = [
    "Rent",
    "Groceries",
    "Tuition",
    "Food & Dining",
    "Transportation",
    "Books & Supplies",
    "Entertainment",
    "Personal Care",
    "Health & Fitness",
    "Utilities",
    "Savings",
    "Other",
];
const CATEGORY_COLORS = {
    // Common expense categories
    Rent: "#6366F1",
    Tuition: "#A855F7",
    Groceries: "#16A34A",
    Transportation: "#4ECDC4",
    Entertainment: "#F97316",
    Utilities: "#D97706",
    Health: "#0891B2",
    Dining: "#DC2626",
    // Back-compat / legacy categories used in charts
    "Food & Dining": "#DC2626",
    "Books & Supplies": "#45B7D1",
    Housing: "#98D8C8",
    "Personal Care": "#BB8FCE",
    "Health & Fitness": "#EF4444",
    Savings: "#10B981",
    Other: "#95A5A6",
};
function normalizeCategory(category) {
    return category.trim().toLowerCase();
}
const CATEGORY_COLORS_NORMALIZED = Object.fromEntries(Object.entries(CATEGORY_COLORS).map(([k, v]) => [normalizeCategory(k), v]));
function getCategoryColor(category, index) {
    const palette = Object.values(CATEGORY_COLORS);
    const normalized = normalizeCategory(category);
    return CATEGORY_COLORS_NORMALIZED[normalized] ?? palette[index % palette.length];
}
dashboardRouter.get("/", authRequired, async (req, res) => {
    const userId = req.user.id;
    const now = new Date();
    const monthParam = req.query.month ? Number(req.query.month) : undefined;
    const yearParam = req.query.year ? Number(req.query.year) : undefined;
    // Time-sync rule: default to the most-recent month that has any transactions.
    // If user has no transactions, fall back to the real current month.
    let month = monthParam;
    let year = yearParam;
    if (!month || !year) {
        const latest = await prisma.expense.findFirst({
            where: { userId },
            orderBy: { date: "desc" },
            select: { date: true },
        });
        const anchor = latest?.date ?? now;
        if (!month)
            month = anchor.getMonth() + 1;
        if (!year)
            year = anchor.getFullYear();
    }
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);
    const [budgets, expenses] = await Promise.all([
        prisma.budget.findMany({
            where: { userId, month, year },
        }),
        prisma.expense.findMany({
            where: {
                userId,
                date: { gte: startOfMonth, lte: endOfMonth },
            },
        }),
    ]);
    // BudgetCreator stores the total monthly budget in `totalLimit` (duplicated per category row).
    // Use the max to be resilient if a partial save occurred.
    const totalBudget = budgets.reduce((max, b) => (b.totalLimit > max ? b.totalLimit : max), 0);
    const expenseItems = expenses.filter((e) => e.type === "EXPENSE");
    const incomeItems = expenses.filter((e) => e.type === "INCOME");
    const totalExpense = expenseItems.reduce((sum, e) => sum + e.amount, 0);
    const totalIncome = incomeItems.reduce((sum, e) => sum + e.amount, 0);
    const net = totalIncome - totalExpense;
    // For budgeting, "Remaining" is based on expenses vs allocated budget.
    const remaining = totalBudget - totalExpense;
    // Spending by category (for pie chart): { name, value, color }
    const spentByCategory = new Map();
    for (const e of expenseItems) {
        spentByCategory.set(e.category, (spentByCategory.get(e.category) ?? 0) + e.amount);
    }
    // Include all BudgetCreator categories so the pie legend shows every option,
    // but 0-value categories won't render visible slices.
    const categoryBreakdown = BUDGET_CATEGORIES.map((name, i) => ({
        name,
        value: Math.round((spentByCategory.get(name) ?? 0) * 100) / 100,
        color: getCategoryColor(name, i),
    }));
    // Remaining by category (for bar chart): { category, allocated, spent, remaining }
    const spentByCat = new Map();
    for (const e of expenseItems) {
        spentByCat.set(e.category, (spentByCat.get(e.category) ?? 0) + e.amount);
    }
    const categorySet = new Set(BUDGET_CATEGORIES);
    const remainingByCategory = Array.from(categorySet).map((category) => {
        const allocated = budgets.find((b) => b.category === category)?.allocated ?? 0;
        const spent = spentByCat.get(category) ?? 0;
        return {
            category,
            allocated: Math.round(allocated * 100) / 100,
            spent: Math.round(spent * 100) / 100,
            // "Budget Remaining" in the UI is the allocated envelope amount (positive).
            remaining: Math.round(allocated * 100) / 100,
        };
    });
    res.json({
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
    });
});
