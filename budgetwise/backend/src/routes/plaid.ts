import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { CountryCode, Products, type LinkTokenCreateRequest } from "plaid";
import { prisma } from "../lib/prisma.js";
import { authRequired, type AuthedRequest } from "../middleware/authRequired.js";
import { env } from "../config/env.js";
import { getPlaidCountryCodes, plaidClient } from "../services/plaidClient.js";
import { syncLinkedAccountTransactions } from "../services/plaidImport.js";

const prismaAny = prisma as any;

export const plaidRouter = Router();

const exchangeSchema = z.object({
  publicToken: z.string().min(1),
});

const syncSchema = z.object({
  linkedAccountId: z.string().min(1),
});

const DEFAULT_SANDBOX_INSTITUTION_ID = "ins_109508";

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function hasSyncActivity(summary: { created: number; updated: number; removed: number; skipped: number }): boolean {
  return summary.created > 0 || summary.updated > 0 || summary.removed > 0 || summary.skipped > 0;
}

type AsyncAuthedHandler = (req: AuthedRequest, res: Response, next: NextFunction) => Promise<void>;

function asyncAuthedRoute(handler: AsyncAuthedHandler) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req as AuthedRequest, res, next)).catch(next);
  };
}

async function assertUserExists(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });

  if (!user) {
    const error = new Error("Session is no longer valid. Please sign in again.");
    (error as Error & { statusCode?: number }).statusCode = 401;
    throw error;
  }
}

function serializeLinkedAccount(linkedAccount: any) {
  return {
    id: linkedAccount.id,
    institutionName: linkedAccount.institutionName,
    accountName: linkedAccount.accountName,
    accountMask: linkedAccount.accountMask,
    accountType: linkedAccount.accountType,
    accountSubtype: linkedAccount.accountSubtype,
    createdAt: linkedAccount.createdAt,
  };
}

async function exchangeAndUpsertLinkedAccount(userId: string, publicToken: string) {
  const exchange = await plaidClient.itemPublicTokenExchange({
    public_token: publicToken,
  });

  const accessToken = exchange.data.access_token;
  const itemId = exchange.data.item_id;

  const accountsResponse = await plaidClient.accountsGet({ access_token: accessToken });
  const chosenAccount =
    accountsResponse.data.accounts.find((a) => `${a.type}`.toLowerCase() === "credit") ?? accountsResponse.data.accounts[0];

  const institutionId = accountsResponse.data.item?.institution_id ?? null;
  let institutionName: string | null = null;

  if (institutionId) {
    try {
      const institution = await plaidClient.institutionsGetById({
        institution_id: institutionId,
        country_codes: getPlaidCountryCodes() as CountryCode[],
      });
      institutionName = institution.data.institution.name;
    } catch {
      institutionName = null;
    }
  }

  return prismaAny.linkedAccount.upsert({
    where: {
      user_item_unique: {
        userId,
        itemId,
      },
    },
    update: {
      accessToken,
      institutionId,
      institutionName,
      accountId: chosenAccount?.account_id,
      accountMask: chosenAccount?.mask,
      accountName: chosenAccount?.name,
      accountType: chosenAccount?.type,
      accountSubtype: chosenAccount?.subtype,
    },
    create: {
      userId,
      itemId,
      accessToken,
      institutionId,
      institutionName,
      accountId: chosenAccount?.account_id,
      accountMask: chosenAccount?.mask,
      accountName: chosenAccount?.name,
      accountType: chosenAccount?.type,
      accountSubtype: chosenAccount?.subtype,
    },
  });
}

plaidRouter.post("/link-token", authRequired, asyncAuthedRoute(async (req, res) => {
  const userId = req.user!.id;
  await assertUserExists(userId);

  const request: LinkTokenCreateRequest = {
    user: { client_user_id: userId },
    client_name: "BudgetWise Sandbox",
    language: env.PLAID_LANGUAGE,
    products: [Products.Transactions],
    country_codes: getPlaidCountryCodes(),
  };

  const response = await plaidClient.linkTokenCreate(request);
  res.json({ linkToken: response.data.link_token, expiration: response.data.expiration });
}));

plaidRouter.post("/exchange-public-token", authRequired, asyncAuthedRoute(async (req, res) => {
  const parsed = exchangeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const userId = req.user!.id;
  await assertUserExists(userId);
  const linkedAccount = await exchangeAndUpsertLinkedAccount(userId, parsed.data.publicToken);

  const syncSummary = await syncLinkedAccountTransactions(userId, linkedAccount.id, 30);

  res.status(201).json({
    linkedAccount: serializeLinkedAccount(linkedAccount),
    importSummary: syncSummary,
  });
}));

plaidRouter.post("/demo-import", authRequired, asyncAuthedRoute(async (req, res) => {
  if (!env.PLAID_DEMO_DIRECT_IMPORT_ENABLED) {
    res.status(404).json({ error: "Plaid demo import is disabled." });
    return;
  }

  if (env.PLAID_ENV !== "sandbox") {
    res.status(400).json({ error: "Plaid demo import requires PLAID_ENV=sandbox." });
    return;
  }

  const userId = req.user!.id;
  await assertUserExists(userId);

  const sandboxToken = await plaidClient.sandboxPublicTokenCreate({
    institution_id: DEFAULT_SANDBOX_INSTITUTION_ID,
    initial_products: [Products.Transactions],
  });

  const linkedAccount = await exchangeAndUpsertLinkedAccount(userId, sandboxToken.data.public_token);
  let syncSummary = await syncLinkedAccountTransactions(userId, linkedAccount.id, 30);

  for (let attempt = 0; attempt < 6 && !hasSyncActivity(syncSummary); attempt += 1) {
    await wait(2000);
    syncSummary = await syncLinkedAccountTransactions(userId, linkedAccount.id, 30);
  }

  res.status(201).json({
    linkedAccount: serializeLinkedAccount(linkedAccount),
    importSummary: syncSummary,
  });
}));

plaidRouter.post("/sync", authRequired, asyncAuthedRoute(async (req, res) => {
  const parsed = syncSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const userId = req.user!.id;
  await assertUserExists(userId);
  const summary = await syncLinkedAccountTransactions(userId, parsed.data.linkedAccountId);
  res.json({ summary });
}));

plaidRouter.get("/accounts", authRequired, asyncAuthedRoute(async (req, res) => {
  const userId = req.user!.id;
  await assertUserExists(userId);

  const linkedAccounts = await prismaAny.linkedAccount.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      institutionName: true,
      accountName: true,
      accountMask: true,
      accountType: true,
      accountSubtype: true,
      lastSyncedAt: true,
      createdAt: true,
    },
  });

  res.json({ linkedAccounts });
}));

plaidRouter.get("/sandbox-config", authRequired, async (_req, res) => {
  res.json({
    environment: env.PLAID_ENV,
    testCredentials: {
      username: "user_good",
      password: "pass_good",
    },
    placeholderKey: "PLAID-SANDBOX-KEY",
  });
});
