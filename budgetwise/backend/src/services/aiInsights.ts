import { z } from "zod";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "../config/env.js";

/**
 * ===== Schema Definitions =====
 * These Zod schemas define the exact structure of AI insights we expect.
 * We use strict validation to ensure AI output always matches our frontend expectations.
 */

/**
 * Input schema: Describes a user's spending and budget by category.
 * Used to build the prompt for Gemini.
 */
export const categorySpendSummarySchema = z.object({
  category: z.string().describe("The spending category (e.g., 'Food & Dining')"),
  spent: z.number().nonnegative().describe("Amount spent in this category (dollars)"),
  allocated: z.number().nonnegative().describe("Budget allocated for this category (dollars)"),
});

export type CategorySpendSummary = z.infer<typeof categorySpendSummarySchema>;

/**
 * Output schema: A single recommendation from Gemini.
 * We request EXACTLY 3 recommendations: one for each type.
 */
export const recommendationSchema = z.object({
  // Type of recommendation: what the user should do with spending in a category
  type: z
    .enum(["reduce", "keepDoing", "spendMore"])
    .describe("Whether the user should reduce, keep, or increase spending in this category"),
  // The category this recommendation applies to
  category: z.string().describe("The spending category this recommendation applies to"),
  // A concise title for the recommendation
  title: z.string().describe("A short title summarizing the recommendation"),
  // Detailed message explaining the recommendation
  message: z.string().describe("A detailed message explaining why and how to follow this recommendation"),
});

export type Recommendation = z.infer<typeof recommendationSchema>;

/**
 * Full response schema: exactly 3 recommendations + metadata.
 * We use .length(3) to enforce exactly 3 items (reduce, keepDoing, spendMore).
 * This contract is critical for the frontend which expects exactly 3 cards.
 */
export const dashboardAiResponseSchema = z.object({
  recommendations: z.array(recommendationSchema).length(3).describe("Exactly 3 recommendations: reduce, keepDoing, spendMore"),
  generatedAt: z.string().datetime().describe("ISO 8601 timestamp when recommendations were generated"),
});

export type DashboardAiResponse = z.infer<typeof dashboardAiResponseSchema>;

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
    normalized.includes("404 not found") ||
    normalized.includes("permission denied") ||
    normalized.includes("does not have access") ||
    normalized.includes("free tier") ||
    normalized.includes("not allowed")
  );
}

/**
 * ===== Gemini Integration =====
 * Calls Google's Gemini API to generate AI-powered budget recommendations.
 */

/**
 * Generates dashboard insights by calling Gemini using a configured model and fallbacks.
 *
 * Design Decision: Why fallback model chain?
 * - Free tier access can vary by account and region.
 * - We try models in a strict order and continue when model access is unavailable.
 * - This avoids hard failure when a single model is not accessible.
 *
 * Design Decision: Why responseMimeType: "application/json"?
 * - Forces Gemini to return valid JSON, not raw text
 * - Eliminates markdown code blocks, unrelated text, or hallucinated explanations
 * - Ensures we can parse + validate with Zod predictably
 *
 * @param spendingData - Array of category summaries (spent vs allocated per category)
 * @param month - Month number (1-12) for context in the prompt
 * @param year - Year for context in the prompt
 * @returns Promise<DashboardAiResponse> - Exactly 3 recommendations + timestamp
 * @throws Error if Gemini API fails, returns invalid JSON, or fails Zod validation
 */
export async function generateDashboardInsights(
  spendingData: CategorySpendSummary[],
  month: number,
  year: number
): Promise<DashboardAiResponse> {
  // Check if API key is configured
  if (!env.GEMINI_API_KEY) {
    // Return a sentinel indicating the feature is unavailable
    // The calling route will convert this to a 503 response
    throw new Error("GEMINI_API_KEY not configured");
  }

  // Initialize the Gemini client with the API key
  const client = new GoogleGenerativeAI(env.GEMINI_API_KEY);

  // Strict model order: configured/default first, then requested fallbacks.
  const modelCandidates = [
    env.GEMINI_MODEL,
    "gemini-2.5-flash-lite",
    "gemini-3.1-flash-lite",
    "gemini-3-flash",
  ];
  const uniqueModelCandidates = Array.from(new Set(modelCandidates));

  // Shared generation config across all candidate models.
  const generationConfig = {
    responseMimeType: "application/json",
    responseSchema: {
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
          },
          minItems: 3,
          maxItems: 3,
        },
        generatedAt: { type: "string" },
      },
      required: ["recommendations", "generatedAt"],
    },
  };

  // Build the prompt from spending data
  // We provide specific numbers so Gemini can give targeted, data-driven recommendations
  const categoryBreakdown = spendingData
    .map(
      (item) =>
        `- ${item.category}: $${item.spent.toFixed(2)} spent of $${item.allocated.toFixed(2)} allocated (${
          item.allocated > 0 ? ((item.spent / item.allocated) * 100).toFixed(1) : "N/A"
        }% of budget)`
    )
    .join("\n");

  const userPrompt = `
You are a personal finance advisor for a college student. Analyze the following spending data for ${new Date(
    year,
    month - 1
  ).toLocaleDateString("en-US", { month: "long", year: "numeric" })} and provide exactly 3 recommendations:

Spending Summary:
${categoryBreakdown}

Generate exactly 3 recommendations in this format:
1. One recommendation where the student should REDUCE spending (type: "reduce")
2. One recommendation where the student is doing WELL and should KEEP their current habits (type: "keepDoing")
3. One recommendation where the student could INCREASE spending or take a different approach (type: "spendMore")

Each recommendation must include:
- type: One of "reduce", "keepDoing", or "spendMore"
- category: The spending category it applies to
- title: A short, actionable title (max 50 characters)
- message: A detailed message with specific, practical advice (1-2 sentences)

Return ONLY valid JSON with this structure:
{
  "recommendations": [
    { "type": "...", "category": "...", "title": "...", "message": "..." },
    { "type": "...", "category": "...", "title": "...", "message": "..." },
    { "type": "...", "category": "...", "title": "...", "message": "..." }
  ],
  "generatedAt": "ISO 8601 timestamp"
}

Ensure you return exactly 3 recommendations with one of each type.
`;

  let sawAvailabilityFailure = false;

  for (const modelName of uniqueModelCandidates) {
    try {
      console.log(`[AI] Trying model: ${modelName}`);

      const model = client.getGenerativeModel({
        model: modelName,
        // Cast is required because SDK schema typings are stricter than runtime API accepts.
        generationConfig: generationConfig as any,
      });

      // Call Gemini with the JSON schema constraint
      const response = await model.generateContent(userPrompt);
      const responseText = response.response.text();

      // DEBUG: Log the raw response from Gemini for troubleshooting
      console.log("[AI] Raw Gemini response:", responseText);

      // Sometimes Gemini wraps JSON in markdown code blocks even with responseMimeType set
      // Extract JSON if it's wrapped in markdown: ```json ... ``` or just ``` ... ```
      let jsonText = responseText.trim();
      const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        console.log("[AI] Extracted JSON from markdown code block");
        jsonText = jsonMatch[1].trim();
      }

      // Parse the JSON response
      // Gemini should return valid JSON due to responseMimeType constraint, but we parse defensively
      let parsed;
      try {
        parsed = JSON.parse(jsonText);
      } catch (parseError) {
        console.error("[AI] Failed to parse JSON. Response text was:", jsonText);
        throw parseError;
      }

      // DEBUG: Log parsed structure before validation
      console.log("[AI] Parsed structure:", JSON.stringify(parsed, null, 2));

      // Validate against our schema
      // This ensures the response matches expectations and throws if it doesn't
      const validated = dashboardAiResponseSchema.parse({
        ...parsed,
        // Ensure we have a timestamp (set current time if missing)
        generatedAt: parsed.generatedAt || new Date().toISOString(),
      });

      console.log(`[AI] Successfully generated recommendations with model: ${modelName}`);
      return validated;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      // Retry with next model only for provider/model availability issues.
      if (isModelAvailabilityError(message)) {
        sawAvailabilityFailure = true;
        console.warn(`[AI] Model unavailable for this key/tier: ${modelName}. Error: ${message}`);
        continue;
      }

      // Provide clear error messages for parsing/validation failures.
      if (error instanceof SyntaxError) {
        console.error("[AI] JSON Parse Error:", error.message);
        throw new Error(`Gemini returned invalid JSON: ${error.message}`);
      }
      if (error instanceof z.ZodError) {
        // Log the specific validation errors with detailed information
        const validationErrors = error.errors
          .map((e) => `${e.path.join(".")}: ${e.message} (code: ${e.code})`)
          .join("; ");
        console.error("[AI] Validation Error:", JSON.stringify(error.errors, null, 2));
        throw new Error(`Gemini response failed validation: ${validationErrors}`);
      }

      // Re-throw other errors (network, API errors, etc.)
      console.error("[AI] Unexpected error:", message);
      throw error;
    }
  }

  if (sawAvailabilityFailure) {
    throw new Error(
      "No supported Gemini model is available for generateContent. Configure GEMINI_MODEL to a currently supported model ID."
    );
  }

  throw new Error("Gemini request failed before any model could return a response.");
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
