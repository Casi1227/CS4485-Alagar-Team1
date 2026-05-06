import os from 'node:os';
import { z } from "zod";

const hostname = os.hostname();

const envSchema = z.object({
    PORT: z.coerce.number().default(5001),
    CORS_ORIGIN: z.string().default("http://localhost:3000"),
    LOG_FORMAT: z.enum(['dev', 'json']).default('dev'),
    LOG_SLOW_REQUEST_MS: z.coerce.number().int().positive().default(1500),
    FRONTEND_SERVER_ORIGIN: z.string()
        .default(`http://${encodeURIComponent(hostname)}/`),
    /* Mail server configuration. */
    MAIL_SERVER_URL: z.string().url()
        .default("smtp://localhost/?ignoreTLS=true"),
    MAIL_SERVER_DOMAIN: z.string().default(hostname),
    MAIL_SERVER_MBOX_NO_REPLY_LOCAL_PART: z.string().default('no-reply'),
    MAIL_SERVER_MBOX_NO_REPLY_DISPLAY_NAME: z.string().default('Budgetwise'),
    // JWT_*
    JWT_SECRET: z.string()
        .min(10, "JWT_SECRET must be at least 10 characters")
        .default("dev_secret_change_me"),
    JWT_EXPIRES_IN: z.string().default("15m"),
    JWT_REFRESH_SECRET: z.string()
        .min(10, "JWT_REFRESH_SECRET must be at least 10 characters")
        .default("dev_refresh_secret_change_me"),
    JWT_REFRESH_EXPIRES_IN: z.string().default("1d"),
    AUTH_LOGIN_RATE_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
    AUTH_LOGIN_RATE_LIMIT_PER_IP: z.coerce.number().int().positive().default(120),
    AUTH_LOGIN_RATE_LIMIT_PER_ACCOUNT: z.coerce.number().int().positive().default(30),
    BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(8).max(14).default(10),
    // GROQ_API_KEY: Required for AI-powered budget recommendations feature.
    // If not provided, the AI insights endpoint will return a 503 (Unavailable) response.
    GROQ_API_KEY: z.string().optional(),
    // Primary and fallback model IDs for dashboard recommendations.
    GROQ_MODEL_PRIMARY: z.string().default("openai/gpt-oss-20b"),
    GROQ_MODEL_FALLBACK_1: z.string().default("openai/gpt-oss-120b"),
    GROQ_MODEL_FALLBACK_2: z.string().default("llama-3.3-70b-versatile"),
    // Token and payload controls for AI endpoints.
    GROQ_MAX_TOKENS_INSIGHTS: z.coerce.number().int().positive().default(420),
    GROQ_MAX_TOKENS_COMPARISON: z.coerce.number().int().positive().default(480),
    GROQ_MAX_INPUT_CATEGORIES: z.coerce.number().int().positive().default(8),
    // Plaid Sandbox configuration.
    PLAID_CLIENT_ID: z.string().default("PLAID-SANDBOX-KEY"),
    PLAID_SECRET: z.string().default("PLAID-SANDBOX-KEY"),
    PLAID_ENV: z.enum(["sandbox", "development", "production"])
        .default("sandbox"),
    PLAID_PRODUCTS: z.string().default("transactions"),
    PLAID_COUNTRY_CODES: z.string().default("US"),
    PLAID_LANGUAGE: z.string().default("en"),
    PLAID_REDIRECT_URI: z.string().optional(),
    PLAID_DEMO_DIRECT_IMPORT_ENABLED: z.coerce.boolean().default(false),
});

export type Env = z.infer<typeof envSchema>;

export const env: Env = envSchema.parse(process.env);
