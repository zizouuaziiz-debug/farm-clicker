/**
 * Deposit routes — BEP20 USDT auto-verification flow.
 *
 * POST /api/deposits/submit   — submit a txHash for instant on-chain verification
 * GET  /api/deposits/history  — current user's deposit history
 * GET  /api/deposits/wallet   — public: deposit wallet address + network info
 */
import { Router } from "express";
import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { db } from "@workspace/db";
import { depositsTable, usersTable } from "@workspace/db/schema";
import { requireAuth } from "../middlewares/requireAuth.js";
import { validateBody } from "../middlewares/validateBody.js";
import { verifyUsdtDeposit, USDT_CONTRACT_BSC } from "../lib/bscscan.js";
import { store } from "../lib/config-store.js";
import { logger } from "../lib/logger.js";

const router = Router();

// ── Wallet info (public) ──────────────────────────────────────────────────────
router.get("/wallet", (_req, res) => {
  const walletAddress = process.env.DEPOSIT_WALLET_ADDRESS ?? "";
  res.json({
    walletAddress,
    network: "BEP20 (BSC)",
    contractAddress: USDT_CONTRACT_BSC,
    coinsPerUsdt: store.economy.coinsPerUsdt,
  });
});

// ── Deposit history (authenticated) ──────────────────────────────────────────
router.get("/history", requireAuth, async (req, res) => {
  const rows = await db
    .select()
    .from(depositsTable)
    .where(eq(depositsTable.userId, req.user!.id))
    .orderBy(desc(depositsTable.createdAt))
    .limit(50);

  res.json(
    rows.map((d) => ({
      id: d.id,
      txHash: d.txHash,
      amountUsdt: parseFloat(String(d.amountUsdt)),
      coinsCredit: d.coinsCredit,
      status: d.status,
      failReason: d.failReason ?? null,
      verifiedAt: d.verifiedAt?.toISOString() ?? null,
      createdAt: d.createdAt.toISOString(),
    })),
  );
});

// ── Submit deposit (authenticated) ───────────────────────────────────────────
const submitDepositSchema = z.object({
  txHash: z
    .string()
    .min(1, "txHash is required")
    .regex(/^0x[a-fA-F0-9]{64}$/, "Invalid txHash format (must be 0x + 64 hex chars)"),
  amountUsdt: z
    .number()
    .positive("Amount must be positive")
    .max(100_000, "Amount too large"),
});

router.post("/submit", requireAuth, validateBody(submitDepositSchema), async (req, res) => {
  const user = req.user!;
  const { txHash, amountUsdt } = req.body as z.infer<typeof submitDepositSchema>;

  const depositWallet = process.env.DEPOSIT_WALLET_ADDRESS ?? "";
  if (!depositWallet) {
    res.status(503).json({ error: "Deposit wallet not configured on the server." });
    return;
  }

  // ── Duplicate check ────────────────────────────────────────────────────────
  const existing = await db
    .select({ id: depositsTable.id, status: depositsTable.status })
    .from(depositsTable)
    .where(eq(depositsTable.txHash, txHash))
    .limit(1);

  if (existing.length > 0) {
    res.status(409).json({
      error: "This transaction hash has already been submitted.",
      existingStatus: existing[0].status,
    });
    return;
  }

  // ── Insert as pending first ────────────────────────────────────────────────
  const coinsPerUsdt = store.economy.coinsPerUsdt;
  const [deposit] = await db
    .insert(depositsTable)
    .values({
      userId: user.id,
      txHash,
      amountUsdt: String(amountUsdt),
      coinsCredit: 0,
      status: "pending",
    })
    .returning();

  // ── Verify on-chain ────────────────────────────────────────────────────────
  let verificationResult;
  try {
    verificationResult = await verifyUsdtDeposit(txHash, depositWallet, amountUsdt);
  } catch (err) {
    logger.error({ err, txHash }, "Deposit: unexpected error during verification");
    // Keep as pending for admin to re-verify
    await db
      .update(depositsTable)
      .set({ status: "pending", failReason: "Verification service error. Will be retried." })
      .where(eq(depositsTable.id, deposit.id));
    res.json({
      id: deposit.id,
      status: "pending",
      message: "Deposit submitted. Verification is pending due to a temporary error.",
    });
    return;
  }

  if (!verificationResult.ok) {
    // Mark as failed
    await db
      .update(depositsTable)
      .set({ status: "failed", failReason: verificationResult.failReason })
      .where(eq(depositsTable.id, deposit.id));

    res.status(422).json({
      id: deposit.id,
      status: "failed",
      failReason: verificationResult.failReason,
      error: verificationResult.failReason,
    });
    return;
  }

  // ── Credit coins to user ───────────────────────────────────────────────────
  const confirmedUsdt = verificationResult.confirmedAmountUsdt ?? amountUsdt;
  // Credit based on the declared amount (not the confirmed amount) capped at
  // the confirmed amount, to prevent over-crediting on rounding.
  const creditUsdt = Math.min(amountUsdt, confirmedUsdt);
  const coinsToCredit = Math.floor(creditUsdt * coinsPerUsdt);
  const now = new Date();

  await Promise.all([
    db
      .update(depositsTable)
      .set({
        status: "completed",
        coinsCredit: coinsToCredit,
        verifiedAt: now,
      })
      .where(eq(depositsTable.id, deposit.id)),
    db
      .update(usersTable)
      .set({ coins: user.coins + coinsToCredit })
      .where(eq(usersTable.id, user.id)),
  ]);

  logger.info(
    { userId: user.id, txHash, amountUsdt, coinsToCredit },
    "Deposit verified and credited",
  );

  res.json({
    id: deposit.id,
    status: "completed",
    amountUsdt: creditUsdt,
    coinsCredit: coinsToCredit,
    message: `Deposit verified! ${coinsToCredit.toLocaleString()} coins have been credited to your account.`,
  });
});

export default router;
