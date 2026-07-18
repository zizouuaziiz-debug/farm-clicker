import { Router } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { usersTable, withdrawalsTable, vipPurchasesTable, adminLogsTable, adminUsersTable, depositsTable } from "@workspace/db/schema";
import { eq, ilike, or, desc, count, sum, and, sql } from "drizzle-orm";
import { requireAdminAuth } from "../middlewares/requireAdminAuth.js";
import { requirePermission } from "../middlewares/requirePermission.js";
import { validateBody } from "../middlewares/validateBody.js";
import { serializeUser } from "./auth.js";
import { parsePagination } from "../lib/pagination.js";
import { verifyUsdtDeposit } from "../lib/bscscan.js";
import { BEP20_WALLET_ADDRESS, BEP20_MIN_DEPOSIT_USDT } from "../lib/game-config.js";

const patchUserSchema = z.object({
  isBanned: z.boolean().optional(),
  isAdmin: z.boolean().optional(),
  vipLevel: z.number().int().min(0).max(3).optional(),
  coins: z.number().int().min(0).optional(),
  xp: z.number().int().min(0).optional(),
  resetProgress: z.boolean().optional(),
});

const approveWithdrawalSchema = z.object({
  txHash: z.string().min(1, "txHash is required"),
  adminNotes: z.string().optional(),
});

const rejectSchema = z.object({
  reason: z.string().optional(),
  adminNotes: z.string().optional(),
});

const approveVipSchema = z.object({
  adminNotes: z.string().optional(),
});
import { VIP_TIER_NAMES, VIP_TIER_EMOJIS, getLevelForXp, type CropConfig, type VipConfig } from "../lib/game-config.js";
import { store, saveConfig, getMaxEnergyFromStore } from "../lib/config-store.js";

const router = Router();
router.use(requireAdminAuth);

router.get("/stats", async (_req, res) => {
  // These six aggregates are independent — run them concurrently instead of
  // one round trip at a time.
  const [[userStats], [pendingW], [pendingVip], [completedW], [bannedUsers], [vipUsers]] = await Promise.all([
    db.select({ total: count(usersTable.id), totalCoins: sum(usersTable.coins) }).from(usersTable),
    db.select({ count: count() }).from(withdrawalsTable).where(eq(withdrawalsTable.status, "pending")),
    db.select({ count: count() }).from(vipPurchasesTable).where(eq(vipPurchasesTable.status, "pending")),
    db.select({ count: count() }).from(withdrawalsTable).where(eq(withdrawalsTable.status, "completed")),
    db.select({ count: count() }).from(usersTable).where(eq(usersTable.isBanned, true)),
    db.select({ count: count() }).from(usersTable).where(sql`${usersTable.vipLevel} > 0`),
  ]);

  res.json({
    totalUsers: Number(userStats?.total ?? 0),
    totalCoinsInCirculation: Number(userStats?.totalCoins ?? 0),
    pendingWithdrawals: Number(pendingW?.count ?? 0),
    pendingVipPurchases: Number(pendingVip?.count ?? 0),
    totalWithdrawalsCompleted: Number(completedW?.count ?? 0),
    activeUsers: Number(userStats?.total ?? 0),
    bannedUsers: Number(bannedUsers?.count ?? 0),
    vipUsers: Number(vipUsers?.count ?? 0),
  });
});

router.get("/users", async (req, res) => {
  const { limit, offset } = parsePagination(req);
  const search = String(req.query.search || "");

  const users = search
    ? await db
        .select()
        .from(usersTable)
        .where(or(ilike(usersTable.username, `%${search}%`), ilike(usersTable.telegramId, `%${search}%`)))
        .orderBy(desc(usersTable.createdAt))
        .limit(limit)
        .offset(offset)
    : await db.select().from(usersTable).orderBy(desc(usersTable.createdAt)).limit(limit).offset(offset);

  const [{ total }] = await db.select({ total: count() }).from(usersTable);

  res.json({ users: users.map(serializeUser), total: Number(total), limit, offset });
});

router.get("/users/:id", async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  res.json(serializeUser(user));
});

router.patch("/users/:id", requirePermission("manage_users"), validateBody(patchUserSchema), async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  const { isBanned, isAdmin, vipLevel, coins, xp, resetProgress } = req.body as {
    isBanned?: boolean;
    isAdmin?: boolean;
    vipLevel?: number;
    coins?: number;
    xp?: number;
    resetProgress?: boolean;
  };

  const [existing] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
  if (!existing) { res.status(404).json({ error: "User not found" }); return; }

  if (resetProgress) {
    const [updated] = await db
      .update(usersTable)
      .set({
        coins: 0,
        xp: 0,
        level: 1,
        vipLevel: 0,
        vipExpiresAt: null,
        maxEnergy: 50,
        energy: 50,
        currentStreak: 0,
        longestStreak: 0,
        totalHarvests: 0,
        cropsHarvestedWheat: 0,
        cropsHarvestedSunflower: 0,
        cropsHarvestedTomato: 0,
        cropsHarvestedCarrot: 0,
        cropsHarvestedPotato: 0,
        cropsHarvestedCorn: 0,
      })
      .where(eq(usersTable.id, id))
      .returning();

    await db.insert(adminLogsTable).values({
      adminId: req.adminUser!.id,
      action: "reset_progress",
      targetType: "user",
      targetId: String(id),
      details: `Reset progress for user ${existing.username}`,
      ipAddress: (Array.isArray(req.ip) ? req.ip[0] : req.ip) ?? "unknown",
    });

    res.json(serializeUser(updated));
    return;
  }

  const updates: Partial<typeof usersTable.$inferInsert> = {};
  if (isBanned !== undefined) updates.isBanned = isBanned;
  if (isAdmin !== undefined) updates.isAdmin = isAdmin;
  if (typeof coins === "number") updates.coins = Math.max(0, coins);
  if (typeof xp === "number") {
    updates.xp = Math.max(0, xp);
    updates.level = getLevelForXp(Math.max(0, xp));
  }
  if (vipLevel !== undefined) {
    updates.vipLevel = vipLevel;
    updates.maxEnergy = getMaxEnergyFromStore(vipLevel);
    if (vipLevel > 0) {
      updates.vipExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    } else {
      updates.vipExpiresAt = null;
    }
  }

  const [updated] = await db.update(usersTable).set(updates).where(eq(usersTable.id, id)).returning();

  const changedFields = Object.keys(updates).join(", ");
  await db.insert(adminLogsTable).values({
    adminId: req.adminUser!.id,
    action: "update_user",
    targetType: "user",
    targetId: String(id),
    details: `Updated user ${existing.username}: ${changedFields}`,
    ipAddress: (Array.isArray(req.ip) ? req.ip[0] : req.ip) ?? "unknown",
  });

  res.json(serializeUser(updated));
});

router.get("/withdrawals", async (req, res) => {
  const status = req.query.status as string | undefined;

  const rows = status
    ? await db
        .select({ w: withdrawalsTable, u: { id: usersTable.id, username: usersTable.username, telegramId: usersTable.telegramId } })
        .from(withdrawalsTable)
        .leftJoin(usersTable, eq(withdrawalsTable.userId, usersTable.id))
        .where(eq(withdrawalsTable.status, status))
        .orderBy(desc(withdrawalsTable.createdAt))
    : await db
        .select({ w: withdrawalsTable, u: { id: usersTable.id, username: usersTable.username, telegramId: usersTable.telegramId } })
        .from(withdrawalsTable)
        .leftJoin(usersTable, eq(withdrawalsTable.userId, usersTable.id))
        .orderBy(desc(withdrawalsTable.createdAt));

  res.json(
    rows.map(({ w, u }) => ({
      id: w.id,
      userId: w.userId,
      username: u?.username ?? "",
      telegramId: u?.telegramId ?? "",
      coinsAmount: w.coinsAmount,
      usdtAmount: parseFloat(String(w.usdtAmount)),
      usdtWallet: w.usdtWallet,
      network: w.network,
      status: w.status,
      txHash: w.txHash,
      rejectReason: w.rejectReason,
      adminNotes: w.adminNotes,
      createdAt: w.createdAt.toISOString(),
      processedAt: w.processedAt?.toISOString() || null,
    }))
  );
});

router.post("/withdrawals/:id/approve", requirePermission("manage_withdrawals"), validateBody(approveWithdrawalSchema), async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  const { txHash, adminNotes } = req.body as { txHash?: string; adminNotes?: string };

  if (!txHash) { res.status(400).json({ error: "txHash is required" }); return; }

  const [updated] = await db
    .update(withdrawalsTable)
    .set({ status: "completed", txHash, adminNotes: adminNotes || null, processedAt: new Date() })
    .where(and(eq(withdrawalsTable.id, id), eq(withdrawalsTable.status, "pending")))
    .returning();

  if (!updated) {
    const [existing] = await db.select().from(withdrawalsTable).where(eq(withdrawalsTable.id, id)).limit(1);
    if (!existing) { res.status(404).json({ error: "Not found" }); return; }
    res.status(409).json({ error: `Withdrawal is already ${existing.status}` });
    return;
  }

  await db.insert(adminLogsTable).values({
    adminId: req.adminUser!.id,
    action: "approve_withdrawal",
    targetType: "withdrawal",
    targetId: String(id),
    details: `Approved withdrawal of ${updated.coinsAmount} coins / ${updated.usdtAmount} USDT. TX: ${txHash}`,
    ipAddress: (Array.isArray(req.ip) ? req.ip[0] : req.ip) ?? "unknown",
  });

  res.json({ success: true, id, status: "completed" });
});

router.post("/withdrawals/:id/reject", requirePermission("manage_withdrawals"), validateBody(rejectSchema), async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  const { reason, adminNotes } = req.body as { reason?: string; adminNotes?: string };

  const refunded = await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(withdrawalsTable)
      .set({ status: "rejected", rejectReason: reason || null, adminNotes: adminNotes || null, processedAt: new Date() })
      .where(and(eq(withdrawalsTable.id, id), eq(withdrawalsTable.status, "pending")))
      .returning();

    if (!updated) return null;

    await tx
      .update(usersTable)
      .set({ coins: sql`${usersTable.coins} + ${updated.coinsAmount}` })
      .where(eq(usersTable.id, updated.userId));

    return updated;
  });

  if (!refunded) {
    const [existing] = await db.select().from(withdrawalsTable).where(eq(withdrawalsTable.id, id)).limit(1);
    if (!existing) { res.status(404).json({ error: "Not found" }); return; }
    res.status(409).json({ error: `Withdrawal is already ${existing.status}` });
    return;
  }

  await db.insert(adminLogsTable).values({
    adminId: req.adminUser!.id,
    action: "reject_withdrawal",
    targetType: "withdrawal",
    targetId: String(id),
    details: `Rejected withdrawal ${id}. Reason: ${reason || "none"}`,
    ipAddress: (Array.isArray(req.ip) ? req.ip[0] : req.ip) ?? "unknown",
  });

  res.json({ success: true, id, status: "rejected" });
});

router.get("/vip-purchases", async (req, res) => {
  const status = req.query.status as string | undefined;

  const rows = status
    ? await db
        .select({ v: vipPurchasesTable, u: { id: usersTable.id, username: usersTable.username, telegramId: usersTable.telegramId } })
        .from(vipPurchasesTable)
        .leftJoin(usersTable, eq(vipPurchasesTable.userId, usersTable.id))
        .where(eq(vipPurchasesTable.status, status))
        .orderBy(desc(vipPurchasesTable.createdAt))
    : await db
        .select({ v: vipPurchasesTable, u: { id: usersTable.id, username: usersTable.username, telegramId: usersTable.telegramId } })
        .from(vipPurchasesTable)
        .leftJoin(usersTable, eq(vipPurchasesTable.userId, usersTable.id))
        .orderBy(desc(vipPurchasesTable.createdAt));

  res.json(
    rows.map(({ v, u }) => ({
      id: v.id,
      userId: v.userId,
      username: u?.username ?? "",
      telegramId: u?.telegramId ?? "",
      tier: v.tier,
      tierName: VIP_TIER_NAMES[v.tier] || `Tier ${v.tier}`,
      tierEmoji: VIP_TIER_EMOJIS[v.tier] || "💎",
      priceUsdt: parseFloat(String(v.priceUsdt)),
      durationDays: v.durationDays,
      txHash: v.txHash,
      walletSent: v.walletSent,
      screenshotUrl: v.screenshotUrl,
      status: v.status,
      rejectReason: v.rejectReason,
      adminNotes: v.adminNotes,
      createdAt: v.createdAt.toISOString(),
      approvedAt: v.approvedAt?.toISOString() || null,
    }))
  );
});

router.post("/vip-purchases/:id/approve", requirePermission("manage_vip"), validateBody(approveVipSchema), async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  const { adminNotes } = req.body as { adminNotes?: string };

  const approved = await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(vipPurchasesTable)
      .set({ status: "approved", adminNotes: adminNotes || null, approvedAt: new Date() })
      .where(and(eq(vipPurchasesTable.id, id), eq(vipPurchasesTable.status, "pending")))
      .returning();

    if (!updated) return null;

    const [currentUser] = await tx.select().from(usersTable).where(eq(usersTable.id, updated.userId)).limit(1);
    const now = new Date();
    const baseTime = currentUser?.vipExpiresAt && currentUser.vipExpiresAt > now ? currentUser.vipExpiresAt : now;
    const vipExpiresAt = new Date(baseTime.getTime() + updated.durationDays * 24 * 60 * 60 * 1000);
    const maxEnergy = getMaxEnergyFromStore(updated.tier);

    await tx
      .update(usersTable)
      .set({ vipLevel: updated.tier, vipExpiresAt, maxEnergy })
      .where(eq(usersTable.id, updated.userId));

    return updated;
  });

  if (!approved) {
    const [existing] = await db.select().from(vipPurchasesTable).where(eq(vipPurchasesTable.id, id)).limit(1);
    if (!existing) { res.status(404).json({ error: "Not found" }); return; }
    res.status(409).json({ error: `VIP purchase is already ${existing.status}` });
    return;
  }

  await db.insert(adminLogsTable).values({
    adminId: req.adminUser!.id,
    action: "approve_vip",
    targetType: "vip_purchase",
    targetId: String(id),
    details: `Approved VIP tier ${approved.tier} purchase for user ${approved.userId}`,
    ipAddress: (Array.isArray(req.ip) ? req.ip[0] : req.ip) ?? "unknown",
  });

  res.json({ success: true, id, status: "approved" });
});

router.post("/vip-purchases/:id/reject", requirePermission("manage_vip"), validateBody(rejectSchema), async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  const { reason, adminNotes } = req.body as { reason?: string; adminNotes?: string };

  const [updated] = await db
    .update(vipPurchasesTable)
    .set({ status: "rejected", rejectReason: reason || null, adminNotes: adminNotes || null })
    .where(and(eq(vipPurchasesTable.id, id), eq(vipPurchasesTable.status, "pending")))
    .returning();

  if (!updated) {
    const [existing] = await db.select().from(vipPurchasesTable).where(eq(vipPurchasesTable.id, id)).limit(1);
    if (!existing) { res.status(404).json({ error: "Not found" }); return; }
    res.status(409).json({ error: `VIP purchase is already ${existing.status}` });
    return;
  }

  await db.insert(adminLogsTable).values({
    adminId: req.adminUser!.id,
    action: "reject_vip",
    targetType: "vip_purchase",
    targetId: String(id),
    details: `Rejected VIP purchase ${id}. Reason: ${reason || "none"}`,
    ipAddress: (Array.isArray(req.ip) ? req.ip[0] : req.ip) ?? "unknown",
  });

  res.json({ success: true, id, status: "rejected" });
});

router.get("/logs", async (req, res) => {
  const { page, limit, offset } = parsePagination(req, { defaultLimit: 50, maxLimit: 100 });

  const logs = await db
    .select({
      log: adminLogsTable,
      admin: { id: adminUsersTable.id, name: adminUsersTable.name, email: adminUsersTable.email },
    })
    .from(adminLogsTable)
    .leftJoin(adminUsersTable, eq(adminLogsTable.adminId, adminUsersTable.id))
    .orderBy(desc(adminLogsTable.createdAt))
    .limit(limit)
    .offset(offset);

  const [{ total }] = await db.select({ total: count() }).from(adminLogsTable);

  res.json({
    logs: logs.map(({ log, admin }) => ({
      id: log.id,
      adminId: log.adminId,
      adminName: admin?.name || "System",
      adminEmail: admin?.email || "",
      action: log.action,
      targetType: log.targetType,
      targetId: log.targetId,
      details: log.details,
      ipAddress: log.ipAddress,
      createdAt: log.createdAt.toISOString(),
    })),
    total: Number(total),
    page,
    limit,
  });
});

function buildGameConfigResponse() {
  const { coinsPerUsdt, minWithdrawalCoins, withdrawNetworks } = store.economy;
  return {
    crops: Object.values(store.crops).map((c) => ({
      cropType: c.cropType,
      name: c.name,
      emoji: c.emoji,
      buyCost: c.buyCost,
      sellPrice: c.sellPrice,
      growTimeMinutes: Math.round(c.growTimeMs / 60000),
      waterNeeded: c.waterNeeded,
      requiredLevel: c.requiredLevel,
      xpReward: c.xpReward,
      coinsPerHarvest: c.coinsPerHarvest,
    })),
    vipPlans: store.vipPlans,
    withdrawNetworks,
    coinsPerUsdt,
    minWithdrawalCoins,
    minWithdrawalUsdt: coinsPerUsdt > 0 ? minWithdrawalCoins / coinsPerUsdt : 0,
  };
}

router.get("/game-config", (_req, res) => {
  res.json(buildGameConfigResponse());
});

// ── PATCH /game-config ────────────────────────────────────────────────────────

const patchCropItemSchema = z.object({
  cropType: z.string(),
  buyCost: z.number().int().min(0),
  sellPrice: z.number().int().min(0),
  growTimeMinutes: z.number().int().min(1),
  waterNeeded: z.number().int().min(0),
  requiredLevel: z.number().int().min(1),
  xpReward: z.number().int().min(0),
  coinsPerHarvest: z.number().int().min(0),
});

const patchVipItemSchema = z.object({
  tier: z.number().int().min(1).max(5),
  priceUsdt: z.number().min(0),
  durationDays: z.number().int().min(1),
  maxEnergy: z.number().int().min(1),
  xpMultiplier: z.number().min(1),
  growSpeedMultiplier: z.number().min(1),
  maxSlots: z.number().int().min(1),
  benefits: z.array(z.string()),
});

const patchEconomySchema = z.object({
  coinsPerUsdt: z.number().int().min(1),
  minWithdrawalCoins: z.number().int().min(0),
  withdrawNetworks: z.array(z.string().min(1)).min(1),
});

const patchGameConfigSchema = z.object({
  crops: z.array(patchCropItemSchema).optional(),
  vipPlans: z.array(patchVipItemSchema).optional(),
  economy: patchEconomySchema.optional(),
});

router.patch("/game-config", validateBody(patchGameConfigSchema), async (req, res) => {
  const { crops, vipPlans, economy } = req.body as z.infer<typeof patchGameConfigSchema>;
  const changed: string[] = [];

  if (crops && crops.length > 0) {
    const updatedCrops: Record<string, CropConfig> = { ...store.crops };
    for (const c of crops) {
      if (!updatedCrops[c.cropType]) continue; // ignore unknown crop types
      updatedCrops[c.cropType] = {
        ...updatedCrops[c.cropType],
        buyCost: c.buyCost,
        sellPrice: c.sellPrice,
        growTimeMs: c.growTimeMinutes * 60 * 1000,
        waterNeeded: c.waterNeeded,
        requiredLevel: c.requiredLevel,
        xpReward: c.xpReward,
        coinsPerHarvest: c.coinsPerHarvest,
      };
    }
    store.crops = updatedCrops;
    await saveConfig("crops", updatedCrops);
    changed.push("crops");
  }

  if (vipPlans && vipPlans.length > 0) {
    const updatedPlans: VipConfig[] = store.vipPlans.map((p) => {
      const patch = vipPlans.find((v) => v.tier === p.tier);
      return patch
        ? {
            ...p,
            priceUsdt: patch.priceUsdt,
            durationDays: patch.durationDays,
            maxEnergy: patch.maxEnergy,
            xpMultiplier: patch.xpMultiplier,
            growSpeedMultiplier: patch.growSpeedMultiplier,
            maxSlots: patch.maxSlots,
            benefits: patch.benefits.filter(Boolean),
          }
        : p;
    });
    store.vipPlans = updatedPlans;
    await saveConfig("vip_plans", updatedPlans);
    changed.push("vip_plans");
  }

  if (economy) {
    store.economy = {
      coinsPerUsdt: economy.coinsPerUsdt,
      minWithdrawalCoins: economy.minWithdrawalCoins,
      withdrawNetworks: economy.withdrawNetworks,
    };
    await saveConfig("economy", store.economy);
    changed.push("economy");
  }

  if (changed.length === 0) {
    res.status(400).json({ error: "No valid sections provided" });
    return;
  }

  await db.insert(adminLogsTable).values({
    adminId: req.adminUser!.id,
    action: "update_game_config",
    targetType: "game_config",
    targetId: "game_config",
    details: `Updated game config sections: ${changed.join(", ")}`,
    ipAddress: (Array.isArray(req.ip) ? req.ip[0] : req.ip) ?? "unknown",
  });

  res.json(buildGameConfigResponse());
});

// ── Deposits ─────────────────────────────────────────────────────────────────

router.get("/deposits", async (req, res) => {
  const { limit, offset } = parsePagination(req);
  const status = req.query.status as string | undefined;

  const baseQuery = db
    .select({
      id: depositsTable.id,
      userId: depositsTable.userId,
      username: usersTable.username,
      telegramId: usersTable.telegramId,
      txHash: depositsTable.txHash,
      amountUsdt: depositsTable.amountUsdt,
      status: depositsTable.status,
      failReason: depositsTable.failReason,
      network: depositsTable.network,
      confirmations: depositsTable.confirmations,
      verifiedAt: depositsTable.verifiedAt,
      createdAt: depositsTable.createdAt,
    })
    .from(depositsTable)
    .innerJoin(usersTable, eq(depositsTable.userId, usersTable.id));

  const deposits = status
    ? await baseQuery.where(eq(depositsTable.status, status)).orderBy(desc(depositsTable.createdAt)).limit(limit).offset(offset)
    : await baseQuery.orderBy(desc(depositsTable.createdAt)).limit(limit).offset(offset);

  const [{ total }] = await db.select({ total: count() }).from(depositsTable);

  res.json({
    deposits: deposits.map((d) => ({
      id: d.id,
      userId: d.userId,
      username: d.username,
      telegramId: d.telegramId,
      txHash: d.txHash,
      amountUsdt: parseFloat(String(d.amountUsdt)),
      status: d.status,
      failReason: d.failReason,
      network: d.network,
      confirmations: d.confirmations,
      verifiedAt: d.verifiedAt?.toISOString() ?? null,
      createdAt: d.createdAt.toISOString(),
    })),
    total: Number(total),
    limit,
    offset,
  });
});

router.post("/deposits/:id/reverify", async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  const [deposit] = await db.select().from(depositsTable).where(eq(depositsTable.id, id)).limit(1);

  if (!deposit) { res.status(404).json({ error: "Deposit not found" }); return; }
  if (deposit.status === "completed") {
    res.json({ success: true, id, status: "completed", message: "Already completed." }); return;
  }

  const result = await verifyUsdtDeposit(deposit.txHash, BEP20_WALLET_ADDRESS, BEP20_MIN_DEPOSIT_USDT);

  if (result.success) {
    const verifiedAmount = result.amountUsdt ?? parseFloat(String(deposit.amountUsdt));

    await db.transaction(async (tx) => {
      await tx.update(depositsTable).set({
        status: "completed",
        amountUsdt: String(verifiedAmount),
        confirmations: result.confirmations,
        verifiedAt: new Date(),
        failReason: null,
      }).where(eq(depositsTable.id, id));

      await tx.update(usersTable)
        .set({ usdtBalance: sql`${usersTable.usdtBalance} + ${String(verifiedAmount)}` })
        .where(eq(usersTable.id, deposit.userId));
    });

    await db.insert(adminLogsTable).values({
      adminId: req.adminUser!.id,
      action: "reverify_deposit",
      targetType: "deposit",
      targetId: String(id),
      details: `Re-verified deposit #${id}: ${verifiedAmount} USDT credited`,
      ipAddress: (Array.isArray(req.ip) ? req.ip[0] : req.ip) ?? "unknown",
    });

    res.json({ success: true, id, status: "completed", amountUsdt: verifiedAmount });
  } else {
    await db.update(depositsTable)
      .set({ status: "failed", failReason: result.error ?? "Verification failed" })
      .where(eq(depositsTable.id, id));

    res.json({ success: false, id, status: "failed", error: result.error });
  }
});

export default router;
