/**
 * Canonical expense categories used across Expenses, Budget Creator, and dashboard charts.
 */
export const STANDARD_EXPENSE_CATEGORIES = [
  'Rent',
  'Groceries',
  'Tuition',
  'Transportation',
  'Entertainment',
  'Utilities',
  'Health',
  'Dining',
  'Other',
] as const;

export type StandardExpenseCategory = (typeof STANDARD_EXPENSE_CATEGORIES)[number];
