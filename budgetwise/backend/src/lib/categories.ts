export const BUDGET_CATEGORIES = [
  "Rent",
  "Groceries",
  "Tuition",
  "Transportation",
  "Entertainment",
  "Utilities",
  "Health",
  "Dining",
  "Other",
] as const;

export const CATEGORY_COLORS: Record<string, string> = {
  Rent: "#6366F1",
  Tuition: "#A855F7",
  Groceries: "#16A34A",
  Transportation: "#4ECDC4",
  Entertainment: "#F97316",
  Utilities: "#D97706",
  Health: "#0891B2",
  Dining: "#DC2626",
  Other: "#95A5A6",
};
