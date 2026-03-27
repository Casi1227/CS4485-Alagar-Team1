import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { authRequired } from "../middleware/authRequired.js";
/**
 * Dashboard summary: spend totals, category breakdown, budget progress for a given month.
 * GET /api/dashboard?month=3&year=2026 (month/year optional; default = current)
 */
export const dashboardRouter = Router();
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
    const month = req.query.month ? Number(req.query.month) : now.getMonth() + 1;
    const year = req.query.year ? Number(req.query.year) : now.getFullYear();
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
    const totalBudget = budgets.reduce((sum, b) => sum + b.allocated, 0);
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
    const categoryBreakdown = Array.from(spentByCategory.entries()).map(([name], i) => ({
        name,
        value: Math.round(spentByCategory.get(name) * 100) / 100,
        color: getCategoryColor(name, i),
    }));
    // Remaining by category (for bar chart): { category, allocated, spent, remaining }
    const spentByCat = new Map();
    for (const e of expenseItems) {
        spentByCat.set(e.category, (spentByCat.get(e.category) ?? 0) + e.amount);
    }
    const categorySet = new Set([
        ...budgets.map((b) => b.category),
        ...expenseItems.map((e) => e.category),
    ]);
    const remainingByCategory = Array.from(categorySet).map((category) => {
        const allocated = budgets.find((b) => b.category === category)?.allocated ?? 0;
        const spent = spentByCat.get(category) ?? 0;
        return {
            category,
            allocated: Math.round(allocated * 100) / 100,
            spent: Math.round(spent * 100) / 100,
            remaining: Math.round((allocated - spent) * 100) / 100,
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
