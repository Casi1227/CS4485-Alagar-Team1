'use client';

/**
 * Minimal fetch helper.
 * Base URL must be provided via NEXT_PUBLIC_API_BASE_URL.
 */

const baseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5001').replace(/\/$/, '');
export const PLAID_DEMO_DIRECT_IMPORT_ENABLED =
  process.env.NEXT_PUBLIC_PLAID_DEMO_DIRECT_IMPORT_ENABLED === 'true';

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

export type PlaidLinkTokenResponse = {
  linkToken: string;
  expiration: string;
};

export type PlaidExchangeResponse = {
  linkedAccount: {
    id: string;
    institutionName?: string | null;
    accountName?: string | null;
    accountMask?: string | null;
    accountType?: string | null;
    accountSubtype?: string | null;
    createdAt: string;
  };
  importSummary: {
    created: number;
    updated: number;
    removed: number;
    skipped: number;
  };
};

export type LinkedPlaidAccount = {
  id: string;
  institutionName?: string | null;
  accountName?: string | null;
  accountMask?: string | null;
  accountType?: string | null;
  accountSubtype?: string | null;
  lastSyncedAt?: string | null;
  createdAt: string;
};

export async function createPlaidLinkToken(): Promise<PlaidLinkTokenResponse> {
  return apiJson('/api/plaid/link-token', {
    method: 'POST',
    body: JSON.stringify({ accountType: 'credit' }),
  });
}

export async function exchangePlaidPublicToken(publicToken: string): Promise<PlaidExchangeResponse> {
  return apiJson('/api/plaid/exchange-public-token', {
    method: 'POST',
    body: JSON.stringify({ publicToken }),
  });
}

export async function demoPlaidImport(): Promise<PlaidExchangeResponse> {
  return apiJson('/api/plaid/demo-import', {
    method: 'POST',
  });
}

export async function listPlaidLinkedAccounts(): Promise<{ linkedAccounts: LinkedPlaidAccount[] }> {
  return apiJson('/api/plaid/accounts', { method: 'GET' });
}

export async function syncPlaidLinkedAccount(linkedAccountId: string): Promise<{ summary: { created: number; updated: number; removed: number; skipped: number } }> {
  return apiJson('/api/plaid/sync', {
    method: 'POST',
    body: JSON.stringify({ linkedAccountId }),
  });
}

export async function apiJson(path: string, init: RequestInit = {}) {
  const url = `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;

  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  const token = typeof window !== 'undefined' ? localStorage.getItem('bw_token') : null;
  if (token && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);

  let res: Response;
  try {
    res = await fetch(url, { ...init, headers });
  } catch {
    throw new Error(`Unable to reach the API at ${baseUrl}. Please verify the backend is running and your browser origin is allowed.`);
  }
  const text = await res.text();
  const data = text ? safeJsonParse(text) : null;

  if (!res.ok) {
    if (res.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('bw_token');
    }
    const msg = data?.error?.message || data?.error || `Request failed (${res.status})`;
    if (res.status === 401) {
      throw new Error('Session expired. Please sign in again.');
    }
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
