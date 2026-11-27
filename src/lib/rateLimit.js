export function createRateLimiter({ limit, windowMs, clock = Date.now, maxKeys = 10_000 } = {}) {
  if (!Number.isSafeInteger(limit) || limit < 1) {
    throw new TypeError('Rate limit must be a positive whole number');
  }
  if (!Number.isSafeInteger(windowMs) || windowMs < 1) {
    throw new TypeError('Rate-limit window must be a positive whole number of milliseconds');
  }
  if (!Number.isSafeInteger(maxKeys) || maxKeys < 1) {
    throw new TypeError('Maximum rate-limit keys must be a positive whole number');
  }
  if (typeof clock !== 'function') throw new TypeError('Rate-limit clock must be a function');
  const buckets = new Map();

  return Object.freeze({
    allow(key) {
      if (typeof key !== 'string' || key.trim() === '') {
        throw new TypeError('Rate-limit key is required');
      }
      const now = clock();
      if (!Number.isSafeInteger(now)) throw new TypeError('Rate-limit clock must return milliseconds');
      let bucket = buckets.get(key);
      if (!bucket || now >= bucket.resetAt) {
        if (buckets.size >= maxKeys) {
          for (const [storedKey, storedBucket] of buckets) {
            if (now >= storedBucket.resetAt) buckets.delete(storedKey);
          }
          if (buckets.size >= maxKeys) buckets.delete(buckets.keys().next().value);
        }
        bucket = { count: 0, resetAt: now + windowMs };
        buckets.set(key, bucket);
      }
      if (bucket.count >= limit) return false;
      bucket.count += 1;
      return true;
    },
  });
}
