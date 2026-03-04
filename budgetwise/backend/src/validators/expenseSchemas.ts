import { z } from "zod";

export const createExpenseSchema = z.object({
  amount: z.number().positive(),
  category: z.string().min(1),
  date: z.string().date(), // ISO string from client
  note: z.string().optional(),
});

export const updateExpenseSchema = createExpenseSchema.partial();
