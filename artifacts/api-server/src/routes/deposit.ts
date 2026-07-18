import { Router } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { depositsTable, usersTable } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth.js";
import { validateBody } from "../middlewares/validateBody.js";
import { verifyUsdtDeposit, USDT_CONTRACT_BEP20 } from "../lib/bscscan.js";
import { BEP20_WALLET_ADDRESS, BEP20_MIN_DEPOSIT_USDT } from "../lib/game-config.js";
import { logger } from "../lib/logger.js";

const router = Router();

const submitDepositSchema = z.object({
  txHash: z
    .string()
    .min(1, "txHash is required")
    .regex(/^0x[a-fA-F0-9]{64}$/, "Invalid transaction hash format — must be a 66-character hex string starting with 0x"),
  amountUsdt: z.number().positive("Amount must be positive"),
});

/** GET /deposit/wallet — public endpoint; returns the deposit wallet details */
router.get("/wallet", (_req, res) => {
  res.json({
    walletAddress: BEP20_WALLET_ADDRESS,
    network: "BEP20 (BNB Smart Chain)",
    minDepositUsdt: BEP20_MIN_DEPOSIT_USDT,
    contractAddress: USDT_CONTRACT_BEP20,
  });
});

/** GET /deposit/history — authenticated; returns the current user's deposit history */
router.get("/history", requireAuth, async (req, res) => {
  const deposits = await db
    .select()
    .from(depositsTable)
    .where(eq(depositsTable.userId, req.user!.id))
    .orderBy(sql`${depositsTable.createdAt} desc`);

  res.json(
    deposits.map((d) => ({
      id: d.id,
      txHash: d.txHash,
      amountUsdt: parseFloat(String(d.amountUsdt)),
      status: d.status,
      failReason: d.failReason,
      network: d.network,
      confirmations: d.confirmations,
      verifiedAt: d.verifiedAt?.toISOString() ?? null,
      createdAt: d.createdAt.toISOString(),
    })),
  );
});

/**
 * POST /deposit/submit — authenticated; submits a BEP20 USDT deposit.
 *
 * Flow:
 *  1. Validate inputs.
 *  2. Check txHash is not already used (duplicate prevention).
 *  3. Create a "pending" deposit record.
 *  4. Call BscScan to verify the transaction.
 *  5. On success → credit user's USDT balance atomically, mark deposit "completed".
 *  6. On failure → mark deposit "failed" with reason.
 */
router.post("/submit", requireAuth, validateBody(submitDepositSchema), async (req, res) => {
  const { txHash, amountUsdt } = req.body as { txHash: string; amountUsdt: number };
  const userId = req.user!.id;

  // Normalise hash to lowercase
  const normalizedHash = txHash.toLowerCase().trim();

  // Check for minimum deposit
  if (amountUsdt < BEP20_MIN_DEPOSIT_USDT) {
    res.status(400).json({ error: `Minimum deposit is ${BEP20_MIN_DEPOSIT_USDT} USDT` });
    return;
  }

  // Duplicate txHash check
  const [existing] = await db
    .select({ id: depositsTable.id, status: depositsTable.status })
    .from(depositsTable)
    .where(eq(depositsTable.txHash, normalizedHash))
    .limit(1);

  if (existing) {
    res.status(409).json({ error: "This transaction hash has already been submitted." });
    return;
  }

  // Insert a pending deposit record first so the txHash is immediately reserved
  const [deposit] = await db
    .insert(depositsTable)
    .values({
      userId,
      txHash: normalizedHash,
      amountUsdt: String(amountUsdt),
      status: "pending",
      network: "BEP20",
    })
    .returning();

  // Verify on BscScan (backend only)
  let verifyResult;
  try {
    verifyResult = await verifyUsdtDeposit(normalizedHash, BEP20_WALLET_ADDRESS, BEP20_MIN_DEPOSIT_USDT);
  } catch (err) {
    logger.error({ err, depositId: deposit.id }, "BscScan verification error");
    await db
      .update(depositsTable)
      .set({ status: "failed", failReason: "Verification service error. Please contact support." })
      .where(eq(depositsTable.id, deposit.id));

    res.status(500).json({ error: "Could not reach verification service. Please try again later." });
    return;
  }

  if (!verifyResult.success) {
    // Mark as failed with reason
    await db
      .update(depositsTable)
      .set({ status: "failed", failReason: verifyResult.error ?? "Verification failed" })
      .where(eq(depositsTable.id, deposit.id));

    res.status(400).json({
      error: verifyResult.error ?? "Transaction verification failed.",
      depositId: deposit.id,
    });
    return;
  }

  // Verification passed — credit balance atomically
  const verifiedAmountUsdt = verifyResult.amountUsdt ?? amountUsdt;

  const [updatedUser] = await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(depositsTable)
      .set({
        status: "completed",
        amountUsdt: String(verifiedAmountUsdt),
        confirmations: verifyResult.confirmations,
        verifiedAt: new Date(),
      })
      .where(eq(depositsTable.id, deposit.id))
      .returning();

    const [user] = await tx
      .update(usersTable)
      .set({
        usdtBalance: sql`${usersTable.usdtBalance} + ${String(verifiedAmountUsdt)}`,
      })
      .where(eq(usersTable.id, userId))
      .returning({ usdtBalance: usersTable.usdtBalance });

    return [user];
  });

  res.json({
    id: deposit.id,
    status: "completed",
    amountUsdt: verifiedAmountUsdt,
    message: `${verifiedAmountUsdt.toFixed(2)} USDT successfully credited to your balance.`,
    usdtBalance: parseFloat(String(updatedUser.usdtBalance)),
  });
});

export default router;
