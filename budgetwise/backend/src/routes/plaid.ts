import { Router } from "express";
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

plaidRouter.post("/link-token", authRequired, async (req: AuthedRequest, res) => {
  const userId = req.user!.id;

  const request: LinkTokenCreateRequest = {
    user: { client_user_id: userId },
    client_name: "BudgetWise Sandbox",
    language: env.PLAID_LANGUAGE,
    products: [Products.Transactions],
    country_codes: getPlaidCountryCodes(),
  };

  const response = await plaidClient.linkTokenCreate(request);
  res.json({ linkToken: response.data.link_token, expiration: response.data.expiration });
});

plaidRouter.post("/exchange-public-token", authRequired, async (req: AuthedRequest, res) => {
  const parsed = exchangeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const userId = req.user!.id;

  const exchange = await plaidClient.itemPublicTokenExchange({
    public_token: parsed.data.publicToken,
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

  const linkedAccount = await prismaAny.linkedAccount.upsert({
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

  const syncSummary = await syncLinkedAccountTransactions(userId, linkedAccount.id, 30);

  res.status(201).json({
    linkedAccount: {
      id: linkedAccount.id,
      institutionName: linkedAccount.institutionName,
      accountName: linkedAccount.accountName,
      accountMask: linkedAccount.accountMask,
      accountType: linkedAccount.accountType,
      accountSubtype: linkedAccount.accountSubtype,
      createdAt: linkedAccount.createdAt,
    },
    importSummary: syncSummary,
  });
});

plaidRouter.post("/sync", authRequired, async (req: AuthedRequest, res) => {
  const parsed = syncSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const userId = req.user!.id;
  const summary = await syncLinkedAccountTransactions(userId, parsed.data.linkedAccountId);
  res.json({ summary });
});

plaidRouter.get("/accounts", authRequired, async (req: AuthedRequest, res) => {
  const userId = req.user!.id;

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
});

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
