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
export const aiBudgetSuggestionCategoryInputSchema = z.object({
    category: z.string().trim().min(1).max(80),
    allocated: z.number().nonnegative(),
    percent: z.number().min(0).max(100),
});
export const aiBudgetSuggestionsRequestSchema = z.object({
    income: z.number().positive(),
    month: z.number().int().min(1).max(12),
    year: z.number().int().min(1970).max(3000),
    categories: z.array(aiBudgetSuggestionCategoryInputSchema).min(1).max(20),
});
export const aiBudgetSuggestionItemSchema = z.object({
    category: z.string().trim().min(1).max(80),
    percent: z.number().min(0).max(100),
});
export const aiBudgetSuggestionsResponseSchema = z.object({
    suggestions: z.array(aiBudgetSuggestionItemSchema).min(1),
    generatedAt: z.string().datetime(),
});
