import { Router } from "express";
import { z } from "zod";
import { validateBody } from "../middlewares/validateBody.js";
import { db } from "@workspace/db";

const vipPurchaseSchema = z.object({
  tier: z.number().int().min(1).max(3),
  txHash: z.string().min(1, "txHash is required"),
  walletSent: z.string().min(1, "walletSent is required"),
});
import { vipPurchasesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth.js";
import { VIP_WALLET, VIP_NETWORK } from "../lib/game-config.js";
import { store } from "../lib/config-store.js";

const router = Router();

router.get("/plans", async (_req, res) => {
  res.json({
    walletAddress: VIP_WALLET,
    network: VIP_NETWORK,
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

router.get("/status", requireAuth, async (req, res) => {
  const user = req.user!;
  const now = new Date();
  const active = user.vipLevel > 0 && (!user.vipExpiresAt || user.vipExpiresAt > now);
  res.json({
    vipLevel: user.vipLevel,
    vipExpiresAt: user.vipExpiresAt?.toISOString() || null,
    active,
  });
});

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
      rejectReason: p.rejectReason,
      createdAt: p.createdAt.toISOString(),
      approvedAt: p.approvedAt?.toISOString() || null,
    }))
  );
});

router.post("/purchase", requireAuth, validateBody(vipPurchaseSchema), async (req, res) => {
  const user = req.user!;
  const { tier, txHash, walletSent } = req.body as { tier?: number; txHash?: string; walletSent?: string };

  if (!tier || !txHash || !walletSent) {
    res.status(400).json({ error: "tier, txHash and walletSent are required" });
    return;
  }

  const plan = store.vipPlans.find((p) => p.tier === tier);
  if (!plan) {
    res.status(400).json({ error: "Invalid VIP tier" });
    return;
  }

  const [purchase] = await db
    .insert(vipPurchasesTable)
    .values({
      userId: user.id,
      tier,
      priceUsdt: String(plan.priceUsdt),
      durationDays: plan.durationDays,
      txHash,
      walletSent,
      status: "pending",
    })
    .returning();

  res.json({
    id: purchase.id,
    tier: purchase.tier,
    priceUsdt: parseFloat(String(purchase.priceUsdt)),
    status: purchase.status,
    message: "Your VIP purchase has been submitted and is pending review.",
  });
});

export default router;
