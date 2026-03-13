import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { authRequired, type AuthedRequest } from "../middleware/authRequired.js";
import { generateDashboardInsights, CategorySpendSummary } from "../services/aiInsights.js";

/**
 * ===== AI Insights Router =====
 * Handles AI-powered budget recommendation generation.
 * Endpoint: GET /api/ai/dashboard-insights
 *
 * Flow:
 * 1. User visits dashboard for a specific month/year
 * 2. Frontend makes GET request to this endpoint with month and year params
 * 3. We fetch user's expenses and budgets for that month from Prisma
 * 4. Aggregate spending by category
 * 5. Call Gemini API to generate 3 personalized recommendations
 * 6. Return recommendations as JSON to frontend
 * 7. Frontend renders the 3 recommendations in the "Recommended Actions" section
 *
 * Design Decision: GET not POST
 * - Dashboard auto-triggers on page load; idempotent GET is semantically correct
 * - Query params (month, year) are simpler than POST body for this use case
 * - Works naturally with useEffect in React (no need to manage POST state)
 *
 * Design Decision: Query-based month/year filtering
 * - Allows dashboard to ask for insights for any month (current, past, future)
 * - Enables historical view without refetching if user navigates dashboard months
 * - Matches the parameter structure of /api/dashboard endpoint
 */
export const aiRouter = Router();

/**
 * GET /api/ai/dashboard-insights
 * Generate AI recommendations for a user's budget for a specific month.
 *
 * Query Parameters:
 *   - month (optional): Month number 1-12, defaults to current month
 *   - year (optional): Year number, defaults to current year
 *
 * Response (200):
 *   {
 *     "recommendations": [
 *       { "type": "reduce", "category": "Food & Dining", "title": "Cut dining out", "message": "..." },
 *       { "type": "keepDoing", "category": "Transportation", "title": "Great transit habits", "message": "..." },
 *       { "type": "spendMore", "category": "Health", "title": "Prioritize wellness", "message": "..." }
 *     ],
 *     "generatedAt": "2026-03-12T14:30:00.000Z"
 *   }
 *
 * Response (503) - If GEMINI_API_KEY is not configured:
 *   { "error": "AI insights are not available. Please contact support." }
 *
 * Response (422) - If Gemini output fails validation:
 *   { "error": "Failed to generate valid recommendations. Please try again." }
 */
aiRouter.get("/dashboard-insights", authRequired, async (req: AuthedRequest, res) => {
  const userId = req.user!.id;

  // Parse month and year from query parameters
  const now = new Date();
  const month = req.query.month ? Number(req.query.month) : now.getMonth() + 1;
  const year = req.query.year ? Number(req.query.year) : now.getFullYear();

  // Validate month is in valid range
  if (month < 1 || month > 12) {
    return res.status(400).json({ error: "Month must be between 1 and 12" });
  }

  try {
    // Calculate the start and end of the requested month
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

    // Fetch both expenses and budgets in parallel for efficiency
    // This reduces database query time vs sequential fetches
    const [expenses, budgets] = await Promise.all([
      prisma.expense.findMany({
        where: {
          userId,
          date: { gte: startOfMonth, lte: endOfMonth },
        },
      }),
      prisma.budget.findMany({
        where: {
          userId,
          month,
          year,
        },
      }),
    ]);

    // DEBUG: Log the data we fetched
    console.log(`[AI Route] User ${userId} - Month ${month}/${year}: ${expenses.length} expenses, ${budgets.length} budgets`);

    // Aggregate expenses and budgets by category
    // Design Decision: Use Map for efficient O(1) lookups vs O(n) array.find()
    const spendByCategory = new Map<string, number>();
    const budgetByCategory = new Map<string, number>();

    // Sum up all expenses by category
    for (const expense of expenses) {
      const current = spendByCategory.get(expense.category) ?? 0;
      spendByCategory.set(expense.category, current + expense.amount);
    }

    // Sum up all budget allocations by category
    // Note: If a category has multiple budgets (shouldn't happen with unique constraints),
    // we sum them for robustness
    for (const budget of budgets) {
      const current = budgetByCategory.get(budget.category) ?? 0;
      budgetByCategory.set(budget.category, current + budget.allocated);
    }

    // Build the spending summary for Gemini
    // Include all categories that have either spending or budget (or both)
    const allCategories = new Set([...spendByCategory.keys(), ...budgetByCategory.keys()]);
    const spendingSummary: CategorySpendSummary[] = Array.from(allCategories).map((category) => ({
      category,
      spent: spendByCategory.get(category) ?? 0,
      allocated: budgetByCategory.get(category) ?? 0,
    }));

    console.log(`[AI Route] Spending summary: ${JSON.stringify(spendingSummary)}`);

    // Call Gemini to generate recommendations
    try {
      const recommendations = await generateDashboardInsights(spendingSummary, month, year);

      // Success: return the AI-generated recommendations
      // The frontend expects exactly this structure (3 recommendations + timestamp)
      console.log("[AI Route] Successfully returning recommendations to frontend");
      return res.json(recommendations);
    } catch (aiError) {
      // Check if the error is due to missing API key
      if (aiError instanceof Error && aiError.message.includes("GEMINI_API_KEY not configured")) {
        // API key not configured: return 503 Service Unavailable
        // Indicates the feature is temporarily disabled, not a client error
        console.warn("[AI Route] API key not configured");
        return res.status(503).json({
          error: "AI insights are not available. Please contact support.",
        });
      }

      const aiMessage = aiError instanceof Error ? aiError.message : String(aiError);

      // Provider/model availability errors should surface as upstream dependency failure.
      if (
        aiMessage.includes("No supported Gemini model is available") ||
        (aiMessage.toLowerCase().includes("model") &&
          (aiMessage.toLowerCase().includes("not found") ||
            aiMessage.toLowerCase().includes("unavailable") ||
            aiMessage.toLowerCase().includes("not supported") ||
            aiMessage.toLowerCase().includes("does not have access") ||
            aiMessage.toLowerCase().includes("permission denied") ||
            aiMessage.toLowerCase().includes("free tier") ||
            aiMessage.includes("404")))
      ) {
        console.error("[AI Route] AI provider/model unavailable:", aiMessage);
        return res.status(502).json({
          error: "AI provider model is unavailable. Please try again later or update model configuration.",
        });
      }

      // Structured output issues remain validation errors.
      if (
        aiMessage.toLowerCase().includes("failed validation") ||
        aiMessage.toLowerCase().includes("invalid json")
      ) {
        console.error("[AI Route] AI insights validation error:", aiMessage);
        return res.status(422).json({
          error: "Failed to generate valid recommendations. Please try again.",
        });
      }

      // Other upstream provider failures are treated as dependency errors.
      console.error("[AI Route] AI upstream error:", aiMessage);
      return res.status(502).json({
        error: "AI service is temporarily unavailable. Please try again later.",
      });
    }
  } catch (error) {
    // Database or other unexpected error: return 500 Internal Server Error
    console.error("[AI Route] Dashboard insights error:", error);
    return res.status(500).json({
      error: "An error occurred while generating recommendations.",
    });
  }
});
