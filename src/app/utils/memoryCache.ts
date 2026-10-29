// Small in-process cache for read-heavy, rarely changed data (site settings,
// categories, sliders, ...). Every storefront page reads these, so serving
// them from memory saves a database round trip per request.
//
// Writes on this instance clear the matching keys straight away. Other
// instances (serverless) catch up within the TTL, so keep TTLs short.

interface Entry {
  value: unknown;
  expiresAt: number;
}

const store = new Map<string, Entry>();
// Concurrent misses for the same key share one database call
const inflight = new Map<string, Promise<unknown>>();

const keyFor = (prefix: string, args: unknown[]) =>
  args.length ? `${prefix}:${JSON.stringify(args)}` : prefix;

export const invalidateCache = (...prefixes: string[]) => {
  for (const key of store.keys()) {
    if (prefixes.some((p) => key === p || key.startsWith(`${p}:`))) {
      store.delete(key);
    }
  }
};

// Wrap a loader so its result is reused for `ttlMs` (per argument list)
export const cached =
  <A extends unknown[], R>(prefix: string, ttlMs: number, loader: (...args: A) => Promise<R>) =>
  async (...args: A): Promise<R> => {
    const key = keyFor(prefix, args);
    const hit = store.get(key);
    if (hit && hit.expiresAt > Date.now()) return hit.value as R;

    const pending = inflight.get(key);
    if (pending) return pending as Promise<R>;

    const promise = loader(...args)
      .then((value) => {
        store.set(key, { value, expiresAt: Date.now() + ttlMs });
        return value;
      })
      .finally(() => inflight.delete(key));
    inflight.set(key, promise);
    return promise;
  };

// Wrap a write so the given cache groups are cleared once it has run
export const invalidates =
  <A extends unknown[], R>(prefixes: string[], fn: (...args: A) => Promise<R>) =>
  async (...args: A): Promise<R> => {
    try {
      return await fn(...args);
    } finally {
      invalidateCache(...prefixes);
    }
  };

export const MINUTE = 60 * 1000;
