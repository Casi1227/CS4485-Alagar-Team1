import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { authRequired, type AuthedRequest } from "../middleware/authRequired.js";
import { createExpenseSchema, updateExpenseSchema } from "../validators/expenseSchemas.js";
import { invalidateUserDashboardAndAiCache } from "../lib/requestCache.js";

/**
 * R-102: CRUD expenses with backdating (date field).
 * Now supports INCOME as well via `type`.
 */
export const expensesRouter = Router();
const DEFAULT_PAGE_SIZE = 100;
const MAX_PAGE_SIZE = 250;

function parseYmdLocal(ymd: string): Date | null {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
    if (!m) return null;
    const year = Number(m[1]);
    const month = Number(m[2]);
    const day = Number(m[3]);
    if (!Number.isFinite(year)
            || !Number.isFinite(month)
            || !Number.isFinite(day)) {
        return null;
    }
    /* Treat date-only values as UTC calendar dates
     * so they do not drift by timezone. */
    const d = new Date(Date.UTC(year, month - 1, day));
    if (Number.isNaN(d.getTime())) {
        return null;
    }
    return d;
}

expensesRouter.get("/", authRequired, async (req: AuthedRequest, res) => {
    const userId = req.user!.id;
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;
    const cursor = req.query.cursor as string | undefined;
    const limitRaw = req.query.limit as string | undefined;

    const where: Prisma.ExpenseWhereInput = { userId };
    if (from || to) {
        where.date = {};
        if (from) {
            const d = parseYmdLocal(from) ?? new Date(from);
            if (!Number.isNaN(d.getTime())) {
                (where.date as Prisma.DateTimeFilter).gte = d;
            }
        }
        if (to) {
            const toDate = parseYmdLocal(to) ?? new Date(to);
            if (!Number.isNaN(toDate.getTime())) {
                toDate.setUTCHours(23, 59, 59, 999);
                (where.date as Prisma.DateTimeFilter).lte = toDate;
            }
        }
    }

    const limitParam = Number(limitRaw ?? DEFAULT_PAGE_SIZE);
    const take = Number.isFinite(limitParam)
        ? Math.max(1, Math.min(MAX_PAGE_SIZE, Math.trunc(limitParam)))
        : DEFAULT_PAGE_SIZE;

    /* Cursor format is the last seen expense id. */
    const query: Prisma.ExpenseFindManyArgs = {
        where,
        orderBy: [{ date: "desc" }, { id: "desc" }],
        take: take + 1, /* read one extra row to determine hasNext/ */
    };
    if (cursor) {
        query.cursor = { id: cursor };
        query.skip = 1;
    }

    const items = await prisma.expense.findMany(query);
    const hasNext = items.length > take;
    const page = hasNext ? items.slice(0, take) : items;
    const nextCursor = hasNext ? page[page.length - 1]?.id ?? null : null;

    return res.json({
        expenses: page,
        pageInfo: { hasNext, nextCursor },
    });
});

expensesRouter.post("/", authRequired, async (req: AuthedRequest, res) => {
    const parsed = createExpenseSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
    }

    const userId = req.user!.id;

    const created = await prisma.expense.create({
        data: {
            userId,
            amount: parsed.data.amount,
            category: parsed.data.category,
            type: parsed.data.type ?? "EXPENSE",
            date: parseYmdLocal(parsed.data.date)
                ?? new Date(parsed.data.date),
            note: parsed.data.note,
        },
    });
    invalidateUserDashboardAndAiCache(userId);

    res.status(201).json({ expense: created });
});

expensesRouter.put("/:id", authRequired, async (req: AuthedRequest, res) => {
    const parsed = updateExpenseSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const userId = req.user!.id;
    const id = req.params.id;

    const existing = await prisma.expense.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) {
        return res.status(404).json({ error: "Expense not found" });
    }

    const updated = await prisma.expense.update({
        where: { id },
        data: {
            amount: parsed.data.amount,
            category: parsed.data.category,
            type: parsed.data.type,
            date: parsed.data.date
                ? (parseYmdLocal(parsed.data.date) ?? new Date(parsed.data.date))
                : undefined,
            note: parsed.data.note,
        },
    });
    invalidateUserDashboardAndAiCache(userId);

    res.json({ expense: updated });
});

expensesRouter.delete("/:id", authRequired, async (req: AuthedRequest, res) => {
    const userId = req.user!.id;
    const id = req.params.id;

    const existing = await prisma.expense.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) {
        return res.status(404).json({ error: "Expense not found" });
    }

    await prisma.expense.delete({ where: { id } });
    invalidateUserDashboardAndAiCache(userId);
    res.json({ ok: true });
});
