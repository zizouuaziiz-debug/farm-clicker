import { Router } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { usersTable, inventoryTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth.js";
import { validateBody } from "../middlewares/validateBody.js";
import { serializeUser } from "./auth.js";
import { store } from "../lib/config-store.js";
import { incrementMissionProgress } from "./missions.js";

const buySchema = z.object({
  cropType: z.string().min(1, "cropType is required"),
  quantity: z.number().int().min(1, "quantity must be at least 1"),
});

const sellSchema = z.object({
  itemType: z.string().min(1, "itemType is required"),
  quantity: z.number().int().min(1, "quantity must be at least 1"),
});

const router = Router();

router.get("/seeds", requireAuth, async (req, res) => {
  const seeds = Object.values(store.crops).map((c) => ({
    cropType: c.cropType,
    name: c.name,
    emoji: c.emoji,
    buyCost: c.buyCost,
    sellPrice: c.sellPrice,
    growTime: c.growTimeMs,
    waterNeeded: c.waterNeeded,
    requiredLevel: c.requiredLevel,
    xpReward: c.xpReward,
  }));
  res.json(seeds);
});

router.post("/buy", requireAuth, validateBody(buySchema), async (req, res) => {
  const user = req.user!;
  const { cropType, quantity } = req.body as { cropType?: string; quantity?: number };

  if (!cropType || !quantity || quantity < 1) {
    res.status(400).json({ error: "cropType and quantity are required" });
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

  const totalCost = crop.buyCost * quantity;
  if (user.coins < totalCost) {
    res.status(400).json({ error: "Not enough coins" });
    return;
  }

  const seedItemType = `${cropType}_seed`;

  const [existingItem] = await db
    .select()
    .from(inventoryTable)
    .where(and(eq(inventoryTable.userId, user.id), eq(inventoryTable.itemType, seedItemType)))
    .limit(1);

  await db.transaction(async (tx) => {
    await tx.update(usersTable).set({ coins: user.coins - totalCost }).where(eq(usersTable.id, user.id));
    if (existingItem) {
      await tx.update(inventoryTable).set({ quantity: existingItem.quantity + quantity }).where(eq(inventoryTable.id, existingItem.id));
    } else {
      await tx.insert(inventoryTable).values({ userId: user.id, itemType: seedItemType, quantity });
    }
  });

  await incrementMissionProgress(user.id, "buy_seeds_5", quantity);

  const [updatedUser] = await db.select().from(usersTable).where(eq(usersTable.id, user.id)).limit(1);

  res.json({ cropType, quantity, totalCost, user: serializeUser(updatedUser) });
});

router.post("/sell", requireAuth, validateBody(sellSchema), async (req, res) => {
  const user = req.user!;
  const { itemType, quantity } = req.body as { itemType?: string; quantity?: number };

  if (!itemType || !quantity || quantity < 1) {
    res.status(400).json({ error: "itemType and quantity are required" });
    return;
  }

  const crop = store.crops[itemType];
  if (!crop) {
    res.status(400).json({ error: "Unknown item type" });
    return;
  }

  const [existingItem] = await db
    .select()
    .from(inventoryTable)
    .where(and(eq(inventoryTable.userId, user.id), eq(inventoryTable.itemType, itemType)))
    .limit(1);

  if (!existingItem || existingItem.quantity < quantity) {
    res.status(400).json({ error: "Not enough items in inventory" });
    return;
  }

  const totalCoins = crop.sellPrice * quantity;

  await db.transaction(async (tx) => {
    await tx.update(inventoryTable).set({ quantity: existingItem.quantity - quantity }).where(eq(inventoryTable.id, existingItem.id));
    await tx.update(usersTable).set({ coins: user.coins + totalCoins, totalCoinsEarned: user.totalCoinsEarned + totalCoins }).where(eq(usersTable.id, user.id));
  });

  const [updatedUser] = await db.select().from(usersTable).where(eq(usersTable.id, user.id)).limit(1);

  res.json({ totalCoins, itemsSold: quantity, user: serializeUser(updatedUser) });
});

export default router;
