import { z } from "zod";
const transactionType = z.enum(["EXPENSE", "INCOME"]);
export const createExpenseSchema = z.object({
    amount: z.number().positive(),
    category: z.string().min(1),
    date: z.string().min(1),
    note: z.string().optional(),
    type: transactionType.optional(), // defaults to EXPENSE in router/db
});
export const updateExpenseSchema = z.object({
    amount: z.number().positive().optional(),
    category: z.string().min(1).optional(),
    date: z.string().min(1).optional(),
    note: z.string().optional(),
    type: transactionType.optional(),
});
