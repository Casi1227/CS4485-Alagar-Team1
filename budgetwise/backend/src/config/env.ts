import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(5001),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  JWT_SECRET: z.string().min(10, "JWT_SECRET must be at least 10 characters").default("dev_secret_change_me"),
  JWT_EXPIRES_IN: z.string().default("7d"),
  OPENAI_API_KEY: z.string().optional(),
  // GEMINI_API_KEY: Required for AI-powered budget recommendations feature.
  // Set this to your Google AI API key to enable Gemini-based insights on the dashboard.
  // If not provided, the AI insights endpoint will return a 503 (Unavailable) response.
  GEMINI_API_KEY: z.string().optional(),
  // GEMINI_MODEL: Preferred Gemini model for recommendations.
  // Default uses Gemini 2.5 Flash, with service-level fallbacks for Free tier availability.
  GEMINI_MODEL: z.string().default("gemini-2.5-flash"),
});

export type Env = z.infer<typeof envSchema>;

export const env: Env = envSchema.parse(process.env);
