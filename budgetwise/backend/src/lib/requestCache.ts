type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const valueCache = new Map<string, CacheEntry<unknown>>();
const inFlight = new Map<string, Promise<unknown>>();

export async function getOrSetRequestCache<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
): Promise<T> {
  const now = Date.now();
  const cached = valueCache.get(key);
  if (cached && cached.expiresAt > now) {
    return cached.value as T;
  }

  const existing = inFlight.get(key);
  if (existing) {
    return existing as Promise<T>;
  }

  const promise = loader()
    .then((value) => {
      valueCache.set(key, { value, expiresAt: Date.now() + ttlMs });
      return value;
    })
    .finally(() => {
      inFlight.delete(key);
    });

  inFlight.set(key, promise);
  return promise;
}

export function invalidateRequestCacheByPrefix(prefix: string): void {
  for (const key of valueCache.keys()) {
    if (key.startsWith(prefix)) {
      valueCache.delete(key);
    }
  }

  for (const key of inFlight.keys()) {
    if (key.startsWith(prefix)) {
      inFlight.delete(key);
    }
  }
}

export function invalidateUserDashboardAndAiCache(userId: string): void {
  invalidateRequestCacheByPrefix(`dashboard:${userId}:`);
  invalidateRequestCacheByPrefix(`ai:insights:${userId}:`);
  invalidateRequestCacheByPrefix(`ai:comparison:${userId}:`);
}
