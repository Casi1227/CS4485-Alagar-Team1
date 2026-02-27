import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

import { healthRouter } from "../routes/health.js";
import { authRouter } from "../routes/auth.js";
import { profileRouter } from "../routes/profile.js";
import { expensesRouter } from "../routes/expenses.js";
import { prisma } from "./db.js";

const app = express();

const PORT = Number(process.env.PORT || 5001);
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:3000";

app.use(helmet());
app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));

app.use("/api", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api/profile", profileRouter);
app.use("/api/expenses", expensesRouter);

app.use((_req, res) => res.status(404).json({ error: "Not found" }));

async function start() {
  try {
    await prisma.$connect();
    app.listen(PORT, () => {
      console.log(`🚀 Server running in ${process.env.NODE_ENV || "development"} mode on port ${PORT}`);
    });
  } catch (err) {
    console.error("❌ Database connection error:", err);
    process.exit(1);
  }
}

start();
