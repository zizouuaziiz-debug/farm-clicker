import { Router } from "express";
import { authLimiter, adminAuthLimiter, writeLimiter } from "../lib/rateLimiters.js";

import healthzRouter from "./healthz.js";
import authRouter from "./auth.js";
import userRouter from "./user.js";
import dashboardRouter from "./dashboard.js";
import farmRouter from "./farm.js";
import inventoryRouter from "./inventory.js";
import shopRouter from "./shop.js";
import leaderboardRouter from "./leaderboard.js";
import dailyRouter from "./daily.js";
import missionsRouter from "./missions.js";
import achievementsRouter from "./achievements.js";
import statsRouter from "./stats.js";
import vipRouter from "./vip.js";
import withdrawRouter from "./withdraw.js";
import adminRouter from "./admin.js";
import adminAuthRouter from "./admin-auth.js";
import adsRouter from "./ads.js";
import referralsRouter from "./referrals.js";
import depositsRouter from "./deposits.js";
import broadcastsRouter from "./broadcasts.js";

const router = Router();

// ── Public / utility ────────────────────────────────────────────────────────
router.use("/healthz", healthzRouter);

// ── Auth  (tight rate limit) ─────────────────────────────────────────────────
router.use("/auth", authLimiter, authRouter);

// ── Player endpoints ─────────────────────────────────────────────────────────
router.use("/user", userRouter);
router.use("/dashboard", dashboardRouter);
router.use("/leaderboard", leaderboardRouter);
router.use("/stats", statsRouter);

// ── Game actions  (write limiter on POST/PATCH) ───────────────────────────────
router.use("/farm", writeLimiter, farmRouter);
router.use("/shop", writeLimiter, shopRouter);
router.use("/inventory", inventoryRouter);
router.use("/daily", writeLimiter, dailyRouter);
router.use("/missions", missionsRouter);
router.use("/achievements", achievementsRouter);
router.use("/vip", vipRouter);
router.use("/withdraw", withdrawRouter);
router.use("/deposits", depositsRouter);
router.use("/ads", writeLimiter, adsRouter);
router.use("/referrals", referralsRouter);

// ── Admin ─────────────────────────────────────────────────────────────────────
router.use("/admin-auth", adminAuthLimiter, adminAuthRouter);
router.use("/admin", adminRouter);
router.use("/admin/broadcasts", broadcastsRouter);

export default router;
