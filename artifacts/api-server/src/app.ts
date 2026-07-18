import express, { type Express, Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import pinoHttp from "pino-http";
import router from "./routes/index.js";
import { logger } from "./lib/logger.js";
import { globalLimiter } from "./lib/rateLimiters.js";

const IS_DEV = process.env.NODE_ENV !== "production";

// ── Allowed CORS origins ───────────────────────────────────────────────────────
// In production set ALLOWED_ORIGINS="https://yourapp.com,https://admin.yourapp.com"
const rawOrigins = process.env.ALLOWED_ORIGINS || "";
const allowedOrigins: string[] = rawOrigins
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, same-origin)
    if (!origin) return callback(null, true);
    // In dev allow everything
    if (IS_DEV) return callback(null, true);
    // In production only explicitly listed origins
    if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error(`CORS: origin '${origin}' not allowed`));
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
  maxAge: 86400, // preflight cache 24 h
};

const app: Express = express();
app.set("trust proxy", 1);

// ── Security headers ───────────────────────────────────────────────────────────
app.use(
  helmet({
    // Allow the Telegram Mini App to be embedded in iframes
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "https:"],
        frameSrc: ["'none'"],
      },
    },
    // Let the Telegram WebView embed the mini-app
    frameguard: false,
  }),
);

// ── CORS ───────────────────────────────────────────────────────────────────────
app.use(cors(corsOptions));
app.options("/{*path}", cors(corsOptions));

// ── Response compression ────────────────────────────────────────────────────────
// Gzip/brotli-negotiated compression for JSON responses (leaderboard, admin
// lists, etc. can be sizeable). Cheap CPU cost, meaningful bandwidth win.
app.use(compression());

// ── Request logging ────────────────────────────────────────────────────────────
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);

// ── Body parsing ───────────────────────────────────────────────────────────────
app.use(express.json({ limit: "512kb" }));
app.use(express.urlencoded({ extended: true, limit: "512kb" }));

// ── Global rate limiter ────────────────────────────────────────────────────────
app.use("/api", globalLimiter);

// ── Routes ─────────────────────────────────────────────────────────────────────
app.use("/api", router);

// ── 404 handler ────────────────────────────────────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Not found" });
});

// ── Global error handler ───────────────────────────────────────────────────────
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  // Never leak internals in production
  const message = IS_DEV ? err.message : "Internal server error";
  const stack = IS_DEV ? err.stack : undefined;
  logger.error({ err }, "Unhandled error");
  res.status(500).json({ error: message, ...(stack ? { stack } : {}) });
});

export default app;
