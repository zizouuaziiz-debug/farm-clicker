import { Router } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { usersTable, withdrawalsTable } from "@workspace/db/schema";
import { eq, and, gte, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth.js";
import { validateBody } from "../middlewares/validateBody.js";
import { store } from "../lib/config-store.js";

const withdrawRequestSchema = z.object({
  coinsAmount: z.number({ required_error: "coinsAmount is required" }).int().positive("coinsAmount must be positive"),
  usdtWallet: z.string({ required_error: "usdtWallet is required" }).min(10, "usdtWallet too short"),
  network: z.enum(["TRC20", "ERC20", "BEP20"]).optional().default("TRC20"),
});

const router = Router();

router.get("/info", requireAuth, async (_req, res) => {
  res.json({
    coinsPerUsdt: store.economy.coinsPerUsdt,
    minWithdrawalCoins: store.economy.minWithdrawalCoins,
    minWithdrawalUsdt: store.economy.minWithdrawalCoins / store.economy.coinsPerUsdt,
    networks: ["TRC20", "ERC20", "BEP20"],
  });
});

router.get("/history", requireAuth, async (req, res) => {
  const withdrawals = await db
    .select()
    .from(withdrawalsTable)
    .where(eq(withdrawalsTable.userId, req.user!.id));
  res.json(
    withdrawals.map((w) => ({
      id: w.id,
      coinsAmount: w.coinsAmount,
      usdtAmount: parseFloat(String(w.usdtAmount)),
      usdtWallet: w.usdtWallet,
      status: w.status,
      txHash: w.txHash,
      rejectReason: w.rejectReason,
      createdAt: w.createdAt.toISOString(),
      processedAt: w.processedAt?.toISOString() || null,
    }))
  );
});

router.post("/request", requireAuth, validateBody(withdrawRequestSchema), async (req, res) => {
  const user = req.user!;
  const { coinsAmount, usdtWallet, network } = req.body as { coinsAmount?: number; usdtWallet?: string; network?: string };

  if (!coinsAmount || !usdtWallet) {
    res.status(400).json({ error: "coinsAmount and usdtWallet are required" });
    return;
  }

  const validNetworks = ["TRC20", "ERC20", "BEP20"];
  const selectedNetwork = (network && validNetworks.includes(network)) ? network : "TRC20";
  if (coinsAmount < store.economy.minWithdrawalCoins) {
    res.status(400).json({ error: `Minimum withdrawal is ${store.economy.minWithdrawalCoins} coins` });
    return;
  }
  if (user.coins < coinsAmount) {
    res.status(400).json({ error: "Not enough coins" });
    return;
  }

  const usdtAmount = coinsAmount / store.economy.coinsPerUsdt;

  const withdrawal = await db.transaction(async (tx) => {
    // Atomic conditional decrement: only deducts if the user still has
    // enough coins at commit time, preventing double-spend from concurrent
    // withdrawal requests racing against the earlier read of `user.coins`.
    const [updated] = await tx
      .update(usersTable)
      .set({ coins: sql`${usersTable.coins} - ${coinsAmount}` })
      .where(and(eq(usersTable.id, user.id), gte(usersTable.coins, coinsAmount)))
      .returning();

    if (!updated) return null;

    const [w] = await tx
      .insert(withdrawalsTable)
      .values({
        userId: user.id,
        coinsAmount,
        usdtAmount: String(usdtAmount),
        usdtWallet,
        network: selectedNetwork,
        status: "pending",
      })
      .returning();

    return w;
  });

  if (!withdrawal) {
    res.status(400).json({ error: "Not enough coins" });
    return;
  }

  res.json({
    id: withdrawal.id,
    coinsAmount,
    usdtAmount,
    usdtWallet,
    status: "pending",
    message: "Your withdrawal request has been submitted.",
  });
});

export default router;
