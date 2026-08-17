const buckets = new Map();

function rateLimit(req, key, options = {}) {
  const limit = options.limit || 60;
  const windowMs = options.windowMs || 60_000;
  const now = Date.now();
  const bucketKey = `${key}:${options.identity || "anon"}`;
  const current = buckets.get(bucketKey);

  if (!current || current.resetAt <= now) {
    buckets.set(bucketKey, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, resetAt: now + windowMs };
  }

  current.count += 1;
  return {
    ok: current.count <= limit,
    remaining: Math.max(0, limit - current.count),
    resetAt: current.resetAt,
  };
}

module.exports = { rateLimit };
