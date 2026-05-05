import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { randomUUID } from "node:crypto";

import { env } from "./config/env.js";
import { healthRouter } from "./routes/health.js";
import { authRouter } from "./routes/auth.js";
import { profileRouter } from "./routes/profile.js";
import { expensesRouter } from "./routes/expenses.js";
import { budgetsRouter } from "./routes/budgets.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { aiRouter } from "./routes/ai.js";
import { settingsRouter } from "./routes/settings.js";

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
  const jsonLoggingEnabled = env.LOG_FORMAT === "json";

  app.use(helmet());
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (isAllowedOrigin(origin, allowedOrigins)) return callback(null, true);
        return callback(new Error("CORS origin not allowed"));
      },
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "1mb" }));
  app.use((req, res, next) => {
    const startedAtMs = Date.now();
    const requestId = req.header("x-request-id") ?? randomUUID();
    res.setHeader("x-request-id", requestId);
    res.locals.requestId = requestId;
    res.locals.startedAtMs = startedAtMs;

    res.on("finish", () => {
      const durationMs = Date.now() - startedAtMs;
      if (durationMs >= env.LOG_SLOW_REQUEST_MS) {
        const payload = {
          level: "warn",
          msg: "slow_request",
          requestId,
          method: req.method,
          path: req.originalUrl,
          statusCode: res.statusCode,
          durationMs,
        };
        if (jsonLoggingEnabled) {
          console.warn(JSON.stringify(payload));
        } else {
          console.warn(
            `[slow_request] ${req.method} ${req.originalUrl} -> ${res.statusCode} in ${durationMs}ms (requestId=${requestId})`,
          );
        }
      }
    });
    next();
  });

  morgan.token("request-id", (_req, res) => String(res.getHeader("x-request-id") ?? "-"));
  morgan.token("duration-ms", (_req, res) => {
    const locals = (res as { locals?: { startedAtMs?: unknown } }).locals;
    const startedAtMs = typeof locals?.startedAtMs === "number" ? locals.startedAtMs : Date.now();
    return String(Date.now() - startedAtMs);
  });

  const jsonLogFormat =
    '{"level":"info","msg":"http_request","requestId":":request-id","method":":method","path":":url","statusCode"::status,"responseBytes"::res[content-length],"durationMs"::duration-ms}';
  app.use(morgan(jsonLoggingEnabled ? jsonLogFormat : "dev"));

  app.use("/api", healthRouter);
  app.use("/api/auth", authRouter);
  app.use("/api/profile", profileRouter);
  app.use("/api/expenses", expensesRouter);
  app.use("/api/budgets", budgetsRouter);
  app.use("/api/dashboard", dashboardRouter);
  app.use("/api/ai", aiRouter);
  app.use("/api/settings", settingsRouter);

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    void _next;
    const status =
      err && typeof err === "object" && "statusCode" in err && typeof (err as { statusCode: unknown }).statusCode === "number"
        ? (err as { statusCode: number }).statusCode
        : 500;
    const message =
      err && typeof err === "object" && "message" in err && typeof (err as { message: unknown }).message === "string"
        ? (err as { message: string }).message
        : "Internal server error";
    if (status >= 500) {
      const requestId = String(res.getHeader("x-request-id") ?? "unknown");
      if (jsonLoggingEnabled) {
        console.error(
          JSON.stringify({
            level: "error",
            msg: "unhandled_api_error",
            requestId,
            statusCode: status,
            errorMessage: message,
          }),
        );
      } else {
        console.error(`Unhandled API error (requestId=${requestId}):`, err);
      }
    }
    res.status(status).json({ error: message });
  });

  app.use((_req, res) => res.status(404).json({ error: "Not found" }));
  return app;
}
