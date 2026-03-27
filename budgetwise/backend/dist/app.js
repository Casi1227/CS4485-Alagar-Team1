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
export function createApp() {
    const app = express();
    app.use(helmet());
    app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
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
    app.use((_req, res) => res.status(404).json({ error: "Not found" }));
    return app;
}
