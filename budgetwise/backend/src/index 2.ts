import "dotenv/config";
import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { prisma } from "./lib/prisma.js";

async function start() {
  const app = createApp();

  try {
    await prisma.$connect();
    app.listen(env.PORT, () => {
      console.log(`🚀 API listening on http://localhost:${env.PORT}`);
    });
  } catch (err) {
    console.error("❌ Database connection error:", err);
    process.exit(1);
  }
}

start();
