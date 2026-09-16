const rateLimit = require("express-rate-limit");
const { client: redisClient, isAvailable } = require("../utils/redis");

// Build a Redis store only when Redis is connected.
// Falls back to the default in-memory store automatically.
const makeStore = () => {
  if (!isAvailable() || !redisClient) return undefined; // express-rate-limit uses memory by default
  try {
    const { RedisStore } = require("rate-limit-redis");
    return new RedisStore({
      sendCommand: (...args) => redisClient.call(...args),
      prefix: "rl:",
    });
  } catch {
    return undefined;
  }
};

// Re-evaluate the store at request time so Redis reconnections are picked up.
// express-rate-limit accepts a store factory via the store option.
const lazyStore = () => makeStore();

const rateLimitMessage = {
  message: "Too many requests. Please wait a moment and try again.",
};

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 1000,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: rateLimitMessage,
  store: lazyStore(),
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    message: "Too many failed login attempts. Please wait 15 minutes and try again.",
  },
  store: lazyStore(),
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    message: "Too many registration attempts. Please try again later.",
  },
  store: lazyStore(),
});

const bookingActionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    message: "Too many booking requests. Please wait and try again.",
  },
  store: lazyStore(),
});

module.exports = {
  apiLimiter,
  loginLimiter,
  registerLimiter,
  bookingActionLimiter,
};
