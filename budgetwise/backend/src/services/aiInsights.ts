import Groq from "groq-sdk";
import { z } from "zod";
import { env } from "../config/env.js";

/**
 * ===== Schema Definitions =====
 * These Zod schemas define the exact structure of AI insights we expect.
 * We use strict validation to ensure AI output always matches our frontend expectations.
 */

/**
 * Input schema: Describes a user's spending and budget by category.
 * Used to build the prompt for Groq.
 */
export const categorySpendSummarySchema = z.object({
  category: z.string().describe("The spending category (e.g., 'Dining', 'Rent')"),
  spent: z.number().nonnegative().describe("Amount spent in this category (dollars)"),
  allocated: z.number().nonnegative().describe("Budget allocated for this category (dollars)"),
});

export type CategorySpendSummary = z.infer<typeof categorySpendSummarySchema>;

/**
 * Output schema: A single recommendation from Groq.
 * We request EXACTLY 3 recommendations: one for each type.
 */
export const recommendationSchema = z.object({
  type: z
    .enum(["reduce", "keepDoing", "spendMore"])
    .describe("Whether the user should reduce, keep, or increase spending in this category"),
  category: z.string().describe("The spending category this recommendation applies to"),
  title: z
    .string()
    .min(3)
    .max(72)
    .describe("A concise title summarizing the recommendation"),
  message: z
    .string()
    .min(40)
    .max(360)
    .describe("A compact and detailed recommendation including Action, Why, Impact, and When"),
});

export type Recommendation = z.infer<typeof recommendationSchema>;

/**
 * Full response schema: exactly 3 recommendations + metadata.
 * This contract is critical for the frontend which expects exactly 3 cards.
 */
export const dashboardAiResponseSchema = z.object({
  recommendations: z.array(recommendationSchema).length(3).describe("Exactly 3 recommendations: reduce, keepDoing, spendMore"),
  generatedAt: z.string().datetime().describe("ISO 8601 timestamp when recommendations were generated"),
});

export type DashboardAiResponse = z.infer<typeof dashboardAiResponseSchema>;

/**
 * Output schema for the dashboard bar chart comparison.
 * Each item maps a category's current spend to an AI-recommended spend amount.
 */
export const aiComparisonItemSchema = z.object({
  category: z.string().min(1),
  currentSpend: z.number().nonnegative(),
  recommendedSpend: z.number().nonnegative(),
});

export const budgetComparisonResponseSchema = z.object({
  items: z.array(aiComparisonItemSchema),
  generatedAt: z.string().datetime(),
});

export type BudgetComparisonResponse = z.infer<typeof budgetComparisonResponseSchema>;

type OutputMode = "strict-json-schema" | "best-effort-json-schema" | "json-object" | "no-format";

const STRICT_JSON_SCHEMA_MODELS = new Set(["openai/gpt-oss-20b", "openai/gpt-oss-120b"]);

function trimSpendingData(spendingData: CategorySpendSummary[]): CategorySpendSummary[] {
  if (spendingData.length <= env.GROQ_MAX_INPUT_CATEGORIES) {
    return spendingData;
  }

  const sorted = [...spendingData].sort((a, b) => b.spent - a.spent);
  const kept = sorted.slice(0, env.GROQ_MAX_INPUT_CATEGORIES - 1);
  const overflow = sorted.slice(env.GROQ_MAX_INPUT_CATEGORIES - 1);

  const other: CategorySpendSummary = {
    category: "Other",
    spent: overflow.reduce((sum, item) => sum + item.spent, 0),
    allocated: overflow.reduce((sum, item) => sum + item.allocated, 0),
  };

  return [...kept, other];
}

/**
 * Detects provider errors that indicate a model is unavailable for this key/tier/region.
 * These are retryable using the fallback model list.
 */
function isModelAvailabilityError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    (normalized.includes("model") &&
      (normalized.includes("not found") ||
        normalized.includes("not supported") ||
        normalized.includes("unavailable") ||
        normalized.includes("deprecated"))) ||
    normalized.includes("404") ||
    normalized.includes("permission denied") ||
    normalized.includes("does not have access") ||
    normalized.includes("not allowed") ||
    normalized.includes("rate limit") ||
    normalized.includes("too many requests") ||
    normalized.includes("429") ||
    normalized.includes("capacity")
  );
}

/**
 * Detects unsupported structured output request formatting for a given model.
 */
function isStructuredOutputCompatibilityError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("response_format") ||
    normalized.includes("json_schema") ||
    normalized.includes("structured output") ||
    normalized.includes("strict")
  );
}

function isJsonGenerationValidationError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("json_validate_failed") ||
    normalized.includes("failed to validate json")
  );
}

function parseMessageContent(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") {
          return part;
        }
        if (part && typeof part === "object" && "text" in part && typeof (part as { text?: unknown }).text === "string") {
          return (part as { text: string }).text;
        }
        return "";
      })
      .join("");
  }

  return "";
}

function buildDashboardInsightsResponseFormat(mode: OutputMode): Record<string, unknown> {
  if (mode === "json-object") {
    return { type: "json_object" };
  }

  return {
    type: "json_schema",
    json_schema: {
      name: "dashboard_ai_response",
      strict: mode === "strict-json-schema",
      schema: {
        type: "object",
        properties: {
          recommendations: {
            type: "array",
            items: {
              type: "object",
              properties: {
                type: { type: "string", enum: ["reduce", "keepDoing", "spendMore"] },
                category: { type: "string" },
                title: { type: "string" },
                message: { type: "string" },
              },
              required: ["type", "category", "title", "message"],
              additionalProperties: false,
            },
            minItems: 3,
            maxItems: 3,
          },
          generatedAt: { type: "string" },
        },
        required: ["recommendations", "generatedAt"],
        additionalProperties: false,
      },
    },
  };
}

function buildBudgetComparisonResponseFormat(mode: OutputMode): Record<string, unknown> {
  if (mode === "json-object") {
    return { type: "json_object" };
  }

  return {
    type: "json_schema",
    json_schema: {
      name: "budget_comparison_response",
      strict: mode === "strict-json-schema",
      schema: {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                category: { type: "string" },
                currentSpend: { type: "number", minimum: 0 },
                recommendedSpend: { type: "number", minimum: 0 },
              },
              required: ["category", "currentSpend", "recommendedSpend"],
              additionalProperties: false,
            },
          },
          generatedAt: { type: "string" },
        },
        required: ["items", "generatedAt"],
        additionalProperties: false,
      },
    },
  };
}

function calculateInsightsTokenBudget(categoryCount: number): number {
  const adaptiveBudget = 220 + categoryCount * 32;
  const boundedAdaptiveBudget = Math.max(300, adaptiveBudget);
  return Math.min(env.GROQ_MAX_TOKENS_INSIGHTS, boundedAdaptiveBudget);
}

/**
 * ===== Groq Integration =====
 * Calls Groq's Chat Completions API to generate AI-powered budget recommendations.
 */
export async function generateDashboardInsights(
  spendingData: CategorySpendSummary[],
  month: number,
  year: number
): Promise<DashboardAiResponse> {
  if (!env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY not configured");
  }

  const client = new Groq({ apiKey: env.GROQ_API_KEY });

  const modelCandidates = [env.GROQ_MODEL_PRIMARY, env.GROQ_MODEL_FALLBACK_1, env.GROQ_MODEL_FALLBACK_2];
  const uniqueModelCandidates = Array.from(new Set(modelCandidates));

  const trimmedSpendingData = trimSpendingData(spendingData);

  const categoryBreakdown = trimmedSpendingData
    .map(
      (item) =>
        `- ${item.category}: $${item.spent.toFixed(2)} spent of $${item.allocated.toFixed(2)} allocated (${item.allocated > 0 ? ((item.spent / item.allocated) * 100).toFixed(1) : "N/A"}% of budget)`
    )
    .join("\n");

  const monthLabel = new Date(year, month - 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const insightsTokenBudget = calculateInsightsTokenBudget(trimmedSpendingData.length);

  const messages = [
    {
      role: "system",
      content:
        "You are a precise personal finance advisor. Return compact JSON only. Be concrete, practical, and avoid filler.",
    },
    {
      role: "user",
      content: `Month: ${monthLabel}.\nSpending:\n${categoryBreakdown}\n\nReturn exactly 3 recommendations, one each type: reduce, keepDoing, spendMore.\nEach item: {type, category, title, message}.\nTitle rules: 16-72 characters, specific to category and action.\nMessage rules: 100-360 characters with exactly these 4 bullet lines:\n- Action: <one concrete step>\n- Why: <category-specific reason using the data>\n- Impact: <expected outcome with rough amount/percent>\n- When: <timeframe or weekly cadence>\nNo disclaimers. No generic advice. No repeated text between recommendations. JSON only.`,
    },
  ] as const;

  let sawAvailabilityFailure = false;
  let lastError: unknown = null;

  for (const modelName of uniqueModelCandidates) {
    const candidateModes: OutputMode[] = ["json-object", "no-format"];

    for (const outputMode of candidateModes) {
      try {
        console.log(`[AI] Trying Groq model: ${modelName} with mode: ${outputMode}`);

        const completionConfig: Record<string, unknown> = {
          model: modelName,
          messages: messages as any,
          temperature: 0,
          max_tokens: insightsTokenBudget,
        };

        if (outputMode !== "no-format") {
          completionConfig.response_format = buildDashboardInsightsResponseFormat(outputMode) as any;
        }

        const completion = await client.chat.completions.create(completionConfig as any);

        const responseText = parseMessageContent(completion.choices[0]?.message?.content).trim();
        console.log("[AI] Raw Groq response:", responseText);

        let jsonText = responseText;
        const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
          jsonText = jsonMatch[1].trim();
        }

        const parsed = JSON.parse(jsonText);
        const validated = dashboardAiResponseSchema.parse({
          ...parsed,
          generatedAt: parsed.generatedAt || new Date().toISOString(),
        });

        console.log(`[AI] Successfully generated recommendations with model: ${modelName} (${outputMode})`);
        return validated;
      } catch (error) {
        lastError = error;
        const message = error instanceof Error ? error.message : String(error);

        if (isModelAvailabilityError(message)) {
          sawAvailabilityFailure = true;
          console.warn(`[AI] Groq model unavailable: ${modelName}. Error: ${message}`);
          break;
        }

        if (isStructuredOutputCompatibilityError(message) && outputMode !== "json-object") {
          console.warn(`[AI] Structured output mode unsupported for ${modelName} (${outputMode}). Falling back to json-object.`);
          continue;
        }

        if (isJsonGenerationValidationError(message)) {
          console.warn(`[AI] JSON generation failed for ${modelName} (${outputMode}). Trying next mode/model.`);
          continue;
        }

        if (error instanceof SyntaxError) {
          lastError = new Error(`Groq returned invalid JSON: ${error.message}`);
          console.warn(`[AI] Invalid JSON for ${modelName} (${outputMode}). Trying next mode/model.`);
          continue;
        }

        if (error instanceof z.ZodError) {
          const validationErrors = error.errors
            .map((e) => `${e.path.join(".")}: ${e.message} (code: ${e.code})`)
            .join("; ");
          lastError = new Error(`Groq response failed validation: ${validationErrors}`);
          console.warn(`[AI] Response schema validation failed for ${modelName} (${outputMode}). Trying next mode/model.`);
          continue;
        }

        throw error;
      }
    }
  }

  if (sawAvailabilityFailure) {
    throw new Error(
      "No supported Groq model is available for chat completions. Configure GROQ_MODEL_PRIMARY / GROQ_MODEL_FALLBACK_* to valid model IDs."
    );
  }

  if (lastError instanceof Error) {
    throw lastError;
  }

  throw new Error("Groq request failed before any model could return a response.");
}

function normalizeCategory(category: string): string {
  return category.trim().toLowerCase();
}

/**
 * Generates per-category AI recommended spending amounts for the dashboard bar chart.
 */
export async function generateBudgetComparison(
  spendingData: CategorySpendSummary[],
  totalIncome: number,
  month: number,
  year: number,
): Promise<BudgetComparisonResponse> {
  if (!env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY not configured");
  }

  const client = new Groq({ apiKey: env.GROQ_API_KEY });
  const modelCandidates = [env.GROQ_MODEL_PRIMARY, env.GROQ_MODEL_FALLBACK_1, env.GROQ_MODEL_FALLBACK_2];
  const uniqueModelCandidates = Array.from(new Set(modelCandidates));

  const trimmedSpendingData = trimSpendingData(spendingData);
  const totalAllocated = trimmedSpendingData.reduce((sum, item) => sum + item.allocated, 0);
  const totalSpent = trimmedSpendingData.reduce((sum, item) => sum + item.spent, 0);
  const monthLabel = new Date(year, month - 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const categoryBreakdown = trimmedSpendingData
    .map((item) => `- ${item.category}: spent=$${item.spent.toFixed(2)}, allocated=$${item.allocated.toFixed(2)}`)
    .join("\n");
  const comparisonTokenBudget = Math.min(
    env.GROQ_MAX_TOKENS_COMPARISON,
    120 + trimmedSpendingData.length * 45,
  );

  const messages = [
    {
      role: "system",
      content:
        "You are a personal finance advisor. Return compact JSON only.",
    },
    {
      role: "user",
      content: `Month: ${monthLabel}.\nIncome: $${totalIncome.toFixed(2)}. Allocated: $${totalAllocated.toFixed(2)}. Spent: $${totalSpent.toFixed(2)}.\nCategories:\n${categoryBreakdown}\n\nReturn JSON only: items[] with {category,currentSpend,recommendedSpend}. Keep category labels exact. Use non-negative numbers with 2 decimals max.`,
    },
  ] as const;

  let sawAvailabilityFailure = false;
  let lastError: unknown = null;

  for (const modelName of uniqueModelCandidates) {
    const candidateModes: OutputMode[] = ["json-object", "no-format"];

    for (const outputMode of candidateModes) {
      try {
        const completionConfig: Record<string, unknown> = {
          model: modelName,
          messages: messages as any,
          temperature: 0,
          max_tokens: comparisonTokenBudget,
        };

        if (outputMode !== "no-format") {
          completionConfig.response_format = buildBudgetComparisonResponseFormat(outputMode) as any;
        }

        const completion = await client.chat.completions.create(completionConfig as any);

        const responseText = parseMessageContent(completion.choices[0]?.message?.content).trim();
        let jsonText = responseText;
        const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
          jsonText = jsonMatch[1].trim();
        }

        const parsed = JSON.parse(jsonText);
        const validated = budgetComparisonResponseSchema.parse({
          ...parsed,
          generatedAt: parsed.generatedAt || new Date().toISOString(),
        });

        const aiByCategory = new Map(
          validated.items.map((item) => [normalizeCategory(item.category), item]),
        );

        const normalizedItems = spendingData.map((item) => {
          const aiItemDirect = aiByCategory.get(normalizeCategory(item.category));
          const aiItem = aiItemDirect ?? aiByCategory.get("other");
          const fallbackRecommended = item.allocated > 0 ? item.allocated : item.spent;
          const recommendedSpend = Number(
            Math.max(0, aiItem?.recommendedSpend ?? fallbackRecommended).toFixed(2),
          );

          return {
            category: item.category,
            currentSpend: Number(Math.max(0, item.spent).toFixed(2)),
            recommendedSpend,
          };
        });

        return {
          items: normalizedItems,
          generatedAt: validated.generatedAt,
        };
      } catch (error) {
        lastError = error;
        const message = error instanceof Error ? error.message : String(error);

        if (isModelAvailabilityError(message)) {
          sawAvailabilityFailure = true;
          break;
        }

        if (isStructuredOutputCompatibilityError(message) && outputMode !== "json-object") {
          continue;
        }

        if (isJsonGenerationValidationError(message)) {
          continue;
        }

        if (error instanceof SyntaxError) {
          lastError = new Error(`Groq returned invalid JSON: ${error.message}`);
          console.warn(`[AI] Invalid JSON for ${modelName} (${outputMode}). Trying next mode/model.`);
          continue;
        }

        if (error instanceof z.ZodError) {
          const validationErrors = error.errors
            .map((e) => `${e.path.join(".")}: ${e.message} (code: ${e.code})`)
            .join("; ");
          lastError = new Error(`Groq response failed validation: ${validationErrors}`);
          console.warn(`[AI] Response schema validation failed for ${modelName} (${outputMode}). Trying next mode/model.`);
          continue;
        }

        throw error;
      }
    }
  }

  if (sawAvailabilityFailure) {
    throw new Error(
      "No supported Groq model is available for chat completions. Configure GROQ_MODEL_PRIMARY / GROQ_MODEL_FALLBACK_* to valid model IDs.",
    );
  }

  if (lastError instanceof Error) {
    throw lastError;
  }

  throw new Error("Groq request failed before any model could return a response.");
}

/**
 * Legacy schema kept for compatibility (can be removed if not used elsewhere).
 * This was the original schema design but we're now using the simpler 3-item approach above.
 */
export const dashboardAiResponseSchema_Legacy = z.object({
  cards: z.array(
    z.object({
      type: z.enum(["alert", "onTrack", "tip", "reallocation"]),
      title: z.string(),
      message: z.string(),
      savingsCents: z.number().int().nonnegative().optional(),
      category: z.string().optional(),
    })
  ),
  comparison: z.object({
    items: z.array(
      z.object({
        category: z.string(),
        currentSpendCents: z.number().int().nonnegative(),
        recommendedSpendCents: z.number().int().nonnegative(),
      })
    ),
  }),
  recommendedActions: z.array(
    z.object({
      severity: z.enum(["info", "warning", "critical"]),
      text: z.string(),
    })
  ),
  generatedAt: z.string(),
});
