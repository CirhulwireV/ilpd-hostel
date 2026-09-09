const redis = require("../utils/redis");

/**
 * Cache middleware for GET endpoints.
 * Usage: router.get("/path", cache("key", ttlSeconds), handler)
 *
 * - If Redis is available and the key exists: returns cached JSON instantly.
 * - If Redis is unavailable or key is missing: calls the handler normally,
 *   then stores the response in Redis for future requests.
 * - TTL defaults to 60 seconds. Adjust per endpoint based on how often
 *   the data changes (rooms/categories rarely change, so 120s is fine).
 */
const cache = (keyFn, ttl = 60) => async (req, res, next) => {
  const key = typeof keyFn === "function" ? keyFn(req) : keyFn;

  const cached = await redis.get(key);
  if (cached) {
    res.setHeader("X-Cache", "HIT");
    return res.json(JSON.parse(cached));
  }

  // Intercept res.json to store the response in Redis before sending
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    // Only cache successful responses
    if (res.statusCode >= 200 && res.statusCode < 300) {
      redis.set(key, JSON.stringify(body), ttl);
    }
    res.setHeader("X-Cache", "MISS");
    return originalJson(body);
  };

  next();
};

module.exports = { cache };
