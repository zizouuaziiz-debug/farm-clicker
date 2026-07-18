import { Router } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { validateBody } from "../middlewares/validateBody.js";
import { requireAuth } from "../middlewares/requireAuth.js";
import { db } from "@workspace/db";
import { vipPurchasesTable, usersTable } from "@workspace/db/schema";
import { VIP_WALLET, VIP_NETWORK } from "../lib/game-config.js";
import { store } from "../lib/config-store.js";
import { verifyUsdtDeposit } from "../lib/bscscan.js";
import { logger } from "../lib/logger.js";

const router = Router();

// ── GET /vip/plans ────────────────────────────────────────────────────────────
router.get("/plans", (_req, res) => {
  // Prefer the BEP20 deposit wallet; fall back to legacy VIP_WALLET env
  const walletAddress = process.env.DEPOSIT_WALLET_ADDRESS || VIP_WALLET;
  res.json({
    walletAddress,
    network: VIP_NETWORK,          // "BEP20 (BSC)" after game-config update
    plans: store.vipPlans.map((p) => ({
      tier: p.tier,
      name: p.name,
      emoji: p.emoji,
      priceUsdt: p.priceUsdt,
      durationDays: p.durationDays,
      maxEnergy: p.maxEnergy,
      xpMultiplier: p.xpMultiplier,
      benefits: p.benefits,
    })),
  });
});

// ── GET /vip/status ───────────────────────────────────────────────────────────
router.get("/status", requireAuth, async (req, res) => {
  const user = req.user!;
  const now = new Date();
  const active = user.vipLevel > 0 && (!user.vipExpiresAt || user.vipExpiresAt > now);
  res.json({
    vipLevel: user.vipLevel,
    vipExpiresAt: user.vipExpiresAt?.toISOString() ?? null,
    active,
  });
});

// ── GET /vip/purchases ────────────────────────────────────────────────────────
router.get("/purchases", requireAuth, async (req, res) => {
  const purchases = await db
    .select()
    .from(vipPurchasesTable)
    .where(eq(vipPurchasesTable.userId, req.user!.id));
  res.json(
    purchases.map((p) => ({
      id: p.id,
      tier: p.tier,
      priceUsdt: parseFloat(String(p.priceUsdt)),
      durationDays: p.durationDays,
      txHash: p.txHash,
      walletSent: p.walletSent,
      status: p.status,
      rejectReason: p.rejectReason ?? null,
      createdAt: p.createdAt.toISOString(),
      approvedAt: p.approvedAt?.toISOString() ?? null,
    })),
  );
});

// ── POST /vip/purchase — auto-verifies on BscScan, activates immediately ──────
const vipPurchaseSchema = z.object({
  tier: z.number().int().min(1).max(5),
  txHash: z
    .string()
    .min(1, "txHash is required")
    .regex(/^0x[a-fA-F0-9]{64}$/, "Invalid txHash format (must be 0x + 64 hex chars)"),
});

router.post(
  "/purchase",
  requireAuth,
  validateBody(vipPurchaseSchema),
  async (req, res) => {
    const user = req.user!;
    const { tier, txHash } = req.body as z.infer<typeof vipPurchaseSchema>;

    // ── Wallet guard ──────────────────────────────────────────────────────
    const depositWallet = process.env.DEPOSIT_WALLET_ADDRESS || VIP_WALLET;
    if (!depositWallet || depositWallet === "TBD_SET_VIP_WALLET_ADDRESS") {
      res.status(503).json({ error: "Payment wallet not configured on server." });
      return;
    }

    // ── Plan guard ────────────────────────────────────────────────────────
    const plan = store.vipPlans.find((p) => p.tier === tier);
    if (!plan) {
      res.status(400).json({ error: "Invalid VIP tier" });
      return;
    }

    // ── Duplicate txHash check ────────────────────────────────────────────
    const existing = await db
      .select({ id: vipPurchasesTable.id, status: vipPurchasesTable.status })
      .from(vipPurchasesTable)
      .where(eq(vipPurchasesTable.txHash, txHash))
      .limit(1);

    if (existing.length > 0) {
      res.status(409).json({
        error: "This transaction hash has already been used.",
        existingStatus: existing[0].status,
      });
      return;
    }

    // ── Insert row as pending while we verify ─────────────────────────────
    const [purchase] = await db
      .insert(vipPurchasesTable)
      .values({
        userId: user.id,
        tier,
        priceUsdt: String(plan.priceUsdt),
        durationDays: plan.durationDays,
        txHash,
        walletSent: "auto-verified",   // no longer supplied by the user
        status: "pending",
      })
      .returning();

    // ── BscScan verification ──────────────────────────────────────────────
    let verificationResult;
    try {
      verificationResult = await verifyUsdtDeposit(txHash, depositWallet, plan.priceUsdt);
    } catch (err) {
      logger.error({ err, txHash }, "VIP purchase: unexpected verification error");
      await db
        .update(vipPurchasesTable)
        .set({ status: "pending", rejectReason: "Verification service error — admin will review." })
        .where(eq(vipPurchasesTable.id, purchase.id));
      res.json({
        id: purchase.id,
        tier,
        priceUsdt: plan.priceUsdt,
        status: "pending",
        message: "Payment submitted. Verification failed temporarily — you will be activated within 24h.",
      });
      return;
    }

    // ── Verification failed ───────────────────────────────────────────────
    if (!verificationResult.ok) {
      await db
        .update(vipPurchasesTable)
        .set({ status: "rejected", rejectReason: verificationResult.failReason })
        .where(eq(vipPurchasesTable.id, purchase.id));

      res.status(422).json({
        id: purchase.id,
        tier,
        priceUsdt: plan.priceUsdt,
        status: "rejected",
        failReason: verificationResult.failReason,
        message: verificationResult.failReason ?? "Verification failed.",
      });
      return;
    }

    // ── Activate VIP immediately ──────────────────────────────────────────
    const now = new Date();
    // Extend from current expiry if VIP is still active, otherwise from now
    const base =
      user.vipLevel > 0 && user.vipExpiresAt && user.vipExpiresAt > now
        ? user.vipExpiresAt.getTime()
        : now.getTime();
    const expiresAt = new Date(base + plan.durationDays * 24 * 60 * 60 * 1000);

    await Promise.all([
      db
        .update(vipPurchasesTable)
        .set({ status: "approved", approvedAt: now })
        .where(eq(vipPurchasesTable.id, purchase.id)),
      db
        .update(usersTable)
        .set({
          vipLevel: Math.max(user.vipLevel, tier),
          vipExpiresAt: expiresAt,
          maxEnergy: Math.max(user.maxEnergy, plan.maxEnergy),
        })
        .where(eq(usersTable.id, user.id)),
    ]);

    logger.info(
      { userId: user.id, tier, txHash, expiresAt },
      "VIP activated automatically",
    );

    res.json({
      id: purchase.id,
      tier,
      priceUsdt: plan.priceUsdt,
      status: "approved",
      message: `${plan.emoji} ${plan.name} VIP activated! Valid until ${expiresAt.toLocaleDateString()}.`,
    });
  },
);

export default router;
