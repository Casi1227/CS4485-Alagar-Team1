import type { RemovedTransaction, Transaction } from "plaid";
import { prisma } from "../lib/prisma.js";
import { BUDGET_CATEGORIES } from "../lib/categories.js";
import { plaidClient } from "./plaidClient.js";

const prismaAny = prisma as any;

const BUDGET_CATEGORY_SET = new Set<string>(BUDGET_CATEGORIES);

const CATEGORY_KEYWORDS: Array<{ category: string; keywords: string[] }> = [
  { category: "Rent", keywords: ["rent", "landlord", "lease", "apartment"] },
  { category: "Groceries", keywords: ["grocery", "supermarket", "whole foods", "trader joe", "costco", "kroger", "aldi"] },
  { category: "Tuition", keywords: ["tuition", "university", "college", "school", "student loan"] },
  { category: "Transportation", keywords: ["uber", "lyft", "gas", "fuel", "shell", "chevron", "transit", "parking", "toll"] },
  { category: "Entertainment", keywords: ["movie", "theater", "spotify", "netflix", "hulu", "steam", "playstation", "entertainment"] },
  { category: "Utilities", keywords: ["utility", "electric", "water", "internet", "comcast", "verizon", "at&t", "phone"] },
  { category: "Health", keywords: ["health", "pharmacy", "doctor", "hospital", "clinic", "dental", "vision"] },
  { category: "Dining", keywords: ["restaurant", "cafe", "coffee", "doordash", "ubereats", "grubhub", "dining", "fast food"] },
];

const EXCLUDED_KEYWORDS = [
  "credit card payment",
  "payment thank you",
  "autopay",
  "internal transfer",
  "bank transfer",
  "transfer",
  "p2p",
  "zelle",
  "venmo cashout",
];

export type PlaidSyncSummary = {
  created: number;
  updated: number;
  removed: number;
  skipped: number;
};

function normalizeText(txn: Transaction): string {
  const parts = [
    txn.name,
    txn.merchant_name,
    txn.personal_finance_category?.primary,
    txn.personal_finance_category?.detailed,
    ...(txn.category ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return parts;
}

function isExcludedTransfer(txn: Transaction): boolean {
  const text = normalizeText(txn);
  return EXCLUDED_KEYWORDS.some((keyword) => text.includes(keyword));
}

function mapCategory(txn: Transaction): string {
  const text = normalizeText(txn);

  for (const rule of CATEGORY_KEYWORDS) {
    if (rule.keywords.some((keyword) => text.includes(keyword))) {
      return rule.category;
    }
  }

  const plaidCategory = txn.category?.[0] ?? txn.personal_finance_category?.primary;
  if (plaidCategory && BUDGET_CATEGORY_SET.has(plaidCategory)) {
    return plaidCategory;
  }

  return "Other";
}

function parsePlaidDate(ymd: string): Date {
  return new Date(`${ymd}T12:00:00.000Z`);
}

function isWithinInitialWindow(txnDateYmd: string, initialWindowDays?: number): boolean {
  if (!initialWindowDays) return true;

  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - initialWindowDays);

  const txnDate = new Date(`${txnDateYmd}T00:00:00.000Z`);
  return txnDate >= cutoff;
}

async function upsertTransaction(
  userId: string,
  linkedAccountId: string,
  txn: Transaction,
  summary: PlaidSyncSummary,
  initialWindowDays?: number,
) {
  if (!isWithinInitialWindow(txn.date, initialWindowDays)) {
    summary.skipped += 1;
    return;
  }

  if (isExcludedTransfer(txn)) {
    summary.skipped += 1;
    return;
  }

  if (!txn.amount || txn.amount === 0) {
    summary.skipped += 1;
    return;
  }

  const mappedType = txn.amount > 0 ? "EXPENSE" : "INCOME";
  const mappedAmount = Math.abs(txn.amount);
  const mappedCategory = mapCategory(txn);

  const existing = await prismaAny.plaidTransactionImport.findUnique({
    where: {
      user_plaid_txn_unique: {
        userId,
        plaidTransactionId: txn.transaction_id,
      },
    },
    select: {
      id: true,
      expenseId: true,
    },
  });

  if (existing?.expenseId) {
    await prismaAny.expense.update({
      where: { id: existing.expenseId },
      data: {
        amount: mappedAmount,
        category: mappedCategory,
        type: mappedType,
        date: parsePlaidDate(txn.date),
        note: `Plaid: ${txn.name}`,
      },
    });

    await prismaAny.plaidTransactionImport.update({
      where: { id: existing.id },
      data: {
        linkedAccountId,
        removedAt: null,
      },
    });

    summary.updated += 1;
    return;
  }

  const createdExpense = await prismaAny.expense.create({
    data: {
      userId,
      amount: mappedAmount,
      category: mappedCategory,
      type: mappedType,
      date: parsePlaidDate(txn.date),
      note: `Plaid: ${txn.name}`,
    },
  });

  if (existing) {
    await prismaAny.plaidTransactionImport.update({
      where: { id: existing.id },
      data: {
        linkedAccountId,
        expenseId: createdExpense.id,
        removedAt: null,
      },
    });
    summary.updated += 1;
    return;
  }

  await prismaAny.plaidTransactionImport.create({
    data: {
      userId,
      linkedAccountId,
      plaidTransactionId: txn.transaction_id,
      expenseId: createdExpense.id,
      removedAt: null,
    },
  });

  summary.created += 1;
}

async function applyRemovedTransactions(userId: string, removed: RemovedTransaction[], summary: PlaidSyncSummary) {
  for (const removedTxn of removed) {
    const existing = await prismaAny.plaidTransactionImport.findUnique({
      where: {
        user_plaid_txn_unique: {
          userId,
          plaidTransactionId: removedTxn.transaction_id,
        },
      },
      select: {
        id: true,
        expenseId: true,
      },
    });

    if (!existing) continue;

    if (existing.expenseId) {
      await prismaAny.expense.delete({ where: { id: existing.expenseId } });
    }

    await prismaAny.plaidTransactionImport.update({
      where: { id: existing.id },
      data: {
        expenseId: null,
        removedAt: new Date(),
      },
    });

    summary.removed += 1;
  }
}

export async function syncLinkedAccountTransactions(
  userId: string,
  linkedAccountId: string,
  initialWindowDays?: number,
): Promise<PlaidSyncSummary> {
  const linkedAccount = await prismaAny.linkedAccount.findFirst({
    where: { id: linkedAccountId, userId },
    select: { id: true, accessToken: true },
  });

  if (!linkedAccount) {
    throw new Error("Linked account not found");
  }

  const existingCursor = await prismaAny.plaidSyncCursor.findUnique({
    where: { linkedAccountId },
    select: { nextCursor: true },
  });

  const summary: PlaidSyncSummary = {
    created: 0,
    updated: 0,
    removed: 0,
    skipped: 0,
  };

  let cursor = existingCursor?.nextCursor ?? null;
  let hasMore = true;

  while (hasMore) {
    const syncResponse = await plaidClient.transactionsSync({
      access_token: linkedAccount.accessToken,
      cursor: cursor ?? undefined,
      count: 100,
    });

    const { added, modified, removed, has_more: nextHasMore, next_cursor } = syncResponse.data;

    for (const txn of [...added, ...modified]) {
      await upsertTransaction(userId, linkedAccountId, txn, summary, initialWindowDays);
    }

    await applyRemovedTransactions(userId, removed, summary);

    cursor = next_cursor;
    hasMore = nextHasMore;
  }

  await prismaAny.plaidSyncCursor.upsert({
    where: { linkedAccountId },
    create: { linkedAccountId, nextCursor: cursor },
    update: { nextCursor: cursor },
  });

  await prismaAny.linkedAccount.update({
    where: { id: linkedAccountId },
    data: { lastSyncedAt: new Date() },
  });

  return summary;
}
