const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:5001/api";

export async function apiFetch<T>(path: string, opts: RequestInit = {}, token?: string | null): Promise<T> {
  const headers = new Headers(opts.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${API_BASE}${path}`, { ...opts, headers, cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data && (data.error?.message || data.error || data.message)) || `HTTP ${res.status}`);
  }
  return data as T;
}
