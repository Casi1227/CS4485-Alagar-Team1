import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { authRequired, type AuthedRequest } from "../middleware/authRequired.js";
import { createExpenseSchema, updateExpenseSchema } from "../validators/expenseSchemas.js";

/**
 * R-102: CRUD expenses with backdating (date field).
 */
export const expensesRouter = Router();

expensesRouter.get("/", authRequired, async (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  const from = req.query.from as string | undefined;
  const to = req.query.to as string | undefined;

  const where: { userId: string; date?: { gte?: Date; lte?: Date } } = { userId };
  if (from || to) {
    where.date = {};
    if (from) where.date.gte = new Date(from);
    if (to) {
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999);
      where.date.lte = toDate;
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

  // Ensure user owns expense
  const existing = await prisma.expense.findUnique({ where: { id } });
  if (!existing || existing.userId !== userId) return res.status(404).json({ error: "Expense not found" });

  const updated = await prisma.expense.update({
    where: { id },
    data: {
      amount: parsed.data.amount,
      category: parsed.data.category,
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
