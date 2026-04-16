import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { authRequired, type AuthedRequest } from "../middleware/authRequired.js";
import { createExpenseSchema, updateExpenseSchema } from "../validators/expenseSchemas.js";

/**
 * R-102: CRUD expenses with backdating (date field).
 * Now supports INCOME as well via `type`.
 */
export const expensesRouter = Router();

function parseYmdLocal(ymd: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  const d = new Date(year, month - 1, day);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

expensesRouter.get("/", authRequired, async (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  const from = req.query.from as string | undefined;
  const to = req.query.to as string | undefined;

  const where: { userId: string; date?: { gte?: Date; lte?: Date } } = { userId };
  if (from || to) {
    where.date = {};
    if (from) {
      const d = parseYmdLocal(from) ?? new Date(from);
      if (!Number.isNaN(d.getTime())) where.date.gte = d;
    }
    if (to) {
      const toDate = parseYmdLocal(to) ?? new Date(to);
      if (!Number.isNaN(toDate.getTime())) {
        toDate.setHours(23, 59, 59, 999);
        where.date.lte = toDate;
      }
    }
  }

  const items = await prisma.expense.findMany({ where, orderBy: { date: "desc" } });
  res.json({ expenses: items });
});

expensesRouter.post("/", authRequired, async (req: AuthedRequest, res) => {
  const parsed = createExpenseSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const userId = req.user!.id;

  const created = await prisma.expense.create({
    data: {
      userId,
      amount: parsed.data.amount,
      category: parsed.data.category,
      type: parsed.data.type ?? "EXPENSE",
      date: new Date(parsed.data.date),
      note: parsed.data.note,
    },
  });

  res.status(201).json({ expense: created });
});

expensesRouter.put("/:id", authRequired, async (req: AuthedRequest, res) => {
  const parsed = updateExpenseSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const userId = req.user!.id;
  const id = req.params.id;

  const existing = await prisma.expense.findUnique({ where: { id } });
  if (!existing || existing.userId !== userId) return res.status(404).json({ error: "Expense not found" });

  const updated = await prisma.expense.update({
    where: { id },
    data: {
      amount: parsed.data.amount,
      category: parsed.data.category,
      type: parsed.data.type,
      date: parsed.data.date ? new Date(parsed.data.date) : undefined,
      note: parsed.data.note,
    },
  });

  res.json({ expense: updated });
});

expensesRouter.delete("/:id", authRequired, async (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  const id = req.params.id;

  const existing = await prisma.expense.findUnique({ where: { id } });
  if (!existing || existing.userId !== userId) return res.status(404).json({ error: "Expense not found" });

  await prisma.expense.delete({ where: { id } });
  res.json({ ok: true });
});