'use client';

/**
 * Minimal fetch helper.
 * Base URL must be provided via NEXT_PUBLIC_API_BASE_URL.
 */

export const API_ORIGIN =
    (
        process.env.NEXT_PUBLIC_API_BASE_URL
        || 'http://localhost:5001'
    ).replace(/\/$/, '');
const ACCESS_TOKEN_KEY = 'bw_token';
const REFRESH_TOKEN_KEY = 'bw_refresh_token';
let refreshInFlight: Promise<string | null> | null = null;
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

export type ExpenseRecord = {
    id: string;
    amount: number;
    category: string;
    type?: "EXPENSE" | "INCOME" | null;
    date: string;
    note?: string | null;
};

type ExpensesPageResponse = {
    expenses?: ExpenseRecord[];
    pageInfo?: {
        hasNext?: boolean;
        nextCursor?: string | null;
    };
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

export async function syncPlaidLinkedAccount(
    linkedAccountId: string,
): Promise<{ summary: { created: number; updated: number; removed: number; skipped: number } }> {
    return apiJson('/api/plaid/sync', {
        method: 'POST',
        body: JSON.stringify({ linkedAccountId }),
    });
}

function formatRequestError(data: unknown, status: number): string {
    if (data && typeof data === "object" && "error" in data) {
        const e = (data as { error: unknown }).error;
        if (typeof e === "string") return e;
        if (
            e
            && typeof e === "object"
            && "message" in e
            && typeof (e as { message: unknown }).message === "string"
        ) {
            return (e as { message: string }).message;
        }
    }
    return `Request failed (${status})`;
}

export async function apiJson(path: string, init: RequestInit = {}) {
    const url = `${API_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`;

    const headers = new Headers(init.headers);
    if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

    const token = typeof window !== 'undefined' ? localStorage.getItem(ACCESS_TOKEN_KEY) : null;
    if (token && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);

    let res: Response;
    const requestInit = { ...init, headers };
    try {
        res = await fetch(url, requestInit);
    } catch {
        throw new Error(`Unable to reach the API at ${API_ORIGIN}. Please verify the backend is running and your browser origin is allowed.`);
    }
    if (
        res.status === 401
        && typeof window !== 'undefined'
        && !url.endsWith('/api/auth/login')
        && !url.endsWith('/api/auth/refresh')
    ) {
        const refreshedToken = await refreshAccessToken();
        if (refreshedToken) {
            const retryHeaders = new Headers(init.headers);
            if (!retryHeaders.has('Content-Type')) retryHeaders.set('Content-Type', 'application/json');
            retryHeaders.set('Authorization', `Bearer ${refreshedToken}`);
            res = await fetch(url, { ...init, headers: retryHeaders });
        }
    }
    const text = await res.text();
    const data = text ? safeJsonParse(text) : null;

    if (!res.ok) {
        if (res.status === 401 && typeof window !== 'undefined') {
            localStorage.removeItem(ACCESS_TOKEN_KEY);
            localStorage.removeItem(REFRESH_TOKEN_KEY);
        }
        const msg = formatRequestError(data, res.status);
        throw new Error(msg);
    }
    return data;
}

async function refreshAccessToken(): Promise<string | null> {
    if (typeof window === 'undefined') return null;
    if (refreshInFlight) return refreshInFlight;

    refreshInFlight = (async () => {
        const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
        if (!refreshToken) return null;

        const response = await fetch(`${API_ORIGIN}/api/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken }),
        });
        if (!response.ok) return null;

        const json = safeJsonParse(await response.text());
        const nextAccess = typeof json?.token === 'string' ? json.token : null;
        const nextRefresh = typeof json?.refreshToken === 'string' ? json.refreshToken : null;
        if (!nextAccess || !nextRefresh) return null;

        localStorage.setItem(ACCESS_TOKEN_KEY, nextAccess);
        localStorage.setItem(REFRESH_TOKEN_KEY, nextRefresh);
        return nextAccess;
    })()
        .catch(() => null)
        .finally(() => {
            refreshInFlight = null;
        });

    return refreshInFlight;
}

export async function fetchAllExpenses(params?: {
    from?: string;
    to?: string;
    limit?: number;
    maxPages?: number;
}): Promise<ExpenseRecord[]> {
    const pageSize = Math.max(1, Math.min(250, Math.trunc(params?.limit ?? 250)));
    const maxPages = Math.max(1, Math.trunc(params?.maxPages ?? 200));
    const rows: ExpenseRecord[] = [];
    let cursor: string | null = null;
    let hasNext = true;
    let page = 0;

    while (hasNext && page < maxPages) {
        const query = new URLSearchParams();
        query.set("limit", String(pageSize));
        if (params?.from) query.set("from", params.from);
        if (params?.to) query.set("to", params.to);
        if (cursor) query.set("cursor", cursor);

        const data = (await apiJson(`/api/expenses?${query.toString()}`)) as ExpensesPageResponse;
        const current = data?.expenses ?? [];
        rows.push(...current);
        hasNext = Boolean(data?.pageInfo?.hasNext);
        cursor = data?.pageInfo?.nextCursor ?? null;
        page += 1;
    }

    return rows;
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
