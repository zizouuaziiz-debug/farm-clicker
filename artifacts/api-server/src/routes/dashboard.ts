import { Router } from "express";
import { db } from "@workspace/db";
import { plotsTable, userMissionsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth.js";
import { derivePlotState } from "./farm.js";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  const user = req.user!;
  const today = new Date().toISOString().slice(0, 10);

  const [plots, _missions] = await Promise.all([
    db.select().from(plotsTable).where(eq(plotsTable.userId, user.id)),
    db.select().from(userMissionsTable).where(
      and(eq(userMissionsTable.userId, user.id), eq(userMissionsTable.missionDate, today))
    ),
  ]);

  const now = new Date();
  let readyToHarvest = 0;
  let needsWater = 0;

  for (const plot of plots) {
    const state = derivePlotState(plot, now);
    if (state === "ready" || state === "withered") readyToHarvest++;
    if (state === "needs_water") needsWater++;
  }

  const todayClaimed = user.lastDailyClaimAt
    ? user.lastDailyClaimAt.toISOString().slice(0, 10) === today
    : false;

  res.json({
    readyToHarvest,
    needsWater,
    todayClaimed,
    currentStreak: user.currentStreak,
    level: user.level,
    coins: user.coins,
    energy: user.energy,
    maxEnergy: user.maxEnergy,
  });
});

export default router;
