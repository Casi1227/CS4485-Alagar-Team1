import "dotenv/config";

import bcrypt from "bcryptjs";
import * as path from "node:path";
import * as process from "node:process";
import * as fs from "node:fs";
import xlsx from "xlsx";

import { prisma } from "../src/lib/prisma.js";
import { PASSWORD_HASH_SALT } from "../src/middleware/authRequired.js";

type Row = {
  Date: string | Date;
  Description: string;
  Amount: number | string;
  Category: string;
  Type: "EXPENSE" | "INCOME";
};

function resolveDefaultWorkbookPath() {
  const candidate = path.resolve(process.cwd(), "mock-data", "personal_transactions_budgetwise_2025_2026.xlsx");
  return candidate;
}

function parseArgs(argv: string[]) {
  const args = new Map<string, string>();
  for (const part of argv) {
    const m = part.match(/^--([^=]+)=(.*)$/);
    if (m) args.set(m[1], m[2]);
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const workbookPath =
    args.get("file") ||
    process.env.MOCK_DATA_XLSX ||
    // convenient local default for your attached file name
    path.resolve(process.cwd(), "..", "..", "..", "Downloads", "personal_transactions_budgetwise_2025_2026 (1).xlsx");

  const fallback = resolveDefaultWorkbookPath();
  const finalPath = fs.existsSync(workbookPath) ? workbookPath : fallback;

  if (!fs.existsSync(finalPath)) {
    throw new Error(
      [
        "Mock data workbook not found.",
        `Tried:`,
        `- ${workbookPath}`,
        `- ${fallback}`,
        "",
        "Fix: pass --file=PATH_TO_XLSX or set MOCK_DATA_XLSX, or copy the file into backend/mock-data/.",
      ].join("\n"),
    );
  }

  const email = args.get("email") || process.env.MOCK_DATA_USER_EMAIL || "mock.user@budgetwise.local";
  const name = args.get("name") || process.env.MOCK_DATA_USER_NAME || "Mock User";
  const password = args.get("password") || process.env.MOCK_DATA_USER_PASSWORD || "MockPassword123!";

  const wipe = (args.get("wipe") || process.env.MOCK_DATA_WIPE || "true").toLowerCase() !== "false";

  console.log(`[mock:data] Using workbook: ${finalPath}`);
  console.log(`[mock:data] Seeding user: ${email} (wipe=${wipe})`);

  await prisma.$connect();

  const passwordHash = await bcrypt.hash(password, PASSWORD_HASH_SALT);
  const user = await prisma.user.upsert({
    where: { email },
    update: { name, passwordHash },
    create: { email, name, passwordHash },
  });

  if (wipe) {
    const deleted = await prisma.expense.deleteMany({ where: { userId: user.id } });
    console.log(`[mock:data] Deleted existing expenses: ${deleted.count}`);
  }

  const wb = xlsx.readFile(finalPath, { cellDates: true });
  const sheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  const rows = xlsx.utils.sheet_to_json<Row>(sheet, { defval: "" });

  if (!rows.length) {
    console.log("[mock:data] No rows found; nothing to import.");
    return;
  }

  const toCreate = rows
    .filter((r) => r && r.Date && r.Amount !== "" && r.Category && r.Type)
    .map((r) => {
      const date = r.Date instanceof Date ? r.Date : new Date(String(r.Date));
      const amount = typeof r.Amount === "number" ? r.Amount : Number(String(r.Amount));
      const category = String(r.Category).trim() || "Other";
      const type = r.Type === "INCOME" ? "INCOME" : "EXPENSE";
      const note = String(r.Description ?? "").trim() || null;

      if (!Number.isFinite(amount) || amount <= 0) return null;
      if (Number.isNaN(date.getTime())) return null;

      return {
        userId: user.id,
        amount,
        category,
        type,
        date,
        note,
      };
    })
    .filter(Boolean) as Array<{
    userId: string;
    amount: number;
    category: string;
    type: "EXPENSE" | "INCOME";
    date: Date;
    note: string | null;
  }>;

  // Insert in chunks to avoid SQLite/Prisma limits.
  const chunkSize = 250;
  let inserted = 0;
  for (let i = 0; i < toCreate.length; i += chunkSize) {
    const chunk = toCreate.slice(i, i + chunkSize);
    const res = await prisma.expense.createMany({ data: chunk });
    inserted += res.count;
  }

  console.log(`[mock:data] Imported rows: ${inserted}/${rows.length}`);
  console.log(`[mock:data] Login with email=${email} password=${password}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await prisma.$disconnect();
    } catch {
      // ignore
    }
  });

