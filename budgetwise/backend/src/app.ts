import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

import { env } from "./config/env.js";
import { healthRouter } from "./routes/health.js";
import { authRouter } from "./routes/auth.js";
import { profileRouter } from "./routes/profile.js";
import { expensesRouter } from "./routes/expenses.js";
import { budgetsRouter } from "./routes/budgets.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { aiRouter } from "./routes/ai.js";
import { settingsRouter } from "./routes/settings.js";
import { plaidRouter } from "./routes/plaid.js";

function parseCorsOrigins(value: string): string[] {
  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function isLoopbackHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function isAllowedOrigin(requestOrigin: string, allowedOrigins: string[]): boolean {
  if (allowedOrigins.includes(requestOrigin)) return true;

  let requestUrl: URL;
  try {
    requestUrl = new URL(requestOrigin);
  } catch {
    return false;
  }

  for (const allowed of allowedOrigins) {
    let allowedUrl: URL;
    try {
      allowedUrl = new URL(allowed);
    } catch {
      continue;
    }

    const sameProtocol = allowedUrl.protocol === requestUrl.protocol;
    const samePort = allowedUrl.port === requestUrl.port;
    const bothLoopback = isLoopbackHost(allowedUrl.hostname) && isLoopbackHost(requestUrl.hostname);

    if (sameProtocol && samePort && bothLoopback) {
      return true;
    }
  }

  return false;
}

export function createApp() {
  const app = express();
  const allowedOrigins = parseCorsOrigins(env.CORS_ORIGIN);

  app.use(helmet());
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow server-to-server clients and same-origin requests.
        if (!origin) return callback(null, true);
        if (isAllowedOrigin(origin, allowedOrigins)) return callback(null, true);
        return callback(new Error("CORS origin not allowed"));
      },
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(morgan("dev"));

  app.use("/api", healthRouter);
  app.use("/api/auth", authRouter);
  app.use("/api/profile", profileRouter);
  app.use("/api/expenses", expensesRouter);
  app.use("/api/budgets", budgetsRouter);
  app.use("/api/dashboard", dashboardRouter);
  // Mount AI insights router for Groq-powered recommendations
  app.use("/api/ai", aiRouter);
  app.use("/api/settings", settingsRouter);
  app.use("/api/plaid", plaidRouter);

  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status = typeof err?.statusCode === "number" ? err.statusCode : 500;
    const message = typeof err?.message === "string" ? err.message : "Internal server error";
    if (status >= 500) {
      console.error("Unhandled API error:", err);
    }
    res.status(status).json({ error: message });
  });

  app.use((_req, res) => res.status(404).json({ error: "Not found" }));
  return app;
}