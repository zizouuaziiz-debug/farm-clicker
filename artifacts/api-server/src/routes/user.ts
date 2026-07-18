import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth.js";
import { serializeUser } from "./auth.js";
import { ENERGY_REFILL_COST } from "../lib/game-config.js";

const router = Router();

router.get("/me", requireAuth, async (req, res) => {
  res.json(serializeUser(req.user!));
});

router.post("/me/energy", requireAuth, async (req, res) => {
  const user = req.user!;
  if (user.energy >= user.maxEnergy) {
    res.status(400).json({ error: "Energy is already full" });
    return;
  }
  if (user.coins < ENERGY_REFILL_COST) {
    res.status(400).json({ error: "Not enough coins" });
    return;
  }
  const [updated] = await db
    .update(usersTable)
    .set({ coins: user.coins - ENERGY_REFILL_COST, energy: user.maxEnergy })
    .where(eq(usersTable.id, user.id))
    .returning();
  res.json(serializeUser(updated));
});

export default router;
