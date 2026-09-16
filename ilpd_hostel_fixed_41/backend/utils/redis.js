const Redis = require("ioredis");

let client = null;
let available = false;

if (process.env.REDIS_URL) {
  client = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: 1,
    enableReadyCheck: true,
    lazyConnect: true,
    connectTimeout: 5000,
  });

  client.on("ready", () => {
    available = true;
    console.log("Redis connected — rate limiting and caching are distributed.");
  });

  client.on("error", (err) => {
    if (available) console.warn("Redis error (falling back to in-memory):", err.message);
    available = false;
  });

  client.on("reconnecting", () => {
    available = false;
  });

  client.connect().catch(() => {
    // Connection failure at startup — app continues without Redis
  });
} else {
  console.log("REDIS_URL not set — using in-memory rate limiting and no caching (fine for single instance).");
}

// Safe wrappers — never throw, always return null on failure
const get = async (key) => {
  if (!available) return null;
  try { return await client.get(key); } catch { return null; }
};

const set = async (key, value, ttlSeconds) => {
  if (!available) return;
  try { await client.set(key, value, "EX", ttlSeconds); } catch { /* silent */ }
};

const del = async (...keys) => {
  if (!available) return;
  try { await client.del(...keys); } catch { /* silent */ }
};

// Delete all keys matching a pattern (e.g. "rooms:*")
const delPattern = async (pattern) => {
  if (!available) return;
  try {
    const keys = await client.keys(pattern);
    if (keys.length) await client.del(...keys);
  } catch { /* silent */ }
};

module.exports = { client, isAvailable: () => available, get, set, del, delPattern };
