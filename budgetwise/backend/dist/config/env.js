import { z } from "zod";
const envSchema = z.object({
    PORT: z.coerce.number().default(5001),
    CORS_ORIGIN: z.string().default("http://localhost:3000"),
    /* Mail server configuration. */
    MAIL_SERVER_NAME: z.string().default("localhost"),
    /* 465 is the standard port for email message submission over TLS. */
    MAIL_SERVER_PORT: z.coerce.number().default(465),
    MAIL_SERVER_SECURE: z.coerce.boolean().default(true),
    MAIL_SERVER_USER: z.string().optional(),
    MAIL_SERVER_PASSWORD: z.string().optional(),
    /* Sender of reset-password emails. */
    RESET_PASSWORD_SENDER_NAME: z.string().default("Budgetwise"),
    RESET_PASSWORD_SENDER_ADDRESS: z.string().email().default("no-reply@localhost"),
    // JWT_*
    JWT_SECRET: z.string().min(10, "JWT_SECRET must be at least 10 characters").default("dev_secret_change_me"),
    JWT_EXPIRES_IN: z.string().default("7d"),
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
});
export const env = envSchema.parse(process.env);
