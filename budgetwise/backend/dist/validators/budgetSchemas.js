import { z } from "zod";
export const budgetCategorySchema = z.object({
    category: z.string().min(1),
    allocated: z.number().nonnegative(),
    percent: z.number().nonnegative().optional().default(0),
});
export const upsertBudgetSchema = z.object({
    month: z.number().int().min(1).max(12),
    year: z.number().int().min(1970).max(3000),
    totalLimit: z.number().nonnegative(),
    categories: z.array(budgetCategorySchema).min(1),
});
