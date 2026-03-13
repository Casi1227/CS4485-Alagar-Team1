import { useState, useEffect } from 'react';
import { TrendingDown, TrendingUp, Sparkles, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { apiJson } from '../lib/api';

// ===== Hardcoded Data (Kept for future AI feature implementation) =====
// These constants are placeholder data for the chart section.
// The bar chart section will be replaced with real AI data in a future feature phase.
// For now, we keep them hardcoded so the chart displays properly on the dashboard.
const recommendationData = [
  { category: 'Food & Dining', current: 320, recommended: 280, status: 'reduce' },
  { category: 'Transportation', current: 85, recommended: 85, status: 'good' },
  { category: 'Entertainment', current: 125, recommended: 100, status: 'reduce' },
  { category: 'Personal Care', current: 60, recommended: 60, status: 'good' },
  { category: 'Other', current: 40, recommended: 80, status: 'increase' },
];

// These insights cards are also kept hardcoded for now.
// In a future phase, these can be replaced with dynamic AI-generated content.
const insights = [
  {
    icon: TrendingDown,
    type: 'warning',
    title: 'High Spending Alert',
    message: 'Your food spending is 20% above the recommended amount for students. Consider meal prepping to save $40/month.',
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
  },
  {
    icon: CheckCircle,
    type: 'success',
    title: 'On Track',
    message: 'Your transportation costs are well-optimized! You\'re using public transit efficiently.',
    color: 'text-green-400',
    bgColor: 'bg-green-500/10',
  },
  {
    icon: Sparkles,
    type: 'tip',
    title: 'Smart Saving Tip',
    message: 'Based on your spending patterns, you could save $50 by switching to a student meal plan.',
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/10',
  },
  {
    icon: TrendingUp,
    type: 'opportunity',
    title: 'Budget Reallocation',
    message: 'Consider allocating more to "Other" for unexpected expenses. You have room in your overall budget.',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
  },
];

// ===== Type Definitions =====
/**
 * Recommendation type matches the backend schema from aiInsights.ts
 * The backend returns exactly 3 recommendations with these properties.
 */
interface Recommendation {
  type: 'reduce' | 'keepDoing' | 'spendMore';
  category: string;
  title: string;
  message: string;
}

interface AIResponse {
  recommendations: Recommendation[];
  generatedAt: string;
}

// ===== Helper Function: Map Recommendation Type to Icon and Color =====
/**
 * Maps each recommendation type to an appropriate Lucide icon and Tailwind color.
 * This ensures visual consistency: reduce (red, down), keepDoing (green, check), spendMore (blue, up).
 * 
 * Design Decision: Hard-map icon types rather than using an exhaustive switch statement.
 * This provides a single source of truth for the icon/color mapping across the component.
 */
function getIconAndColorForType(type: 'reduce' | 'keepDoing' | 'spendMore') {
  switch (type) {
    case 'reduce':
      // Red, downward trend icon: indicates the user should reduce spending
      return { Icon: TrendingDown, color: 'text-red-400' };
    case 'keepDoing':
      // Green, checkmark icon: indicates the user is doing well and should maintain
      return { Icon: CheckCircle, color: 'text-green-400' };
    case 'spendMore':
      // Blue, upward trend icon: indicates the user should increase spending or take a different approach
      return { Icon: TrendingUp, color: 'text-blue-400' };
  }
}

// ===== Component =====
/**
 * AIRecommendations Component
 * 
 * Displays AI-generated budget recommendations for the user's spending in a specific month.
 * 
 * Props:
 *   - month (optional): Month number (1-12), defaults to current month
 *   - year (optional): Year number, defaults to current year
 * 
 * The component displays:
 * 1. Hardcoded AI Insights Cards (placeholder for future enhancement)
 * 2. Hardcoded Chart showing spending vs recommended amounts
 * 3. Dynamic "Recommended Actions" - fetched from /api/ai/dashboard-insights
 * 
 * Design Decision: Only the "Recommended Actions" section is dynamic.
 * The chart and insight cards remain hardcoded because:
 * - Chart data requires complex spend analysis (future feature)
 * - Insight cards will be enhanced with more AI features later
 * - This keeps the initial implementation focused and testable
 */
export function AIRecommendations({ month, year }: { month?: number; year?: number }) {
  // ===== State Management =====
  // Store the fetched recommendations from the API
  const [recommendations, setRecommendations] = useState<Recommendation[] | null>(null);
  // Track loading state while fetching from API
  const [loading, setLoading] = useState(true);
  // Track error state if API call fails
  const [error, setError] = useState<string | null>(null);

  // ===== Effect: Fetch Recommendations =====
  /**
   * Fetches AI recommendations from the backend when component mounts or month/year changes.
   * 
   * Design Decision: Use useEffect to auto-trigger on page load.
   * This matches the expected flow: user lands on dashboard → AI automatically generates insights.
   * We don't require a button click or manual refresh to fetch recommendations.
   * 
   * Error Handling:
   * - If API key is not configured (503): Show user-friendly message
   * - If validation fails (422): Show generic retry message
   * - If network error: Show error to assist debugging
   * - If user navigates away before response: Ignore via cancelled flag
   */
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    // Use current month/year if not provided
    const currentDate = new Date();
    const queryMonth = month ?? currentDate.getMonth() + 1;
    const queryYear = year ?? currentDate.getFullYear();

    // Fetch recommendations from the backend AI endpoint
    apiJson(`/api/ai/dashboard-insights?month=${queryMonth}&year=${queryYear}`)
      .then((res: AIResponse) => {
        // Only update state if component is still mounted
        if (!cancelled) {
          setRecommendations(res.recommendations);
        }
      })
      .catch((err) => {
        // Only update state if component is still mounted
        if (!cancelled) {
          // Provide different error messages based on the error
          const errorMessage =
            err instanceof Error ? err.message : 'Failed to load AI recommendations';
          setError(errorMessage);
        }
      })
      .finally(() => {
        // Only update state if component is still mounted
        if (!cancelled) {
          setLoading(false);
        }
      });

    // Cleanup: mark as cancelled if component unmounts
    return () => {
      cancelled = true;
    };
  }, [month, year]);

  return (
    <div className="space-y-6">
      {/* AI Insights Cards - Hardcoded for now */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {insights.map((insight, index) => {
          const Icon = insight.icon;
          return (
            <div key={index} className={`${insight.bgColor} backdrop-blur-sm rounded-lg p-4 border border-white/20`}>
              <div className="flex items-start gap-3">
                <div className={`${insight.color} mt-1`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-white mb-1">{insight.title}</h3>
                  <p className="text-sm text-white/90">{insight.message}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Recommended vs Current Spending Chart - Hardcoded for now */}
      <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 border border-white/20">
        <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
          <Sparkles className="w-5 h-5" />
          AI-Optimized Budget Comparison
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={recommendationData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
            <XAxis dataKey="category" tick={{ fill: 'white' }} angle={-15} textAnchor="end" height={80} />
            <YAxis tick={{ fill: 'white' }} />
            <Tooltip 
              contentStyle={{ backgroundColor: '#e5e7eb', border: 'none', borderRadius: '8px' }}
              formatter={(value) => `$${value}`}
            />
            <Bar dataKey="current" fill="#3b82f6" name="Current Spending" />
            <Bar dataKey="recommended" fill="#10b981" name="AI Recommended" />
          </BarChart>
        </ResponsiveContainer>
        
        <div className="mt-4 flex items-center gap-4 text-sm text-white/80">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#3b82f6]"></div>
            <span>Current Spending</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#10b981]"></div>
            <span>AI Recommended</span>
          </div>
        </div>
      </div>

      {/* Recommended Actions - Dynamically fetched from AI API */}
      <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 border border-white/20">
        <h3 className="font-semibold text-white mb-4">Recommended Actions</h3>
        
        {/* Loading State: Show spinner while fetching recommendations */}
        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 text-white animate-spin" />
            <span className="ml-2 text-white/80">Generating recommendations...</span>
          </div>
        )}

        {/* Error State: Show error message if API call failed */}
        {error && !loading && (
          <div className="space-y-3 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
            <p className="text-red-400 text-sm">
              Unable to load recommendations: {error}
            </p>
            <p className="text-red-400/70 text-xs">
              Please try refreshing the page or contact support if the problem persists.
            </p>
          </div>
        )}

        {/* Success State: Display the 3 recommendations from Gemini */}
        {!loading && !error && recommendations && (
          <div className="space-y-3">
            {recommendations.map((rec, index) => {
              const { Icon, color } = getIconAndColorForType(rec.type);
              return (
                <div key={index} className="flex items-start gap-3 p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-colors">
                  <Icon className={`w-5 h-5 ${color} mt-0.5 flex-shrink-0`} />
                  <div className="flex-1">
                    {/* Display the AI-generated title and message */}
                    <p className="font-medium text-white text-sm">{rec.title}</p>
                    <p className="text-white/80 text-sm mt-1">{rec.message}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Fallback: Show nothing if no recommendations loaded but also no error */}
        {!loading && !error && !recommendations && (
          <p className="text-white/60 text-sm">No recommendations available.</p>
        )}
      </div>
    </div>
  );
}