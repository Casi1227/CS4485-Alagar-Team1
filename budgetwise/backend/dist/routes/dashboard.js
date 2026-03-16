import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { authRequired } from "../middleware/authRequired.js";
/**
 * Dashboard summary: spend totals, category breakdown, budget progress for a given month.
 * GET /api/dashboard?month=3&year=2026 (month/year optional; default = current)
 */
export const dashboardRouter = Router();
const CATEGORY_COLORS = {
    "Food & Dining": "#DC2626",
    "Groceries": "#16A34A",
    "Transportation": "#4ECDC4",
    "Books & Supplies": "#45B7D1",
    "Entertainment": "#FFA07A",
    "Housing": "#98D8C8",
    "Utilities": "#D97706",
    "Health": "#0891B2",
    "Personal Care": "#BB8FCE",
    "Rent": "#98D8C8",
    "Tuition": "#45B7D1",
    Other: "#95A5A6",
};
function getCategoryColor(category, index) {
    const palette = Object.values(CATEGORY_COLORS);
    return CATEGORY_COLORS[category] ?? palette[index % palette.length];
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
    const totalSpent = expenses.reduce((sum, e) => sum + e.amount, 0);
    const remaining = totalBudget - totalSpent;
    // Spending by category (for pie chart): { name, value, color }
    const spentByCategory = new Map();
    for (const e of expenses) {
        spentByCategory.set(e.category, (spentByCategory.get(e.category) ?? 0) + e.amount);
    }
    const categoryBreakdown = Array.from(spentByCategory.entries()).map(([name], i) => ({
        name,
        value: Math.round(spentByCategory.get(name) * 100) / 100,
        color: getCategoryColor(name, i),
    }));
    // Remaining by category (for bar chart): { category, allocated, spent, remaining }
    const spentByCat = new Map();
    for (const e of expenses) {
        spentByCat.set(e.category, (spentByCat.get(e.category) ?? 0) + e.amount);
    }
    const categorySet = new Set([
        ...budgets.map((b) => b.category),
        ...expenses.map((e) => e.category),
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
        totalSpent: Math.round(totalSpent * 100) / 100,
        remaining: Math.round(remaining * 100) / 100,
        categoryBreakdown,
        remainingByCategory,
    });
});
