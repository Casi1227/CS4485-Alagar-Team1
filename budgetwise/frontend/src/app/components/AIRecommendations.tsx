import { useState, useEffect } from 'react';
import { TrendingDown, TrendingUp, Sparkles, CheckCircle, Loader2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { apiJson } from '../lib/api';

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

interface ComparisonItem {
  category: string;
  currentSpend: number;
  recommendedSpend: number;
}

interface AIComparisonResponse {
  items: ComparisonItem[];
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

function getRecommendationBulletPoints(message: string): string[] {
  return message
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- '))
    .map((line) => line.slice(2).trim());
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
 * 1. Dynamic Chart showing current spending vs AI recommended amounts
 * 2. Dynamic "Recommended Actions" - fetched from /api/ai/dashboard-insights
 */
export function AIRecommendations({ month, year }: { month?: number; year?: number }) {
  // ===== State Management =====
  // Store the fetched recommendations from the API
  const [recommendations, setRecommendations] = useState<Recommendation[] | null>(null);
  const [comparisonItems, setComparisonItems] = useState<ComparisonItem[]>([]);
  // Track loading state while fetching from API
  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(true);
  // Track error state if API call fails
  const [error, setError] = useState<string | null>(null);
  const [chartError, setChartError] = useState<string | null>(null);

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
    setChartLoading(true);
    setError(null);
    setChartError(null);

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

    // Fetch comparison data for chart bars from the AI endpoint
    apiJson(`/api/ai/budget-comparison?month=${queryMonth}&year=${queryYear}`)
      .then((res: AIComparisonResponse) => {
        if (!cancelled) {
          setComparisonItems(Array.isArray(res.items) ? res.items : []);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          const errorMessage =
            err instanceof Error ? err.message : 'Failed to load AI comparison data';
          setChartError(errorMessage);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setChartLoading(false);
        }
      });

    // Cleanup: mark as cancelled if component unmounts
    return () => {
      cancelled = true;
    };
  }, [month, year]);

  return (
    <div className="space-y-6">
      {/* Recommended vs Current Spending Chart */}
      <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 border border-white/20">
        <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
          <Sparkles className="w-5 h-5" />
          AI-Optimized Budget Comparison
        </h3>

        {chartLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 text-white animate-spin" />
            <span className="ml-2 text-white/80">Generating chart data...</span>
          </div>
        )}

        {chartError && !chartLoading && (
          <div className="space-y-2 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
            <p className="text-red-400 text-sm">Unable to load chart data: {chartError}</p>
          </div>
        )}

        {!chartLoading && !chartError && comparisonItems.length > 0 && (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={comparisonItems.map((item) => ({
                category: item.category,
                current: item.currentSpend,
                recommended: item.recommendedSpend,
              }))}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="category" tick={{ fill: 'white' }} angle={-15} textAnchor="end" height={80} />
              <YAxis tick={{ fill: 'white' }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#e5e7eb', border: 'none', borderRadius: '8px' }}
                formatter={(value: number | string) =>
                  typeof value === 'number' ? `$${value.toFixed(2)}` : `$${value}`
                }
              />
              <Bar dataKey="current" fill="#3b82f6" name="Current Spending" />
              <Bar dataKey="recommended" fill="#10b981" name="AI Recommended" />
            </BarChart>
          </ResponsiveContainer>
        )}

        {!chartLoading && !chartError && comparisonItems.length === 0 && (
          <p className="text-white/60 text-sm">No category data available for comparison.</p>
        )}
        
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

        {/* Success State: Display the 3 recommendations from Groq */}
        {!loading && !error && recommendations && (
          <div className="space-y-3">
            {recommendations.map((rec, index) => {
              const { Icon, color } = getIconAndColorForType(rec.type);
              const bulletPoints = getRecommendationBulletPoints(rec.message);
              return (
                <div key={index} className="flex items-start gap-3 p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-colors">
                  <Icon className={`w-5 h-5 ${color} mt-0.5 flex-shrink-0`} />
                  <div className="flex-1">
                    {/* Display the AI-generated title and message */}
                    <p className="font-medium text-white text-sm">{rec.title}</p>
                    {bulletPoints.length > 0 ? (
                      <ul className="text-white/80 text-sm mt-1 leading-relaxed break-words list-disc pl-5 space-y-1">
                        {bulletPoints.map((point, pointIndex) => (
                          <li key={pointIndex}>{point}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-white/80 text-sm mt-1 leading-relaxed break-words">{rec.message}</p>
                    )}
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