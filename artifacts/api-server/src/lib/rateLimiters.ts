import { rateLimit } from "express-rate-limit";

const IS_DEV = process.env.NODE_ENV !== "production";

/**
 * Global limiter — applied to all /api routes.
 * Generous in dev, strict in production.
 */
export const globalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: IS_DEV ? 1000 : 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please slow down." },
  skip: (req) => req.path === "/health" || req.path === "/healthz",
});

/**
 * Auth limiter — for Telegram initData authentication.
 * Tight to prevent brute-force / replay attacks.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: IS_DEV ? 100 : 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many authentication attempts, try again later." },
});

/**
 * Admin auth limiter — login and setup endpoints.
 * Very strict to protect admin credentials.
 */
export const adminAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: IS_DEV ? 100 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many admin auth attempts, try again later." },
});

/**
 * Write operation limiter — for state-changing game actions (plant, harvest, buy, etc.)
 * Prevents automated farming / coin grinding.
 */
export const writeLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: IS_DEV ? 500 : 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please slow down." },
});
