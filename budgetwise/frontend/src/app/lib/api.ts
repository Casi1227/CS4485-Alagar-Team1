'use client';

/**
 * Minimal fetch helper.
 * Base URL must be provided via NEXT_PUBLIC_API_BASE_URL.
 */

const baseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5001').replace(/\/$/, '');

export type AiBudgetSuggestionsRequest = {
  income: number;
  month: number;
  year: number;
  categories: Array<{
    category: string;
    allocated: number;
    percent: number;
  }>;
};

export type AiBudgetSuggestionsResponse = {
  suggestions: Array<{
    category: string;
    percent: number;
  }>;
  generatedAt: string;
};

export async function apiJson(path: string, init: RequestInit = {}) {
  const url = `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;

  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  const token = typeof window !== 'undefined' ? localStorage.getItem('bw_token') : null;
  if (token && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(url, { ...init, headers });
  const text = await res.text();
  const data = text ? safeJsonParse(text) : null;

  if (!res.ok) {
    const msg = data?.error?.message || data?.error || `Request failed (${res.status})`;
    throw new Error(typeof msg === 'string' ? msg : 'Request failed');
  }
  return data;
}

export function fetchAiBudgetSuggestions(
  payload: AiBudgetSuggestionsRequest,
  init: RequestInit = {},
): Promise<AiBudgetSuggestionsResponse> {
  return apiJson('/api/ai/budget-suggestions', {
    ...init,
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

function safeJsonParse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
