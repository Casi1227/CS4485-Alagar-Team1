import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { authRequired } from "../middleware/authRequired.js";
import { upsertBudgetSchema } from "../validators/budgetSchemas.js";
export const budgetsRouter = Router();
function currentMonthYear() {
    const d = new Date();
    return { month: d.getMonth() + 1, year: d.getFullYear() };
}
/**
 * Get the user's budget for a given month/year.
 * Returns one row per category.
 */
budgetsRouter.get("/", authRequired, async (req, res) => {
    const userId = req.user.id;
    const qMonth = req.query.month ? Number(req.query.month) : undefined;
    const qYear = req.query.year ? Number(req.query.year) : undefined;
    const { month, year } = qMonth && qYear ? { month: qMonth, year: qYear } : currentMonthYear();
    const rows = await prisma.budget.findMany({
        where: { userId, month, year },
        orderBy: { category: "asc" },
    });
    if (rows.length === 0) {
        return res.status(404).json({ error: "No budget found" });
    }
    // totalLimit is duplicated per row, so read from the first
    const totalLimit = rows[0].totalLimit;
    return res.json({
        month,
        year,
        totalLimit,
        categories: rows.map((r) => ({
            category: r.category,
            allocated: r.allocated,
            percent: r.percent,
        })),
    });
});
/**
 * Save/overwrite a budget for month/year.
 * Uses upsert per category so repeated saves do not create duplicates.
 */
budgetsRouter.post("/", authRequired, async (req, res) => {
    const parsed = upsertBudgetSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: parsed.error.flatten() });
    const userId = req.user.id;
    const { month, year, totalLimit, categories } = parsed.data;
    const incomingCategoryNames = categories.map((c) => c.category);
    // Keep only the current submitted categories for that month/year.
    // This removes stale/legacy category rows that can skew dashboard bars.
    await prisma.$transaction([
        prisma.budget.deleteMany({
            where: {
                userId,
                month,
                year,
                category: { notIn: incomingCategoryNames },
            },
        }),
        ...categories.map((c) => prisma.budget.upsert({
            where: {
                user_month_year_category: {
                    userId,
                    month,
                    year,
                    category: c.category,
                },
            },
            create: {
                userId,
                month,
                year,
                totalLimit,
                category: c.category,
                allocated: c.allocated,
                percent: c.percent,
            },
            update: {
                totalLimit,
                allocated: c.allocated,
                percent: c.percent,
            },
        })),
    ]);
    return res.json({ ok: true });
});
