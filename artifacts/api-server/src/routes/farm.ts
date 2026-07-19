import { Router } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { usersTable, plotsTable, inventoryTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth.js";
import { validateBody } from "../middlewares/validateBody.js";

const plantSchema = z.object({
  slot: z.number().int().min(0, "slot must be 0 or greater"),
  cropType: z.string().min(1, "cropType is required"),
});
import { serializeUser } from "./auth.js";
import {
  CROP_HARVEST_FIELDS,
  ENERGY_PER_PLANT,
  getLevelForXp,
  getSlotsForVip,
} from "../lib/game-config.js";
import { store } from "../lib/config-store.js";
import { incrementMissionProgress } from "./missions.js";

const router = Router();

export type PlotState = "empty" | "planted" | "growing" | "needs_water" | "ready" | "withered" | "dead";

export function derivePlotState(plot: { state: string; cropType: string | null; plantedAt: Date | null; readyAt: Date | null; wateredAt: Date | null; waterStage: number | null; witheredAt: Date | null }, now: Date): PlotState {
  if (plot.state === "empty" || !plot.cropType || !plot.plantedAt) return "empty";

  const crop = store.crops[plot.cropType];
  if (!crop) return "empty";

  const readyAt = plot.readyAt ? new Date(plot.readyAt) : null;
  const witheredAt = plot.witheredAt ? new Date(plot.witheredAt) : null;

  // Check dead (past wither deadline)
  if (witheredAt && now > witheredAt) return "dead";

  // Check ready / withered (past ready but before dead)
  if (readyAt && now >= readyAt) {
    const witherStart = new Date(readyAt.getTime() + crop.witherGraceMs);
    if (witheredAt && now >= witherStart) return "withered";
    return "ready";
  }

  // Growing - check if needs water
  const waterStage = plot.waterStage ?? 0;
  if (waterStage < crop.waterNeeded) {
    const elapsed = now.getTime() - plot.plantedAt.getTime();
    const halfWay = crop.growTimeMs / 2;
    if (elapsed >= halfWay) return "needs_water";
  }

  return "growing";
}

function serializePlot(plot: typeof plotsTable.$inferSelect, now: Date) {
  const state = derivePlotState(plot, now);
  let growthPercent: number | null = null;

  if (state !== "empty" && plot.plantedAt && plot.readyAt) {
    const total = new Date(plot.readyAt).getTime() - new Date(plot.plantedAt).getTime();
    const elapsed = now.getTime() - new Date(plot.plantedAt).getTime();
    growthPercent = Math.min(100, Math.floor((elapsed / total) * 100));
  }

  return {
    id: plot.id,
    slot: plot.slot,
    state,
    cropType: plot.cropType,
    plantedAt: plot.plantedAt?.toISOString() || null,
    readyAt: plot.readyAt?.toISOString() || null,
    wateredAt: plot.wateredAt?.toISOString() || null,
    waterStage: plot.waterStage,
    growthPercent,
  };
}

async function getOrCreatePlots(userId: number, slotCount: number) {
  const existing = await db.select().from(plotsTable).where(eq(plotsTable.userId, userId));

  const toCreate: typeof plotsTable.$inferInsert[] = [];
  for (let i = 0; i < slotCount; i++) {
    if (!existing.find((p) => p.slot === i)) {
      toCreate.push({ userId, slot: i, state: "empty" });
    }
  }

  if (toCreate.length > 0) {
    await db.insert(plotsTable).values(toCreate);
  }

  return db.select().from(plotsTable).where(eq(plotsTable.userId, userId));
}

router.get("/plots", requireAuth, async (req, res) => {
  const user = req.user!;
  const slotCount = getSlotsForVip(user.vipLevel);
  const plots = await getOrCreatePlots(user.id, slotCount);
  const now = new Date();
  res.json(plots.map((p) => serializePlot(p, now)));
});

router.post("/plant", requireAuth, validateBody(plantSchema), async (req, res) => {
  const user = req.user!;
  const { slot, cropType } = req.body as { slot?: number; cropType?: string };

  if (slot === undefined || !cropType) {
    res.status(400).json({ error: "slot and cropType are required" });
    return;
  }

  const crop = store.crops[cropType];
  if (!crop) {
    res.status(400).json({ error: "Unknown crop type" });
    return;
  }

  if (user.level < crop.requiredLevel) {
    res.status(400).json({ error: `Requires level ${crop.requiredLevel}` });
    return;
  }

  if (user.energy < ENERGY_PER_PLANT) {
    res.status(400).json({ error: "Not enough energy" });
    return;
  }

  // Check seed in inventory
  const slotCount = getSlotsForVip(user.vipLevel);
  const plots = await getOrCreatePlots(user.id, slotCount);
  const plot = plots.find((p) => p.slot === slot);

  if (!plot) {
    res.status(400).json({ error: "Invalid slot" });
    return;
  }

  const now = new Date();
  const currentState = derivePlotState(plot, now);
  if (currentState !== "empty" && currentState !== "dead") {
    res.status(400).json({ error: "Slot is not empty" });
    return;
  }

  // Deduct seed from inventory
  const [invItem] = await db
    .select()
    .from(inventoryTable)
    .where(and(eq(inventoryTable.userId, user.id), eq(inventoryTable.itemType, `${cropType}_seed`)))
    .limit(1);

  if (!invItem || invItem.quantity < 1) {
    res.status(400).json({ error: "No seeds in inventory" });
    return;
  }

  const readyAt = new Date(now.getTime() + crop.growTimeMs);
  const witheredAt = new Date(readyAt.getTime() + crop.witherGraceMs * 2);

  await db.transaction(async (tx) => {
    await tx
      .update(inventoryTable)
      .set({ quantity: invItem.quantity - 1 })
      .where(eq(inventoryTable.id, invItem.id));

    await tx
      .update(usersTable)
      .set({ energy: user.energy - ENERGY_PER_PLANT })
      .where(eq(usersTable.id, user.id));

    await tx
      .update(plotsTable)
      .set({
        state: "growing",
        cropType,
        plantedAt: now,
        readyAt,
        wateredAt: null,
        waterStage: 0,
        witheredAt,
      })
      .where(eq(plotsTable.id, plot.id));
  });

  const [updatedPlot] = await db.select().from(plotsTable).where(eq(plotsTable.id, plot.id)).limit(1);
  res.json(serializePlot(updatedPlot, new Date()));
});

router.post("/harvest/:plotId", requireAuth, async (req, res) => {
  const user = req.user!;
  const plotId = parseInt(String(req.params.plotId), 10);

  const [plot] = await db
    .select()
    .from(plotsTable)
    .where(and(eq(plotsTable.id, plotId), eq(plotsTable.userId, user.id)))
    .limit(1);

  if (!plot) {
    res.status(404).json({ error: "Plot not found" });
    return;
  }

  const now = new Date();
  const state = derivePlotState(plot, now);

  if (state !== "ready" && state !== "withered" && state !== "dead") {
    res.status(400).json({ error: "Plot is not ready to harvest" });
    return;
  }

  // Dead plots are simply cleared with no rewards, so players can replant.
  if (state === "dead") {
    await db
      .update(plotsTable)
      .set({ state: "empty", cropType: null, plantedAt: null, readyAt: null, wateredAt: null, waterStage: 0, witheredAt: null })
      .where(eq(plotsTable.id, plot.id));

    res.json({
      cropType: plot.cropType,
      quantity: 0,
      coinsEarned: 0,
      xpEarned: 0,
      levelUp: false,
      user: serializeUser(user),
    });
    return;
  }

  const crop = store.crops[plot.cropType!];
  if (!crop) {
    res.status(400).json({ error: "Invalid crop" });
    return;
  }

  const xpGain = Math.floor(crop.xpReward * (user.vipLevel > 0 ? (user.vipLevel === 1 ? 1.5 : user.vipLevel === 2 ? 2 : 3) : 1));
  const coinsGain = 0;
  const newXp = user.xp + xpGain;
  const newCoins = user.coins + coinsGain;
  const newLevel = getLevelForXp(newXp);
  const levelUp = newLevel > user.level;

  // Update inventory
  const [existingItem] = await db
    .select()
    .from(inventoryTable)
    .where(and(eq(inventoryTable.userId, user.id), eq(inventoryTable.itemType, plot.cropType!)))
    .limit(1);

  const cropField = CROP_HARVEST_FIELDS[plot.cropType!] ?? "cropsHarvestedWheat";

  await db.transaction(async (tx) => {
    // Clear plot
    await tx
      .update(plotsTable)
      .set({ state: "empty", cropType: null, plantedAt: null, readyAt: null, wateredAt: null, waterStage: 0, witheredAt: null })
      .where(eq(plotsTable.id, plot.id));

    // Award resources
    await tx
      .update(usersTable)
      .set({
        xp: newXp,
        coins: user.coins,
        level: newLevel,
        totalHarvests: user.totalHarvests + 1,
        totalCoinsEarned: user.totalCoinsEarned,
        totalXpEarned: user.totalXpEarned + xpGain,
        [cropField]: user[cropField] + crop.quantity,
      })
      .where(eq(usersTable.id, user.id));

    // Update inventory
    if (existingItem) {
      await tx
        .update(inventoryTable)
        .set({ quantity: existingItem.quantity + crop.quantity })
        .where(eq(inventoryTable.id, existingItem.id));
    } else {
      await tx
        .insert(inventoryTable)
        .values({ userId: user.id, itemType: plot.cropType!, quantity: crop.quantity });
    }
  });

  await incrementMissionProgress(user.id, "harvest_5", 1);
  await incrementMissionProgress(user.id, "harvest_10", 1);
  await incrementMissionProgress(user.id, "earn_coins_500", coinsGain);

  const [updatedUser] = await db.select().from(usersTable).where(eq(usersTable.id, user.id)).limit(1);

  res.json({
    cropType: plot.cropType,
    quantity: crop.quantity,
    coinsEarned: coinsGain,
    xpEarned: xpGain,
    levelUp,
    user: serializeUser(updatedUser),
  });
});

router.post("/water/:plotId", requireAuth, async (req, res) => {
  const user = req.user!;
  const plotId = parseInt(String(req.params.plotId), 10);

  const [plot] = await db
    .select()
    .from(plotsTable)
    .where(and(eq(plotsTable.id, plotId), eq(plotsTable.userId, user.id)))
    .limit(1);

  if (!plot) {
    res.status(404).json({ error: "Plot not found" });
    return;
  }

  const now = new Date();
  const state = derivePlotState(plot, now);

  if (state !== "needs_water") {
    res.status(400).json({ error: "Plot does not need water right now" });
    return;
  }

  const newWaterStage = (plot.waterStage ?? 0) + 1;

  await db.transaction(async (tx) => {
    await tx
      .update(plotsTable)
      .set({ wateredAt: now, waterStage: newWaterStage })
      .where(eq(plotsTable.id, plot.id));

    await tx
      .update(usersTable)
      .set({ totalWatered: user.totalWatered + 1 })
      .where(eq(usersTable.id, user.id));
  });

  await incrementMissionProgress(user.id, "water_3", 1);

  const [updatedPlot] = await db.select().from(plotsTable).where(eq(plotsTable.id, plot.id)).limit(1);
  res.json(serializePlot(updatedPlot, new Date()));
});

router.post("/harvest-all", requireAuth, async (req, res) => {
  const user = req.user!;
  const plots = await db.select().from(plotsTable).where(eq(plotsTable.userId, user.id));
  const now = new Date();

  const readyPlots = plots.filter((p) => {
    const s = derivePlotState(p, now);
    return s === "ready" || s === "withered";
  });

  if (readyPlots.length === 0) {
    res.json({ harvested: 0, totalCoins: 0, totalXp: 0, user: serializeUser(user) });
    return;
  }

  let totalCoins = 0;
  let totalXp = 0;
  let newCoins = user.coins;
  let newXp = user.xp;

  for (const plot of readyPlots) {
    const crop = store.crops[plot.cropType!];
    if (!crop) continue;
    const xpGain = Math.floor(crop.xpReward * (user.vipLevel > 0 ? (user.vipLevel === 1 ? 1.5 : user.vipLevel === 2 ? 2 : 3) : 1));
    totalCoins += crop.coinsPerHarvest;
    totalXp += xpGain;
    newCoins += crop.coinsPerHarvest;
    newXp += xpGain;
  }

  const newLevel = getLevelForXp(newXp);

  await db.transaction(async (tx) => {
    for (const plot of readyPlots) {
      await tx
        .update(plotsTable)
        .set({ state: "empty", cropType: null, plantedAt: null, readyAt: null, wateredAt: null, waterStage: 0, witheredAt: null })
        .where(eq(plotsTable.id, plot.id));

      const crop = store.crops[plot.cropType!];
      if (!crop) continue;
      const [existingItem] = await tx
        .select()
        .from(inventoryTable)
        .where(and(eq(inventoryTable.userId, user.id), eq(inventoryTable.itemType, plot.cropType!)))
        .limit(1);
      if (existingItem) {
        await tx.update(inventoryTable).set({ quantity: existingItem.quantity + crop.quantity }).where(eq(inventoryTable.id, existingItem.id));
      } else {
        await tx.insert(inventoryTable).values({ userId: user.id, itemType: plot.cropType!, quantity: crop.quantity });
      }
    }

    await tx
      .update(usersTable)
      .set({
        coins: newCoins,
        xp: newXp,
        level: newLevel,
        totalHarvests: user.totalHarvests + readyPlots.length,
        totalCoinsEarned: user.totalCoinsEarned + totalCoins,
        totalXpEarned: user.totalXpEarned + totalXp,
      })
      .where(eq(usersTable.id, user.id));
  });

  await incrementMissionProgress(user.id, "harvest_5", readyPlots.length);
  await incrementMissionProgress(user.id, "harvest_10", readyPlots.length);
  await incrementMissionProgress(user.id, "earn_coins_500", totalCoins);

  const [updatedUser] = await db.select().from(usersTable).where(eq(usersTable.id, user.id)).limit(1);

  res.json({ harvested: readyPlots.length, totalCoins, totalXp, user: serializeUser(updatedUser) });
});

router.post("/water-all", requireAuth, async (req, res) => {
  const user = req.user!;
  const plots = await db.select().from(plotsTable).where(eq(plotsTable.userId, user.id));
  const now = new Date();

  const thirstyPlots = plots.filter((p) => derivePlotState(p, now) === "needs_water");

  if (thirstyPlots.length === 0) {
    res.json({ watered: 0 });
    return;
  }

  await db.transaction(async (tx) => {
    for (const plot of thirstyPlots) {
      await tx
        .update(plotsTable)
        .set({ wateredAt: now, waterStage: (plot.waterStage ?? 0) + 1 })
        .where(eq(plotsTable.id, plot.id));
    }
    await tx
      .update(usersTable)
      .set({ totalWatered: user.totalWatered + thirstyPlots.length })
      .where(eq(usersTable.id, user.id));
  });

  await incrementMissionProgress(user.id, "water_3", thirstyPlots.length);

  res.json({ watered: thirstyPlots.length });
});

export default router;
